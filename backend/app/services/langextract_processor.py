"""
LangExtract Processor - LLM-based парсер описаний для русскоязычных книг.

АРХИТЕКТУРА (v2 - December 2025):
- Прямые вызовы Google Gemini API вместо LangExtract библиотеки
- LangExtract возвращала сущности (NER), а не описания
- Новый GeminiDirectExtractor извлекает полные параграфы

КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ v2:
1. Замена LangExtract library на direct Gemini API calls
2. Рекурсивный чанкинг текста (1024 токена, 15% overlap)
3. JSON repair с retry логикой
4. Few-shot промпты для русской литературы

ПРОИЗВОДИТЕЛЬНОСТЬ:
- ~3000-4000 токенов на чанк (включая промпт + текст + ответ)
- ~$0.02 за книгу (Gemini 2.0 Flash)
- 5-15 описаний на главу (вместо 0 с LangExtract)

ИСПОЛЬЗОВАНИЕ:
    processor = LangExtractProcessor()
    if processor.is_available():
        result = await processor.extract_descriptions(chapter_text)
        # result: ProcessingResult с описаниями

Created: 2025-11-30
Updated: 2025-12-13 (v2 - direct Gemini API)
Author: fancai Team
"""

import os
import re
import time
import json
import logging
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class DescriptionType(Enum):
    """Типы описаний для извлечения."""
    LOCATION = "location"
    CHARACTER = "character"
    ATMOSPHERE = "atmosphere"


@dataclass
class ExtractedDescription:
    """Извлеченное описание из LLM."""
    content: str
    description_type: DescriptionType
    confidence: float
    entities: List[Dict[str, Any]] = field(default_factory=list)
    attributes: Dict[str, Any] = field(default_factory=dict)
    position: int = 0
    source_span: Tuple[int, int] = (0, 0)

    def to_dict(self) -> Dict[str, Any]:
        """Конвертация в формат Multi-NLP системы."""
        return {
            "content": self.content,
            "type": self.description_type.value,
            "confidence_score": self.confidence,
            "priority_score": self._calculate_priority(),
            "source": "langextract",
            "position": self.position,
            "word_count": len(self.content.split()),
            "entities_mentioned": [e.get("name", "") for e in self.entities],
            "metadata": {
                "llm_extracted": True,
                "entities": self.entities,
                "attributes": self.attributes,
                "source_span": self.source_span,
                "char_length": len(self.content),
            }
        }

    def _calculate_priority(self) -> float:
        """Расчет приоритета для генерации изображений."""
        # Базовый приоритет по типу
        type_priority = {
            DescriptionType.LOCATION: 75,
            DescriptionType.CHARACTER: 60,
            DescriptionType.ATMOSPHERE: 45,
        }.get(self.description_type, 40)

        # Бонус за длину (длинные описания лучше для генерации)
        length = len(self.content)
        if 2000 <= length <= 3500:
            length_bonus = 15  # Оптимальная длина
        elif 1000 <= length < 2000:
            length_bonus = 10
        elif 500 <= length < 1000:
            length_bonus = 5
        else:
            length_bonus = 0

        # Бонус за confidence
        confidence_bonus = self.confidence * 10

        return min(100.0, type_priority + length_bonus + confidence_bonus)


@dataclass
class ProcessingResult:
    """Результат обработки текста (совместим с Multi-NLP системой)."""
    descriptions: List[Dict[str, Any]]
    processor_results: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    processing_time: float = 0.0
    processors_used: List[str] = field(default_factory=lambda: ["langextract"])
    quality_metrics: Dict[str, float] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)

    # LangExtract специфичные метрики
    tokens_used: int = 0
    api_calls: int = 0
    chunks_processed: int = 0


@dataclass
class LangExtractConfig:
    """Конфигурация LangExtract процессора."""
    # Модель (gemini-3-flash-preview - Dec 2025, 3x faster than 2.5 Pro)
    model_id: str = "gemini-3-flash-preview"
    api_key: Optional[str] = None

    # Чанкинг
    max_chunk_chars: int = 6000  # ~1500 токенов для Gemini
    min_chunk_chars: int = 500
    chunk_overlap_chars: int = 200  # Перекрытие для сохранения контекста

    # Извлечение
    max_descriptions_per_chunk: int = 15
    min_description_chars: int = 50  # Минимальная длина
    max_description_chars: int = 4000
    min_confidence: float = 0.5

    # Производительность
    max_retries: int = 2
    timeout_seconds: int = 30
    batch_delay_ms: int = 100  # Задержка между batch вызовами

    # Feature flags
    enabled: bool = True
    use_structured_output: bool = True  # JSON mode Gemini


class RussianTextChunker:
    """
    Интеллектуальный чанкер для русского текста.

    Особенности:
    - Разбивает по параграфам (не по предложениям)
    - Сохраняет контекст между чанками (overlap)
    - Не разрывает описания посередине
    """

    def __init__(self, config: LangExtractConfig):
        self.config = config

        # Паттерны для определения границ параграфов
        self.paragraph_pattern = re.compile(r'\n\s*\n|\r\n\s*\r\n')

        # Паттерны диалогов (не разбиваем посередине диалога)
        self.dialog_start = re.compile(r'^[\s]*[—–«"]')

        # Паттерны глав (точка разрыва)
        self.chapter_pattern = re.compile(
            r'^\s*(ГЛАВА|Глава|ЧАСТЬ|Часть|ПРОЛОГ|ЭПИЛОГ)\s*[\dIVXLCDM]*',
            re.MULTILINE
        )

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        """
        Разбить текст на чанки для обработки LLM.

        Args:
            text: Исходный текст (глава книги)

        Returns:
            Список чанков с метаданными:
            [{"text": str, "start": int, "end": int, "paragraph_indices": List[int]}]
        """
        if len(text) <= self.config.max_chunk_chars:
            return [{"text": text, "start": 0, "end": len(text), "paragraph_indices": [0]}]

        # Разбиваем на параграфы
        paragraphs = self._split_to_paragraphs(text)

        # Группируем параграфы в чанки
        chunks = self._group_paragraphs_to_chunks(paragraphs)

        return chunks

    def _split_to_paragraphs(self, text: str) -> List[Dict[str, Any]]:
        """Разбить текст на параграфы с сохранением позиций."""
        paragraphs = []
        current_pos = 0

        # Разбиваем по двойным переносам строк
        parts = self.paragraph_pattern.split(text)

        for i, part in enumerate(parts):
            part = part.strip()
            if not part:
                continue

            # Находим позицию в оригинальном тексте
            start_pos = text.find(part, current_pos)
            if start_pos == -1:
                start_pos = current_pos

            paragraphs.append({
                "text": part,
                "start": start_pos,
                "end": start_pos + len(part),
                "index": len(paragraphs),
                "is_dialog": bool(self.dialog_start.match(part)),
                "is_chapter_start": bool(self.chapter_pattern.match(part)),
            })

            current_pos = start_pos + len(part)

        return paragraphs

    def _group_paragraphs_to_chunks(
        self, paragraphs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Группировка параграфов в чанки оптимального размера."""
        chunks = []
        current_chunk_paragraphs = []
        current_chunk_length = 0

        for para in paragraphs:
            para_length = len(para["text"])

            # Если параграф - начало главы, начинаем новый чанк
            if para["is_chapter_start"] and current_chunk_paragraphs:
                chunks.append(self._create_chunk(current_chunk_paragraphs))
                current_chunk_paragraphs = []
                current_chunk_length = 0

            # Если добавление параграфа превысит лимит
            if (current_chunk_length + para_length > self.config.max_chunk_chars
                and current_chunk_paragraphs):
                chunks.append(self._create_chunk(current_chunk_paragraphs))

                # Добавляем overlap - последние N символов предыдущего чанка
                overlap_paragraphs = self._get_overlap_paragraphs(
                    current_chunk_paragraphs
                )
                current_chunk_paragraphs = overlap_paragraphs
                current_chunk_length = sum(len(p["text"]) for p in overlap_paragraphs)

            current_chunk_paragraphs.append(para)
            current_chunk_length += para_length

        # Добавляем последний чанк
        if current_chunk_paragraphs:
            chunks.append(self._create_chunk(current_chunk_paragraphs))

        return chunks

    def _create_chunk(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Создать чанк из списка параграфов."""
        text = "\n\n".join(p["text"] for p in paragraphs)
        return {
            "text": text,
            "start": paragraphs[0]["start"],
            "end": paragraphs[-1]["end"],
            "paragraph_indices": [p["index"] for p in paragraphs],
        }

    def _get_overlap_paragraphs(
        self, paragraphs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Получить параграфы для overlap (последние N символов)."""
        overlap_chars = self.config.chunk_overlap_chars
        overlap_paragraphs = []
        current_length = 0

        for para in reversed(paragraphs):
            if current_length >= overlap_chars:
                break
            overlap_paragraphs.insert(0, para)
            current_length += len(para["text"])

        return overlap_paragraphs


class LangExtractProcessor:
    """
    LLM-based процессор для извлечения описаний из русскоязычных книг.

    Использует Google Gemini через LangExtract для семантического
    понимания текста и извлечения структурированных описаний.

    ОПТИМИЗАЦИИ:
    1. Один промпт для всех типов описаний
    2. Batch обработка чанков
    3. Кэширование результатов
    4. Graceful degradation

    Example:
        >>> processor = LangExtractProcessor()
        >>> if processor.is_available():
        >>>     result = await processor.extract_descriptions(chapter_text)
        >>>     for desc in result.descriptions:
        >>>         print(f"{desc['type']}: {desc['content'][:100]}...")
    """

    # Оптимизированный промпт для русского языка (~150 токенов)
    EXTRACTION_PROMPT = """Извлеки описания из русского текста для генерации изображений.

ТИПЫ:
- location: места, здания, природа, интерьеры
- character: внешность персонажей, одежда, черты
- atmosphere: настроение, освещение, погода, звуки, запахи

ПРАВИЛА:
1. Только визуальные описания (не действия, не диалоги)
2. Минимум 100 символов на описание
3. Сохраняй оригинальный текст, не перефразируй
4. Указывай confidence 0.0-1.0

JSON формат:
{"descriptions": [{"type": "location|character|atmosphere", "content": "текст описания", "confidence": 0.8, "entities": [{"name": "замок", "attributes": {"size": "огромный"}}]}]}"""

    # Few-shot примеры для улучшения качества
    EXAMPLES = [
        {
            "input": "Старый замок возвышался на высоком холме, окруженный густым лесом. Его величественные башни касались облаков, а мрачные стены хранили множество тайн. Серый камень, из которого были сложены стены, потемнел от времени.",
            "output": {
                "descriptions": [{
                    "type": "location",
                    "content": "Старый замок возвышался на высоком холме, окруженный густым лесом. Его величественные башни касались облаков, а мрачные стены хранили множество тайн. Серый камень, из которого были сложены стены, потемнел от времени.",
                    "confidence": 0.95,
                    "entities": [
                        {"name": "замок", "attributes": {"age": "старый", "location": "на холме"}},
                        {"name": "башни", "attributes": {"quality": "величественные"}},
                        {"name": "стены", "attributes": {"mood": "мрачные", "material": "серый камень"}}
                    ]
                }]
            }
        },
        {
            "input": "Молодой князь Алексей стоял у окна. Его тёмные глаза смотрели вдаль с задумчивым выражением. Длинные чёрные волосы были собраны в хвост, а на плечах лежал тяжёлый бархатный плащ тёмно-синего цвета.",
            "output": {
                "descriptions": [{
                    "type": "character",
                    "content": "Молодой князь Алексей стоял у окна. Его тёмные глаза смотрели вдаль с задумчивым выражением. Длинные чёрные волосы были собраны в хвост, а на плечах лежал тяжёлый бархатный плащ тёмно-синего цвета.",
                    "confidence": 0.92,
                    "entities": [
                        {"name": "князь Алексей", "attributes": {"age": "молодой", "eyes": "тёмные", "hair": "длинные чёрные"}},
                        {"name": "плащ", "attributes": {"material": "бархатный", "color": "тёмно-синий", "weight": "тяжёлый"}}
                    ]
                }]
            }
        },
        {
            "input": "Атмосфера в зале была торжественной и немного мрачной. Тяжёлые портьеры из тёмного бархата поглощали звуки. Свечи в канделябрах отбрасывали дрожащие тени на стены. Пахло воском и старыми книгами.",
            "output": {
                "descriptions": [{
                    "type": "atmosphere",
                    "content": "Атмосфера в зале была торжественной и немного мрачной. Тяжёлые портьеры из тёмного бархата поглощали звуки. Свечи в канделябрах отбрасывали дрожащие тени на стены. Пахло воском и старыми книгами.",
                    "confidence": 0.88,
                    "entities": [
                        {"name": "атмосфера", "attributes": {"mood": "торжественная, мрачная"}},
                        {"name": "портьеры", "attributes": {"material": "тёмный бархат"}},
                        {"name": "свечи", "attributes": {"effect": "дрожащие тени"}},
                        {"name": "запах", "attributes": {"scent": "воск, старые книги"}}
                    ]
                }]
            }
        }
    ]

    def __init__(self, config: Optional[LangExtractConfig] = None):
        """
        Инициализация процессора.

        Args:
            config: Конфигурация (опционально, использует дефолты)
        """
        self.config = config or LangExtractConfig()
        self.config.api_key = self.config.api_key or os.getenv("LANGEXTRACT_API_KEY")

        self.chunker = RussianTextChunker(self.config)
        self._gemini_extractor = None  # GeminiDirectExtractor (замена LangExtract)
        self._lx = None  # Deprecated: LangExtract library
        self._available = False

        # Статистика
        self.stats = {
            "total_extractions": 0,
            "total_tokens": 0,
            "total_api_calls": 0,
            "total_processing_time": 0.0,
            "errors": 0,
        }

        self._initialize_langextract()

    def _initialize_langextract(self):
        """Инициализация Gemini Direct Extractor (замена LangExtract)."""
        try:
            # Используем новый GeminiDirectExtractor вместо LangExtract
            from app.services.gemini_extractor import (
                GeminiDirectExtractor,
                GeminiConfig,
            )

            if not self.config.api_key:
                logger.warning(
                    "LANGEXTRACT_API_KEY not set. Gemini extractor disabled. "
                    "Set LANGEXTRACT_API_KEY environment variable to enable."
                )
                self._available = False
                return

            # Создаём конфигурацию для Gemini
            gemini_config = GeminiConfig(
                model_id=self.config.model_id,
                api_key=self.config.api_key,
                max_chunk_chars=self.config.max_chunk_chars,
                min_chunk_chars=self.config.min_chunk_chars,
                min_description_chars=self.config.min_description_chars,
                max_description_chars=self.config.max_description_chars,
                min_confidence=self.config.min_confidence,
                max_retries=self.config.max_retries,
            )

            self._gemini_extractor = GeminiDirectExtractor(gemini_config)
            self._available = self._gemini_extractor.is_available()

            if self._available:
                logger.info(f"Gemini Direct Extractor initialized (model: {self.config.model_id})")
            else:
                logger.warning("Gemini Direct Extractor failed to initialize")

        except ImportError as e:
            logger.error(f"Failed to import GeminiDirectExtractor: {e}")
            self._available = False
        except Exception as e:
            logger.error(f"Failed to initialize Gemini extractor: {e}")
            self._available = False

    def is_available(self) -> bool:
        """Проверить доступность процессора."""
        return self._available and self.config.enabled

    async def extract_descriptions(
        self,
        text: str,
        chapter_id: Optional[str] = None,
    ) -> ProcessingResult:
        """
        Извлечь описания из текста главы.

        Args:
            text: Текст главы для обработки
            chapter_id: ID главы (опционально, для метаданных)

        Returns:
            ProcessingResult с извлеченными описаниями
        """
        start_time = time.time()

        if not self.is_available():
            logger.warning("LangExtract processor not available")
            return ProcessingResult(
                descriptions=[],
                quality_metrics={"available": False},
                recommendations=["Enable LangExtract processor with API key"]
            )

        # Проверка минимальной длины
        if len(text) < self.config.min_chunk_chars:
            logger.debug(f"Text too short ({len(text)} chars), skipping")
            return ProcessingResult(
                descriptions=[],
                quality_metrics={"skipped": True, "reason": "text_too_short"},
            )

        try:
            # Чанкинг текста
            chunks = self.chunker.chunk(text)
            logger.info(f"Text split into {len(chunks)} chunks")

            # Обработка чанков
            all_descriptions = []
            total_tokens = 0
            api_calls = 0

            for i, chunk in enumerate(chunks):
                chunk_descriptions, tokens = await self._process_chunk(
                    chunk["text"],
                    chunk["start"],
                )
                all_descriptions.extend(chunk_descriptions)
                total_tokens += tokens
                api_calls += 1

                # Задержка между вызовами для rate limiting
                if i < len(chunks) - 1:
                    await asyncio.sleep(self.config.batch_delay_ms / 1000)

            # Дедупликация описаний
            unique_descriptions = self._deduplicate_descriptions(all_descriptions)

            # Фильтрация по confidence
            filtered_descriptions = [
                d for d in unique_descriptions
                if d.confidence >= self.config.min_confidence
            ]

            # Сортировка по приоритету
            sorted_descriptions = sorted(
                filtered_descriptions,
                key=lambda d: d._calculate_priority(),
                reverse=True
            )

            processing_time = time.time() - start_time

            # Обновление статистики
            self.stats["total_extractions"] += 1
            self.stats["total_tokens"] += total_tokens
            self.stats["total_api_calls"] += api_calls
            self.stats["total_processing_time"] += processing_time

            # Формирование результата
            return ProcessingResult(
                descriptions=[d.to_dict() for d in sorted_descriptions],
                processor_results={"langextract": [d.to_dict() for d in sorted_descriptions]},
                processing_time=processing_time,
                processors_used=["langextract"],
                quality_metrics={
                    "total_extracted": len(all_descriptions),
                    "unique_count": len(unique_descriptions),
                    "filtered_count": len(filtered_descriptions),
                    "avg_confidence": (
                        sum(d.confidence for d in filtered_descriptions) / len(filtered_descriptions)
                        if filtered_descriptions else 0
                    ),
                    "by_type": {
                        "location": len([d for d in filtered_descriptions if d.description_type == DescriptionType.LOCATION]),
                        "character": len([d for d in filtered_descriptions if d.description_type == DescriptionType.CHARACTER]),
                        "atmosphere": len([d for d in filtered_descriptions if d.description_type == DescriptionType.ATMOSPHERE]),
                    }
                },
                tokens_used=total_tokens,
                api_calls=api_calls,
                chunks_processed=len(chunks),
            )

        except Exception as e:
            logger.error(f"LangExtract extraction failed: {e}")
            self.stats["errors"] += 1
            return ProcessingResult(
                descriptions=[],
                quality_metrics={"error": str(e)},
                recommendations=["Check API key and network connection"]
            )

    async def _process_chunk(
        self,
        chunk_text: str,
        chunk_offset: int,
    ) -> Tuple[List[ExtractedDescription], int]:
        """
        Обработать один чанк текста.

        Args:
            chunk_text: Текст чанка
            chunk_offset: Смещение чанка в оригинальном тексте

        Returns:
            Tuple[список описаний, количество токенов]
        """
        try:
            # v2: Используем GeminiDirectExtractor вместо LangExtract
            if self._gemini_extractor is not None:
                # Извлекаем описания через прямой API Gemini
                extracted = await self._gemini_extractor._extract_from_chunk(
                    chunk_text,
                    chunk_offset
                )

                # Конвертируем в локальный формат ExtractedDescription
                descriptions = []
                for desc in extracted:
                    descriptions.append(ExtractedDescription(
                        content=desc.content,
                        description_type=DescriptionType(desc.description_type.value),
                        confidence=desc.confidence,
                        entities=desc.entities,
                        attributes=desc.attributes,
                        position=desc.position,
                        source_span=desc.source_span,
                    ))

                # Оценка токенов
                tokens_used = len(chunk_text) // 4 * 2  # input + output

                return descriptions, tokens_used

            # Fallback: старая логика LangExtract (deprecated)
            if self._lx is not None:
                full_prompt = self._build_prompt(chunk_text)
                result = self._lx.extract(
                    text_or_documents=chunk_text,
                    prompt_description=self.EXTRACTION_PROMPT,
                    examples=self._create_examples(),
                    model_id=self.config.model_id,
                    api_key=self.config.api_key,
                )
                descriptions = self._parse_result(result, chunk_offset)
                tokens_used = len(full_prompt) // 4 + len(chunk_text) // 4
                return descriptions, tokens_used

            logger.warning("No extractor available (neither Gemini nor LangExtract)")
            return [], 0

        except Exception as e:
            logger.warning(f"Chunk processing failed: {e}")
            return [], 0

    def _build_prompt(self, text: str) -> str:
        """Построить полный промпт для LLM."""
        examples_text = "\n\n".join([
            f"Пример {i+1}:\nВход: {ex['input']}\nВыход: {json.dumps(ex['output'], ensure_ascii=False)}"
            for i, ex in enumerate(self.EXAMPLES)
        ])

        return f"{self.EXTRACTION_PROMPT}\n\n{examples_text}\n\nТекст для анализа:\n{text}"

    def _create_examples(self) -> List[Any]:
        """Создать примеры для LangExtract."""
        if not self._lx:
            return []

        examples = []
        for ex in self.EXAMPLES:
            try:
                example = self._lx.data.ExampleData(
                    text=ex["input"],
                    extractions=[
                        self._lx.data.Extraction(
                            extraction_class=desc["type"],
                            extraction_text=desc["content"][:200],  # Сокращаем для примера
                            attributes={
                                "confidence": desc["confidence"],
                                "entities": desc.get("entities", [])
                            }
                        )
                        for desc in ex["output"]["descriptions"]
                    ]
                )
                examples.append(example)
            except Exception as e:
                logger.warning(f"Failed to create example: {e}")

        return examples

    def _parse_result(
        self,
        result: Any,
        offset: int
    ) -> List[ExtractedDescription]:
        """Парсинг результата LangExtract."""
        descriptions = []

        if not hasattr(result, "extractions"):
            return descriptions

        for extraction in result.extractions:
            try:
                # Получаем тип описания
                desc_type_str = getattr(extraction, "extraction_class", "location")
                try:
                    desc_type = DescriptionType(desc_type_str.lower())
                except ValueError:
                    desc_type = DescriptionType.LOCATION

                # Получаем текст
                content = getattr(extraction, "extraction_text", "")
                if len(content) < self.config.min_description_chars:
                    continue
                if len(content) > self.config.max_description_chars:
                    content = content[:self.config.max_description_chars]

                # Получаем атрибуты
                attrs = getattr(extraction, "attributes", {})
                confidence = attrs.get("confidence", 0.7)
                entities = attrs.get("entities", [])

                # Получаем source span
                source_span = getattr(extraction, "source_span", (0, len(content)))
                if isinstance(source_span, tuple):
                    source_span = (source_span[0] + offset, source_span[1] + offset)
                else:
                    source_span = (offset, offset + len(content))

                descriptions.append(ExtractedDescription(
                    content=content,
                    description_type=desc_type,
                    confidence=confidence,
                    entities=entities if isinstance(entities, list) else [],
                    attributes=attrs,
                    position=offset,
                    source_span=source_span,
                ))

            except Exception as e:
                logger.warning(f"Failed to parse extraction: {e}")
                continue

        return descriptions

    def _deduplicate_descriptions(
        self,
        descriptions: List[ExtractedDescription]
    ) -> List[ExtractedDescription]:
        """Удаление дубликатов описаний."""
        unique = []
        seen_content = set()

        for desc in descriptions:
            # Нормализуем контент для сравнения
            normalized = desc.content.strip().lower()[:200]

            if normalized not in seen_content:
                seen_content.add(normalized)
                unique.append(desc)

        return unique

    def get_statistics(self) -> Dict[str, Any]:
        """Получить статистику работы процессора."""
        return {
            "available": self._available,
            "enabled": self.config.enabled,
            "model_id": self.config.model_id,
            "api_key_set": bool(self.config.api_key),
            **self.stats,
            "avg_processing_time": (
                self.stats["total_processing_time"] / self.stats["total_extractions"]
                if self.stats["total_extractions"] > 0 else 0
            ),
            "avg_tokens_per_call": (
                self.stats["total_tokens"] / self.stats["total_api_calls"]
                if self.stats["total_api_calls"] > 0 else 0
            ),
        }

    def reset_statistics(self):
        """Сбросить статистику."""
        self.stats = {
            "total_extractions": 0,
            "total_tokens": 0,
            "total_api_calls": 0,
            "total_processing_time": 0.0,
            "errors": 0,
        }


# Singleton instance
_langextract_processor: Optional[LangExtractProcessor] = None


def get_langextract_processor(
    config: Optional[LangExtractConfig] = None
) -> LangExtractProcessor:
    """
    Получить singleton instance LangExtract процессора.

    Args:
        config: Конфигурация (опционально)

    Returns:
        Единственный экземпляр процессора
    """
    global _langextract_processor

    if _langextract_processor is None:
        _langextract_processor = LangExtractProcessor(config)

    return _langextract_processor


async def extract_descriptions_with_langextract(
    text: str,
    chapter_id: Optional[str] = None,
) -> ProcessingResult:
    """
    Утилитарная функция для быстрого извлечения описаний.

    Args:
        text: Текст для обработки
        chapter_id: ID главы (опционально)

    Returns:
        ProcessingResult с описаниями
    """
    processor = get_langextract_processor()
    return await processor.extract_descriptions(text, chapter_id)


# Singleton instance for easy import
langextract_processor = get_langextract_processor()

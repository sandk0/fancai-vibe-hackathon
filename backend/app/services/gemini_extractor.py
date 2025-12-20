"""
Gemini Direct Extractor - Прямые вызовы Google Gemini API для извлечения описаний.

ЗАМЕНА LangExtract библиотеки:
- LangExtract возвращает сущности (NER) вместо описаний
- Этот модуль использует direct API calls для получения полных параграфов

АРХИТЕКТУРА:
- google-generativeai SDK для прямого доступа к Gemini
- Few-shot промпты для русской литературы
- JSON repair с retry логикой
- Рекурсивный чанкинг текста

Created: 2025-12-13
Author: BookReader AI Team
"""

import os
import re
import json
import time
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
            "source": "gemini_direct",
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
        type_priority = {
            DescriptionType.LOCATION: 75,
            DescriptionType.CHARACTER: 60,
            DescriptionType.ATMOSPHERE: 45,
        }.get(self.description_type, 40)

        length = len(self.content)
        if 200 <= length <= 500:
            length_bonus = 15
        elif 100 <= length < 200:
            length_bonus = 10
        elif 500 < length <= 1000:
            length_bonus = 5
        else:
            length_bonus = 0

        confidence_bonus = self.confidence * 10
        return min(100.0, type_priority + length_bonus + confidence_bonus)


@dataclass
class GeminiConfig:
    """Конфигурация Gemini экстрактора."""
    model_id: str = "gemini-3-flash-preview"  # Dec 2025: gemini-3-flash-preview (not 3.0)
    api_key: Optional[str] = None

    # Чанкинг
    max_chunk_chars: int = 4000  # ~1000 токенов
    min_chunk_chars: int = 200
    chunk_overlap_percent: float = 0.15  # 15% перекрытие

    # Извлечение
    max_descriptions_per_chunk: int = 10
    min_description_chars: int = 100
    max_description_chars: int = 1000
    min_confidence: float = 0.6

    # Retry логика
    max_retries: int = 3
    retry_delay_seconds: float = 1.0
    timeout_seconds: int = 30


class RecursiveTextChunker:
    """
    Рекурсивный чанкер текста.

    Разбивает текст по иерархии разделителей:
    1. Двойные переносы (параграфы)
    2. Одинарные переносы
    3. Точки с пробелом (предложения)
    4. Пробелы (слова)
    """

    def __init__(self, config: GeminiConfig):
        self.config = config
        self.separators = ["\n\n", "\n", ". ", " "]

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        """
        Разбить текст на чанки.

        Returns:
            Список чанков: [{"text": str, "start": int, "end": int}]
        """
        if len(text) <= self.config.max_chunk_chars:
            return [{"text": text, "start": 0, "end": len(text)}]

        return self._recursive_split(text, 0, self.separators)

    def _recursive_split(
        self,
        text: str,
        offset: int,
        separators: List[str]
    ) -> List[Dict[str, Any]]:
        """Рекурсивное разбиение текста."""
        if len(text) <= self.config.max_chunk_chars:
            return [{"text": text, "start": offset, "end": offset + len(text)}]

        if not separators:
            # Fallback: разбиваем по символам
            chunks = []
            for i in range(0, len(text), self.config.max_chunk_chars):
                chunk_text = text[i:i + self.config.max_chunk_chars]
                chunks.append({
                    "text": chunk_text,
                    "start": offset + i,
                    "end": offset + i + len(chunk_text)
                })
            return self._add_overlap(chunks, text, offset)

        separator = separators[0]
        parts = text.split(separator)

        # Если разбиение не помогло, переходим к следующему разделителю
        if len(parts) == 1:
            return self._recursive_split(text, offset, separators[1:])

        # Группируем части в чанки
        chunks = []
        current_chunk = ""
        current_start = offset

        for i, part in enumerate(parts):
            part_with_sep = part + (separator if i < len(parts) - 1 else "")

            if len(current_chunk) + len(part_with_sep) > self.config.max_chunk_chars:
                if current_chunk:
                    chunks.append({
                        "text": current_chunk.strip(),
                        "start": current_start,
                        "end": current_start + len(current_chunk.strip())
                    })

                # Если часть слишком большая, разбиваем рекурсивно
                if len(part_with_sep) > self.config.max_chunk_chars:
                    sub_chunks = self._recursive_split(
                        part_with_sep,
                        current_start + len(current_chunk),
                        separators[1:]
                    )
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                    current_start = sub_chunks[-1]["end"] if sub_chunks else current_start
                else:
                    current_chunk = part_with_sep
                    current_start = current_start + len(current_chunk) - len(part_with_sep)
            else:
                current_chunk += part_with_sep

        if current_chunk.strip():
            chunks.append({
                "text": current_chunk.strip(),
                "start": current_start,
                "end": current_start + len(current_chunk.strip())
            })

        return self._add_overlap(chunks, text, offset)

    def _add_overlap(
        self,
        chunks: List[Dict[str, Any]],
        original_text: str,
        offset: int
    ) -> List[Dict[str, Any]]:
        """Добавить перекрытие между чанками."""
        if len(chunks) <= 1:
            return chunks

        overlap_chars = int(self.config.max_chunk_chars * self.config.chunk_overlap_percent)

        for i in range(1, len(chunks)):
            prev_chunk = chunks[i - 1]
            curr_chunk = chunks[i]

            # Берём последние N символов предыдущего чанка
            overlap_text = prev_chunk["text"][-overlap_chars:]

            # Добавляем в начало текущего чанка
            curr_chunk["text"] = overlap_text + "\n\n" + curr_chunk["text"]
            curr_chunk["has_overlap"] = True

        return chunks


class JSONResponseParser:
    """
    Парсер JSON ответов от LLM с автоматическим исправлением.
    """

    @staticmethod
    def parse(response: str) -> Dict[str, Any]:
        """
        Парсинг ответа LLM с несколькими стратегиями.

        Args:
            response: Сырой ответ от LLM

        Returns:
            Распарсенный JSON или пустой результат
        """
        # Стратегия 1: Прямой парсинг
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Стратегия 2: Извлечение из markdown блока (более агрессивная очистка)
        # Сначала удаляем markdown код блоки
        cleaned = response.strip()
        if cleaned.startswith("```"):
            # Удаляем открывающий блок (```json или ```)
            cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned)
            # Удаляем закрывающий блок
            cleaned = re.sub(r'\n?```\s*$', '', cleaned)
            try:
                result = json.loads(cleaned)
                logger.debug(f"Parsed via markdown cleanup: {len(result.get('descriptions', []))} descriptions")
                return result
            except json.JSONDecodeError as e:
                logger.debug(f"Markdown cleanup parse failed: {e}")
                pass

        # Стратегия 2b: Стандартный regex для markdown блока
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Стратегия 3: Поиск JSON-подобной структуры
        json_match = re.search(r'\{[\s\S]*"descriptions"[\s\S]*\}', response)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                # Попытка исправить
                fixed = JSONResponseParser._fix_json(json_match.group())
                try:
                    return json.loads(fixed)
                except json.JSONDecodeError:
                    pass

        # Стратегия 4: Извлечение массива descriptions
        array_match = re.search(r'\[[\s\S]*\]', response)
        if array_match:
            try:
                descriptions = json.loads(array_match.group())
                return {"descriptions": descriptions}
            except json.JSONDecodeError:
                pass

        logger.warning(f"Failed to parse JSON response: {response[:200]}...")
        return {"descriptions": []}

    @staticmethod
    def _fix_json(text: str) -> str:
        """Попытка исправить невалидный JSON."""
        # Удаляем trailing commas
        text = re.sub(r',\s*}', '}', text)
        text = re.sub(r',\s*]', ']', text)

        # Заменяем одинарные кавычки на двойные
        text = re.sub(r"(?<=[{,:\[])\s*'([^']*?)'\s*(?=[},:\]])", r'"\1"', text)

        # Экранируем переносы строк в строках
        text = re.sub(r'(?<!\\)\n(?=[^"]*"[^"]*$)', r'\\n', text)

        return text


class GeminiDirectExtractor:
    """
    Прямой экстрактор описаний через Google Gemini API.

    Заменяет LangExtract библиотеку для получения полных описаний
    вместо коротких сущностей (NER).
    """

    # Промпт для извлечения описаний
    # Двойные скобки {{ }} экранированы для использования с .format()
    EXTRACTION_PROMPT = """Ты - эксперт по извлечению визуальных описаний из русской литературы для создания иллюстраций.

ЗАДАЧА: Найди и извлеки все визуальные описания из текста.

ТИПЫ ОПИСАНИЙ:
- location: места, здания, ландшафты, интерьеры, природа
- character: внешность персонажей, одежда, черты лица, поза
- atmosphere: настроение сцены, освещение, погода, звуки, запахи

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. Извлекай ПОЛНЫЕ параграфы описаний (минимум 100 символов)
2. Сохраняй ОРИГИНАЛЬНЫЙ текст автора без изменений
3. НЕ извлекай диалоги, действия, мысли персонажей
4. Каждое описание должно быть самодостаточным для создания изображения
5. confidence: 0.9+ для ярких детальных описаний, 0.7-0.9 для средних, 0.5-0.7 для базовых

ПРИМЕРЫ:

Текст: "Старый замок возвышался на высоком холме, окруженный густым лесом. Его величественные башни касались низких облаков, а мрачные стены хранили множество тайн."
Ответ:
{{"descriptions": [{{"type": "location", "content": "Старый замок возвышался на высоком холме, окруженный густым лесом. Его величественные башни касались низких облаков, а мрачные стены хранили множество тайн.", "confidence": 0.92, "entities": [{{"name": "замок", "attributes": {{"age": "старый", "setting": "на холме"}}}}]}}]}}

Текст: "Князь Алексей был высоким мужчиной с пронзительными серыми глазами. Длинные чёрные волосы обрамляли бледное лицо, а на плечах лежал тяжёлый плащ тёмно-синего бархата."
Ответ:
{{"descriptions": [{{"type": "character", "content": "Князь Алексей был высоким мужчиной с пронзительными серыми глазами. Длинные чёрные волосы обрамляли бледное лицо, а на плечах лежал тяжёлый плащ тёмно-синего бархата.", "confidence": 0.95, "entities": [{{"name": "князь Алексей", "attributes": {{"height": "высокий", "eyes": "серые пронзительные", "hair": "длинные чёрные"}}}}]}}]}}

Текст: "В зале царил полумрак. Тяжёлые бархатные портьеры поглощали последние лучи заходящего солнца. Пахло старыми книгами и восковыми свечами."
Ответ:
{{"descriptions": [{{"type": "atmosphere", "content": "В зале царил полумрак. Тяжёлые бархатные портьеры поглощали последние лучи заходящего солнца. Пахло старыми книгами и восковыми свечами.", "confidence": 0.88, "entities": [{{"name": "атмосфера", "attributes": {{"lighting": "полумрак", "scent": "старые книги, воск"}}}}]}}]}}

Теперь извлеки описания из следующего текста. Верни ТОЛЬКО валидный JSON без комментариев.

ТЕКСТ:
{text}

ОТВЕТ (только JSON):"""

    def __init__(self, config: Optional[GeminiConfig] = None):
        """Инициализация экстрактора."""
        self.config = config or GeminiConfig()
        self.config.api_key = self.config.api_key or os.getenv("LANGEXTRACT_API_KEY")

        self.chunker = RecursiveTextChunker(self.config)
        self.parser = JSONResponseParser()

        self._client = None  # google-genai Client
        self._model = None   # model ID string
        self._available = False

        # Статистика
        self.stats = {
            "total_calls": 0,
            "successful_calls": 0,
            "failed_calls": 0,
            "total_descriptions": 0,
            "total_tokens": 0,
            "total_time": 0.0,
        }

        self._initialize()

    def _initialize(self):
        """Инициализация Gemini API с новым google-genai SDK (December 2025)."""
        if not self.config.api_key:
            logger.warning("LANGEXTRACT_API_KEY not set. Gemini extractor disabled.")
            return

        try:
            from google import genai

            # Создаём клиент с новым SDK
            self._client = genai.Client(api_key=self.config.api_key)
            self._model = self.config.model_id

            self._available = True
            logger.info(f"Gemini extractor initialized (model: {self.config.model_id}, SDK: google-genai)")

        except ImportError:
            logger.error("google-genai not installed. Run: pip install google-genai")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")

    def is_available(self) -> bool:
        """Проверить доступность экстрактора."""
        return self._available

    async def extract(
        self,
        text: str,
        chapter_id: Optional[str] = None
    ) -> List[ExtractedDescription]:
        """
        Извлечь описания из текста.

        Args:
            text: Текст для обработки
            chapter_id: ID главы (для логирования)

        Returns:
            Список извлечённых описаний
        """
        if not self.is_available():
            logger.warning("Gemini extractor not available")
            return []

        if len(text) < self.config.min_chunk_chars:
            logger.debug(f"Text too short ({len(text)} chars)")
            return []

        start_time = time.time()
        all_descriptions = []

        # Разбиваем на чанки
        chunks = self.chunker.chunk(text)
        logger.info(f"Text split into {len(chunks)} chunks for extraction")

        for i, chunk in enumerate(chunks):
            try:
                chunk_descriptions = await self._extract_from_chunk(
                    chunk["text"],
                    chunk["start"]
                )
                all_descriptions.extend(chunk_descriptions)

                # Пауза между запросами для rate limiting
                if i < len(chunks) - 1:
                    await asyncio.sleep(0.1)

            except Exception as e:
                logger.warning(f"Chunk {i} extraction failed: {e}")
                self.stats["failed_calls"] += 1

        # Дедупликация
        unique_descriptions = self._deduplicate(all_descriptions)

        # Фильтрация по confidence
        filtered = [
            d for d in unique_descriptions
            if d.confidence >= self.config.min_confidence
        ]

        # Обновляем статистику
        self.stats["total_time"] += time.time() - start_time
        self.stats["total_descriptions"] += len(filtered)

        logger.info(
            f"Extracted {len(filtered)} descriptions from {len(chunks)} chunks "
            f"(chapter: {chapter_id})"
        )

        return filtered

    async def _extract_from_chunk(
        self,
        chunk_text: str,
        offset: int
    ) -> List[ExtractedDescription]:
        """Извлечь описания из одного чанка с новым google-genai SDK."""
        self.stats["total_calls"] += 1

        prompt = self.EXTRACTION_PROMPT.format(text=chunk_text)

        for attempt in range(self.config.max_retries):
            try:
                # Вызываем Gemini API с новым SDK (google-genai)
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self._client.models.generate_content(
                        model=self._model,
                        contents=prompt,
                        config={
                            "temperature": 0.3,
                            "top_p": 0.95,
                            "max_output_tokens": 4096,
                        }
                    )
                )

                response_text = response.text

                # Парсим JSON ответ
                parsed = self.parser.parse(response_text)

                # Конвертируем в ExtractedDescription
                descriptions = self._parse_descriptions(parsed, offset)

                self.stats["successful_calls"] += 1

                # Оценка токенов
                self.stats["total_tokens"] += len(prompt) // 4 + len(response_text) // 4

                return descriptions

            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                if attempt < self.config.max_retries - 1:
                    await asyncio.sleep(self.config.retry_delay_seconds * (attempt + 1))

        self.stats["failed_calls"] += 1
        return []

    def _parse_descriptions(
        self,
        parsed: Dict[str, Any],
        offset: int
    ) -> List[ExtractedDescription]:
        """Конвертация JSON в ExtractedDescription объекты."""
        descriptions = []

        for item in parsed.get("descriptions", []):
            try:
                content = item.get("content", "")

                # Проверяем минимальную длину
                if len(content) < self.config.min_description_chars:
                    continue

                # Ограничиваем максимальную длину
                if len(content) > self.config.max_description_chars:
                    content = content[:self.config.max_description_chars]

                # Определяем тип
                type_str = item.get("type", "location").lower()
                try:
                    desc_type = DescriptionType(type_str)
                except ValueError:
                    desc_type = DescriptionType.LOCATION

                # Получаем confidence
                confidence = float(item.get("confidence", 0.7))
                confidence = max(0.0, min(1.0, confidence))

                # Получаем entities
                entities = item.get("entities", [])
                if not isinstance(entities, list):
                    entities = []

                descriptions.append(ExtractedDescription(
                    content=content,
                    description_type=desc_type,
                    confidence=confidence,
                    entities=entities,
                    position=offset,
                    source_span=(offset, offset + len(content)),
                ))

            except Exception as e:
                logger.debug(f"Failed to parse description: {e}")
                continue

        return descriptions

    def _deduplicate(
        self,
        descriptions: List[ExtractedDescription]
    ) -> List[ExtractedDescription]:
        """Удаление дубликатов описаний."""
        unique = []
        seen = set()

        for desc in descriptions:
            # Нормализуем для сравнения
            key = desc.content.strip().lower()[:150]

            if key not in seen:
                seen.add(key)
                unique.append(desc)

        return unique

    def get_statistics(self) -> Dict[str, Any]:
        """Получить статистику."""
        return {
            "available": self._available,
            "model": self.config.model_id,
            **self.stats,
            "success_rate": (
                self.stats["successful_calls"] / self.stats["total_calls"]
                if self.stats["total_calls"] > 0 else 0
            ),
            "avg_descriptions_per_call": (
                self.stats["total_descriptions"] / self.stats["successful_calls"]
                if self.stats["successful_calls"] > 0 else 0
            ),
        }


# Singleton
_extractor: Optional[GeminiDirectExtractor] = None


def get_gemini_extractor(config: Optional[GeminiConfig] = None) -> GeminiDirectExtractor:
    """Получить singleton экстрактора."""
    global _extractor
    if _extractor is None:
        _extractor = GeminiDirectExtractor(config)
    return _extractor

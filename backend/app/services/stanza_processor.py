"""
Улучшенный Stanza процессор для комплексного синтаксического анализа русскоязычной литературы.
Stanza обеспечивает глубокий синтаксический анализ и может найти сложные описательные конструкции.
"""

import stanza
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from .enhanced_nlp_system import EnhancedNLPProcessor, ProcessorConfig, NLPProcessorType
from ..models.description import DescriptionType
from .nlp.utils.description_filter import filter_and_prioritize_descriptions
from .nlp.utils.type_mapper import (
    map_stanza_entity_to_description_type,
    determine_type_by_keywords,
)
from .nlp.utils.quality_scorer import (
    calculate_ner_confidence,
    calculate_dependency_confidence,
    calculate_morphological_descriptiveness,
)

logger = logging.getLogger(__name__)


class EnhancedStanzaProcessor(EnhancedNLPProcessor):
    """Улучшенный Stanza процессор с настройками для анализа художественной литературы."""

    def __init__(self, config: ProcessorConfig = None):
        super().__init__(config)
        self.processor_type = NLPProcessorType.STANZA

        # Stanza pipeline компоненты
        self.nlp = None

        # Специализированные настройки для Stanza
        self.stanza_config = self.config.custom_settings.get(
            "stanza",
            {
                "model_name": "ru",  # Русская модель
                "processors": ["tokenize", "pos", "lemma", "ner", "depparse"],
                "complex_syntax_analysis": True,
                "dependency_parsing": True,
                "literary_syntax_patterns": True,
                "description_dependency_types": [
                    "amod",
                    "nmod",
                    "acl",
                    "appos",
                ],  # Зависимости для описаний
            },
        )

    async def load_model(self):
        """Загружает Stanza модель с компонентами для литературного анализа."""
        try:
            logger.info("Loading Stanza model...")

            model_name = self.stanza_config.get("model_name", "ru")
            processors = self.stanza_config.get(
                "processors", ["tokenize", "pos", "lemma", "ner"]
            )

            # Проверяем доступность модели
            try:
                # Загружаем русскую модель с обходом проблемы PyTorch 2.6
                import torch

                # Временный обход для weights_only issue
                import functools

                original_load = torch.load
                torch.load = functools.partial(original_load, weights_only=False)

                self.nlp = stanza.Pipeline(
                    lang=model_name,
                    processors=processors,
                    download_method=None,  # Не скачиваем автоматически
                    verbose=False,
                )

                # Восстанавливаем оригинальную функцию
                torch.load = original_load

                self.model = self.nlp  # Сохраняем ссылку для базового класса
                self.loaded = True
                logger.info("✅ Stanza model loaded successfully")

            except Exception as download_error:
                logger.warning(f"Stanza model not available locally: {download_error}")

                # Попытка скачать модель
                try:
                    logger.info("Attempting to download Stanza Russian model...")
                    stanza.download(model_name, verbose=False)

                    # Применяем тот же обход после скачивания
                    import torch
                    import functools

                    original_load = torch.load
                    torch.load = functools.partial(original_load, weights_only=False)

                    self.nlp = stanza.Pipeline(
                        lang=model_name, processors=processors, verbose=False
                    )

                    torch.load = original_load

                    self.model = self.nlp  # Сохраняем ссылку для базового класса
                    self.loaded = True
                    logger.info("✅ Stanza model downloaded and loaded successfully")

                except Exception as e:
                    logger.error(f"Failed to download Stanza model: {e}")
                    self.loaded = False

        except Exception as e:
            logger.error(f"❌ Error loading Stanza model: {e}")
            self.loaded = False

    async def extract_descriptions(
        self, text: str, chapter_id: str = None
    ) -> List[Dict[str, Any]]:
        """Извлекает описания используя глубокий синтаксический анализ Stanza."""
        start_time = datetime.now()

        if not self.is_available():
            return []

        try:
            cleaned_text = self._clean_text(text)

            # Ограничиваем длину текста для Stanza (он медленнее)
            if len(cleaned_text) > 10000:
                cleaned_text = cleaned_text[:10000]

            doc = self.nlp(cleaned_text)
            descriptions = []

            # 1. Синтаксический анализ зависимостей для поиска описательных конструкций
            if self.stanza_config.get("dependency_parsing", True):
                dep_descriptions = await self._extract_dependency_descriptions(doc)
                descriptions.extend(dep_descriptions)

            # 2. NER анализ с контекстным обогащением
            ner_descriptions = await self._extract_ner_descriptions(doc)
            descriptions.extend(ner_descriptions)

            # 3. Комплексный синтаксический анализ предложений
            if self.stanza_config.get("complex_syntax_analysis", True):
                syntax_descriptions = await self._extract_complex_syntax_descriptions(
                    doc
                )
                descriptions.extend(syntax_descriptions)

            # 4. Морфологический анализ для литературных конструкций
            morph_descriptions = await self._extract_morphological_descriptions(doc)
            descriptions.extend(morph_descriptions)

            # Фильтрация и приоритизация
            filtered_descriptions = self._filter_and_prioritize_descriptions(
                descriptions
            )

            # Обновляем метрики
            processing_time = (datetime.now() - start_time).total_seconds()
            self._update_metrics(len(filtered_descriptions), processing_time, True)

            logger.info(
                f"Stanza extracted {len(filtered_descriptions)} descriptions in {processing_time:.2f}s"
            )
            return filtered_descriptions

        except Exception as e:
            logger.error(f"Error in Stanza processing: {e}")
            self._update_metrics(
                0, (datetime.now() - start_time).total_seconds(), False
            )
            return []

    async def _extract_dependency_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе синтаксических зависимостей."""
        descriptions = []
        target_deps = self.stanza_config.get(
            "description_dependency_types", ["amod", "nmod", "acl", "appos"]
        )

        for sentence in doc.sentences:
            # Ищем описательные зависимости
            for word in sentence.words:
                if word.deprel in target_deps:
                    # Находим головное слово и зависимое
                    head_word = sentence.words[word.head - 1] if word.head > 0 else word

                    # Определяем тип описания по части речи головного слова
                    desc_type = self._determine_type_by_pos_and_context(
                        head_word, word, sentence
                    )

                    # Расширяем контекст вокруг зависимости
                    extended_context = self._get_dependency_context(
                        sentence, word, head_word
                    )

                    if len(extended_context) >= self.config.min_description_length:
                        confidence = self._calculate_dependency_confidence(
                            word, head_word, sentence
                        )

                        if confidence >= self.config.confidence_threshold:
                            descriptions.append(
                                {
                                    "content": extended_context,
                                    "context": sentence.text,
                                    "type": desc_type,
                                    "confidence_score": confidence,
                                    "entities_mentioned": [head_word.text, word.text],
                                    "text_position_start": 0,  # Stanza не предоставляет char offsets
                                    "text_position_end": len(extended_context),
                                    "position": (
                                        sentence.sent_id
                                        if hasattr(sentence, "sent_id")
                                        else 0
                                    ),
                                    "word_count": len(extended_context.split()),
                                    "priority_score": confidence
                                    * 1.2,  # Синтаксические зависимости получают бонус
                                    "source": "stanza_dependency",
                                    "dependency_type": word.deprel,
                                    "syntactic_features": {
                                        "head_pos": head_word.pos,
                                        "dependent_pos": word.pos,
                                        "head_lemma": head_word.lemma,
                                        "dependent_lemma": word.lemma,
                                    },
                                }
                            )

        return descriptions

    async def _extract_ner_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе именованных сущностей Stanza."""
        descriptions = []

        for sentence in doc.sentences:
            # Stanza хранит NER информацию в entities
            for entity in sentence.ents:
                # Определяем тип описания
                desc_type = self._map_stanza_entity_to_description_type(entity.type)
                if not desc_type:
                    continue

                # Получаем расширенный контекст
                extended_context = self._get_entity_context(sentence, entity)
                confidence = self._calculate_ner_confidence(entity, sentence)

                if (
                    len(extended_context) >= self.config.min_description_length
                    and confidence >= self.config.confidence_threshold
                ):
                    descriptions.append(
                        {
                            "content": extended_context,
                            "context": sentence.text,
                            "type": desc_type,
                            "confidence_score": confidence,
                            "entities_mentioned": [entity.text],
                            "text_position_start": (
                                entity.start_char
                                if hasattr(entity, "start_char")
                                else 0
                            ),
                            "text_position_end": (
                                entity.end_char
                                if hasattr(entity, "end_char")
                                else len(entity.text)
                            ),
                            "position": 0,
                            "word_count": len(extended_context.split()),
                            "priority_score": confidence * 1.1,
                            "source": "stanza_ner",
                            "entity_type": entity.type,
                        }
                    )

        return descriptions

    async def _extract_complex_syntax_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе комплексного синтаксического анализа."""
        descriptions = []

        for sentence in doc.sentences:
            # Ищем сложные описательные конструкции
            syntax_patterns = self._find_complex_descriptive_patterns(sentence)

            for pattern in syntax_patterns:
                desc_type = pattern["type"]
                confidence = pattern["confidence"]
                content = pattern["content"]

                if (
                    len(content) >= self.config.min_description_length
                    and confidence >= self.config.confidence_threshold
                ):
                    descriptions.append(
                        {
                            "content": content,
                            "context": sentence.text,
                            "type": desc_type,
                            "confidence_score": confidence,
                            "entities_mentioned": pattern.get("entities", []),
                            "text_position_start": 0,
                            "text_position_end": len(content),
                            "position": 0,
                            "word_count": len(content.split()),
                            "priority_score": confidence * 1.0,
                            "source": "stanza_complex_syntax",
                            "syntax_pattern": pattern.get("pattern_type", "unknown"),
                        }
                    )

        return descriptions

    async def _extract_morphological_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе морфологического анализа."""
        descriptions = []

        for sentence in doc.sentences:
            # Анализируем морфологические особенности для поиска описаний
            morph_score = self._calculate_morphological_descriptiveness(sentence)

            if morph_score > 0.4:
                desc_type = self._determine_type_by_morphology(sentence)
                confidence = min(0.8, morph_score)

                if confidence >= self.config.confidence_threshold:
                    descriptions.append(
                        {
                            "content": sentence.text,
                            "context": sentence.text,
                            "type": desc_type,
                            "confidence_score": confidence,
                            "entities_mentioned": [],
                            "text_position_start": 0,
                            "text_position_end": len(sentence.text),
                            "position": 0,
                            "word_count": len(sentence.text.split()),
                            "priority_score": confidence
                            * 0.8,  # Морфология менее приоритетна
                            "source": "stanza_morphology",
                        }
                    )

        return descriptions

    def _determine_type_by_pos_and_context(
        self, head_word, dependent_word, sentence
    ) -> str:
        """Определяет тип описания по частям речи и контексту."""
        text_lower = sentence.text.lower()

        # Проверяем ключевые слова для разных типов
        if any(
            word in text_lower
            for word in ["дом", "здание", "место", "город", "лес", "поле"]
        ):
            return DescriptionType.LOCATION.value
        elif any(
            word in text_lower
            for word in ["человек", "девушка", "мужчина", "герой", "персонаж"]
        ):
            return DescriptionType.CHARACTER.value
        elif any(
            word in text_lower
            for word in ["атмосфера", "настроение", "воздух", "тишина"]
        ):
            return DescriptionType.ATMOSPHERE.value

        # По умолчанию используем части речи
        if head_word.pos in ["NOUN"] and dependent_word.pos in ["ADJ"]:
            return DescriptionType.OBJECT.value

        return DescriptionType.OBJECT.value

    def _get_dependency_context(
        self, sentence, word, head_word, context_window: int = 3
    ) -> str:
        """Получает контекст вокруг синтаксической зависимости."""
        # Находим индексы слов
        word_idx = word.id - 1
        head_idx = head_word.id - 1

        # Определяем окно контекста
        min_idx = max(0, min(word_idx, head_idx) - context_window)
        max_idx = min(len(sentence.words), max(word_idx, head_idx) + context_window + 1)

        # Собираем контекст
        context_words = []
        for i in range(min_idx, max_idx):
            context_words.append(sentence.words[i].text)

        return " ".join(context_words)

    def _calculate_dependency_confidence(self, word, head_word, sentence) -> float:
        """Вычисляет уверенность для синтаксической зависимости (использует shared utility)."""
        return calculate_dependency_confidence(
            dependency_type=word.deprel,
            head_pos=head_word.pos,
            dependent_pos=word.pos,
            sentence_length=len(sentence.words),
        )

    def _map_stanza_entity_to_description_type(self, entity_type: str) -> Optional[str]:
        """Сопоставляет тип сущности Stanza с типом описания (использует shared utility)."""
        return map_stanza_entity_to_description_type(entity_type)

    def _get_entity_context(self, sentence, entity, context_words: int = 5) -> str:
        """Получает контекст вокруг именованной сущности."""
        # Простая реализация - возвращаем всё предложение
        return sentence.text

    def _calculate_ner_confidence(self, entity, sentence) -> float:
        """Вычисляет уверенность для именованной сущности (использует shared utility)."""
        # Базовая уверенность выше для Stanza
        base_conf = calculate_ner_confidence(
            entity_text=entity.text, sentence_text=sentence.text
        )

        # Дополнительный бонус за тип сущности (специфично для Stanza)
        type_bonuses = {"PER": 0.1, "LOC": 0.15, "ORG": 0.05}
        bonus = type_bonuses.get(entity.type, 0)

        return min(1.0, base_conf + bonus)

    def _find_complex_descriptive_patterns(self, sentence) -> List[Dict[str, Any]]:
        """Находит сложные описательные синтаксические паттерны."""
        patterns = []

        # Поиск причастных и деепричастных оборотов
        for word in sentence.words:
            if word.pos in ["VERB"] and word.feats and "VerbForm=Part" in word.feats:
                # Найден причастный оборот
                pattern_text = self._extract_participial_phrase(sentence, word)
                if len(pattern_text) >= self.config.min_description_length:
                    patterns.append(
                        {
                            "type": DescriptionType.ATMOSPHERE.value,
                            "confidence": 0.6,
                            "content": pattern_text,
                            "pattern_type": "participial_phrase",
                            "entities": [word.text],
                        }
                    )

        # Поиск сложных именных групп
        noun_phrases = self._extract_complex_noun_phrases(sentence)
        for np in noun_phrases:
            if len(np["text"]) >= self.config.min_description_length:
                patterns.append(
                    {
                        "type": DescriptionType.OBJECT.value,
                        "confidence": 0.5,
                        "content": np["text"],
                        "pattern_type": "complex_noun_phrase",
                        "entities": np["entities"],
                    }
                )

        return patterns

    def _extract_participial_phrase(self, sentence, participle_word) -> str:
        """Извлекает причастный оборот."""
        # Упрощенная версия - берем контекст вокруг причастия
        word_idx = participle_word.id - 1
        start_idx = max(0, word_idx - 3)
        end_idx = min(len(sentence.words), word_idx + 4)

        phrase_words = []
        for i in range(start_idx, end_idx):
            phrase_words.append(sentence.words[i].text)

        return " ".join(phrase_words)

    def _extract_complex_noun_phrases(self, sentence) -> List[Dict[str, Any]]:
        """Извлекает сложные именные группы."""
        noun_phrases = []

        for word in sentence.words:
            if word.pos == "NOUN":
                # Ищем зависимые слова (определения, дополнения)
                dependents = []
                for other_word in sentence.words:
                    if other_word.head == word.id and other_word.pos in ["ADJ", "NOUN"]:
                        dependents.append(other_word)

                if len(dependents) >= 1:  # Есть хотя бы одно определение
                    # Формируем именную группу
                    np_words = [word] + dependents
                    np_words.sort(key=lambda x: x.id)

                    np_text = " ".join(w.text for w in np_words)
                    entities = [w.text for w in np_words]

                    noun_phrases.append({"text": np_text, "entities": entities})

        return noun_phrases

    def _calculate_morphological_descriptiveness(self, sentence) -> float:
        """Вычисляет описательность предложения по морфологии (использует shared utility)."""
        if not sentence.words:
            return 0.0

        total_words = len(sentence.words)
        adj_count = sum(1 for word in sentence.words if word.pos == "ADJ")
        adv_count = sum(1 for word in sentence.words if word.pos == "ADV")
        part_count = sum(
            1
            for word in sentence.words
            if word.pos == "VERB" and word.feats and "VerbForm=Part" in word.feats
        )

        return calculate_morphological_descriptiveness(
            adj_count=adj_count,
            adv_count=adv_count,
            participle_count=part_count,
            total_words=total_words,
        )

    def _determine_type_by_morphology(self, sentence) -> str:
        """Определяет тип описания по морфологическим признакам (использует shared utility)."""
        return determine_type_by_keywords(sentence.text)

    def _filter_and_prioritize_descriptions(
        self, descriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Фильтрует и приоритизирует описания (использует shared utility)."""
        return filter_and_prioritize_descriptions(
            descriptions,
            min_description_length=self.config.min_description_length,
            max_description_length=self.config.max_description_length,
            min_word_count=self.config.min_word_count,
            confidence_threshold=self.config.confidence_threshold,
            dedup_window_size=100,  # Stanza использует большее окно дедупликации
        )

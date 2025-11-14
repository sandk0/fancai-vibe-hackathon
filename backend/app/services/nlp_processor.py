"""
Улучшенный NLP процессор с поддержкой различных движков и настроек.
Поддерживает spaCy, Natasha и гибридный режим.
"""

import spacy
import re
from typing import List, Dict, Any
from enum import Enum

from ..models.description import DescriptionType
from .nlp.utils.text_cleaner import clean_text
from .nlp.utils.description_filter import filter_and_prioritize_descriptions
from .nlp.utils.type_mapper import (
    map_spacy_entity_to_description_type,
    map_natasha_entity_to_description_type,
)


class NLPProcessorType(Enum):
    """Поддерживаемые типы NLP процессоров."""

    SPACY = "spacy"
    NATASHA = "natasha"
    HYBRID = "hybrid"


class BaseNLPProcessor:
    """Базовый класс для NLP процессоров."""

    def __init__(self):
        self.processor_type = None
        self.loaded = False
        # Настройки (будут загружены из БД)
        self.min_description_length = 50
        self.max_description_length = 1000
        self.min_word_count = 10
        self.min_sentence_length = 30
        self.confidence_threshold = 0.3

    async def load_settings(self):
        """Загружает настройки из базы данных."""
        # NOTE: settings_manager removed as it depended on orphaned AdminSettings model
        # Using default values instead
        print("⚠️ Using default NLP settings (AdminSettings removed)")

    async def load_model(self):
        """Загружает модель процессора."""
        raise NotImplementedError

    def is_available(self) -> bool:
        """Проверяет доступность процессора."""
        return self.loaded

    def extract_descriptions(
        self, text: str, chapter_id: str = None
    ) -> List[Dict[str, Any]]:
        """Извлекает описания из текста."""
        raise NotImplementedError

    def _clean_text(self, text: str) -> str:
        """Очищает текст от лишних символов (использует shared utility)."""
        return clean_text(text)

    def _filter_and_prioritize(
        self, descriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Фильтрует и приоритизирует описания (использует shared utility)."""
        return filter_and_prioritize_descriptions(
            descriptions,
            min_description_length=self.min_description_length,
            max_description_length=self.max_description_length,
            min_word_count=self.min_word_count,
            confidence_threshold=self.confidence_threshold,
        )


class SpacyProcessor(BaseNLPProcessor):
    """spaCy процессор для NLP обработки."""

    def __init__(self):
        super().__init__()
        self.processor_type = NLPProcessorType.SPACY
        self.nlp = None
        self._model_loading = False
        self.model_name = "ru_core_news_lg"

    async def load_model(self, model_name: str = None):
        """Загружает spaCy модель."""
        if self._model_loading:
            return

        self._model_loading = True
        try:
            # Загружаем настройки из БД
            await self.load_settings()

            if model_name:
                self.model_name = model_name

            print(f"🔄 Loading spaCy model {self.model_name}...")
            self.nlp = spacy.load(self.model_name)
            self.loaded = True
            print(f"✅ spaCy model {self.model_name} loaded successfully")
        except OSError as e:
            print(f"⚠️ Warning: spaCy model {self.model_name} not found: {e}")
            # Пытаемся загрузить меньшую модель
            try:
                fallback_model = "ru_core_news_md"
                print(f"🔄 Trying fallback model {fallback_model}...")
                self.nlp = spacy.load(fallback_model)
                self.model_name = fallback_model
                self.loaded = True
                print(f"✅ Fallback spaCy model {fallback_model} loaded successfully")
            except OSError:
                print("❌ No spaCy models available")
                self.nlp = None
                self.loaded = False
        except Exception as e:
            print(f"❌ Error loading spaCy model: {e}")
            self.nlp = None
            self.loaded = False
        finally:
            self._model_loading = False

    def extract_descriptions(
        self, text: str, chapter_id: str = None
    ) -> List[Dict[str, Any]]:
        """Извлекает описания используя spaCy."""
        if not self.is_available():
            return []

        print(f"🔍 SpaCy: extracting descriptions from text (length: {len(text)})")

        # Очистка текста
        cleaned_text = self._clean_text(text)

        # Разбивка на предложения
        doc = self.nlp(cleaned_text)
        sentences = [
            sent.text.strip()
            for sent in doc.sents
            if len(sent.text.strip()) >= self.min_sentence_length
        ]

        descriptions = []

        for i, sentence in enumerate(sentences):
            # Анализ предложения на описания
            sentence_descriptions = self._analyze_sentence_spacy(
                sentence, i, cleaned_text
            )
            descriptions.extend(sentence_descriptions)

        # Фильтрация и приоритизация
        filtered_descriptions = self._filter_and_prioritize(descriptions)

        print(f"✅ SpaCy: extracted {len(filtered_descriptions)} descriptions")
        return filtered_descriptions

    def _analyze_sentence_spacy(
        self, sentence: str, position: int, full_text: str
    ) -> List[Dict[str, Any]]:
        """Анализирует предложение на предмет описаний используя spaCy."""
        doc = self.nlp(sentence)
        descriptions = []

        # Извлекаем именованные сущности
        for ent in doc.ents:
            desc_type = None
            confidence = 0.5

            # Используем shared type mapper
            desc_type = map_spacy_entity_to_description_type(ent.label_)

            # Устанавливаем confidence на основе типа
            if ent.label_ in ["LOC", "GPE", "FAC"]:
                confidence = 0.8
            elif ent.label_ in ["PERSON"]:
                confidence = 0.7
            elif ent.label_ in ["ORG"]:
                confidence = 0.6

            if desc_type:
                # Расширяем контекст вокруг сущности
                extended_context = self._get_extended_context(
                    sentence, ent.text, full_text
                )

                descriptions.append(
                    {
                        "content": extended_context,
                        "context": sentence,
                        "type": desc_type,
                        "confidence_score": confidence,
                        "entities_mentioned": ent.text,
                        "text_position_start": ent.start_char,
                        "text_position_end": ent.end_char,
                        "position": position,
                    }
                )

        # Дополнительный анализ на основе паттернов
        pattern_descriptions = self._extract_by_patterns(sentence, position)
        descriptions.extend(pattern_descriptions)

        return descriptions

    def _extract_by_patterns(
        self, sentence: str, position: int
    ) -> List[Dict[str, Any]]:
        """Извлекает описания на основе лингвистических паттернов."""
        descriptions = []

        # Паттерны для локаций
        location_patterns = [
            r"(?:в|на|около|возле|рядом с|перед|за|над|под)\s+([^,.!?]{10,100})",
            r"([^,.!?]{5,50})\s+(?:стоял|стояла|стояло|находился|находилась|находилось)",
            r"(?:дом|здание|замок|храм|дворец|башня|мост|лес|поле|горы?|река|море|озеро)\s+([^,.!?]{10,100})",
        ]

        for pattern in location_patterns:
            matches = re.finditer(pattern, sentence, re.IGNORECASE)
            for match in matches:
                content = match.group(0).strip()
                if len(content) >= self.min_description_length:
                    descriptions.append(
                        {
                            "content": content,
                            "context": sentence,
                            "type": DescriptionType.LOCATION.value,
                            "confidence_score": 0.6,
                            "entities_mentioned": (
                                match.group(1) if match.lastindex >= 1 else content
                            ),
                            "text_position_start": match.start(),
                            "text_position_end": match.end(),
                            "position": position,
                        }
                    )

        # Паттерны для персонажей
        character_patterns = [
            r"(?:он|она|оно|они)\s+(?:был|была|было|были)\s+([^,.!?]{10,100})",
            r"(?:мужчина|женщина|девушка|парень|старик|старуха)\s+([^,.!?]{10,100})",
        ]

        for pattern in character_patterns:
            matches = re.finditer(pattern, sentence, re.IGNORECASE)
            for match in matches:
                content = match.group(0).strip()
                if len(content) >= self.min_description_length:
                    descriptions.append(
                        {
                            "content": content,
                            "context": sentence,
                            "type": DescriptionType.CHARACTER.value,
                            "confidence_score": 0.5,
                            "entities_mentioned": (
                                match.group(1) if match.lastindex >= 1 else content
                            ),
                            "text_position_start": match.start(),
                            "text_position_end": match.end(),
                            "position": position,
                        }
                    )

        # Паттерны для атмосферы
        atmosphere_patterns = [
            r"(?:было|стало)\s+(?:темно|светло|холодно|жарко|тихо|шумно|туманно|ясно)\s*([^,.!?]{0,50})",
            r"(?:наступил|наступила|наступило)\s+(?:вечер|утро|ночь|день|рассвет|закат)\s*([^,.!?]{0,50})",
        ]

        for pattern in atmosphere_patterns:
            matches = re.finditer(pattern, sentence, re.IGNORECASE)
            for match in matches:
                content = match.group(0).strip()
                if len(content) >= self.min_description_length:
                    descriptions.append(
                        {
                            "content": content,
                            "context": sentence,
                            "type": DescriptionType.ATMOSPHERE.value,
                            "confidence_score": 0.7,
                            "entities_mentioned": (
                                match.group(1) if match.lastindex >= 1 else content
                            ),
                            "text_position_start": match.start(),
                            "text_position_end": match.end(),
                            "position": position,
                        }
                    )

        return descriptions

    def _get_extended_context(self, sentence: str, entity: str, full_text: str) -> str:
        """Получает расширенный контекст вокруг сущности."""
        # Пытаемся найти больше деталей вокруг сущности
        entity_pos = sentence.find(entity)
        if entity_pos == -1:
            return sentence

        # Берем предложение целиком, это и есть наш контекст
        return sentence


class NatashaProcessor(BaseNLPProcessor):
    """Natasha процессор для NLP обработки."""

    def __init__(self):
        super().__init__()
        self.processor_type = NLPProcessorType.NATASHA
        self.morph = None
        self.segmenter = None
        self.emb = None
        self.ner_tagger = None

    async def load_model(self):
        """Загружает Natasha модели."""
        try:
            print("🔄 Loading Natasha models...")

            # Загружаем настройки из БД
            await self.load_settings()

            # Попытка импорта и загрузки Natasha
            from natasha import (
                Segmenter,
                MorphVocab,
                NewsEmbedding,
                NewsNERTagger,
                Doc,  # noqa: F401
            )

            self.segmenter = Segmenter()
            MorphVocab()
            self.emb = NewsEmbedding()
            self.ner_tagger = NewsNERTagger(self.emb)

            self.loaded = True
            print("✅ Natasha models loaded successfully")

        except ImportError as e:
            print(f"⚠️ Natasha not available: {e}")
            self.loaded = False
        except Exception as e:
            print(f"❌ Error loading Natasha: {e}")
            self.loaded = False

    def extract_descriptions(
        self, text: str, chapter_id: str = None
    ) -> List[Dict[str, Any]]:
        """Извлекает описания используя Natasha."""
        if not self.is_available():
            return []

        print(f"🔍 Natasha: extracting descriptions from text (length: {len(text)})")

        try:
            from natasha import Doc

            # Очистка текста
            cleaned_text = self._clean_text(text)

            # Анализ с помощью Natasha
            doc = Doc(cleaned_text)
            doc.segment(self.segmenter)
            doc.tag_ner(self.ner_tagger)

            descriptions = []

            for i, sent in enumerate(doc.sents):
                sentence = sent.text
                if len(sentence) < self.min_sentence_length:
                    continue

                # Анализ именованных сущностей в предложении
                sentence_descriptions = self._analyze_sentence_natasha(
                    sentence, i, sent.spans
                )
                descriptions.extend(sentence_descriptions)

            # Фильтрация и приоритизация
            filtered_descriptions = self._filter_and_prioritize(descriptions)

            print(f"✅ Natasha: extracted {len(filtered_descriptions)} descriptions")
            return filtered_descriptions

        except Exception as e:
            print(f"❌ Error in Natasha processing: {e}")
            return []

    def _analyze_sentence_natasha(
        self, sentence: str, position: int, spans
    ) -> List[Dict[str, Any]]:
        """Анализирует предложение используя результаты Natasha NER."""
        descriptions = []

        for span in spans:
            desc_type = None
            confidence = 0.5

            # Используем shared type mapper
            desc_type = map_natasha_entity_to_description_type(span.type)

            # Устанавливаем confidence на основе типа
            if span.type == "LOC":
                confidence = 0.8
            elif span.type == "PER":
                confidence = 0.7
            elif span.type == "ORG":
                confidence = 0.6

            if desc_type:
                entity_text = sentence[span.start : span.stop]
                descriptions.append(
                    {
                        "content": sentence,  # Берем все предложение как контекст
                        "context": sentence,
                        "type": desc_type,
                        "confidence_score": confidence,
                        "entities_mentioned": entity_text,
                        "text_position_start": span.start,
                        "text_position_end": span.stop,
                        "position": position,
                    }
                )

        return descriptions


class NLPProcessor:
    """Главный NLP процессор с поддержкой различных движков."""

    def __init__(self):
        self.processors = {
            NLPProcessorType.SPACY: SpacyProcessor(),
            NLPProcessorType.NATASHA: NatashaProcessor(),
        }
        self.current_processor = None
        self.current_type = NLPProcessorType.SPACY  # По умолчанию

    async def initialize(
        self, processor_type: NLPProcessorType = None, model_name: str = None
    ):
        """Инициализирует NLP процессор."""
        if processor_type:
            self.current_type = processor_type

        # NOTE: settings_manager removed (depended on orphaned AdminSettings)
        # Using defaults or parameters
        if not model_name:
            model_name = "ru_core_news_lg"

        self.current_processor = self.processors[self.current_type]

        # Загружаем модель процессора
        if self.current_type == NLPProcessorType.SPACY:
            await self.current_processor.load_model(model_name)
        else:
            await self.current_processor.load_model()

        print(f"✅ NLP Processor initialized: {self.current_type.value}")

    def is_available(self) -> bool:
        """Проверяет доступность текущего процессора."""
        return self.current_processor and self.current_processor.is_available()

    def extract_descriptions_from_text(
        self, text: str, chapter_id: str = None
    ) -> List[Dict[str, Any]]:
        """Извлекает описания из текста используя текущий процессор."""
        if not self.is_available():
            print("❌ NLP processor not available")
            return []

        return self.current_processor.extract_descriptions(text, chapter_id)

    async def switch_processor(
        self, processor_type: NLPProcessorType, model_name: str = None
    ):
        """Переключает тип процессора."""
        if processor_type not in self.processors:
            raise ValueError(f"Unsupported processor type: {processor_type}")

        self.current_type = processor_type
        self.current_processor = self.processors[processor_type]

        if not self.current_processor.loaded:
            if processor_type == NLPProcessorType.SPACY:
                await self.current_processor.load_model(model_name)
            else:
                await self.current_processor.load_model()

        print(f"✅ Switched to NLP processor: {processor_type.value}")

    def get_available_models(self) -> Dict[str, List[str]]:
        """Возвращает список доступных моделей для каждого процессора."""
        return {
            "spacy": ["ru_core_news_lg", "ru_core_news_md", "ru_core_news_sm"],
            "natasha": ["default"],
        }

    def get_current_processor_info(self) -> Dict[str, Any]:
        """Возвращает информацию о текущем процессоре."""
        if not self.current_processor:
            return {"type": None, "loaded": False, "available": False}

        info = {
            "type": self.current_type.value,
            "loaded": self.current_processor.loaded,
            "available": self.current_processor.is_available(),
        }

        if self.current_type == NLPProcessorType.SPACY and hasattr(
            self.current_processor, "model_name"
        ):
            info["model"] = self.current_processor.model_name

        return info

    async def update_settings(self, settings: Dict[str, Any]):
        """Обновляет настройки NLP процессора."""
        print(f"🔧 [NLP] Updating settings: {settings}")

        # Переключение процессора если нужно
        processor_type = settings.get("processor_type")
        if processor_type:
            try:
                if processor_type == "spacy":
                    new_type = NLPProcessorType.SPACY
                elif processor_type == "natasha":
                    new_type = NLPProcessorType.NATASHA
                elif processor_type == "hybrid":
                    new_type = (
                        NLPProcessorType.SPACY
                    )  # Hybrid использует SpaCy как основу
                else:
                    print(f"⚠️ Unknown processor type: {processor_type}")
                    return

                if new_type != self.current_type:
                    await self.switch_processor(new_type)

            except Exception as e:
                print(f"❌ Failed to switch processor: {e}")

        # Обновление модели spaCy если нужно
        spacy_model = settings.get("spacy_model")
        if (
            spacy_model
            and self.current_type == NLPProcessorType.SPACY
            and hasattr(self.current_processor, "model_name")
        ):
            if self.current_processor.model_name != spacy_model:
                try:
                    await self.initialize(NLPProcessorType.SPACY, spacy_model)
                    print(f"✅ Switched to spaCy model: {spacy_model}")
                except Exception as e:
                    print(f"❌ Failed to switch spaCy model: {e}")

        print("✅ [NLP] Settings updated successfully")


# Создаем глобальный экземпляр процессора
nlp_processor = NLPProcessor()


async def initialize_nlp_processor():
    """Инициализирует глобальный NLP процессор."""
    await nlp_processor.initialize()

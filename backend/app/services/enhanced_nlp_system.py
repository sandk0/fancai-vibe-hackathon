"""
Улучшенная мульти-процессорная NLP система для извлечения качественных описаний из русскоязычной литературы.

Поддерживает:
- spaCy с множественными моделями 
- Natasha для русского языка
- Stanza для сложных конструкций
- NLTK для базового анализа
- PyMorphy3 для морфологии
- Гибридные режимы для максимального качества
"""

import asyncio
import spacy
import stanza
import nltk
from natasha import (
    Segmenter, MorphVocab, NewsEmbedding, NewsMorphTagger,
    NewsSyntaxParser, NewsNERTagger,
    PER, NamesExtractor, Doc
)
import pymorphy3
import re
from typing import List, Dict, Any, Optional, Union, Tuple
from enum import Enum
from dataclasses import dataclass
import logging
from datetime import datetime
import json

from ..models.description import DescriptionType

logger = logging.getLogger(__name__)


@dataclass
class ProcessorConfig:
    """Конфигурация для NLP процессора."""
    enabled: bool = True
    weight: float = 1.0  # Вес процессора при комбинировании результатов
    confidence_threshold: float = 0.3
    min_description_length: int = 50
    max_description_length: int = 1000
    min_word_count: int = 10
    custom_settings: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.custom_settings is None:
            self.custom_settings = {}


class NLPProcessorType(Enum):
    SPACY = "spacy"
    NATASHA = "natasha" 
    STANZA = "stanza"
    NLTK = "nltk"
    PYMORPHY = "pymorphy"
    HYBRID = "hybrid"
    ENSEMBLE = "ensemble"  # Комбинирует результаты всех процессоров


class EnhancedNLPProcessor:
    """Базовый класс для улучшенных NLP процессоров."""
    
    def __init__(self, config: ProcessorConfig = None):
        self.config = config or ProcessorConfig()
        self.processor_type = None
        self.loaded = False
        self.model = None
        self.performance_metrics = {
            'total_processed': 0,
            'avg_processing_time': 0.0,
            'success_rate': 0.0,
            'quality_score': 0.0
        }
    
    async def load_model(self):
        """Загружает модель процессора."""
        raise NotImplementedError
    
    async def extract_descriptions(self, text: str, chapter_id: str = None) -> List[Dict[str, Any]]:
        """Извлекает описания из текста."""
        raise NotImplementedError
    
    def is_available(self) -> bool:
        """Проверяет доступность процессора."""
        return self.loaded and self.model is not None
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Возвращает метрики производительности."""
        return self.performance_metrics.copy()
    
    def _clean_text(self, text: str) -> str:
        """Очищает текст от лишних символов."""
        # Удаляем лишние пробелы и переносы
        text = re.sub(r'\s+', ' ', text)
        # Удаляем специальные символы но оставляем пунктуацию
        text = re.sub(r'[^\w\s\.\,\!\?\;\:\-\—\«\»\"\'\(\)\[\]]', '', text)
        return text.strip()
    
    def _update_metrics(self, results_count: int, processing_time: float, success: bool):
        """Обновляет метрики производительности."""
        self.performance_metrics['total_processed'] += 1
        
        # Обновляем среднее время обработки
        current_avg = self.performance_metrics['avg_processing_time']
        new_avg = (current_avg * (self.performance_metrics['total_processed'] - 1) + processing_time) / self.performance_metrics['total_processed']
        self.performance_metrics['avg_processing_time'] = new_avg
        
        # Обновляем успешность
        if success:
            current_success_count = self.performance_metrics['success_rate'] * (self.performance_metrics['total_processed'] - 1)
            new_success_rate = (current_success_count + 1) / self.performance_metrics['total_processed']
            self.performance_metrics['success_rate'] = new_success_rate
    
    def _calculate_quality_score(self, descriptions: List[Dict[str, Any]]) -> float:
        """Вычисляет оценку качества извлеченных описаний."""
        if not descriptions:
            return 0.0
        
        total_score = 0.0
        for desc in descriptions:
            # Факторы качества
            length_score = min(1.0, len(desc['content']) / 200)  # Оптимальная длина ~200 символов
            confidence_score = desc.get('confidence_score', 0.5)
            word_variety = len(set(desc['content'].split())) / max(1, len(desc['content'].split()))
            
            desc_quality = (length_score * 0.3 + confidence_score * 0.5 + word_variety * 0.2)
            total_score += desc_quality
        
        return total_score / len(descriptions)


class EnhancedSpacyProcessor(EnhancedNLPProcessor):
    """Улучшенный spaCy процессор с настройками специально для русской литературы."""
    
    def __init__(self, config: ProcessorConfig = None):
        super().__init__(config)
        self.processor_type = NLPProcessorType.SPACY
        self.model_name = "ru_core_news_lg"
        self.nlp = None
        
        # Специализированные настройки для spaCy
        self.spacy_config = self.config.custom_settings.get('spacy', {
            'model_name': 'ru_core_news_lg',
            'disable_components': [],  # Компоненты для отключения (для ускорения)
            'entity_types': ['PERSON', 'LOC', 'GPE', 'FAC', 'ORG'],
            'literary_patterns': True,  # Включить литературные паттерны
            'character_detection_boost': 1.2,  # Увеличить вес для персонажей
            'location_detection_boost': 1.1,   # Увеличить вес для локаций
            'atmosphere_keywords': ['мрачный', 'светлый', 'таинственный', 'величественный', 'уютный']
        })
    
    async def load_model(self):
        """Загружает spaCy модель с оптимизациями для русской литературы."""
        try:
            model_name = self.spacy_config.get('model_name', 'ru_core_news_lg')
            disable = self.spacy_config.get('disable_components', [])
            
            logger.info(f"Loading spaCy model: {model_name}")
            self.nlp = spacy.load(model_name, disable=disable)
            self.model = self.nlp  # Сохраняем ссылку для базового класса
            
            # Добавляем кастомные паттерны для литературного анализа
            if self.spacy_config.get('literary_patterns', True):
                await self._add_literary_patterns()
            
            self.model_name = model_name
            self.loaded = True
            logger.info(f"✅ SpaCy model {model_name} loaded successfully")
            
        except OSError:
            # Пытаемся fallback модели
            fallback_models = ['ru_core_news_md', 'ru_core_news_sm']
            for fallback in fallback_models:
                try:
                    logger.info(f"Trying fallback spaCy model: {fallback}")
                    self.nlp = spacy.load(fallback)
                    self.model = self.nlp  # Сохраняем ссылку для базового класса
                    self.model_name = fallback
                    self.loaded = True
                    logger.info(f"✅ Loaded fallback spaCy model: {fallback}")
                    break
                except OSError:
                    continue
            else:
                logger.error("❌ No spaCy models available")
                self.loaded = False
        except Exception as e:
            logger.error(f"❌ Error loading spaCy model: {e}")
            self.loaded = False
    
    async def _add_literary_patterns(self):
        """Добавляет паттерны для анализа художественной литературы."""
        from spacy.matcher import Matcher
        
        matcher = Matcher(self.nlp.vocab)
        
        # Паттерны для описаний персонажей
        character_patterns = [
            [{"LOWER": {"IN": ["молодой", "старый", "красивый", "высокий", "стройный"]}}, 
             {"POS": "NOUN", "IS_ALPHA": True}],
            [{"LOWER": {"IN": ["его", "её", "их"]}}, 
             {"LOWER": {"IN": ["глаза", "волосы", "лицо", "руки"]}}, 
             {"POS": "ADJ"}],
        ]
        
        # Паттерны для описаний локаций  
        location_patterns = [
            [{"LOWER": {"IN": ["старый", "древний", "величественный", "мрачный"]}}, 
             {"LOWER": {"IN": ["замок", "дворец", "дом", "здание"]}}],
            [{"LOWER": {"IN": ["тёмный", "светлый", "узкий", "широкий"]}}, 
             {"LOWER": {"IN": ["коридор", "зал", "комната", "улица"]}}],
        ]
        
        # Паттерны для атмосферных описаний
        atmosphere_patterns = [
            [{"LOWER": {"IN": ["воздух", "атмосфера"]}}, 
             {"LEMMA": "быть"}, 
             {"POS": "ADJ"}],
            [{"LOWER": {"IN": ["пахло", "веяло"]}}, 
             {"POS": "NOUN"}],
        ]
        
        matcher.add("CHARACTER_DESC", character_patterns)
        matcher.add("LOCATION_DESC", location_patterns)  
        matcher.add("ATMOSPHERE_DESC", atmosphere_patterns)
        
        # Сохраняем matcher как атрибут компонента
        self.nlp.matcher = matcher
    
    async def extract_descriptions(self, text: str, chapter_id: str = None) -> List[Dict[str, Any]]:
        """Извлекает описания используя улучшенный spaCy анализ."""
        start_time = datetime.now()
        
        if not self.is_available():
            return []
        
        try:
            cleaned_text = self._clean_text(text)
            doc = self.nlp(cleaned_text)
            
            descriptions = []
            
            # 1. Анализ именованных сущностей с литературным контекстом
            entity_descriptions = await self._extract_entity_descriptions(doc)
            descriptions.extend(entity_descriptions)
            
            # 2. Анализ паттернов описаний
            pattern_descriptions = await self._extract_pattern_descriptions(doc)
            descriptions.extend(pattern_descriptions)
            
            # 3. Контекстный анализ предложений
            contextual_descriptions = await self._extract_contextual_descriptions(doc)
            descriptions.extend(contextual_descriptions)
            
            # 4. Фильтрация и улучшение качества
            filtered_descriptions = self._filter_and_enhance_descriptions(descriptions)
            
            # Обновляем метрики
            processing_time = (datetime.now() - start_time).total_seconds()
            self._update_metrics(len(filtered_descriptions), processing_time, True)
            
            logger.info(f"SpaCy extracted {len(filtered_descriptions)} descriptions in {processing_time:.2f}s")
            return filtered_descriptions
            
        except Exception as e:
            logger.error(f"Error in SpaCy processing: {e}")
            self._update_metrics(0, (datetime.now() - start_time).total_seconds(), False)
            return []
    
    async def _extract_entity_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе именованных сущностей."""
        descriptions = []
        entity_boosts = self.spacy_config
        
        # Если NER не нашел сущности, попробуем более агрессивный подход
        if not doc.ents:
            logger.info("No entities found by NER, using fallback noun-adjective detection")
            return await self._extract_fallback_descriptions(doc)
        
        for ent in doc.ents:
            if ent.label_ not in self.spacy_config['entity_types']:
                continue
            
            # Определяем тип описания и уверенность
            desc_type, base_confidence = self._map_entity_to_description_type(ent.label_)
            if not desc_type:
                continue
            
            # Получаем расширенный контекст
            sent = ent.sent
            context_words = 10  # слов до и после
            extended_context = self._get_extended_context(ent, doc, context_words)
            
            # Вычисляем качество описания
            confidence = self._calculate_entity_confidence(ent, sent, base_confidence)
            
            if confidence >= self.config.confidence_threshold:
                descriptions.append({
                    'content': extended_context,
                    'context': sent.text,
                    'type': desc_type,
                    'confidence_score': confidence,
                    'entities_mentioned': [ent.text],
                    'text_position_start': ent.start_char,
                    'text_position_end': ent.end_char,
                    'position': sent.start,
                    'word_count': len(extended_context.split()),
                    'priority_score': confidence * entity_boosts.get(f'{desc_type.lower()}_detection_boost', 1.0),
                    'source': 'spacy_entity'
                })
        
        return descriptions
    
    async def _extract_fallback_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Fallback метод для извлечения описаний когда NER не работает."""
        descriptions = []
        
        # Ищем предложения с множеством прилагательных
        for sent in doc.sents:
            if len(sent.text.strip()) < self.config.min_description_length:
                continue
                
            # Подсчитываем описательные слова
            adj_count = sum(1 for token in sent if token.pos_ == 'ADJ')
            noun_count = sum(1 for token in sent if token.pos_ == 'NOUN')
            
            # Если много прилагательных относительно существительных
            if adj_count >= 2 and noun_count >= 1:
                desc_type = self._guess_description_type_by_keywords(sent.text)
                confidence = min(0.8, (adj_count / max(1, len(sent))) * 2)
                
                if confidence >= self.config.confidence_threshold:
                    descriptions.append({
                        'content': sent.text.strip(),
                        'context': sent.text,
                        'type': desc_type,
                        'confidence_score': confidence,
                        'entities_mentioned': [],
                        'text_position_start': sent.start_char,
                        'text_position_end': sent.end_char,
                        'position': sent.start,
                        'word_count': len(sent.text.split()),
                        'priority_score': confidence * 0.9,
                        'source': 'spacy_fallback'
                    })
        
        return descriptions
    
    def _guess_description_type_by_keywords(self, text: str) -> str:
        """Угадывает тип описания по ключевым словам."""
        text_lower = text.lower()
        
        location_words = ['замок', 'дворец', 'дом', 'здание', 'комната', 'зал', 'лес', 'поле', 'река', 'гора']
        character_words = ['мужчина', 'женщина', 'девушка', 'юноша', 'старик', 'лицо', 'глаза', 'волосы', 'руки']
        atmosphere_words = ['воздух', 'атмосфера', 'тишина', 'звук', 'свет', 'тень', 'запах', 'аромат']
        
        location_score = sum(1 for word in location_words if word in text_lower)
        character_score = sum(1 for word in character_words if word in text_lower)
        atmosphere_score = sum(1 for word in atmosphere_words if word in text_lower)
        
        max_score = max(location_score, character_score, atmosphere_score)
        
        if max_score == location_score and location_score > 0:
            return DescriptionType.LOCATION.value
        elif max_score == character_score and character_score > 0:
            return DescriptionType.CHARACTER.value
        elif max_score == atmosphere_score and atmosphere_score > 0:
            return DescriptionType.ATMOSPHERE.value
        else:
            return DescriptionType.OBJECT.value
    
    async def _extract_pattern_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе литературных паттернов."""
        descriptions = []
        
        if not hasattr(self.nlp, "matcher"):
            return descriptions
        
        matches = self.nlp.matcher(doc)
        
        for match_id, start, end in matches:
            span = doc[start:end]
            match_label = self.nlp.vocab.strings[match_id]
            
            # Определяем тип описания по метке паттерна
            desc_type = self._map_pattern_to_description_type(match_label)
            if not desc_type:
                continue
            
            sent = span.sent
            extended_context = self._get_extended_context(span, doc, 15)
            
            confidence = 0.7  # Паттерны имеют хорошую базовую уверенность
            confidence = self._adjust_confidence_by_context(confidence, sent)
            
            if confidence >= self.config.confidence_threshold:
                descriptions.append({
                    'content': extended_context,
                    'context': sent.text,
                    'type': desc_type,
                    'confidence_score': confidence,
                    'entities_mentioned': [span.text],
                    'text_position_start': span.start_char,
                    'text_position_end': span.end_char,
                    'position': span.start,
                    'word_count': len(extended_context.split()),
                    'priority_score': confidence * 1.1,  # Паттерны получают бонус
                    'source': 'spacy_pattern'
                })
        
        return descriptions
    
    async def _extract_contextual_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе контекстного анализа предложений."""
        descriptions = []
        atmosphere_keywords = self.spacy_config.get('atmosphere_keywords', [])
        
        for sent in doc.sents:
            if len(sent.text.strip()) < self.config.min_description_length:
                continue
            
            # Проверяем общую описательность предложения
            descriptive_score = self._calculate_general_descriptive_score(sent)
            
            if descriptive_score > 0.3:  # Понижен порог для русских текстов
                desc_type = self._guess_description_type_by_keywords(sent.text)
                confidence = min(0.9, descriptive_score)
                
                descriptions.append({
                    'content': sent.text.strip(),
                    'context': self._get_sentence_context(sent, doc),
                    'type': desc_type,
                    'confidence_score': confidence,
                    'entities_mentioned': [],
                    'text_position_start': sent.start_char,
                    'text_position_end': sent.end_char,
                    'position': sent.start,
                    'word_count': len(sent.text.split()),
                    'priority_score': confidence * 0.9,
                    'source': 'spacy_contextual'
                })
            
            # Дополнительно анализируем атмосферность
            atmosphere_score = self._calculate_atmosphere_score(sent, atmosphere_keywords)
            if atmosphere_score > 0.4 and descriptive_score <= 0.3:
                descriptions.append({
                    'content': sent.text.strip(),
                    'context': self._get_sentence_context(sent, doc),
                    'type': DescriptionType.ATMOSPHERE.value,
                    'confidence_score': atmosphere_score,
                    'entities_mentioned': [],
                    'text_position_start': sent.start_char,
                    'text_position_end': sent.end_char,
                    'position': sent.start,
                    'word_count': len(sent.text.split()),
                    'priority_score': atmosphere_score * 0.8,
                    'source': 'spacy_atmosphere'
                })
        
        return descriptions
    
    def _calculate_general_descriptive_score(self, sentence) -> float:
        """Вычисляет общую описательность предложения."""
        total_tokens = len(sentence)
        if total_tokens == 0:
            return 0.0
        
        # Подсчитываем описательные части речи
        adj_count = sum(1 for token in sentence if token.pos_ == 'ADJ')
        adv_count = sum(1 for token in sentence if token.pos_ == 'ADV')
        noun_count = sum(1 for token in sentence if token.pos_ == 'NOUN')
        
        # Высокое соотношение прилагательных к существительным
        descriptive_ratio = (adj_count + adv_count * 0.5) / max(1, total_tokens)
        
        # Бонус за наличие существительных (нужна база для описания)
        noun_bonus = min(0.3, noun_count * 0.1)
        
        # Проверяем на ключевые русские описательные слова
        text_lower = sentence.text.lower()
        russian_descriptive_words = ['красивый', 'большой', 'старый', 'молодой', 'высокий', 'низкий', 'тёмный', 'светлый', 'величественный', 'древний']
        keyword_bonus = sum(0.1 for word in russian_descriptive_words if word in text_lower)
        
        total_score = descriptive_ratio + noun_bonus + keyword_bonus
        return min(1.0, total_score)
    
    def _map_entity_to_description_type(self, entity_label: str) -> Tuple[Optional[str], float]:
        """Сопоставляет тип сущности с типом описания."""
        mapping = {
            'PERSON': (DescriptionType.CHARACTER.value, 0.8),
            'LOC': (DescriptionType.LOCATION.value, 0.7),
            'GPE': (DescriptionType.LOCATION.value, 0.6),
            'FAC': (DescriptionType.LOCATION.value, 0.7),
            'ORG': (DescriptionType.OBJECT.value, 0.5),
        }
        return mapping.get(entity_label, (None, 0.0))
    
    def _map_pattern_to_description_type(self, pattern_label: str) -> Optional[str]:
        """Сопоставляет метку паттерна с типом описания."""
        mapping = {
            'CHARACTER_DESC': DescriptionType.CHARACTER.value,
            'LOCATION_DESC': DescriptionType.LOCATION.value,
            'ATMOSPHERE_DESC': DescriptionType.ATMOSPHERE.value,
        }
        return mapping.get(pattern_label)
    
    def _get_extended_context(self, span, doc, context_words: int = 10) -> str:
        """Получает расширенный контекст вокруг спана."""
        sent = span.sent
        
        # Пытаемся расширить на соседние предложения если нужно
        start_token = max(0, span.start - context_words)
        end_token = min(len(doc), span.end + context_words)
        
        extended_text = doc[start_token:end_token].text
        return extended_text.strip()
    
    def _calculate_entity_confidence(self, entity, sentence, base_confidence: float) -> float:
        """Вычисляет уверенность для сущности на основе контекста."""
        confidence = base_confidence
        
        # Бонус за длину сущности
        if len(entity.text) > 3:
            confidence += 0.1
        
        # Бонус за позицию в предложении (начало/конец часто важнее)
        rel_pos = (entity.start - sentence.start) / max(1, len(sentence))
        if rel_pos < 0.3 or rel_pos > 0.7:
            confidence += 0.05
        
        # Бонус за наличие прилагательных рядом
        for token in sentence:
            if abs(token.i - entity.start) <= 2 and token.pos_ == 'ADJ':
                confidence += 0.1
                break
        
        return min(1.0, confidence)
    
    def _adjust_confidence_by_context(self, base_confidence: float, sentence) -> float:
        """Корректирует уверенность на основе контекста предложения."""
        confidence = base_confidence
        
        # Бонус за описательные слова
        descriptive_pos = ['ADJ', 'ADV']
        descriptive_count = sum(1 for token in sentence if token.pos_ in descriptive_pos)
        confidence += descriptive_count * 0.02
        
        # Бонус за длину предложения (но не слишком длинное)
        sent_length = len(sentence)
        if 10 <= sent_length <= 30:
            confidence += 0.05
        elif sent_length > 50:
            confidence -= 0.05
        
        return min(1.0, confidence)
    
    def _calculate_atmosphere_score(self, sentence, atmosphere_keywords: List[str]) -> float:
        """Вычисляет оценку атмосферности предложения."""
        text_lower = sentence.text.lower()
        
        # Проверяем ключевые слова
        keyword_score = sum(0.2 for keyword in atmosphere_keywords if keyword in text_lower)
        
        # Проверяем эмоциональную окраску
        emotional_pos = ['ADJ', 'ADV']
        emotional_words = sum(1 for token in sentence if token.pos_ in emotional_pos)
        emotion_score = min(0.4, emotional_words * 0.05)
        
        # Проверяем сенсорные описания
        sensory_words = ['пах', 'звук', 'свет', 'тень', 'цвет', 'запах', 'вкус']
        sensory_score = sum(0.1 for word in sensory_words if word in text_lower)
        
        return min(1.0, keyword_score + emotion_score + sensory_score)
    
    def _get_sentence_context(self, sentence, doc, context_sentences: int = 1) -> str:
        """Получает контекст из соседних предложений."""
        sentences = list(doc.sents)
        sent_index = sentences.index(sentence)
        
        start_idx = max(0, sent_index - context_sentences)
        end_idx = min(len(sentences), sent_index + context_sentences + 1)
        
        context_sents = sentences[start_idx:end_idx]
        return ' '.join(sent.text.strip() for sent in context_sents)
    
    def _filter_and_enhance_descriptions(self, descriptions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Фильтрует и улучшает качество описаний."""
        # Удаляем дубликаты по содержанию
        unique_descriptions = []
        seen_content = set()
        
        for desc in descriptions:
            content_key = desc['content'][:100]  # Первые 100 символов как ключ
            if content_key not in seen_content:
                seen_content.add(content_key)
                unique_descriptions.append(desc)
        
        # Фильтруем по длине и качеству
        filtered = []
        for desc in unique_descriptions:
            if (self.config.min_description_length <= len(desc['content']) <= self.config.max_description_length and
                desc['word_count'] >= self.config.min_word_count and
                desc['confidence_score'] >= self.config.confidence_threshold):
                filtered.append(desc)
        
        # Сортируем по приоритету
        filtered.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return filtered
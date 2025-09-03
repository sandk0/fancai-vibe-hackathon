"""
Улучшенный Natasha процессор для русскоязычной литературы.
Natasha особенно эффективна для русского языка и может найти описания, которые пропускает spaCy.
"""

import asyncio
from natasha import (
    Segmenter, MorphVocab, NewsEmbedding, NewsMorphTagger, NewsNERTagger,
    NewsSyntaxParser, Doc, PER, LOC, ORG
)
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from .enhanced_nlp_system import EnhancedNLPProcessor, ProcessorConfig, NLPProcessorType
from ..models.description import DescriptionType

logger = logging.getLogger(__name__)


class EnhancedNatashaProcessor(EnhancedNLPProcessor):
    """Улучшенный Natasha процессор с настройками для художественной литературы."""
    
    def __init__(self, config: ProcessorConfig = None):
        super().__init__(config)
        self.processor_type = NLPProcessorType.NATASHA
        
        # Компоненты Natasha
        self.segmenter = None
        self.morph_vocab = None
        self.emb = None
        self.morph_tagger = None
        self.syntax_parser = None
        self.ner_tagger = None
        
        # Специализированные настройки для Natasha
        self.natasha_config = self.config.custom_settings.get('natasha', {
            'enable_morphology': True,
            'enable_syntax': True,
            'enable_ner': True,
            'literary_boost': 1.3,  # Усиление для литературных текстов
            'person_patterns': [
                r'\b(?:юноша|девушка|старик|женщина|мужчина|ребёнок|дитя)\b',
                r'\b(?:княгиня|князь|царь|царица|король|королева)\b',
                r'\b(?:герой|героиня|персонаж)\b'
            ],
            'location_patterns': [
                r'\b(?:дворец|замок|крепость|терем|хижина|изба)\b',
                r'\b(?:лес|поле|река|озеро|море|гора|холм)\b', 
                r'\b(?:город|село|деревня|столица)\b',
                r'\b(?:сад|парк|двор|площадь|улица|переулок)\b'
            ],
            'atmosphere_indicators': [
                r'\b(?:мрачно|светло|тихо|шумно|весело|грустно)\b',
                r'\b(?:туман|дымка|мгла|солнце|тень|свет)\b',
                r'\b(?:аромат|запах|благоухание|вонь)\b'
            ]
        })
    
    async def load_model(self):
        """Загружает компоненты Natasha."""
        try:
            logger.info("Loading Natasha components...")
            
            # Базовые компоненты
            self.segmenter = Segmenter()
            self.morph_vocab = MorphVocab()
            
            # Embeddings и теггеры
            if self.natasha_config.get('enable_morphology', True):
                self.emb = NewsEmbedding()
                self.morph_tagger = NewsMorphTagger(self.emb)
            
            if self.natasha_config.get('enable_syntax', True):
                if not self.emb:  # Syntax parser also uses NewsEmbedding
                    self.emb = NewsEmbedding()
                self.syntax_parser = NewsSyntaxParser(self.emb)
            
            if self.natasha_config.get('enable_ner', True):
                if not self.emb:  # Если морфология отключена, всё равно нужны embeddings для NER
                    self.emb = NewsEmbedding()
                self.ner_tagger = NewsNERTagger(self.emb)
            
            # Устанавливаем model для базового класса
            self.model = self.segmenter  # Используем segmenter как индикатор загрузки
            self.loaded = True
            logger.info("✅ Natasha components loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Error loading Natasha: {e}")
            self.loaded = False
    
    async def extract_descriptions(self, text: str, chapter_id: str = None) -> List[Dict[str, Any]]:
        """Извлекает описания используя Natasha анализ."""
        start_time = datetime.now()
        
        if not self.is_available():
            return []
        
        try:
            cleaned_text = self._clean_text(text)
            doc = Doc(cleaned_text)
            
            # Сегментация на предложения и токены
            doc.segment(self.segmenter)
            
            descriptions = []
            
            # 1. NER анализ для персонажей и локаций
            if self.ner_tagger:
                ner_descriptions = await self._extract_ner_descriptions(doc)
                descriptions.extend(ner_descriptions)
            
            # 2. Морфологический анализ для атмосферных описаний
            if self.morph_tagger:
                morph_descriptions = await self._extract_morphological_descriptions(doc)
                descriptions.extend(morph_descriptions)
            
            # 3. Синтаксический анализ для сложных конструкций
            if self.syntax_parser:
                syntax_descriptions = await self._extract_syntactic_descriptions(doc)
                descriptions.extend(syntax_descriptions)
            
            # 4. Паттерн-анализ специфичный для русской литературы
            pattern_descriptions = await self._extract_pattern_descriptions(doc)
            descriptions.extend(pattern_descriptions)
            
            # Фильтрация и приоритизация
            filtered_descriptions = self._filter_and_prioritize_descriptions(descriptions)
            
            # Обновляем метрики
            processing_time = (datetime.now() - start_time).total_seconds()
            self._update_metrics(len(filtered_descriptions), processing_time, True)
            
            logger.info(f"Natasha extracted {len(filtered_descriptions)} descriptions in {processing_time:.2f}s")
            return filtered_descriptions
            
        except Exception as e:
            logger.error(f"Error in Natasha processing: {e}")
            self._update_metrics(0, (datetime.now() - start_time).total_seconds(), False)
            return []
    
    async def _extract_ner_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе именованных сущностей Natasha."""
        descriptions = []
        
        # Запускаем NER
        doc.tag_ner(self.ner_tagger)
        
        for span in doc.spans:
            if span.type not in [PER, LOC, ORG]:
                continue
            
            # Определяем тип описания
            desc_type = self._map_natasha_entity_to_description_type(span.type)
            if not desc_type:
                continue
            
            # Находим предложение, содержащее сущность
            sentence = self._find_sentence_for_span(doc, span)
            if not sentence:
                continue
            
            # Расширяем контекст
            extended_context = self._get_extended_context(doc, sentence, span)
            
            # Вычисляем уверенность
            confidence = self._calculate_ner_confidence(span, sentence, doc)
            
            if confidence >= self.config.confidence_threshold:
                descriptions.append({
                    'content': extended_context,
                    'context': sentence.text,
                    'type': desc_type,
                    'confidence_score': confidence,
                    'entities_mentioned': [span.text],
                    'text_position_start': span.start,
                    'text_position_end': span.stop,
                    'position': sentence.start,
                    'word_count': len(extended_context.split()),
                    'priority_score': confidence * self.natasha_config.get('literary_boost', 1.3),
                    'source': 'natasha_ner'
                })
        
        return descriptions
    
    async def _extract_morphological_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе морфологического анализа."""
        descriptions = []
        
        # Запускаем морфологический анализ
        doc.tag_morph(self.morph_tagger)
        
        for sentence in doc.sents:
            # Ищем описательные конструкции
            descriptive_score = self._calculate_descriptive_score(sentence)
            
            if descriptive_score > 0.4:
                desc_type = self._determine_description_type_by_morphology(sentence)
                
                confidence = min(0.9, descriptive_score)
                extended_context = sentence.text
                
                if confidence >= self.config.confidence_threshold:
                    descriptions.append({
                        'content': extended_context,
                        'context': sentence.text,
                        'type': desc_type,
                        'confidence_score': confidence,
                        'entities_mentioned': [],
                        'text_position_start': sentence.start,
                        'text_position_end': sentence.stop,
                        'position': sentence.start,
                        'word_count': len(extended_context.split()),
                        'priority_score': confidence * 0.9,  # Морфология менее приоритетна
                        'source': 'natasha_morph'
                    })
        
        return descriptions
    
    async def _extract_syntactic_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе синтаксического анализа."""
        descriptions = []
        
        try:
            # Запускаем синтаксический анализ
            doc.parse_syntax(self.syntax_parser)
            
            for sentence in doc.sents:
                # Ищем определенные синтаксические паттерны
                # например: "подлежащее + сказуемое + прилагательное/причастие"
                syntax_patterns = self._find_descriptive_syntax_patterns(sentence)
                
                for pattern in syntax_patterns:
                    desc_type = pattern['type']
                    confidence = pattern['confidence']
                    content = pattern['content']
                    
                    if confidence >= self.config.confidence_threshold:
                        descriptions.append({
                            'content': content,
                            'context': sentence.text,
                            'type': desc_type,
                            'confidence_score': confidence,
                            'entities_mentioned': pattern.get('entities', []),
                            'text_position_start': sentence.start,
                            'text_position_end': sentence.stop,
                            'position': sentence.start,
                            'word_count': len(content.split()),
                            'priority_score': confidence * 1.1,  # Синтаксис получает бонус
                            'source': 'natasha_syntax'
                        })
            
        except Exception as e:
            logger.warning(f"Syntax analysis failed: {e}")
        
        return descriptions
    
    async def _extract_pattern_descriptions(self, doc) -> List[Dict[str, Any]]:
        """Извлекает описания на основе литературных паттернов для русского языка."""
        descriptions = []
        text = doc.text
        
        # Паттерны для персонажей
        for pattern in self.natasha_config.get('person_patterns', []):
            for match in re.finditer(pattern, text, re.IGNORECASE):
                sentence = self._find_sentence_for_position(doc, match.start())
                if sentence and len(sentence.text.strip()) >= self.config.min_description_length:
                    descriptions.append({
                        'content': sentence.text.strip(),
                        'context': sentence.text,
                        'type': DescriptionType.CHARACTER.value,
                        'confidence_score': 0.75,
                        'entities_mentioned': [match.group()],
                        'text_position_start': sentence.start,
                        'text_position_end': sentence.stop,
                        'position': sentence.start,
                        'word_count': len(sentence.text.split()),
                        'priority_score': 0.85,
                        'source': 'natasha_pattern_person'
                    })
        
        # Паттерны для локаций
        for pattern in self.natasha_config.get('location_patterns', []):
            for match in re.finditer(pattern, text, re.IGNORECASE):
                sentence = self._find_sentence_for_position(doc, match.start())
                if sentence and len(sentence.text.strip()) >= self.config.min_description_length:
                    descriptions.append({
                        'content': sentence.text.strip(),
                        'context': sentence.text,
                        'type': DescriptionType.LOCATION.value,
                        'confidence_score': 0.7,
                        'entities_mentioned': [match.group()],
                        'text_position_start': sentence.start,
                        'text_position_end': sentence.stop,
                        'position': sentence.start,
                        'word_count': len(sentence.text.split()),
                        'priority_score': 0.8,
                        'source': 'natasha_pattern_location'
                    })
        
        # Паттерны для атмосферы
        for pattern in self.natasha_config.get('atmosphere_indicators', []):
            for match in re.finditer(pattern, text, re.IGNORECASE):
                sentence = self._find_sentence_for_position(doc, match.start())
                if sentence and len(sentence.text.strip()) >= self.config.min_description_length:
                    descriptions.append({
                        'content': sentence.text.strip(),
                        'context': sentence.text,
                        'type': DescriptionType.ATMOSPHERE.value,
                        'confidence_score': 0.65,
                        'entities_mentioned': [match.group()],
                        'text_position_start': sentence.start,
                        'text_position_end': sentence.stop,
                        'position': sentence.start,
                        'word_count': len(sentence.text.split()),
                        'priority_score': 0.7,
                        'source': 'natasha_pattern_atmosphere'
                    })
        
        return descriptions
    
    def _map_natasha_entity_to_description_type(self, entity_type: str) -> Optional[str]:
        """Сопоставляет тип сущности Natasha с типом описания."""
        mapping = {
            PER: DescriptionType.CHARACTER.value,
            LOC: DescriptionType.LOCATION.value,
            ORG: DescriptionType.OBJECT.value,
        }
        return mapping.get(entity_type)
    
    def _find_sentence_for_span(self, doc, span):
        """Находит предложение, содержащее указанный span."""
        for sentence in doc.sents:
            if sentence.start <= span.start < sentence.stop:
                return sentence
        return None
    
    def _find_sentence_for_position(self, doc, position: int):
        """Находит предложение для указанной позиции в тексте."""
        for sentence in doc.sents:
            if sentence.start <= position < sentence.stop:
                return sentence
        return None
    
    def _get_extended_context(self, doc, sentence, span, context_chars: int = 200):
        """Получает расширенный контекст вокруг span."""
        # Простое расширение по символам
        start_pos = max(0, sentence.start - context_chars)
        end_pos = min(len(doc.text), sentence.stop + context_chars)
        
        return doc.text[start_pos:end_pos].strip()
    
    def _calculate_ner_confidence(self, span, sentence, doc) -> float:
        """Вычисляет уверенность для именованной сущности."""
        base_confidence = 0.6
        
        # Бонус за длину сущности
        if len(span.text) > 3:
            base_confidence += 0.1
        
        # Бонус за позицию в предложении
        relative_position = (span.start - sentence.start) / max(1, sentence.stop - sentence.start)
        if 0.1 <= relative_position <= 0.9:  # Не в самом начале/конце
            base_confidence += 0.1
        
        # Бонус за наличие описательных слов рядом
        context_window = 50  # символов
        context_start = max(0, span.start - context_window)
        context_end = min(len(doc.text), span.stop + context_window)
        context_text = doc.text[context_start:context_end].lower()
        
        descriptive_words = ['красивый', 'большой', 'старый', 'новый', 'высокий', 'низкий', 'тёмный', 'светлый']
        descriptor_bonus = sum(0.05 for word in descriptive_words if word in context_text)
        base_confidence += descriptor_bonus
        
        return min(1.0, base_confidence)
    
    def _calculate_descriptive_score(self, sentence) -> float:
        """Вычисляет описательную оценку предложения на основе морфологии."""
        if not hasattr(sentence, 'tokens') or not sentence.tokens:
            return 0.0
        
        score = 0.0
        total_tokens = len(sentence.tokens)
        
        adj_count = 0
        adv_count = 0
        verb_count = 0
        
        for token in sentence.tokens:
            if hasattr(token, 'pos') and token.pos:
                if token.pos.startswith('ADJ'):  # Прилагательные
                    adj_count += 1
                elif token.pos.startswith('ADV'):  # Наречия
                    adv_count += 1
                elif token.pos.startswith('VERB'):  # Глаголы
                    verb_count += 1
        
        # Высокий процент прилагательных и наречий = описательность
        descriptive_ratio = (adj_count + adv_count) / max(1, total_tokens)
        score += descriptive_ratio * 0.8
        
        # Умеренное количество глаголов тоже хорошо для описаний
        if 1 <= verb_count <= 3:
            score += 0.2
        
        return min(1.0, score)
    
    def _determine_description_type_by_morphology(self, sentence) -> str:
        """Определяет тип описания по морфологии."""
        text = sentence.text.lower()
        
        # Простая эвристика на основе ключевых слов
        person_indicators = ['человек', 'девушка', 'мужчина', 'ребёнок', 'лицо', 'глаза', 'волосы']
        location_indicators = ['дом', 'замок', 'комната', 'лес', 'река', 'город', 'место']
        atmosphere_indicators = ['воздух', 'атмосфера', 'настроение', 'чувство', 'тишина', 'шум']
        
        person_score = sum(1 for word in person_indicators if word in text)
        location_score = sum(1 for word in location_indicators if word in text)
        atmosphere_score = sum(1 for word in atmosphere_indicators if word in text)
        
        max_score = max(person_score, location_score, atmosphere_score)
        
        if max_score == 0:
            return DescriptionType.OBJECT.value  # По умолчанию
        elif max_score == person_score:
            return DescriptionType.CHARACTER.value
        elif max_score == location_score:
            return DescriptionType.LOCATION.value
        else:
            return DescriptionType.ATMOSPHERE.value
    
    def _find_descriptive_syntax_patterns(self, sentence) -> List[Dict[str, Any]]:
        """Находит описательные синтаксические паттерны."""
        patterns = []
        
        # Это упрощенная версия - в реальности нужен более сложный синтаксический анализ
        # Здесь мы ищем простые паттерны типа "Существительное + прилагательное"
        
        text = sentence.text
        words = text.split()
        
        # Простой паттерн: если в предложении много прилагательных
        if len(words) >= 5:
            # Предполагаем, что это описательное предложение
            patterns.append({
                'type': DescriptionType.OBJECT.value,
                'confidence': 0.5,
                'content': text,
                'entities': []
            })
        
        return patterns
    
    def _filter_and_prioritize_descriptions(self, descriptions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Фильтрует и приоритизирует описания."""
        # Удаляем дубликаты
        unique_descriptions = []
        seen_content = set()
        
        for desc in descriptions:
            content_key = desc['content'][:50]  # Первые 50 символов как ключ
            if content_key not in seen_content:
                seen_content.add(content_key)
                unique_descriptions.append(desc)
        
        # Фильтруем по параметрам качества
        filtered = []
        for desc in unique_descriptions:
            content_length = len(desc['content'])
            word_count = desc['word_count']
            confidence = desc['confidence_score']
            
            if (self.config.min_description_length <= content_length <= self.config.max_description_length and
                word_count >= self.config.min_word_count and
                confidence >= self.config.confidence_threshold):
                
                # Применяем литературный буст
                desc['priority_score'] *= self.natasha_config.get('literary_boost', 1.3)
                filtered.append(desc)
        
        # Сортируем по приоритету
        filtered.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return filtered
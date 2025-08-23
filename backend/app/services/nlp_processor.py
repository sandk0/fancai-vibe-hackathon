"""
NLP обработчик для извлечения описаний из текста книг.

Реализует приоритизированное извлечение описаний согласно техническому заданию:
- LOCATION: 75% (высший приоритет) - локации, интерьеры, экстерьеры, природа
- CHARACTER: 60% - персонажи, внешность, одежда, эмоции  
- ATMOSPHERE: 45% - атмосфера, время суток, погода, настроение
- OBJECT: 40% - объекты, оружие, артефакты, транспорт
- ACTION: 30% (низший приоритет) - действия, битвы, церемонии, события
"""

import spacy
import re
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

from ..models.description import DescriptionType


class NLPProcessor:
    """Главный класс для NLP обработки текстов книг."""
    
    def __init__(self):
        """Инициализация NLP процессора с русской моделью spaCy."""
        try:
            self.nlp = spacy.load("ru_core_news_lg")
            self.loaded = True
        except OSError:
            print("⚠️ Предупреждение: русская модель spaCy не найдена. NLP функции недоступны.")
            self.nlp = None
            self.loaded = False
    
    def is_available(self) -> bool:
        """Проверяет доступность NLP обработки."""
        return self.loaded and self.nlp is not None
    
    def extract_descriptions_from_text(self, text: str, chapter_id: str = None) -> List[Dict[str, Any]]:
        """
        Извлекает описания из текста главы.
        
        Args:
            text: Текст главы для анализа
            chapter_id: ID главы (опционально)
            
        Returns:
            Список найденных описаний с метаданными
        """
        if not self.is_available():
            return []
        
        # Очистка текста
        cleaned_text = self._clean_text(text)
        
        # Разбивка на предложения
        doc = self.nlp(cleaned_text)
        sentences = [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 10]
        
        descriptions = []
        
        for i, sentence in enumerate(sentences):
            # Анализ предложения на предмет описаний
            sentence_doc = self.nlp(sentence)
            
            # Извлекаем разные типы описаний
            location_desc = self._extract_location_description(sentence_doc, sentence)
            if location_desc:
                descriptions.append({
                    "type": DescriptionType.LOCATION,
                    "content": sentence,
                    "context": self._get_context(sentences, i),
                    "confidence_score": location_desc["confidence"],
                    "position_in_chapter": i,
                    "word_count": len(sentence.split()),
                    "entities_mentioned": location_desc["entities"],
                    "priority_score": self._calculate_priority_score(DescriptionType.LOCATION, location_desc["confidence"], len(sentence))
                })
            
            character_desc = self._extract_character_description(sentence_doc, sentence)
            if character_desc:
                descriptions.append({
                    "type": DescriptionType.CHARACTER,
                    "content": sentence,
                    "context": self._get_context(sentences, i),
                    "confidence_score": character_desc["confidence"],
                    "position_in_chapter": i,
                    "word_count": len(sentence.split()),
                    "entities_mentioned": character_desc["entities"],
                    "priority_score": self._calculate_priority_score(DescriptionType.CHARACTER, character_desc["confidence"], len(sentence))
                })
            
            atmosphere_desc = self._extract_atmosphere_description(sentence_doc, sentence)
            if atmosphere_desc:
                descriptions.append({
                    "type": DescriptionType.ATMOSPHERE,
                    "content": sentence,
                    "context": self._get_context(sentences, i),
                    "confidence_score": atmosphere_desc["confidence"],
                    "position_in_chapter": i,
                    "word_count": len(sentence.split()),
                    "entities_mentioned": atmosphere_desc["entities"],
                    "priority_score": self._calculate_priority_score(DescriptionType.ATMOSPHERE, atmosphere_desc["confidence"], len(sentence))
                })
            
            object_desc = self._extract_object_description(sentence_doc, sentence)
            if object_desc:
                descriptions.append({
                    "type": DescriptionType.OBJECT,
                    "content": sentence,
                    "context": self._get_context(sentences, i),
                    "confidence_score": object_desc["confidence"],
                    "position_in_chapter": i,
                    "word_count": len(sentence.split()),
                    "entities_mentioned": object_desc["entities"],
                    "priority_score": self._calculate_priority_score(DescriptionType.OBJECT, object_desc["confidence"], len(sentence))
                })
            
            action_desc = self._extract_action_description(sentence_doc, sentence)
            if action_desc:
                descriptions.append({
                    "type": DescriptionType.ACTION,
                    "content": sentence,
                    "context": self._get_context(sentences, i),
                    "confidence_score": action_desc["confidence"],
                    "position_in_chapter": i,
                    "word_count": len(sentence.split()),
                    "entities_mentioned": action_desc["entities"],
                    "priority_score": self._calculate_priority_score(DescriptionType.ACTION, action_desc["confidence"], len(sentence))
                })
        
        # Сортировка по приоритету (выше приоритет = выше в списке)
        descriptions.sort(key=lambda x: x["priority_score"], reverse=True)
        
        return descriptions
    
    def _clean_text(self, text: str) -> str:
        """Очищает текст от лишних символов и форматирования."""
        # Удаляем лишние пробелы и переносы
        text = re.sub(r'\s+', ' ', text)
        # Удаляем странные символы
        text = re.sub(r'[^\w\s\.\!\?\,\;\:\-\—\«\»\(\)\[\]]+', '', text)
        return text.strip()
    
    def _get_context(self, sentences: List[str], position: int, context_size: int = 1) -> str:
        """Получает контекст вокруг предложения."""
        start = max(0, position - context_size)
        end = min(len(sentences), position + context_size + 1)
        return " ".join(sentences[start:end])
    
    def _calculate_priority_score(self, desc_type: DescriptionType, confidence: float, text_length: int) -> float:
        """Рассчитывает приоритетный счет описания."""
        # Базовые приоритеты по типам (из ТЗ)
        type_priorities = {
            DescriptionType.LOCATION: 75,
            DescriptionType.CHARACTER: 60,
            DescriptionType.ATMOSPHERE: 45,
            DescriptionType.OBJECT: 40,
            DescriptionType.ACTION: 30
        }
        
        base_priority = type_priorities.get(desc_type, 30)
        confidence_bonus = confidence * 20  # 0-20 points
        
        # Бонус за оптимальную длину (50-400 символов)
        length_bonus = 0
        if 50 <= text_length <= 400:
            length_bonus = 10
        elif text_length < 50:
            length_bonus = max(0, text_length - 20) / 5
        else:
            length_bonus = max(0, 10 - (text_length - 400) / 100)
        
        return min(100.0, base_priority + confidence_bonus + length_bonus)
    
    def _extract_location_description(self, doc, sentence: str) -> Optional[Dict[str, Any]]:
        """Извлекает описания локаций."""
        location_keywords = [
            'дом', 'замок', 'комната', 'зал', 'дворец', 'храм', 'церковь',
            'лес', 'поле', 'гора', 'река', 'озеро', 'море', 'сад', 'парк',
            'город', 'деревня', 'улица', 'площадь', 'рынок', 'таверна',
            'мост', 'башня', 'стена', 'ворота', 'дорога', 'тропа'
        ]
        
        preposition_location_patterns = [
            'в доме', 'в замке', 'в комнате', 'в зале', 'в лесу', 'в саду',
            'на площади', 'на улице', 'на поле', 'на горе', 'у реки', 'у озера'
        ]
        
        confidence = 0.0
        entities = []
        
        # Проверка наличия ключевых слов локаций
        text_lower = sentence.lower()
        for keyword in location_keywords:
            if keyword in text_lower:
                confidence += 0.3
                entities.append(keyword)
        
        # Проверка паттернов с предлогами
        for pattern in preposition_location_patterns:
            if pattern in text_lower:
                confidence += 0.5
                entities.append(pattern)
        
        # Анализ именованных сущностей
        for ent in doc.ents:
            if ent.label_ in ['LOC', 'GPE']:  # Локации и географические объекты
                confidence += 0.4
                entities.append(ent.text)
        
        # Анализ прилагательных, описывающих места
        descriptive_adjectives = [
            'старый', 'древний', 'большой', 'маленький', 'высокий', 'низкий',
            'тёмный', 'светлый', 'широкий', 'узкий', 'длинный', 'короткий'
        ]
        
        for token in doc:
            if token.pos_ == 'ADJ' and token.text.lower() in descriptive_adjectives:
                confidence += 0.2
        
        # Минимальный порог уверенности для локаций
        if confidence >= 0.4:
            return {
                "confidence": min(1.0, confidence),
                "entities": list(set(entities))
            }
        
        return None
    
    def _extract_character_description(self, doc, sentence: str) -> Optional[Dict[str, Any]]:
        """Извлекает описания персонажей."""
        character_keywords = [
            'человек', 'мужчина', 'женщина', 'девушка', 'парень', 'старик', 'старуха',
            'рыцарь', 'воин', 'маг', 'волшебник', 'король', 'королева', 'принц', 'принцесса',
            'глаза', 'волосы', 'лицо', 'руки', 'одежда', 'платье', 'рубашка', 'плащ'
        ]
        
        appearance_adjectives = [
            'красивый', 'красивая', 'молодой', 'молодая', 'старый', 'старая',
            'высокий', 'высокая', 'низкий', 'низкая', 'сильный', 'сильная',
            'светлый', 'тёмный', 'рыжий', 'блондин', 'брюнет'
        ]
        
        confidence = 0.0
        entities = []
        
        text_lower = sentence.lower()
        
        # Проверка ключевых слов персонажей
        for keyword in character_keywords:
            if keyword in text_lower:
                confidence += 0.4
                entities.append(keyword)
        
        # Проверка прилагательных внешности
        for adj in appearance_adjectives:
            if adj in text_lower:
                confidence += 0.3
        
        # Анализ именованных сущностей (люди)
        for ent in doc.ents:
            if ent.label_ in ['PER', 'PERSON']:
                confidence += 0.5
                entities.append(ent.text)
        
        # Анализ частей речи для описания внешности
        for token in doc:
            if token.pos_ == 'ADJ' and any(person_word in sentence.lower() for person_word in ['человек', 'мужчина', 'женщина']):
                confidence += 0.2
        
        if confidence >= 0.4:
            return {
                "confidence": min(1.0, confidence),
                "entities": list(set(entities))
            }
        
        return None
    
    def _extract_atmosphere_description(self, doc, sentence: str) -> Optional[Dict[str, Any]]:
        """Извлекает описания атмосферы."""
        atmosphere_keywords = [
            'туман', 'дождь', 'снег', 'ветер', 'солнце', 'луна', 'звёзды',
            'утро', 'день', 'вечер', 'ночь', 'рассвет', 'закат',
            'тишина', 'шум', 'крики', 'звуки', 'мрак', 'свет',
            'холод', 'тепло', 'жара', 'прохлада'
        ]
        
        mood_adjectives = [
            'мрачный', 'весёлый', 'грустный', 'таинственный', 'зловещий',
            'спокойный', 'тревожный', 'печальный', 'радостный', 'угрюмый'
        ]
        
        confidence = 0.0
        entities = []
        
        text_lower = sentence.lower()
        
        for keyword in atmosphere_keywords:
            if keyword in text_lower:
                confidence += 0.4
                entities.append(keyword)
        
        for adj in mood_adjectives:
            if adj in text_lower:
                confidence += 0.3
                entities.append(adj)
        
        # Проверка временных указателей
        time_patterns = ['было утром', 'был день', 'наступил вечер', 'пришла ночь']
        for pattern in time_patterns:
            if pattern in text_lower:
                confidence += 0.5
        
        if confidence >= 0.3:
            return {
                "confidence": min(1.0, confidence),
                "entities": list(set(entities))
            }
        
        return None
    
    def _extract_object_description(self, doc, sentence: str) -> Optional[Dict[str, Any]]:
        """Извлекает описания объектов."""
        object_keywords = [
            'меч', 'кинжал', 'лук', 'стрела', 'щит', 'доспехи', 'шлем',
            'кольцо', 'амулет', 'ожерелье', 'посох', 'жезл', 'книга',
            'стол', 'стул', 'кровать', 'шкаф', 'сундук', 'зеркало',
            'лошадь', 'повозка', 'корабль', 'лодка'
        ]
        
        material_adjectives = [
            'золотой', 'серебряный', 'медный', 'железный', 'стальной',
            'деревянный', 'каменный', 'кожаный', 'шёлковый', 'бархатный'
        ]
        
        confidence = 0.0
        entities = []
        
        text_lower = sentence.lower()
        
        for keyword in object_keywords:
            if keyword in text_lower:
                confidence += 0.4
                entities.append(keyword)
        
        for adj in material_adjectives:
            if adj in text_lower:
                confidence += 0.3
        
        # Анализ существительных как потенциальных объектов
        for token in doc:
            if token.pos_ == 'NOUN' and len(token.text) > 3:
                # Проверяем, не является ли это человеком или местом
                if not any(person_word in token.text.lower() for person_word in ['человек', 'люд']):
                    confidence += 0.1
        
        if confidence >= 0.4:
            return {
                "confidence": min(1.0, confidence),
                "entities": list(set(entities))
            }
        
        return None
    
    def _extract_action_description(self, doc, sentence: str) -> Optional[Dict[str, Any]]:
        """Извлекает описания действий."""
        action_keywords = [
            'битва', 'сражение', 'бой', 'война', 'драка',
            'церемония', 'ритуал', 'праздник', 'свадьба', 'похороны',
            'путешествие', 'поход', 'побег', 'погоня', 'охота'
        ]
        
        action_verbs = [
            'сражаться', 'биться', 'воевать', 'драться',
            'идти', 'ехать', 'лететь', 'бежать', 'прыгать',
            'говорить', 'кричать', 'шептать', 'петь'
        ]
        
        confidence = 0.0
        entities = []
        
        text_lower = sentence.lower()
        
        for keyword in action_keywords:
            if keyword in text_lower:
                confidence += 0.5
                entities.append(keyword)
        
        for verb in action_verbs:
            if verb in text_lower:
                confidence += 0.2
        
        # Анализ глаголов действия
        action_verb_count = 0
        for token in doc:
            if token.pos_ == 'VERB':
                action_verb_count += 1
        
        if action_verb_count >= 2:
            confidence += 0.3
        
        if confidence >= 0.4:
            return {
                "confidence": min(1.0, confidence),
                "entities": list(set(entities))
            }
        
        return None


# Глобальный экземпляр процессора
nlp_processor = NLPProcessor()
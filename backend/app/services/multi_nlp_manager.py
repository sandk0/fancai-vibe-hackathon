"""
Менеджер для управления множественными NLP процессорами.
Обеспечивает интеллектуальное переключение, комбинирование результатов и настройку процессоров.
"""

import asyncio
import json
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from dataclasses import dataclass, asdict
import logging
from datetime import datetime

from .enhanced_nlp_system import EnhancedNLPProcessor, ProcessorConfig, NLPProcessorType
from .enhanced_nlp_system import EnhancedSpacyProcessor
from .natasha_processor import EnhancedNatashaProcessor
from .stanza_processor import EnhancedStanzaProcessor
from .settings_manager import settings_manager

logger = logging.getLogger(__name__)


class ProcessingMode(Enum):
    """Режимы обработки NLP."""
    SINGLE = "single"           # Один процессор
    PARALLEL = "parallel"       # Несколько процессоров параллельно
    SEQUENTIAL = "sequential"   # Несколько процессоров последовательно
    ENSEMBLE = "ensemble"       # Комбинирование результатов всех процессоров
    ADAPTIVE = "adaptive"       # Адаптивный выбор процессора по тексту


@dataclass
class ProcessingResult:
    """Результат обработки текста."""
    descriptions: List[Dict[str, Any]]
    processor_results: Dict[str, List[Dict[str, Any]]]  # Результаты каждого процессора
    processing_time: float
    processors_used: List[str]
    quality_metrics: Dict[str, float]
    recommendations: List[str]  # Рекомендации для улучшения


class MultiNLPManager:
    """Менеджер для управления множественными NLP процессорами."""
    
    def __init__(self):
        self.processors: Dict[str, EnhancedNLPProcessor] = {}
        self.processor_configs: Dict[str, ProcessorConfig] = {}
        self.processing_mode = ProcessingMode.SINGLE
        self.default_processor = "spacy"
        self._initialized = False  # Флаг инициализации
        self._init_lock = asyncio.Lock()  # Lock для защиты от race condition
        
        # Глобальные настройки
        self.global_config = {
            'max_parallel_processors': 3,
            'ensemble_voting_threshold': 0.6,  # Минимальный консенсус для ensemble
            'adaptive_text_analysis': True,
            'quality_monitoring': True,
            'auto_processor_selection': True
        }
        
        self.processing_statistics = {
            'total_processed': 0,
            'processor_usage': {},
            'average_quality_scores': {},
            'processing_times': {},
            'error_rates': {}
        }
    
    async def initialize(self):
        """
        Инициализирует все доступные NLP процессоры.

        Защищен Lock'ом от одновременных инициализаций из разных задач.
        """
        async with self._init_lock:
            # Double-check pattern: проверяем еще раз внутри lock
            if self._initialized:
                logger.info("Multi-NLP Manager already initialized, skipping")
                return

            logger.info("Initializing Multi-NLP Manager...")

            # Загружаем конфигурации из базы данных
            await self._load_processor_configs()

            # Инициализируем процессоры
            await self._initialize_processors()

            # Загружаем глобальные настройки
            await self._load_global_settings()

            self._initialized = True  # Устанавливаем флаг инициализации
            logger.info(f"✅ Multi-NLP Manager initialized with {len(self.processors)} processors")
    
    async def _load_processor_configs(self):
        """Загружает конфигурации процессоров из базы данных."""
        try:
            # SpaCy конфигурация
            spacy_settings = await self._get_processor_settings('spacy')
            
            # Создаем полную конфигурацию spaCy
            spacy_config = {
                'model_name': spacy_settings.get('model_name', 'ru_core_news_lg'),
                'disable_components': [],
                'entity_types': ['PERSON', 'LOC', 'GPE', 'FAC', 'ORG'],
                'literary_patterns': spacy_settings.get('literary_patterns', True),
                'character_detection_boost': spacy_settings.get('character_detection_boost', 1.2),
                'location_detection_boost': spacy_settings.get('location_detection_boost', 1.1),
                'atmosphere_keywords': ['мрачный', 'светлый', 'таинственный', 'величественный', 'уютный']
            }
            # Добавляем любые дополнительные настройки
            spacy_config.update(spacy_settings.get('spacy_specific', {}))
            
            self.processor_configs['spacy'] = ProcessorConfig(
                enabled=spacy_settings.get('enabled', True),
                weight=spacy_settings.get('weight', 1.0),
                confidence_threshold=spacy_settings.get('confidence_threshold', 0.3),
                min_description_length=spacy_settings.get('min_description_length', 50),
                max_description_length=spacy_settings.get('max_description_length', 1000),
                min_word_count=spacy_settings.get('min_word_count', 10),
                custom_settings={'spacy': spacy_config}
            )
            
            # Natasha конфигурация
            natasha_settings = await self._get_processor_settings('natasha')
            self.processor_configs['natasha'] = ProcessorConfig(
                enabled=natasha_settings.get('enabled', True),
                weight=natasha_settings.get('weight', 1.2),  # Natasha лучше для русского
                confidence_threshold=natasha_settings.get('confidence_threshold', 0.4),
                min_description_length=natasha_settings.get('min_description_length', 40),
                max_description_length=natasha_settings.get('max_description_length', 1200),
                min_word_count=natasha_settings.get('min_word_count', 8),
                custom_settings={'natasha': natasha_settings.get('natasha_specific', {})}
            )
            
            # Stanza конфигурация (будем добавлять)
            stanza_settings = await self._get_processor_settings('stanza')
            self.processor_configs['stanza'] = ProcessorConfig(
                enabled=stanza_settings.get('enabled', False),  # По умолчанию отключен
                weight=stanza_settings.get('weight', 0.8),
                confidence_threshold=stanza_settings.get('confidence_threshold', 0.5),
                custom_settings={'stanza': stanza_settings.get('stanza_specific', {})}
            )
            
        except Exception as e:
            logger.warning(f"Failed to load processor configs: {e}")
            # Используем конфигурации по умолчанию
            self._set_default_configs()
    
    async def _get_processor_settings(self, processor_name: str) -> Dict[str, Any]:
        """Получает настройки для конкретного процессора."""
        try:
            settings = await settings_manager.get_category_settings(f'nlp_{processor_name}')
            return settings
        except Exception as e:
            logger.warning(f"Failed to load settings for {processor_name}: {e}")
            return {}
    
    def _set_default_configs(self):
        """Устанавливает конфигурации по умолчанию."""
        self.processor_configs = {
            'spacy': ProcessorConfig(
                enabled=True, 
                weight=1.0,
                custom_settings={
                    'spacy': {
                        'model_name': 'ru_core_news_lg',
                        'disable_components': [],
                        'entity_types': ['PERSON', 'LOC', 'GPE', 'FAC', 'ORG'],
                        'literary_patterns': True,
                        'character_detection_boost': 1.2,
                        'location_detection_boost': 1.1,
                        'atmosphere_keywords': ['мрачный', 'светлый', 'таинственный', 'величественный', 'уютный']
                    }
                }
            ),
            'natasha': ProcessorConfig(
                enabled=True, 
                weight=1.2,
                custom_settings={
                    'natasha': {
                        'enable_morphology': True,
                        'enable_syntax': True,
                        'enable_ner': True,
                        'literary_boost': 1.3
                    }
                }
            ),
            'stanza': ProcessorConfig(
                enabled=False, 
                weight=0.8,
                custom_settings={'stanza': {}}
            )
        }
    
    async def _initialize_processors(self):
        """Инициализирует все включенные процессоры."""
        for processor_name, config in self.processor_configs.items():
            if not config.enabled:
                continue
                
            try:
                if processor_name == 'spacy':
                    processor = EnhancedSpacyProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors['spacy'] = processor
                        logger.info("✅ SpaCy processor initialized")
                
                elif processor_name == 'natasha':
                    processor = EnhancedNatashaProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors['natasha'] = processor
                        logger.info("✅ Natasha processor initialized")
                
                elif processor_name == 'stanza':
                    processor = EnhancedStanzaProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors['stanza'] = processor
                        logger.info("✅ Stanza processor initialized")
                    
            except Exception as e:
                logger.error(f"Failed to initialize {processor_name} processor: {e}")
    
    async def _load_global_settings(self):
        """Загружает глобальные настройки системы."""
        try:
            global_settings = await settings_manager.get_category_settings('nlp_global')
            
            self.processing_mode = ProcessingMode(global_settings.get('processing_mode', 'single'))
            self.default_processor = global_settings.get('default_processor', 'spacy')
            self.global_config.update(global_settings.get('global_config', {}))
            
        except Exception as e:
            logger.warning(f"Failed to load global settings: {e}")
    
    async def extract_descriptions(self, text: str, chapter_id: str = None, 
                                 processor_name: str = None, 
                                 mode: ProcessingMode = None) -> ProcessingResult:
        """
        Извлекает описания из текста используя указанный режим обработки.
        """
        start_time = datetime.now()
        
        # Определяем режим обработки
        processing_mode = mode or self.processing_mode
        
        # Определяем процессоры для использования
        processors_to_use = self._select_processors(text, processor_name, processing_mode)
        
        if not processors_to_use:
            logger.warning("No processors available for text processing")
            return ProcessingResult(
                descriptions=[],
                processor_results={},
                processing_time=0.0,
                processors_used=[],
                quality_metrics={},
                recommendations=["No NLP processors available"]
            )
        
        # Обрабатываем текст
        if processing_mode == ProcessingMode.SINGLE:
            result = await self._process_single(text, chapter_id, processors_to_use[0])
        elif processing_mode == ProcessingMode.PARALLEL:
            result = await self._process_parallel(text, chapter_id, processors_to_use)
        elif processing_mode == ProcessingMode.SEQUENTIAL:
            result = await self._process_sequential(text, chapter_id, processors_to_use)
        elif processing_mode == ProcessingMode.ENSEMBLE:
            result = await self._process_ensemble(text, chapter_id, processors_to_use)
        elif processing_mode == ProcessingMode.ADAPTIVE:
            result = await self._process_adaptive(text, chapter_id)
        else:
            result = await self._process_single(text, chapter_id, processors_to_use[0])
        
        # Добавляем время обработки
        processing_time = (datetime.now() - start_time).total_seconds()
        result.processing_time = processing_time
        
        # Обновляем статистику
        self._update_statistics(result)
        
        return result
    
    def _select_processors(self, text: str, processor_name: str = None, 
                          mode: ProcessingMode = ProcessingMode.SINGLE) -> List[str]:
        """Выбирает процессоры для использования на основе параметров."""
        available_processors = list(self.processors.keys())
        
        if processor_name and processor_name in available_processors:
            return [processor_name]
        
        if mode == ProcessingMode.SINGLE:
            return [self.default_processor] if self.default_processor in available_processors else available_processors[:1]
        elif mode in [ProcessingMode.PARALLEL, ProcessingMode.SEQUENTIAL, ProcessingMode.ENSEMBLE]:
            return available_processors[:self.global_config.get('max_parallel_processors', 3)]
        elif mode == ProcessingMode.ADAPTIVE:
            return self._adaptive_processor_selection(text)
        
        return available_processors[:1]
    
    def _adaptive_processor_selection(self, text: str) -> List[str]:
        """Адаптивно выбирает процессоры на основе характеристик текста."""
        selected = []
        
        # Анализируем текст
        text_length = len(text)
        word_count = len(text.split())
        has_names = self._contains_person_names(text)
        has_locations = self._contains_location_names(text)
        complexity = self._estimate_text_complexity(text)
        
        # Выбираем процессоры на основе характеристик
        if has_names and 'natasha' in self.processors:
            selected.append('natasha')  # Natasha лучше для русских имен
        
        if text_length > 1000 and 'spacy' in self.processors:
            selected.append('spacy')  # spaCy хорош для длинных текстов
        
        if complexity > 0.7 and 'stanza' in self.processors:
            selected.append('stanza')  # Stanza для сложных конструкций
        
        # Если ничего не выбрано, используем процессор по умолчанию
        if not selected and self.default_processor in self.processors:
            selected.append(self.default_processor)
        
        return selected or list(self.processors.keys())[:1]
    
    async def _process_single(self, text: str, chapter_id: str, processor_name: str) -> ProcessingResult:
        """Обрабатывает текст одним процессором."""
        processor = self.processors[processor_name]
        descriptions = await processor.extract_descriptions(text, chapter_id)
        
        quality_metrics = {
            processor_name: processor._calculate_quality_score(descriptions)
        }
        
        return ProcessingResult(
            descriptions=descriptions,
            processor_results={processor_name: descriptions},
            processing_time=0.0,  # Будет установлено позже
            processors_used=[processor_name],
            quality_metrics=quality_metrics,
            recommendations=self._generate_recommendations(quality_metrics, [processor_name])
        )
    
    async def _process_parallel(self, text: str, chapter_id: str, processor_names: List[str]) -> ProcessingResult:
        """Обрабатывает текст несколькими процессорами параллельно."""
        tasks = []
        for name in processor_names:
            if name in self.processors:
                task = self.processors[name].extract_descriptions(text, chapter_id)
                tasks.append((name, task))
        
        # Выполняем параллельно
        results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
        
        processor_results = {}
        quality_metrics = {}
        all_descriptions = []
        
        for i, (name, _) in enumerate(tasks):
            if isinstance(results[i], Exception):
                logger.error(f"Error in {name} processor: {results[i]}")
                processor_results[name] = []
                quality_metrics[name] = 0.0
            else:
                descriptions = results[i]
                processor_results[name] = descriptions
                quality_metrics[name] = self.processors[name]._calculate_quality_score(descriptions)
                all_descriptions.extend(descriptions)
        
        # Удаляем дубликаты и комбинируем результаты
        combined_descriptions = self._combine_descriptions(all_descriptions)
        
        return ProcessingResult(
            descriptions=combined_descriptions,
            processor_results=processor_results,
            processing_time=0.0,
            processors_used=processor_names,
            quality_metrics=quality_metrics,
            recommendations=self._generate_recommendations(quality_metrics, processor_names)
        )
    
    async def _process_sequential(self, text: str, chapter_id: str, processor_names: List[str]) -> ProcessingResult:
        """Обрабатывает текст несколькими процессорами последовательно."""
        processor_results = {}
        quality_metrics = {}
        all_descriptions = []
        
        for name in processor_names:
            if name in self.processors:
                try:
                    descriptions = await self.processors[name].extract_descriptions(text, chapter_id)
                    processor_results[name] = descriptions
                    quality_metrics[name] = self.processors[name]._calculate_quality_score(descriptions)
                    all_descriptions.extend(descriptions)
                except Exception as e:
                    logger.error(f"Error in {name} processor: {e}")
                    processor_results[name] = []
                    quality_metrics[name] = 0.0
        
        combined_descriptions = self._combine_descriptions(all_descriptions)
        
        return ProcessingResult(
            descriptions=combined_descriptions,
            processor_results=processor_results,
            processing_time=0.0,
            processors_used=processor_names,
            quality_metrics=quality_metrics,
            recommendations=self._generate_recommendations(quality_metrics, processor_names)
        )
    
    async def _process_ensemble(self, text: str, chapter_id: str, processor_names: List[str]) -> ProcessingResult:
        """Обрабатывает текст используя ensemble подход с голосованием."""
        # Сначала обрабатываем параллельно
        parallel_result = await self._process_parallel(text, chapter_id, processor_names)
        
        # Применяем ensemble логику
        ensemble_descriptions = self._ensemble_voting(parallel_result.processor_results)
        
        return ProcessingResult(
            descriptions=ensemble_descriptions,
            processor_results=parallel_result.processor_results,
            processing_time=parallel_result.processing_time,
            processors_used=processor_names,
            quality_metrics=parallel_result.quality_metrics,
            recommendations=parallel_result.recommendations + ["Used ensemble voting for improved accuracy"]
        )
    
    async def _process_adaptive(self, text: str, chapter_id: str) -> ProcessingResult:
        """Адаптивная обработка на основе анализа текста."""
        # Выбираем процессоры адаптивно
        selected_processors = self._adaptive_processor_selection(text)
        
        # Определяем лучший режим для данного текста
        text_complexity = self._estimate_text_complexity(text)
        
        if text_complexity > 0.8 or len(selected_processors) > 2:
            # Сложный текст - используем ensemble
            return await self._process_ensemble(text, chapter_id, selected_processors)
        elif len(selected_processors) == 2:
            # Средняя сложность - параллельно
            return await self._process_parallel(text, chapter_id, selected_processors)
        else:
            # Простой текст - один процессор
            return await self._process_single(text, chapter_id, selected_processors[0])
    
    def _combine_descriptions(self, descriptions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Комбинирует описания от разных процессоров, удаляя дубликаты."""
        if not descriptions:
            return []
        
        # Группируем похожие описания
        grouped = {}
        
        for desc in descriptions:
            # Создаем ключ на основе содержания и типа
            content_key = (desc['content'][:100], desc['type'])  # Первые 100 символов + тип
            
            if content_key not in grouped:
                grouped[content_key] = []
            grouped[content_key].append(desc)
        
        # Выбираем лучшее описание из каждой группы
        combined = []
        for group_descriptions in grouped.values():
            # Выбираем описание с наивысшим priority_score
            best_desc = max(group_descriptions, key=lambda x: x.get('priority_score', 0))
            
            # Добавляем информацию об источниках
            sources = list(set(desc.get('source', 'unknown') for desc in group_descriptions))
            best_desc['sources'] = sources
            best_desc['consensus_strength'] = len(group_descriptions) / len(self.processors)
            
            combined.append(best_desc)
        
        # Сортируем по приоритету
        combined.sort(key=lambda x: x.get('priority_score', 0), reverse=True)
        
        return combined
    
    def _ensemble_voting(self, processor_results: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Применяет ensemble голосование для выбора лучших описаний."""
        if not processor_results:
            return []
        
        # Собираем все описания
        all_descriptions = []
        for descriptions in processor_results.values():
            all_descriptions.extend(descriptions)
        
        # Комбинируем с учетом весов процессоров
        combined = self._combine_descriptions(all_descriptions)
        
        # Фильтруем по порогу консенсуса
        voting_threshold = self.global_config.get('ensemble_voting_threshold', 0.6)
        
        filtered_descriptions = []
        for desc in combined:
            consensus = desc.get('consensus_strength', 0)
            if consensus >= voting_threshold:
                # Увеличиваем приоритет для описаний с высоким консенсусом
                desc['priority_score'] *= (1.0 + consensus * 0.5)
                filtered_descriptions.append(desc)
        
        return filtered_descriptions
    
    def _contains_person_names(self, text: str) -> bool:
        """Проверяет наличие имен в тексте (простая эвристика)."""
        # Простые паттерны для русских имен
        import re
        name_patterns = [
            r'\b[А-Я][а-я]+(?:ов|ев|ин|ын|ич|на|ия|ья)\b',  # Фамилии
            r'\b[А-Я][а-я]{2,}(?:\s+[А-Я][а-я]+)?\b'        # Имена
        ]
        
        for pattern in name_patterns:
            if re.search(pattern, text):
                return True
        return False
    
    def _contains_location_names(self, text: str) -> bool:
        """Проверяет наличие географических названий."""
        location_keywords = ['город', 'село', 'деревня', 'столица', 'область', 'район', 'улица', 'площадь']
        return any(keyword in text.lower() for keyword in location_keywords)
    
    def _estimate_text_complexity(self, text: str) -> float:
        """Оценивает сложность текста для выбора подходящего процессора."""
        # Простые метрики сложности
        sentences = text.count('.') + text.count('!') + text.count('?')
        words = len(text.split())
        avg_word_length = sum(len(word) for word in text.split()) / max(1, words)
        avg_sentence_length = words / max(1, sentences)
        
        # Нормализуем метрики
        word_complexity = min(1.0, avg_word_length / 10)  # Слова >10 символов считаются сложными
        sentence_complexity = min(1.0, avg_sentence_length / 20)  # Предложения >20 слов сложные
        
        return (word_complexity + sentence_complexity) / 2
    
    def _generate_recommendations(self, quality_metrics: Dict[str, float], 
                                processors_used: List[str]) -> List[str]:
        """Генерирует рекомендации для улучшения обработки."""
        recommendations = []
        
        avg_quality = sum(quality_metrics.values()) / max(1, len(quality_metrics))
        
        if avg_quality < 0.3:
            recommendations.append("Low quality results. Consider adjusting confidence thresholds.")
        
        if len(processors_used) == 1:
            recommendations.append("Consider using multiple processors for better coverage.")
        
        # Рекомендации по процессорам
        best_processor = max(quality_metrics.items(), key=lambda x: x[1], default=(None, 0))
        if best_processor[1] > 0.7:
            recommendations.append(f"Processor {best_processor[0]} showed excellent results.")
        
        return recommendations
    
    def _update_statistics(self, result: ProcessingResult):
        """Обновляет статистику использования процессоров."""
        self.processing_statistics['total_processed'] += 1
        
        for processor_name in result.processors_used:
            self.processing_statistics['processor_usage'][processor_name] = \
                self.processing_statistics['processor_usage'].get(processor_name, 0) + 1
        
        for proc_name, quality in result.quality_metrics.items():
            if proc_name not in self.processing_statistics['average_quality_scores']:
                self.processing_statistics['average_quality_scores'][proc_name] = []
            self.processing_statistics['average_quality_scores'][proc_name].append(quality)
    
    async def get_processor_status(self) -> Dict[str, Any]:
        """Возвращает статус всех процессоров."""
        status = {
            'available_processors': list(self.processors.keys()),
            'default_processor': self.default_processor,
            'processing_mode': self.processing_mode.value,
            'statistics': self.processing_statistics,
            'processor_details': {}
        }
        
        for name, processor in self.processors.items():
            status['processor_details'][name] = {
                'type': processor.processor_type.value,
                'loaded': processor.loaded,
                'available': processor.is_available(),
                'performance_metrics': processor.get_performance_metrics(),
                'config': asdict(self.processor_configs.get(name, ProcessorConfig()))
            }
        
        return status
    
    async def update_processor_config(self, processor_name: str, new_config: Dict[str, Any]) -> bool:
        """Обновляет конфигурацию процессора."""
        try:
            if processor_name in self.processor_configs:
                # Обновляем конфигурацию
                config = self.processor_configs[processor_name]
                for key, value in new_config.items():
                    if hasattr(config, key):
                        setattr(config, key, value)
                
                # Сохраняем в базе данных
                await settings_manager.set_category_settings(f'nlp_{processor_name}', new_config)
                
                # Переинициализируем процессор если нужно
                if processor_name in self.processors:
                    processor = self.processors[processor_name]
                    await processor.load_model()  # Перезагружаем с новыми настройками
                
                logger.info(f"✅ Updated config for {processor_name} processor")
                return True
            
        except Exception as e:
            logger.error(f"Failed to update {processor_name} config: {e}")
        
        return False


# Создаем глобальный экземпляр менеджера
multi_nlp_manager = MultiNLPManager()
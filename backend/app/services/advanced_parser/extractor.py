"""
AdvancedDescriptionExtractor - главный оркестратор продвинутого парсера.

Этот модуль координирует работу всех компонентов продвинутого парсера
и предоставляет простой API для извлечения качественных длинных описаний.

Pipeline:
1. ParagraphSegmenter - сегментация на параграфы с классификацией
2. DescriptionBoundaryDetector - детектирование многопараграфных описаний
3. MultiFactorConfidenceScorer - оценка качества описаний
4. Фильтрация и ранжирование - отбор лучших описаний

РЕВОЛЮЦИОННЫЕ ИЗМЕНЕНИЯ:
- Фокус на ДЛИННЫЕ описания (500-3500 символов, приоритет 2000-3500)
- Многопараграфный анализ вместо предложений
- 5-факторная оценка качества
- Адаптивные пороги по длине
"""

import time
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple
from datetime import datetime

from .config import AdvancedParserConfig, DescriptionType, DEFAULT_CONFIG
from .paragraph_segmenter import ParagraphSegmenter, Paragraph
from .boundary_detector import DescriptionBoundaryDetector, CompleteDescription
from .confidence_scorer import MultiFactorConfidenceScorer, ConfidenceScoreBreakdown


@dataclass
class ExtractionResult:
    """
    Результат извлечения описаний из текста.

    Attributes:
        descriptions: Список кортежей (описание, оценка)
        total_extracted: Общее количество извлеченных описаний
        passed_threshold: Количество прошедших порог quality
        statistics: Детальная статистика по извлечению
        processing_time: Время обработки в секундах
        metadata: Дополнительные метаданные
    """
    descriptions: List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]]
    total_extracted: int
    passed_threshold: int
    statistics: Dict
    processing_time: float
    metadata: Dict = field(default_factory=dict)

    def get_high_priority_descriptions(self, top_n: Optional[int] = None) -> List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]]:
        """
        Получить описания с наивысшим приоритетом.

        Приоритет определяется как overall_score * priority_weight.
        ДЛИННЫЕ описания (2000-3500) автоматически получают высокий приоритет.

        Args:
            top_n: Количество описаний (если None, вернуть все)

        Returns:
            Список описаний, отсортированных по приоритету
        """
        sorted_descriptions = sorted(
            self.descriptions,
            key=lambda item: item[1].overall_score * item[1].priority_weight,
            reverse=True
        )

        if top_n:
            return sorted_descriptions[:top_n]
        return sorted_descriptions

    def get_by_type(self, description_type: DescriptionType) -> List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]]:
        """
        Получить описания определенного типа.

        Args:
            description_type: Тип описания (LOCATION, CHARACTER, ATMOSPHERE)

        Returns:
            Список описаний этого типа
        """
        return [
            (desc, score)
            for desc, score in self.descriptions
            if score.description_type == description_type
        ]

    def get_long_descriptions(self, min_chars: int = 1000) -> List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]]:
        """
        Получить только длинные описания.

        Args:
            min_chars: Минимальная длина в символах

        Returns:
            Список длинных описаний
        """
        return [
            (desc, score)
            for desc, score in self.descriptions
            if desc.char_length >= min_chars
        ]

    def __repr__(self) -> str:
        return f"ExtractionResult(total={self.total_extracted}, " \
               f"passed={self.passed_threshold}, " \
               f"time={self.processing_time:.2f}s)"


class AdvancedDescriptionExtractor:
    """
    Главный оркестратор продвинутого парсера описаний.

    Координирует работу всех компонентов:
    1. ParagraphSegmenter - сегментация текста
    2. DescriptionBoundaryDetector - детектирование границ
    3. MultiFactorConfidenceScorer - оценка качества

    Предоставляет простой API для извлечения качественных описаний.

    Example:
        >>> extractor = AdvancedDescriptionExtractor()
        >>> result = extractor.extract(chapter_text)
        >>> print(f"Найдено {result.passed_threshold} качественных описаний")
        >>>
        >>> # Получить длинные описания (2000+ символов)
        >>> long_descs = result.get_long_descriptions(min_chars=2000)
        >>>
        >>> # Получить описания локаций
        >>> locations = result.get_by_type(DescriptionType.LOCATION)
    """

    def __init__(self, config: Optional[AdvancedParserConfig] = None):
        """
        Инициализация экстрактора.

        Args:
            config: Конфигурация парсера (опционально)
        """
        self.config = config or DEFAULT_CONFIG

        # Инициализация компонентов
        self.segmenter = ParagraphSegmenter(self.config)
        self.boundary_detector = DescriptionBoundaryDetector(self.config)
        self.confidence_scorer = MultiFactorConfidenceScorer(self.config)

        # Статистика работы
        self.total_extractions = 0
        self.total_processing_time = 0.0

    def extract(
        self,
        text: str,
        min_confidence: Optional[float] = None,
        priority_types: Optional[List[DescriptionType]] = None
    ) -> ExtractionResult:
        """
        Извлечь качественные описания из текста.

        Pipeline:
        1. Сегментация текста на параграфы
        2. Детектирование многопараграфных описаний
        3. Оценка качества каждого описания (5 факторов)
        4. Фильтрация по порогу confidence
        5. Ранжирование по приоритету

        Args:
            text: Исходный текст для обработки
            min_confidence: Минимальный порог confidence (если None, использовать из config)
            priority_types: Приоритетные типы описаний (если None, все типы равнозначны)

        Returns:
            ExtractionResult с описаниями и статистикой
        """
        start_time = time.time()

        # Этап 1: Сегментация текста на параграфы
        paragraphs = self.segmenter.segment(text)

        if not paragraphs:
            return self._create_empty_result(time.time() - start_time)

        # Этап 2: Детектирование полных многопараграфных описаний
        complete_descriptions = self.boundary_detector.detect(paragraphs)

        if not complete_descriptions:
            return self._create_empty_result(
                time.time() - start_time,
                metadata={"paragraphs_found": len(paragraphs)}
            )

        # Этап 3: Оценка качества каждого описания
        scored_descriptions = []
        for description in complete_descriptions:
            score_breakdown = self.confidence_scorer.score(description)
            scored_descriptions.append((description, score_breakdown))

        # Этап 4: Фильтрация по порогу confidence
        if min_confidence is not None:
            # Использовать заданный порог
            filtered = [
                (desc, score)
                for desc, score in scored_descriptions
                if score.overall_score >= min_confidence
            ]
        else:
            # Использовать адаптивные пороги из конфигурации
            filtered = self.confidence_scorer.filter_by_threshold(scored_descriptions)

        # Этап 5: Ранжирование по приоритету
        ranked = self.confidence_scorer.rank_by_priority(filtered)

        # Опционально: приоритизировать определенные типы
        if priority_types:
            ranked = self._prioritize_types(ranked, priority_types)

        # Собрать статистику
        processing_time = time.time() - start_time
        statistics = self._collect_statistics(
            paragraphs,
            complete_descriptions,
            scored_descriptions,
            ranked
        )

        # Обновить глобальную статистику
        self.total_extractions += 1
        self.total_processing_time += processing_time

        return ExtractionResult(
            descriptions=ranked,
            total_extracted=len(complete_descriptions),
            passed_threshold=len(ranked),
            statistics=statistics,
            processing_time=processing_time,
            metadata={
                "timestamp": datetime.utcnow().isoformat(),
                "config": {
                    "min_char_length": self.config.min_char_length,
                    "max_char_length": self.config.max_char_length,
                    "optimal_range": self.config.optimal_char_range,
                }
            }
        )

    def extract_from_chapter(
        self,
        chapter_text: str,
        chapter_number: int,
        book_genre: Optional[str] = None
    ) -> ExtractionResult:
        """
        Извлечь описания из главы книги.

        Специализированный метод для обработки глав книг.

        Args:
            chapter_text: Текст главы
            chapter_number: Номер главы
            book_genre: Жанр книги (опционально)

        Returns:
            ExtractionResult с дополнительными метаданными
        """
        result = self.extract(chapter_text)

        # Добавить метаданные главы
        result.metadata.update({
            "chapter_number": chapter_number,
            "book_genre": book_genre,
        })

        return result

    def extract_batch(
        self,
        texts: List[Tuple[str, Dict]],
        max_processing_time: Optional[int] = None
    ) -> List[ExtractionResult]:
        """
        Пакетная обработка нескольких текстов.

        Args:
            texts: Список кортежей (текст, метаданные)
            max_processing_time: Максимальное время обработки в секундах (опционально)

        Returns:
            Список результатов извлечения
        """
        results = []
        start_time = time.time()

        for text, metadata in texts:
            # Проверить timeout
            if max_processing_time:
                elapsed = time.time() - start_time
                if elapsed > max_processing_time:
                    break

            result = self.extract(text)
            result.metadata.update(metadata)
            results.append(result)

        return results

    def _create_empty_result(
        self,
        processing_time: float,
        metadata: Optional[Dict] = None
    ) -> ExtractionResult:
        """Создать пустой результат."""
        return ExtractionResult(
            descriptions=[],
            total_extracted=0,
            passed_threshold=0,
            statistics={
                "paragraphs": {"total": 0},
                "descriptions": {"total": 0},
                "scores": {},
            },
            processing_time=processing_time,
            metadata=metadata or {}
        )

    def _prioritize_types(
        self,
        descriptions: List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]],
        priority_types: List[DescriptionType]
    ) -> List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]]:
        """
        Приоритизировать определенные типы описаний.

        Args:
            descriptions: Список описаний
            priority_types: Приоритетные типы

        Returns:
            Пересортированный список
        """
        priority_set = set(priority_types)

        # Разделить на приоритетные и остальные
        priority_descs = [
            (desc, score)
            for desc, score in descriptions
            if score.description_type in priority_set
        ]
        other_descs = [
            (desc, score)
            for desc, score in descriptions
            if score.description_type not in priority_set
        ]

        # Объединить: сначала приоритетные
        return priority_descs + other_descs

    def _collect_statistics(
        self,
        paragraphs: List[Paragraph],
        complete_descriptions: List[CompleteDescription],
        scored_descriptions: List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]],
        filtered_descriptions: List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]]
    ) -> Dict:
        """
        Собрать детальную статистику по извлечению.

        Args:
            paragraphs: Список параграфов
            complete_descriptions: Полные описания
            scored_descriptions: Оцененные описания
            filtered_descriptions: Отфильтрованные описания

        Returns:
            Словарь со статистикой
        """
        # Статистика параграфов
        para_stats = self.segmenter.get_statistics(paragraphs)

        # Статистика границ
        boundary_stats = self.boundary_detector.get_statistics(complete_descriptions)

        # Статистика оценок
        score_stats = self.confidence_scorer.get_statistics(scored_descriptions)

        # Статистика длины описаний
        length_distribution = {
            "very_long (2000-3500)": 0,
            "long (1000-2000)": 0,
            "medium (500-1000)": 0,
            "short (100-500)": 0,
        }

        for desc, score in filtered_descriptions:
            if 2000 <= desc.char_length <= 3500:
                length_distribution["very_long (2000-3500)"] += 1
            elif 1000 <= desc.char_length < 2000:
                length_distribution["long (1000-2000)"] += 1
            elif 500 <= desc.char_length < 1000:
                length_distribution["medium (500-1000)"] += 1
            elif 100 <= desc.char_length < 500:
                length_distribution["short (100-500)"] += 1

        return {
            "paragraphs": para_stats,
            "descriptions": boundary_stats,
            "scores": score_stats,
            "filtered": {
                "total": len(filtered_descriptions),
                "length_distribution": length_distribution,
                "avg_priority_weight": sum(
                    score.priority_weight
                    for _, score in filtered_descriptions
                ) / len(filtered_descriptions) if filtered_descriptions else 0,
            }
        }

    def get_global_statistics(self) -> Dict:
        """
        Получить глобальную статистику работы экстрактора.

        Returns:
            Словарь со статистикой
        """
        return {
            "total_extractions": self.total_extractions,
            "total_processing_time": self.total_processing_time,
            "avg_processing_time": (
                self.total_processing_time / self.total_extractions
                if self.total_extractions > 0 else 0
            ),
            "config": {
                "min_char_length": self.config.min_char_length,
                "max_char_length": self.config.max_char_length,
                "optimal_range": self.config.optimal_char_range,
                "min_overall_confidence": self.config.min_overall_confidence,
            }
        }

    def reset_statistics(self):
        """Сбросить глобальную статистику."""
        self.total_extractions = 0
        self.total_processing_time = 0.0

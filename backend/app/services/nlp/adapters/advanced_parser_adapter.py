"""
Адаптер для интеграции Advanced Parser в Multi-NLP систему.

Конвертирует результаты AdvancedDescriptionExtractor в формат ProcessingResult,
совместимый с Multi-NLP Manager.

Архитектура:
- AdvancedParserAdapter - главный адаптер
- Конвертирует ExtractionResult → ProcessingResult
- Поддерживает LLM enrichment (опционально)
- Собирает детальные метрики качества
"""

import time
import logging
from typing import Dict, Any, List
from dataclasses import asdict

from ..strategies.base_strategy import ProcessingResult
from ...advanced_parser.extractor import (
    AdvancedDescriptionExtractor,
    ExtractionResult,
)
from ...advanced_parser.config import DescriptionType

logger = logging.getLogger(__name__)


class AdvancedParserAdapter:
    """
    Адаптер для конвертации результатов Advanced Parser в Multi-NLP формат.

    Интегрирует продвинутый парсер описаний (AdvancedDescriptionExtractor)
    с Multi-NLP Manager, позволяя использовать его как альтернативу
    стандартным NLP процессорам (SpaCy, Natasha, Stanza).

    Преимущества:
    - Фокус на длинные описания (500-3500 символов)
    - Многопараграфный анализ
    - 5-факторная оценка качества
    - Опциональное LLM обогащение

    Example:
        >>> adapter = AdvancedParserAdapter(enable_enrichment=True)
        >>> result = await adapter.extract_descriptions(chapter_text, chapter_id)
        >>> print(f"Найдено {len(result.descriptions)} описаний")
        >>> print(f"Средний score: {result.quality_metrics['average_score']:.2f}")
    """

    def __init__(self, enable_enrichment: bool = True):
        """
        Инициализация адаптера.

        Args:
            enable_enrichment: Включить LLM enrichment (требует API ключ)
        """
        self.extractor = AdvancedDescriptionExtractor(enable_enrichment=enable_enrichment)
        self.enable_enrichment = enable_enrichment

        # Статистика использования
        self.total_conversions = 0
        self.total_conversion_time = 0.0
        self.total_descriptions_converted = 0

        logger.info(
            f"✅ Advanced Parser Adapter initialized "
            f"(enrichment: {enable_enrichment}, "
            f"available: {self.extractor.enricher is not None})"
        )

    async def extract_descriptions(
        self, text: str, chapter_id: str = None
    ) -> ProcessingResult:
        """
        Извлечь описания используя Advanced Parser и конвертировать в ProcessingResult.

        Pipeline:
        1. Извлечь описания через AdvancedDescriptionExtractor
        2. Конвертировать ExtractionResult → ProcessingResult
        3. Собрать метрики качества
        4. Сгенерировать рекомендации

        Args:
            text: Текст для обработки
            chapter_id: Идентификатор главы (опционально)

        Returns:
            ProcessingResult совместимый с Multi-NLP системой
        """
        start_time = time.time()

        # Этап 1: Извлечение описаний через Advanced Parser
        extraction_result = self.extractor.extract(text)

        # Этап 2: Конвертация в Multi-NLP формат
        descriptions = self._convert_to_multi_nlp_format(extraction_result)

        # Этап 3: Расчет времени обработки
        processing_time = time.time() - start_time

        # Обновить статистику
        self.total_conversions += 1
        self.total_conversion_time += processing_time
        self.total_descriptions_converted += len(descriptions)

        # Этап 4: Построение ProcessingResult
        return ProcessingResult(
            descriptions=descriptions,
            processor_results={"advanced_parser": descriptions},
            processing_time=processing_time,
            processors_used=["advanced_parser"],
            quality_metrics=self._extract_quality_metrics(extraction_result),
            recommendations=self._generate_recommendations(extraction_result),
        )

    def _convert_to_multi_nlp_format(
        self, result: ExtractionResult
    ) -> List[Dict[str, Any]]:
        """
        Конвертировать ExtractionResult в Multi-NLP формат списка описаний.

        Формат Multi-NLP описания:
        {
            "content": str,              # Текст описания
            "type": str,                 # Тип: location/character/atmosphere
            "priority_score": float,     # Приоритет (0-3.0+)
            "confidence_score": float,   # Уверенность (0-1)
            "source": str,               # Источник: "advanced_parser"
            "metadata": dict             # Дополнительные данные
        }

        Args:
            result: Результат извлечения из Advanced Parser

        Returns:
            Список описаний в Multi-NLP формате
        """
        descriptions = []

        for desc, score in result.descriptions:
            # Базовое описание
            description = {
                "content": desc.text,
                "type": score.description_type.value,
                "priority_score": score.overall_score * score.priority_weight,
                "confidence_score": score.overall_score,
                "source": "advanced_parser",
                "metadata": {
                    # Структурные данные
                    "char_length": desc.char_length,
                    "paragraph_count": desc.paragraph_count,
                    "start_paragraph_idx": desc.start_paragraph_idx,
                    "end_paragraph_idx": desc.end_paragraph_idx,
                    # Детальная оценка качества (5 факторов)
                    "score_breakdown": {
                        "clarity": score.clarity_score,
                        "detail": score.detail_score,
                        "emotional": score.emotional_score,
                        "contextual": score.contextual_score,
                        "literary": score.literary_score,
                    },
                    # Приоритеты
                    "priority_weight": score.priority_weight,
                    "is_premium_length": (
                        2000 <= desc.char_length <= 3500
                    ),  # Премиум длина для генерации
                },
            }

            # Добавить метаданные обогащения, если доступны
            if hasattr(desc, "enrichment_metadata") and desc.enrichment_metadata:
                description["metadata"]["enrichment"] = desc.enrichment_metadata

            descriptions.append(description)

        return descriptions

    def _extract_quality_metrics(self, result: ExtractionResult) -> Dict[str, float]:
        """
        Извлечь метрики качества из ExtractionResult.

        Метрики:
        - total_extracted: Общее количество извлечено
        - passed_threshold: Прошло порог качества
        - average_score: Средняя уверенность
        - enrichment_rate: Процент обогащенных описаний
        - premium_rate: Процент премиум длины (2000-3500)

        Args:
            result: Результат извлечения

        Returns:
            Словарь с метриками качества
        """
        metrics = {
            "total_extracted": result.total_extracted,
            "passed_threshold": result.passed_threshold,
        }

        if not result.descriptions:
            metrics["average_score"] = 0.0
            metrics["enrichment_rate"] = 0.0
            metrics["premium_rate"] = 0.0
            return metrics

        # Средняя уверенность
        total_score = sum(score.overall_score for _, score in result.descriptions)
        metrics["average_score"] = total_score / len(result.descriptions)

        # Процент обогащенных
        enriched_count = sum(
            1
            for desc, _ in result.descriptions
            if hasattr(desc, "enrichment_metadata")
            and desc.enrichment_metadata
            and desc.enrichment_metadata.get("llm_enriched", False)
        )
        metrics["enrichment_rate"] = enriched_count / len(result.descriptions)

        # Процент премиум длины
        premium_count = sum(
            1 for desc, _ in result.descriptions if 2000 <= desc.char_length <= 3500
        )
        metrics["premium_rate"] = premium_count / len(result.descriptions)

        # Распределение по типам
        type_distribution = {}
        for _, score in result.descriptions:
            desc_type = score.description_type.value
            type_distribution[desc_type] = type_distribution.get(desc_type, 0) + 1

        metrics["type_distribution"] = type_distribution

        return metrics

    def _generate_recommendations(self, result: ExtractionResult) -> List[str]:
        """
        Сгенерировать рекомендации на основе результатов извлечения.

        Рекомендации:
        - По качеству извлечения
        - По настройке порогов
        - По LLM enrichment
        - По длине описаний

        Args:
            result: Результат извлечения

        Returns:
            Список рекомендаций
        """
        recommendations = []

        # Рекомендации по качеству
        if result.passed_threshold == 0:
            recommendations.append(
                "⚠️ Не найдено описаний выше порога качества. "
                "Рассмотрите снижение порога (min_overall_confidence < 0.65) "
                "или улучшите качество текста."
            )
        elif result.passed_threshold < result.total_extracted * 0.3:
            recommendations.append(
                f"⚠️ Только {result.passed_threshold}/{result.total_extracted} описаний "
                f"прошло порог качества ({result.passed_threshold/result.total_extracted:.1%}). "
                f"Текст может содержать мало качественных описаний."
            )

        # Рекомендации по обогащению
        stats = result.statistics
        if stats.get("enrichment", {}).get("enabled", False):
            total_attempted = stats["enrichment"].get("total_enriched", 0)
            if total_attempted == 0:
                recommendations.append(
                    "ℹ️ LLM enrichment включен, но не применялся. "
                    "Возможно, все описания имеют score < 0.6 или нет API ключа."
                )
            else:
                avg_time = stats["enrichment"].get("avg_enrichment_time", 0)
                recommendations.append(
                    f"✅ LLM enrichment активен: {total_attempted} описаний обогащено "
                    f"(среднее время: {avg_time:.2f}s)"
                )

        # Рекомендации по длине
        long_count = len(result.get_long_descriptions(min_chars=2000))
        if long_count > 0:
            recommendations.append(
                f"🎯 Найдено {long_count} премиум длинных описаний (2000+ символов). "
                f"Приоритизируйте их для генерации изображений."
            )
        elif result.passed_threshold > 0:
            # Есть описания, но все короткие
            recommendations.append(
                "ℹ️ Все описания короче 2000 символов. "
                "Длинные описания (2000-3500) дают лучшие результаты генерации."
            )

        # Рекомендации по производительности
        if result.processing_time > 10.0:
            recommendations.append(
                f"⚠️ Обработка заняла {result.processing_time:.1f}s. "
                f"Рассмотрите оптимизацию для больших текстов."
            )

        return recommendations

    def get_adapter_statistics(self) -> Dict[str, Any]:
        """
        Получить статистику работы адаптера.

        Returns:
            Словарь со статистикой
        """
        global_stats = self.extractor.get_global_statistics()

        return {
            "adapter": {
                "total_conversions": self.total_conversions,
                "total_conversion_time": self.total_conversion_time,
                "avg_conversion_time": (
                    self.total_conversion_time / self.total_conversions
                    if self.total_conversions > 0
                    else 0
                ),
                "total_descriptions_converted": self.total_descriptions_converted,
                "avg_descriptions_per_conversion": (
                    self.total_descriptions_converted / self.total_conversions
                    if self.total_conversions > 0
                    else 0
                ),
            },
            "extractor": global_stats,
            "enrichment": {
                "enabled": self.enable_enrichment,
                "available": (
                    self.extractor.enricher is not None
                    and self.extractor.enricher.is_available()
                ),
            },
        }

    def reset_statistics(self):
        """Сбросить статистику адаптера и экстрактора."""
        self.total_conversions = 0
        self.total_conversion_time = 0.0
        self.total_descriptions_converted = 0
        self.extractor.reset_statistics()

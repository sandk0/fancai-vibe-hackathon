"""
MultiFactorConfidenceScorer - многофакторная оценка качества описаний.

Этот модуль реализует третий этап продвинутого парсинга - вычисление
итоговой оценки качества (confidence score) на основе 5 факторов.

РЕВОЛЮЦИОННОЕ ОТЛИЧИЕ от классических подходов:
- 5 независимых факторов вместо простой confidence
- Разные веса для разных факторов
- Адаптивные пороги в зависимости от длины описания
- Приоритет ДЛИННЫМ описаниям (2000-3500 символов)

Формула:
C(D) = Σᵢ wᵢ * fᵢ(D)

где:
- C(D) - итоговая confidence score
- wᵢ - вес i-го фактора
- fᵢ(D) - значение i-го фактора для описания D

5 Факторов:
1. Linguistic Quality (30%) - лингвистическое качество
2. Visual Richness (25%) - визуальное богатство
3. Structural Completeness (20%) - структурная полнота
4. Type Specificity (15%) - специфичность типа
5. Length Appropriateness (10%) - соответствие длины
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple
from collections import Counter

from .config import AdvancedParserConfig, DescriptionType, DEFAULT_CONFIG
from .boundary_detector import CompleteDescription


@dataclass
class ConfidenceScoreBreakdown:
    """
    Детализация оценки confidence с разбивкой по факторам.

    Attributes:
        overall_score: Общая итоговая оценка (0.0-1.0)
        linguistic_quality: Оценка лингвистического качества (0.0-1.0)
        visual_richness: Оценка визуального богатства (0.0-1.0)
        structural_completeness: Оценка структурной полноты (0.0-1.0)
        type_specificity: Оценка специфичности типа (0.0-1.0)
        length_appropriateness: Оценка соответствия длины (0.0-1.0)
        description_type: Определенный тип описания
        priority_weight: Вес приоритета по длине
        passes_threshold: Проходит ли минимальный порог
        metadata: Дополнительные метаданные
    """

    overall_score: float
    linguistic_quality: float
    visual_richness: float
    structural_completeness: float
    type_specificity: float
    length_appropriateness: float
    description_type: DescriptionType
    priority_weight: float
    passes_threshold: bool
    metadata: Dict = field(default_factory=dict)

    def __repr__(self) -> str:
        return (
            f"ConfidenceScore(overall={self.overall_score:.3f}, "
            f"type={self.description_type.value}, "
            f"ling={self.linguistic_quality:.2f}, "
            f"vis={self.visual_richness:.2f}, "
            f"struct={self.structural_completeness:.2f}, "
            f"type_spec={self.type_specificity:.2f}, "
            f"len={self.length_appropriateness:.2f}, "
            f"passes={self.passes_threshold})"
        )


class MultiFactorConfidenceScorer:
    """
    Многофакторная оценка качества описаний.

    Этот класс реализует третий этап продвинутого парсинга - вычисление
    итоговой confidence score на основе 5 независимых факторов.

    Основные возможности:
    1. Лингвистическое качество (adj/noun balance, complexity)
    2. Визуальное богатство (colors, textures, lighting, sizes)
    3. Структурная полнота (начало/конец, multi-sentence)
    4. Специфичность типа (location, character, atmosphere)
    5. Соответствие длины (приоритет длинным описаниям)

    Веса факторов (по умолчанию):
    - Linguistic Quality: 30%
    - Visual Richness: 25%
    - Structural Completeness: 20%
    - Type Specificity: 15%
    - Length Appropriateness: 10%
    """

    def __init__(self, config: Optional[AdvancedParserConfig] = None):
        """
        Инициализация scorer'а.

        Args:
            config: Конфигурация парсера (опционально)
        """
        self.config = config or DEFAULT_CONFIG

        # Компиляция паттернов и подготовка наборов слов
        self._prepare_linguistic_resources()

    def _prepare_linguistic_resources(self):
        """Подготовка лингвистических ресурсов для оценки."""
        # Визуальные слова по категориям
        self.visual_words_sets = {}
        for category, words in self.config.visual_keywords.items():
            self.visual_words_sets[category] = set(word.lower() for word in words)

        # Все визуальные слова
        self.all_visual_words = set()
        for words_set in self.visual_words_sets.values():
            self.all_visual_words.update(words_set)

        # Индикаторы типов описаний
        self.type_indicators_sets = {}
        for desc_type, indicators in self.config.type_indicators.items():
            self.type_indicators_sets[desc_type] = set(
                ind.lower() for ind in indicators
            )

        # Русские прилагательные (частые суффиксы)
        self.adjective_suffixes = [
            "ый",
            "ий",
            "ой",
            "ая",
            "яя",
            "ое",
            "ее",
            "ые",
            "ие",
            "ого",
            "его",
            "ому",
            "ему",
            "ым",
            "им",
            "ом",
            "ем",
        ]

        # Русские существительные (частые окончания)
        self.noun_endings = [
            "а",
            "я",
            "о",
            "е",
            "и",
            "ы",
            "у",
            "ю",
            "ость",
            "есть",
            "ание",
            "ение",
            "ство",
            "тель",
        ]

        # Паттерн для предложений
        self.sentence_pattern = re.compile(r"[.!?]+\s+", re.UNICODE)

    def score(self, description: CompleteDescription) -> ConfidenceScoreBreakdown:
        """
        Вычислить многофакторную confidence score для описания.

        Args:
            description: Полное описание для оценки

        Returns:
            Детализированная оценка с разбивкой по факторам
        """
        text = description.text

        # Фактор 1: Linguistic Quality (30%)
        linguistic_quality = self._calculate_linguistic_quality(text)

        # Фактор 2: Visual Richness (25%)
        visual_richness = self._calculate_visual_richness(text)

        # Фактор 3: Structural Completeness (20%)
        structural_completeness = self._calculate_structural_completeness(
            text, description
        )

        # Фактор 4: Type Specificity (15%)
        description_type, type_specificity = self._calculate_type_specificity(text)

        # Фактор 5: Length Appropriateness (10%)
        length_appropriateness = self._calculate_length_appropriateness(
            description.char_length
        )

        # Вычислить итоговую оценку (взвешенная сумма)
        weights = self.config.confidence_weights
        overall_score = (
            weights["linguistic_quality"] * linguistic_quality
            + weights["visual_richness"] * visual_richness
            + weights["structural_completeness"] * structural_completeness
            + weights["type_specificity"] * type_specificity
            + weights["length_appropriateness"] * length_appropriateness
        )

        # Получить вес приоритета для этой длины
        priority_weight = self.config.get_priority_weight(description.char_length)

        # Получить адаптивный порог для этой длины
        adaptive_threshold = self.config.get_quality_threshold(description.char_length)

        # Проверить, проходит ли порог
        passes_threshold = overall_score >= adaptive_threshold

        # Проверить минимальные пороги для каждого фактора
        min_thresholds = self.config.min_factor_scores
        passes_min_thresholds = (
            linguistic_quality >= min_thresholds["linguistic_quality"]
            and visual_richness >= min_thresholds["visual_richness"]
            and structural_completeness >= min_thresholds["structural_completeness"]
            and type_specificity >= min_thresholds["type_specificity"]
            and length_appropriateness >= min_thresholds["length_appropriateness"]
        )

        passes_threshold = passes_threshold and passes_min_thresholds

        return ConfidenceScoreBreakdown(
            overall_score=overall_score,
            linguistic_quality=linguistic_quality,
            visual_richness=visual_richness,
            structural_completeness=structural_completeness,
            type_specificity=type_specificity,
            length_appropriateness=length_appropriateness,
            description_type=description_type,
            priority_weight=priority_weight,
            passes_threshold=passes_threshold,
            metadata={
                "char_length": description.char_length,
                "paragraph_count": description.paragraph_count,
                "coherence_score": description.coherence_score,
                "adaptive_threshold": adaptive_threshold,
            },
        )

    def _calculate_linguistic_quality(self, text: str) -> float:
        """
        Фактор 1: Лингвистическое качество (30%).

        Подфакторы:
        - Баланс прилагательных/существительных (40%)
        - Синтаксическая сложность (средняя длина предложения) (30%)
        - Разнообразие словаря (unique words ratio) (30%)

        Args:
            text: Текст описания

        Returns:
            Оценка от 0.0 до 1.0
        """
        words = text.lower().split()
        if not words:
            return 0.0

        score = 0.0

        # Подфактор 1.1: Баланс прилагательных/существительных (40%)
        adjective_count = sum(
            1
            for word in words
            if any(word.endswith(suffix) for suffix in self.adjective_suffixes)
        )
        noun_count = sum(
            1
            for word in words
            if any(word.endswith(ending) for ending in self.noun_endings)
        )

        if noun_count > 0:
            adj_noun_ratio = adjective_count / noun_count
            # Оптимальное соотношение: 0.3-0.6 прилагательных на существительное
            if 0.3 <= adj_noun_ratio <= 0.6:
                balance_score = 1.0
            elif 0.2 <= adj_noun_ratio < 0.3 or 0.6 < adj_noun_ratio <= 0.8:
                balance_score = 0.7
            elif 0.1 <= adj_noun_ratio < 0.2 or 0.8 < adj_noun_ratio <= 1.0:
                balance_score = 0.5
            else:
                balance_score = 0.3
        else:
            balance_score = 0.0

        score += 0.4 * balance_score

        # Подфактор 1.2: Синтаксическая сложность (30%)
        sentences = self.sentence_pattern.split(text)
        sentences = [s.strip() for s in sentences if s.strip()]

        if sentences:
            avg_sentence_length = sum(len(s.split()) for s in sentences) / len(
                sentences
            )
            # Оптимальная длина: 12-25 слов (описательные предложения длиннее)
            if 12 <= avg_sentence_length <= 25:
                complexity_score = 1.0
            elif 8 <= avg_sentence_length < 12 or 25 < avg_sentence_length <= 35:
                complexity_score = 0.8
            elif 5 <= avg_sentence_length < 8 or 35 < avg_sentence_length <= 45:
                complexity_score = 0.6
            else:
                complexity_score = 0.4
        else:
            complexity_score = 0.5

        score += 0.3 * complexity_score

        # Подфактор 1.3: Разнообразие словаря (30%)
        unique_words = set(words)
        vocab_diversity = len(unique_words) / len(words)
        # Высокое разнообразие = хорошо (>0.5)
        if vocab_diversity >= 0.6:
            diversity_score = 1.0
        elif vocab_diversity >= 0.5:
            diversity_score = 0.9
        elif vocab_diversity >= 0.4:
            diversity_score = 0.7
        else:
            diversity_score = 0.5

        score += 0.3 * diversity_score

        return min(score, 1.0)

    def _calculate_visual_richness(self, text: str) -> float:
        """
        Фактор 2: Визуальное богатство (25%).

        Подфакторы:
        - Количество визуальных слов (40%)
        - Разнообразие категорий визуальных слов (30%)
        - Плотность визуальных слов (30%)

        Args:
            text: Текст описания

        Returns:
            Оценка от 0.0 до 1.0
        """
        words = text.lower().split()
        if not words:
            return 0.0

        score = 0.0

        # Найти все визуальные слова в тексте
        visual_words_found = [w for w in words if w in self.all_visual_words]

        # Подфактор 2.1: Количество визуальных слов (40%)
        visual_count = len(visual_words_found)
        # Оптимально: 5-15 визуальных слов на описание
        if 5 <= visual_count <= 15:
            count_score = 1.0
        elif 3 <= visual_count < 5 or 15 < visual_count <= 20:
            count_score = 0.8
        elif 1 <= visual_count < 3 or 20 < visual_count <= 30:
            count_score = 0.6
        else:
            count_score = 0.3

        score += 0.4 * count_score

        # Подфактор 2.2: Разнообразие категорий (30%)
        categories_found = set()
        for category, words_set in self.visual_words_sets.items():
            if any(vw in words_set for vw in visual_words_found):
                categories_found.add(category)

        # Оптимально: 3+ категорий
        num_categories = len(categories_found)
        if num_categories >= 4:
            diversity_score = 1.0
        elif num_categories == 3:
            diversity_score = 0.9
        elif num_categories == 2:
            diversity_score = 0.7
        elif num_categories == 1:
            diversity_score = 0.5
        else:
            diversity_score = 0.2

        score += 0.3 * diversity_score

        # Подфактор 2.3: Плотность визуальных слов (30%)
        if len(words) > 0:
            visual_density = len(visual_words_found) / len(words)
            # Оптимально: 0.05-0.15 (5-15% слов визуальные)
            if 0.05 <= visual_density <= 0.15:
                density_score = 1.0
            elif 0.03 <= visual_density < 0.05 or 0.15 < visual_density <= 0.20:
                density_score = 0.8
            elif 0.01 <= visual_density < 0.03 or 0.20 < visual_density <= 0.30:
                density_score = 0.6
            else:
                density_score = 0.4
        else:
            density_score = 0.0

        score += 0.3 * density_score

        return min(score, 1.0)

    def _calculate_structural_completeness(
        self, text: str, description: CompleteDescription
    ) -> float:
        """
        Фактор 3: Структурная полнота (20%).

        Подфакторы:
        - Правильное начало (заглавная буква, не местоимение) (30%)
        - Правильное окончание (точка, завершенная мысль) (30%)
        - Многопараграфность (>1 параграфа) (20%)
        - Boundary confidence (20%)

        Args:
            text: Текст описания
            description: Объект описания с метаданными

        Returns:
            Оценка от 0.0 до 1.0
        """
        score = 0.0

        # Подфактор 3.1: Правильное начало (30%)
        first_char = text.strip()[0] if text.strip() else ""
        starts_properly = first_char.isupper() and first_char.isalpha()

        # Проверить, что не начинается с местоимения
        first_word = text.strip().split()[0].lower() if text.strip().split() else ""
        pronouns = {"он", "она", "оно", "они", "его", "её", "их"}
        starts_with_pronoun = first_word in pronouns

        if starts_properly and not starts_with_pronoun:
            start_score = 1.0
        elif starts_properly:
            start_score = 0.7
        else:
            start_score = 0.3

        score += 0.3 * start_score

        # Подфактор 3.2: Правильное окончание (30%)
        last_char = text.strip()[-1] if text.strip() else ""
        ends_properly = last_char in ".!?"

        if ends_properly:
            end_score = 1.0
        else:
            end_score = 0.5

        score += 0.3 * end_score

        # Подфактор 3.3: Многопараграфность (20%)
        para_count = description.paragraph_count
        if para_count >= 3:
            multi_para_score = 1.0
        elif para_count == 2:
            multi_para_score = 0.8
        else:
            multi_para_score = 0.6

        score += 0.2 * multi_para_score

        # Подфактор 3.4: Boundary confidence (20%)
        boundary_conf = description.boundary_confidence
        score += 0.2 * boundary_conf

        return min(score, 1.0)

    def _calculate_type_specificity(self, text: str) -> Tuple[DescriptionType, float]:
        """
        Фактор 4: Специфичность типа (15%).

        Определяет тип описания (LOCATION, CHARACTER, ATMOSPHERE) и
        оценивает уверенность в определении типа.

        Args:
            text: Текст описания

        Returns:
            Кортеж (тип описания, оценка специфичности)
        """
        words = set(text.lower().split())

        # Подсчитать индикаторы для каждого типа
        type_scores = {}

        for desc_type, indicators_set in self.type_indicators_sets.items():
            # Найти совпадения индикаторов
            matches = words & indicators_set
            # Оценка = количество совпадений / корень из общего количества индикаторов
            # (нормализация по размеру словаря)
            type_scores[desc_type] = len(matches) / (len(indicators_set) ** 0.5)

        # Определить доминирующий тип
        if not type_scores or max(type_scores.values()) == 0:
            return DescriptionType.OBJECT, 0.3  # Дефолт с низкой уверенностью

        best_type = max(type_scores, key=type_scores.get)
        best_score = type_scores[best_type]

        # Нормализовать оценку к [0, 1]
        # Оптимально: 3+ индикатора = 1.0
        normalized_score = min(best_score / 2.0, 1.0)

        # Проверить, насколько тип отличается от других
        # (четкая специфичность = хорошо)
        sorted_scores = sorted(type_scores.values(), reverse=True)
        if len(sorted_scores) > 1:
            second_best = sorted_scores[1]
            if best_score > second_best * 1.5:  # Явное доминирование
                normalized_score = min(normalized_score * 1.2, 1.0)

        # Маппинг строковых типов на Enum
        type_mapping = {
            "location": DescriptionType.LOCATION,
            "character": DescriptionType.CHARACTER,
            "atmosphere": DescriptionType.ATMOSPHERE,
        }

        description_type = type_mapping.get(best_type, DescriptionType.OBJECT)

        return description_type, normalized_score

    def _calculate_length_appropriateness(self, char_length: int) -> float:
        """
        Фактор 5: Соответствие длины (10%).

        КРИТИЧЕСКИ ВАЖНО: Длинные описания (2000-3500) получают НАИВЫСШУЮ оценку!

        Args:
            char_length: Длина описания в символах

        Returns:
            Оценка от 0.0 до 1.0
        """
        # Зоны приоритета
        if 2000 <= char_length <= 3500:  # VERY LONG - наивысший приоритет!
            return 1.0
        elif 1000 <= char_length < 2000:  # LONG
            return 0.95
        elif 3500 < char_length <= 4000:  # Немного длинновато, но OK
            return 0.90
        elif 500 <= char_length < 1000:  # MEDIUM
            return 0.80
        elif 100 <= char_length < 500:  # SHORT - низкий приоритет
            return 0.50
        else:  # Слишком короткое или слишком длинное
            return 0.30

    def filter_by_threshold(
        self,
        scored_descriptions: List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]],
    ) -> List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]]:
        """
        Фильтровать описания по минимальному порогу confidence.

        Args:
            scored_descriptions: Список кортежей (описание, оценка)

        Returns:
            Отфильтрованный список
        """
        return [
            (desc, score)
            for desc, score in scored_descriptions
            if score.passes_threshold
        ]

    def rank_by_priority(
        self,
        scored_descriptions: List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]],
    ) -> List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]]:
        """
        Ранжировать описания по приоритету.

        Приоритет = overall_score * priority_weight

        ДЛИННЫЕ описания (2000-3500) получают наивысший приоритет!

        Args:
            scored_descriptions: Список кортежей (описание, оценка)

        Returns:
            Отсортированный список (от наивысшего приоритета)
        """

        def priority_key(item):
            desc, score = item
            return score.overall_score * score.priority_weight

        return sorted(scored_descriptions, key=priority_key, reverse=True)

    def get_statistics(
        self,
        scored_descriptions: List[Tuple[CompleteDescription, ConfidenceScoreBreakdown]],
    ) -> Dict:
        """
        Получить статистику по оценкам.

        Args:
            scored_descriptions: Список кортежей (описание, оценка)

        Returns:
            Словарь со статистикой
        """
        if not scored_descriptions:
            return {
                "total": 0,
                "passed_threshold": 0,
                "avg_overall_score": 0.0,
                "avg_by_factor": {},
                "by_type": {},
            }

        scores = [score for _, score in scored_descriptions]
        passed = [score for score in scores if score.passes_threshold]

        type_distribution = Counter(score.description_type for score in scores)

        return {
            "total": len(scores),
            "passed_threshold": len(passed),
            "pass_rate": len(passed) / len(scores) if scores else 0.0,
            "avg_overall_score": sum(s.overall_score for s in scores) / len(scores),
            "avg_by_factor": {
                "linguistic_quality": sum(s.linguistic_quality for s in scores)
                / len(scores),
                "visual_richness": sum(s.visual_richness for s in scores) / len(scores),
                "structural_completeness": sum(
                    s.structural_completeness for s in scores
                )
                / len(scores),
                "type_specificity": sum(s.type_specificity for s in scores)
                / len(scores),
                "length_appropriateness": sum(s.length_appropriateness for s in scores)
                / len(scores),
            },
            "by_type": {
                desc_type.value: count for desc_type, count in type_distribution.items()
            },
        }

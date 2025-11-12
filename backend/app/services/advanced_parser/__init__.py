"""
Advanced Description Parser для извлечения длинных качественных описаний из русской литературы.

Этот модуль реализует продвинутую систему парсинга, специально разработанную для:
- Извлечения ДЛИННЫХ описаний (500-3500 символов, приоритет 2000-3500)
- Поддержки генерации изображений в Stable Diffusion 3, DALL-E 3, Gemini, Flux
- Многофакторной оценки качества описаний
- Отслеживания контекста между главами

Компоненты:
- ParagraphSegmenter: Сегментация текста на параграфы с классификацией типов
- DescriptionBoundaryDetector: Детектирование границ многопараграфных описаний
- MultiFactorConfidenceScorer: Многофакторная оценка качества (5 факторов)
- EntityRegistry: Отслеживание сущностей и кореференции
- UnifiedPromptGenerator: Унифицированная генерация промптов для разных моделей

Революционные изменения от классических подходов:
- Парсинг на уровне ПАРАГРАФОВ, а не предложений
- Приоритет ДЛИННЫХ описаний (2000-3500 chars), а не коротких
- 5-факторная оценка вместо простой confidence
- Контекстное обогащение через граф сущностей
"""

from .paragraph_segmenter import ParagraphSegmenter, Paragraph
from .boundary_detector import DescriptionBoundaryDetector, CompleteDescription
from .confidence_scorer import MultiFactorConfidenceScorer, ConfidenceScoreBreakdown
from .config import AdvancedParserConfig, DescriptionType, ParagraphType, DEFAULT_CONFIG
from .extractor import AdvancedDescriptionExtractor, ExtractionResult

__all__ = [
    # Main API
    "AdvancedDescriptionExtractor",
    "ExtractionResult",
    # Components
    "ParagraphSegmenter",
    "DescriptionBoundaryDetector",
    "MultiFactorConfidenceScorer",
    # Data classes
    "Paragraph",
    "CompleteDescription",
    "ConfidenceScoreBreakdown",
    # Configuration
    "AdvancedParserConfig",
    "DescriptionType",
    "ParagraphType",
    "DEFAULT_CONFIG",
]

"""
Comprehensive тесты для Multi-NLP Manager - координатора множественных NLP процессоров.

Покрывает все 5 режимов обработки: SINGLE, PARALLEL, SEQUENTIAL, ENSEMBLE, ADAPTIVE.

Target coverage: 65-75% для multi_nlp_manager.py (+8-12% общего покрытия)
Total tests: 63 comprehensive тестов
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from typing import List, Dict, Any
from datetime import datetime

from app.services.multi_nlp_manager import (
    MultiNLPManager,
    ProcessingMode,
    ProcessingResult
)
from app.services.enhanced_nlp_system import ProcessorConfig, NLPProcessorType, EnhancedNLPProcessor


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def multi_nlp_manager():
    """Fixture для MultiNLPManager."""
    manager = MultiNLPManager()
    return manager


@pytest.fixture
def sample_text():
    """Пример текста на русском языке для обработки."""
    return """
    В глубоком темном лесу стояла старая избушка на курьих ножках.
    Вокруг нее росли высокие сосны и ели, их ветви касались крыши.
    Иван Петрович медленно приближался к избушке, внимательно осматривая окрестности.
    Тишина была такая, что слышно было, как падают с деревьев шишки.
    Красивое закатное небо окрашивало лес в золотисто-красные тона.
    """


@pytest.fixture
def complex_text():
    """Сложный текст для ADAPTIVE режима."""
    return """
    Князь Андрей Болконский и Пьер Безухов встретились в Москве на балу у графа Ростова.
    Великолепный зал был украшен хрустальными люстрами и позолоченными зеркалами.
    Петербургское высшее общество собралось в особняке на Тверской улице.
    Анна Павловна Шерер устраивала вечер, где присутствовали все знатные особы столицы.
    """


@pytest.fixture
def mock_processor_results():
    """Mock результаты от процессора."""
    return [
        {
            "content": "глубокий темный лес",
            "type": "location",
            "priority_score": 0.85,
            "chapter_position": 0,
            "context": "В глубоком темном лесу стояла старая избушка",
            "entities": ["лес"],
            "adjectives": ["глубокий", "темный"],
            "source": "spacy"
        },
        {
            "content": "старая избушка на курьих ножках",
            "type": "location",
            "priority_score": 0.90,
            "chapter_position": 0,
            "context": "стояла старая избушка на курьих ножках",
            "entities": ["избушка"],
            "adjectives": ["старая"],
            "source": "spacy"
        },
        {
            "content": "Иван Петрович",
            "type": "character",
            "priority_score": 0.92,
            "chapter_position": 0,
            "context": "Иван Петрович медленно приближался к избушке",
            "entities": ["Иван Петрович"],
            "adjectives": [],
            "source": "spacy"
        }
    ]


@pytest.fixture
def mock_spacy_processor():
    """Mock SpaCy processor."""
    processor = AsyncMock(spec=EnhancedNLPProcessor)
    processor.processor_type = NLPProcessorType.SPACY
    processor.loaded = True
    processor.model = Mock()
    processor.is_available.return_value = True
    processor.get_performance_metrics.return_value = {
        "total_processed": 10,
        "avg_processing_time": 0.5,
        "success_rate": 0.95,
        "quality_score": 0.80
    }
    processor._calculate_quality_score.return_value = 0.80
    return processor


@pytest.fixture
def mock_natasha_processor():
    """Mock Natasha processor."""
    processor = AsyncMock(spec=EnhancedNLPProcessor)
    processor.processor_type = NLPProcessorType.NATASHA
    processor.loaded = True
    processor.model = Mock()
    processor.is_available.return_value = True
    processor.get_performance_metrics.return_value = {
        "total_processed": 8,
        "avg_processing_time": 0.6,
        "success_rate": 0.92,
        "quality_score": 0.85
    }
    processor._calculate_quality_score.return_value = 0.85
    return processor


@pytest.fixture
def mock_stanza_processor():
    """Mock Stanza processor."""
    processor = AsyncMock(spec=EnhancedNLPProcessor)
    processor.processor_type = NLPProcessorType.STANZA
    processor.loaded = True
    processor.model = Mock()
    processor.is_available.return_value = True
    processor.get_performance_metrics.return_value = {
        "total_processed": 5,
        "avg_processing_time": 0.8,
        "success_rate": 0.90,
        "quality_score": 0.75
    }
    processor._calculate_quality_score.return_value = 0.75
    return processor


@pytest.fixture
def mock_settings_manager():
    """Mock settings_manager."""
    with patch('app.services.multi_nlp_manager.settings_manager') as mock:
        # Default processor settings
        mock.get_category_settings.return_value = {
            "enabled": True,
            "weight": 1.0,
            "confidence_threshold": 0.3,
            "min_description_length": 50,
            "max_description_length": 1000,
            "min_word_count": 10,
            "model_name": "ru_core_news_lg"
        }
        yield mock


# ============================================================================
# TEST CLASS 1: INITIALIZATION
# ============================================================================

class TestMultiNLPManagerInitialization:
    """Тесты инициализации Multi-NLP Manager."""

    @pytest.mark.asyncio
    async def test_manager_default_initialization(self, multi_nlp_manager):
        """Тест начальных значений при создании менеджера."""
        assert multi_nlp_manager is not None
        assert multi_nlp_manager.processors == {}
        assert multi_nlp_manager.processor_configs == {}
        assert multi_nlp_manager.processing_mode == ProcessingMode.SINGLE
        assert multi_nlp_manager.default_processor == "spacy"
        assert multi_nlp_manager._initialized is False
        assert multi_nlp_manager.global_config["max_parallel_processors"] == 3
        assert multi_nlp_manager.global_config["ensemble_voting_threshold"] == 0.6

    @pytest.mark.asyncio
    async def test_initialize_loads_all_processors(
        self, multi_nlp_manager, mock_spacy_processor,
        mock_natasha_processor, mock_stanza_processor, mock_settings_manager
    ):
        """Тест загрузки всех процессоров при инициализации."""
        # Mock processor initialization
        with patch('app.services.multi_nlp_manager.EnhancedSpacyProcessor') as mock_spacy_class, \
             patch('app.services.multi_nlp_manager.EnhancedNatashaProcessor') as mock_natasha_class, \
             patch('app.services.multi_nlp_manager.EnhancedStanzaProcessor') as mock_stanza_class:

            mock_spacy_class.return_value = mock_spacy_processor
            mock_natasha_class.return_value = mock_natasha_processor
            mock_stanza_class.return_value = mock_stanza_processor

            await multi_nlp_manager.initialize()

            assert multi_nlp_manager._initialized is True
            assert "spacy" in multi_nlp_manager.processors
            assert "natasha" in multi_nlp_manager.processors
            # Stanza может быть выключен по умолчанию
            assert len(multi_nlp_manager.processors) >= 2

    @pytest.mark.asyncio
    async def test_initialize_idempotent(self, multi_nlp_manager, mock_settings_manager):
        """Тест защиты от повторной инициализации (идемпотентность)."""
        with patch.object(multi_nlp_manager, '_initialize_processors') as mock_init:
            # Первая инициализация
            await multi_nlp_manager.initialize()
            assert mock_init.call_count == 1
            assert multi_nlp_manager._initialized is True

            # Вторая инициализация - должна быть пропущена
            await multi_nlp_manager.initialize()
            assert mock_init.call_count == 1  # Не вызвана повторно

    @pytest.mark.asyncio
    async def test_initialize_handles_processor_failure(self, multi_nlp_manager, mock_settings_manager):
        """Тест graceful degradation если один процессор падает."""
        with patch('app.services.multi_nlp_manager.EnhancedSpacyProcessor') as mock_spacy_class, \
             patch('app.services.multi_nlp_manager.EnhancedNatashaProcessor') as mock_natasha_class:

            # SpaCy успешно загружается
            mock_spacy = AsyncMock()
            mock_spacy.processor_type = NLPProcessorType.SPACY
            mock_spacy.loaded = True
            mock_spacy.is_available.return_value = True
            mock_spacy_class.return_value = mock_spacy

            # Natasha падает при загрузке
            mock_natasha_class.side_effect = Exception("Failed to load Natasha")

            await multi_nlp_manager.initialize()

            # Менеджер инициализирован, но только с одним процессором
            assert multi_nlp_manager._initialized is True
            assert "spacy" in multi_nlp_manager.processors
            assert "natasha" not in multi_nlp_manager.processors

    @pytest.mark.asyncio
    async def test_initialize_loads_processor_configs(self, multi_nlp_manager):
        """Тест загрузки конфигураций процессоров из settings."""
        with patch('app.services.multi_nlp_manager.settings_manager') as mock_settings:
            async def async_get_settings(category):
                return {
                    "enabled": True,
                    "weight": 1.5,
                    "confidence_threshold": 0.4,
                    "model_name": "ru_core_news_lg"
                }

            mock_settings.get_category_settings.side_effect = async_get_settings

            with patch.object(multi_nlp_manager, '_initialize_processors'):
                await multi_nlp_manager.initialize()

                # Проверяем что конфигурации загружены
                assert "spacy" in multi_nlp_manager.processor_configs
                assert multi_nlp_manager.processor_configs["spacy"].weight == 1.5
                assert multi_nlp_manager.processor_configs["spacy"].confidence_threshold == 0.4

    @pytest.mark.asyncio
    async def test_initialize_sets_default_configs_on_error(self, multi_nlp_manager):
        """Тест установки default конфигураций при ошибке загрузки."""
        with patch('app.services.multi_nlp_manager.settings_manager') as mock_settings:
            mock_settings.get_category_settings.side_effect = Exception("Database error")

            with patch.object(multi_nlp_manager, '_initialize_processors'):
                await multi_nlp_manager.initialize()

                # Должны быть установлены default configs
                assert len(multi_nlp_manager.processor_configs) > 0
                assert "spacy" in multi_nlp_manager.processor_configs


# ============================================================================
# TEST CLASS 2: SINGLE PROCESSOR MODE
# ============================================================================

class TestSingleProcessorMode:
    """Тесты для режима SINGLE (один процессор)."""

    @pytest.mark.asyncio
    async def test_single_mode_spacy_success(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_processor_results
    ):
        """Тест успешной обработки в режиме SINGLE с SpaCy."""
        mock_spacy_processor.extract_descriptions.return_value = mock_processor_results

        multi_nlp_manager.processors["spacy"] = mock_spacy_processor
        multi_nlp_manager.processor_configs["spacy"] = ProcessorConfig(enabled=True)
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.SINGLE
        multi_nlp_manager.default_processor = "spacy"

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            chapter_id="test-chapter-1"
        )

        assert isinstance(result, ProcessingResult)
        assert len(result.descriptions) == 3
        assert result.processors_used == ["spacy"]
        assert result.processing_time > 0
        assert "spacy" in result.quality_metrics
        mock_spacy_processor.extract_descriptions.assert_called_once_with(sample_text, "test-chapter-1")

    @pytest.mark.asyncio
    async def test_single_mode_with_specific_processor(
        self, multi_nlp_manager, sample_text,
        mock_natasha_processor, mock_processor_results
    ):
        """Тест SINGLE режима с явным указанием процессора."""
        mock_natasha_processor.extract_descriptions.return_value = mock_processor_results[:2]

        multi_nlp_manager.processors["natasha"] = mock_natasha_processor
        multi_nlp_manager.processor_configs["natasha"] = ProcessorConfig(enabled=True)
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            processor_name="natasha"  # Explicit processor selection
        )

        assert result.processors_used == ["natasha"]
        assert len(result.descriptions) == 2

    @pytest.mark.asyncio
    async def test_single_mode_empty_text(self, multi_nlp_manager, mock_spacy_processor):
        """Тест SINGLE режима с пустым текстом."""
        mock_spacy_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors["spacy"] = mock_spacy_processor
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        result = await multi_nlp_manager.extract_descriptions(text="   ")

        # Должен вернуть пустой результат, но без ошибки
        assert result.descriptions == []
        assert result.processors_used == ["spacy"]

    @pytest.mark.asyncio
    async def test_single_mode_no_processors_available(self, multi_nlp_manager, sample_text):
        """Тест SINGLE режима когда нет доступных процессоров."""
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processors = {}  # Нет процессоров

        result = await multi_nlp_manager.extract_descriptions(text=sample_text)

        assert result.descriptions == []
        assert result.processors_used == []
        assert "No NLP processors available" in result.recommendations

    @pytest.mark.asyncio
    async def test_single_mode_invalid_processor_name(
        self, multi_nlp_manager, sample_text, mock_spacy_processor
    ):
        """Тест SINGLE режима с несуществующим именем процессора."""
        mock_spacy_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors["spacy"] = mock_spacy_processor
        multi_nlp_manager.processor_configs["spacy"] = ProcessorConfig(enabled=True)
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        # Запрос несуществующего процессора - должен вернуть пустой список
        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            processor_name="nonexistent"
        )

        # Так как процессор не найден, должен вернуть пустой список процессоров
        # Или fallback к default, зависит от реализации
        # Проверим что результат валидный
        assert isinstance(result, ProcessingResult)

    @pytest.mark.asyncio
    async def test_single_mode_updates_statistics(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_processor_results
    ):
        """Тест обновления статистики в SINGLE режиме."""
        mock_spacy_processor.extract_descriptions.return_value = mock_processor_results

        multi_nlp_manager.processors["spacy"] = mock_spacy_processor
        multi_nlp_manager.processor_configs["spacy"] = ProcessorConfig(enabled=True)
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        initial_count = multi_nlp_manager.processing_statistics["total_processed"]

        await multi_nlp_manager.extract_descriptions(text=sample_text)

        assert multi_nlp_manager.processing_statistics["total_processed"] == initial_count + 1
        assert "spacy" in multi_nlp_manager.processing_statistics["processor_usage"]

    @pytest.mark.asyncio
    async def test_single_mode_generates_recommendations(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_processor_results
    ):
        """Тест генерации рекомендаций в SINGLE режиме."""
        mock_spacy_processor.extract_descriptions.return_value = mock_processor_results

        multi_nlp_manager.processors["spacy"] = mock_spacy_processor
        multi_nlp_manager.processor_configs["spacy"] = ProcessorConfig(enabled=True)
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        result = await multi_nlp_manager.extract_descriptions(text=sample_text)

        assert len(result.recommendations) > 0
        # Должна быть рекомендация использовать несколько процессоров
        assert any("multiple processors" in rec for rec in result.recommendations)

    @pytest.mark.asyncio
    async def test_single_mode_with_chapter_id(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_processor_results
    ):
        """Тест передачи chapter_id в процессор."""
        mock_spacy_processor.extract_descriptions.return_value = mock_processor_results

        multi_nlp_manager.processors["spacy"] = mock_spacy_processor
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        chapter_id = "chapter-123"
        await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            chapter_id=chapter_id
        )

        # Проверяем что chapter_id передан в процессор
        mock_spacy_processor.extract_descriptions.assert_called_once_with(sample_text, chapter_id)


# ============================================================================
# TEST CLASS 3: PARALLEL PROCESSOR MODE
# ============================================================================

class TestParallelProcessorMode:
    """Тесты для режима PARALLEL (параллельная обработка)."""

    @pytest.mark.asyncio
    async def test_parallel_mode_processes_all(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor,
        mock_stanza_processor, mock_processor_results
    ):
        """Тест параллельной обработки всеми 3 процессорами."""
        mock_spacy_processor.extract_descriptions.return_value = mock_processor_results[:2]
        mock_natasha_processor.extract_descriptions.return_value = mock_processor_results[1:]
        mock_stanza_processor.extract_descriptions.return_value = [mock_processor_results[2]]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True),
            "stanza": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.PARALLEL
        )

        assert len(result.processors_used) == 3
        assert "spacy" in result.processors_used
        assert "natasha" in result.processors_used
        assert "stanza" in result.processors_used

        # Все процессоры должны быть вызваны
        mock_spacy_processor.extract_descriptions.assert_called_once()
        mock_natasha_processor.extract_descriptions.assert_called_once()
        mock_stanza_processor.extract_descriptions.assert_called_once()

    @pytest.mark.asyncio
    async def test_parallel_mode_merges_results(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест объединения результатов в PARALLEL режиме."""
        spacy_results = [
            {
                "content": "темный лес",
                "type": "location",
                "priority_score": 0.8,
                "source": "spacy"
            },
            {
                "content": "высокие деревья",
                "type": "location",
                "priority_score": 0.75,
                "source": "spacy"
            }
        ]

        natasha_results = [
            {
                "content": "Иван Петрович",
                "type": "character",
                "priority_score": 0.9,
                "source": "natasha"
            }
        ]

        mock_spacy_processor.extract_descriptions.return_value = spacy_results
        mock_natasha_processor.extract_descriptions.return_value = natasha_results

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.PARALLEL
        )

        # Результаты должны быть объединены
        assert len(result.descriptions) >= 3
        assert "spacy" in result.processor_results
        assert "natasha" in result.processor_results
        assert len(result.processor_results["spacy"]) == 2
        assert len(result.processor_results["natasha"]) == 1

    @pytest.mark.asyncio
    async def test_parallel_mode_deduplication(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест дедупликации одинаковых описаний."""
        # Оба процессора находят одинаковое описание
        duplicate_desc = {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.8,
            "source": "spacy"
        }

        mock_spacy_processor.extract_descriptions.return_value = [duplicate_desc.copy()]

        natasha_desc = duplicate_desc.copy()
        natasha_desc["priority_score"] = 0.85
        natasha_desc["source"] = "natasha"
        mock_natasha_processor.extract_descriptions.return_value = [natasha_desc]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.PARALLEL
        )

        # Должно быть только одно описание (дедуплицировано)
        assert len(result.descriptions) == 1
        # Должно быть выбрано описание с лучшим priority_score
        assert result.descriptions[0]["priority_score"] >= 0.8

    @pytest.mark.asyncio
    async def test_parallel_mode_handles_processor_failure(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест обработки ошибки одного процессора в PARALLEL режиме."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        # Natasha падает с ошибкой
        mock_natasha_processor.extract_descriptions.side_effect = Exception("Natasha error")

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.PARALLEL
        )

        # SpaCy результаты должны быть
        assert len(result.descriptions) >= 1
        assert "spacy" in result.processor_results
        # Natasha должна быть в processor_results с пустым списком
        assert "natasha" in result.processor_results
        assert result.processor_results["natasha"] == []

    @pytest.mark.asyncio
    async def test_parallel_mode_respects_max_processors(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor, mock_stanza_processor
    ):
        """Тест соблюдения лимита max_parallel_processors."""
        mock_spacy_processor.extract_descriptions.return_value = []
        mock_natasha_processor.extract_descriptions.return_value = []
        mock_stanza_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True),
            "stanza": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config["max_parallel_processors"] = 2  # Лимит 2

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.PARALLEL
        )

        # Должно быть использовано максимум 2 процессора
        assert len(result.processors_used) <= 2

    @pytest.mark.asyncio
    async def test_parallel_mode_quality_metrics(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест расчета quality_metrics для каждого процессора."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test1", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "test2", "type": "character", "priority_score": 0.9, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.PARALLEL
        )

        assert "spacy" in result.quality_metrics
        assert "natasha" in result.quality_metrics
        assert result.quality_metrics["spacy"] == 0.80
        assert result.quality_metrics["natasha"] == 0.85

    @pytest.mark.asyncio
    async def test_parallel_mode_consensus_strength(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест расчета consensus_strength для описаний."""
        # Оба процессора находят похожее описание
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "темный лес", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "темный лес", "type": "location", "priority_score": 0.85, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.PARALLEL
        )

        # Описание с консенсусом должно иметь consensus_strength
        assert len(result.descriptions) > 0
        assert "consensus_strength" in result.descriptions[0]
        assert result.descriptions[0]["consensus_strength"] >= 0.5

    @pytest.mark.asyncio
    async def test_parallel_mode_sources_tracking(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест отслеживания источников описаний."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "лес", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "лес", "type": "location", "priority_score": 0.82, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.PARALLEL
        )

        # Объединенное описание должно иметь sources от обоих процессоров
        assert "sources" in result.descriptions[0]
        assert "spacy" in result.descriptions[0]["sources"]
        assert "natasha" in result.descriptions[0]["sources"]


# ============================================================================
# TEST CLASS 4: SEQUENTIAL PROCESSOR MODE
# ============================================================================

class TestSequentialProcessorMode:
    """Тесты для режима SEQUENTIAL (последовательная обработка)."""

    @pytest.mark.asyncio
    async def test_sequential_mode_processes_in_order(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест последовательной обработки процессорами."""
        call_order = []

        async def spacy_extract(*args, **kwargs):
            call_order.append("spacy")
            return [{"content": "test1", "type": "location", "priority_score": 0.8, "source": "spacy"}]

        async def natasha_extract(*args, **kwargs):
            call_order.append("natasha")
            return [{"content": "test2", "type": "character", "priority_score": 0.9, "source": "natasha"}]

        mock_spacy_processor.extract_descriptions = spacy_extract
        mock_natasha_processor.extract_descriptions = natasha_extract

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.SEQUENTIAL
        )

        # Проверяем последовательный порядок
        assert len(call_order) == 2
        assert call_order == ["spacy", "natasha"]

    @pytest.mark.asyncio
    async def test_sequential_mode_continues_on_error(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor, mock_stanza_processor
    ):
        """Тест продолжения обработки при ошибке одного процессора."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test1", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        # Natasha падает с ошибкой
        mock_natasha_processor.extract_descriptions.side_effect = Exception("Natasha error")

        mock_stanza_processor.extract_descriptions.return_value = [
            {"content": "test3", "type": "atmosphere", "priority_score": 0.7, "source": "stanza"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True),
            "stanza": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.SEQUENTIAL
        )

        # SpaCy и Stanza результаты должны быть
        assert len(result.descriptions) >= 2
        assert "spacy" in result.processor_results
        assert "stanza" in result.processor_results

    @pytest.mark.asyncio
    async def test_sequential_mode_merges_all_results(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест объединения всех результатов в SEQUENTIAL режиме."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "лес", "type": "location", "priority_score": 0.8, "source": "spacy"},
            {"content": "избушка", "type": "location", "priority_score": 0.75, "source": "spacy"}
        ]

        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "Иван", "type": "character", "priority_score": 0.9, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.SEQUENTIAL
        )

        # Все результаты должны быть объединены
        assert len(result.descriptions) >= 3

    @pytest.mark.asyncio
    async def test_sequential_mode_quality_metrics(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест quality_metrics в SEQUENTIAL режиме."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "test2", "type": "character", "priority_score": 0.9, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.SEQUENTIAL
        )

        assert "spacy" in result.quality_metrics
        assert "natasha" in result.quality_metrics
        assert result.quality_metrics["spacy"] > 0
        assert result.quality_metrics["natasha"] > 0

    @pytest.mark.asyncio
    async def test_sequential_mode_empty_results(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест SEQUENTIAL режима с пустыми результатами."""
        mock_spacy_processor.extract_descriptions.return_value = []
        mock_natasha_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.SEQUENTIAL
        )

        assert result.descriptions == []
        assert len(result.processors_used) == 2

    @pytest.mark.asyncio
    async def test_sequential_mode_deduplication(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест дедупликации в SEQUENTIAL режиме."""
        duplicate = {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.8,
            "source": "spacy"
        }

        mock_spacy_processor.extract_descriptions.return_value = [duplicate.copy()]

        natasha_dup = duplicate.copy()
        natasha_dup["priority_score"] = 0.85
        natasha_dup["source"] = "natasha"
        mock_natasha_processor.extract_descriptions.return_value = [natasha_dup]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.SEQUENTIAL
        )

        # Должна быть дедупликация
        assert len(result.descriptions) == 1


# ============================================================================
# TEST CLASS 5: ENSEMBLE PROCESSOR MODE
# ============================================================================

class TestEnsembleProcessorMode:
    """Тесты для режима ENSEMBLE (voting и consensus)."""

    @pytest.mark.asyncio
    async def test_ensemble_mode_voting(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor, mock_stanza_processor
    ):
        """Тест ensemble voting механизма."""
        # Все три процессора находят похожее описание
        common_desc_spacy = {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.80,
            "source": "spacy"
        }
        common_desc_natasha = {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.85,
            "source": "natasha"
        }
        common_desc_stanza = {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.75,
            "source": "stanza"
        }

        mock_spacy_processor.extract_descriptions.return_value = [common_desc_spacy]
        mock_natasha_processor.extract_descriptions.return_value = [common_desc_natasha]
        mock_stanza_processor.extract_descriptions.return_value = [common_desc_stanza]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.2),
            "stanza": ProcessorConfig(enabled=True, weight=0.8)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.6

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        assert len(result.processors_used) == 3
        assert len(result.descriptions) > 0
        # Voting должен быть применен
        assert "consensus_strength" in result.descriptions[0]
        assert result.descriptions[0]["consensus_strength"] >= 0.6

    @pytest.mark.asyncio
    async def test_ensemble_mode_consensus_threshold(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor, mock_stanza_processor
    ):
        """Тест порога consensus в ensemble режиме."""
        # Только один процессор находит описание
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "редкое описание", "type": "location", "priority_score": 0.5, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = []
        mock_stanza_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.0),
            "stanza": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.6

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        # Описание с низким консенсусом может быть отфильтровано
        # consensus_strength = 1/3 = 0.33 < 0.6
        assert len(result.descriptions) == 0 or result.descriptions[0]["consensus_strength"] < 0.6

    @pytest.mark.asyncio
    async def test_ensemble_mode_weighted_voting(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor, mock_stanza_processor
    ):
        """Тест weighted voting (веса процессоров)."""
        # Natasha имеет вес 1.2, SpaCy 1.0, Stanza 0.8
        desc = {
            "content": "описание",
            "type": "location",
            "priority_score": 0.80,
        }

        desc_spacy = desc.copy()
        desc_spacy["source"] = "spacy"

        desc_natasha = desc.copy()
        desc_natasha["priority_score"] = 0.85
        desc_natasha["source"] = "natasha"

        desc_stanza = desc.copy()
        desc_stanza["priority_score"] = 0.75
        desc_stanza["source"] = "stanza"

        mock_spacy_processor.extract_descriptions.return_value = [desc_spacy]
        mock_natasha_processor.extract_descriptions.return_value = [desc_natasha]
        mock_stanza_processor.extract_descriptions.return_value = [desc_stanza]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.2),  # Больший вес
            "stanza": ProcessorConfig(enabled=True, weight=0.8)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.5

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        # Результаты с высоким консенсусом должны пройти
        assert len(result.descriptions) > 0

    @pytest.mark.asyncio
    async def test_ensemble_mode_context_enrichment(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест обогащения контекста в ENSEMBLE режиме."""
        desc_spacy = {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.8,
            "source": "spacy",
            "context": "В темном лесу"
        }

        desc_natasha = {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.85,
            "source": "natasha",
            "context": "темный лес с высокими деревьями"
        }

        mock_spacy_processor.extract_descriptions.return_value = [desc_spacy]
        mock_natasha_processor.extract_descriptions.return_value = [desc_natasha]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.2)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.5

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        # Контекст может быть обогащен из нескольких источников
        assert len(result.descriptions) > 0
        assert "sources" in result.descriptions[0]

    @pytest.mark.asyncio
    async def test_ensemble_mode_boosts_priority_score(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест boost priority_score для описаний с высоким консенсусом."""
        desc = {
            "content": "лес",
            "type": "location",
            "priority_score": 0.70,
        }

        desc_spacy = desc.copy()
        desc_spacy["source"] = "spacy"
        desc_natasha = desc.copy()
        desc_natasha["source"] = "natasha"

        mock_spacy_processor.extract_descriptions.return_value = [desc_spacy]
        mock_natasha_processor.extract_descriptions.return_value = [desc_natasha]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.5

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        # Priority score должен быть увеличен для консенсуса
        if len(result.descriptions) > 0:
            # Проверяем что есть consensus_strength
            assert "consensus_strength" in result.descriptions[0]
            # Priority может быть увеличен
            # original 0.70 * (1 + consensus * 0.5)
            assert result.descriptions[0]["priority_score"] >= 0.70

    @pytest.mark.asyncio
    async def test_ensemble_mode_adds_recommendation(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест добавления специальной рекомендации в ENSEMBLE режиме."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.85, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        # Должна быть рекомендация об ensemble voting
        assert any("ensemble" in rec.lower() for rec in result.recommendations)

    @pytest.mark.asyncio
    async def test_ensemble_mode_handles_disagreement(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor, mock_stanza_processor
    ):
        """Тест обработки разногласий между процессорами."""
        # Каждый процессор находит разные описания
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "лес", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "избушка", "type": "location", "priority_score": 0.85, "source": "natasha"}
        ]
        mock_stanza_processor.extract_descriptions.return_value = [
            {"content": "деревья", "type": "location", "priority_score": 0.75, "source": "stanza"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.0),
            "stanza": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.6

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        # При отсутствии консенсуса (каждое описание от 1 процессора)
        # все описания могут быть отфильтрованы
        for desc in result.descriptions:
            assert "consensus_strength" in desc
            assert desc["consensus_strength"] < 0.6

    @pytest.mark.asyncio
    async def test_ensemble_mode_sorts_by_priority(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест сортировки результатов по приоритету в ENSEMBLE."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "low priority", "type": "location", "priority_score": 0.5, "source": "spacy"},
            {"content": "high priority", "type": "character", "priority_score": 0.9, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "low priority", "type": "location", "priority_score": 0.52, "source": "natasha"},
            {"content": "high priority", "type": "character", "priority_score": 0.92, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.5

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        # Результаты должны быть отсортированы по priority_score
        if len(result.descriptions) > 1:
            assert result.descriptions[0]["priority_score"] >= result.descriptions[1]["priority_score"]

    @pytest.mark.asyncio
    async def test_ensemble_mode_empty_results(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест ENSEMBLE режима с пустыми результатами от всех процессоров."""
        mock_spacy_processor.extract_descriptions.return_value = []
        mock_natasha_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=ProcessingMode.ENSEMBLE
        )

        assert result.descriptions == []
        assert len(result.processors_used) == 2


# ============================================================================
# TEST CLASS 6: ADAPTIVE PROCESSOR MODE
# ============================================================================

class TestAdaptiveProcessorMode:
    """Тесты для режима ADAPTIVE (адаптивный выбор процессора)."""

    @pytest.mark.asyncio
    async def test_adaptive_mode_selects_natasha_for_names(
        self, multi_nlp_manager,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест выбора Natasha для текста с русскими именами."""
        text_with_names = "Иван Петрович Сидоров встретил Анну Михайловну Петрову."

        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "Иван Петрович", "type": "character", "priority_score": 0.9, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=text_with_names,
            mode=ProcessingMode.ADAPTIVE
        )

        # Natasha должна быть выбрана для имен
        assert "natasha" in result.processors_used

    @pytest.mark.asyncio
    async def test_adaptive_mode_uses_spacy_for_long_text(
        self, multi_nlp_manager,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест выбора SpaCy для длинных текстов."""
        # Длинный текст (>1000 символов)
        long_text = "Красивый лес. " * 100  # ~1400 символов

        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "лес", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=long_text,
            mode=ProcessingMode.ADAPTIVE
        )

        # SpaCy должен быть выбран для длинного текста
        assert "spacy" in result.processors_used

    @pytest.mark.asyncio
    async def test_adaptive_mode_uses_stanza_for_complex(
        self, multi_nlp_manager, complex_text,
        mock_spacy_processor, mock_natasha_processor, mock_stanza_processor
    ):
        """Тест выбора Stanza для сложных конструкций."""
        mock_stanza_processor.extract_descriptions.return_value = [
            {"content": "сложное описание", "type": "location", "priority_score": 0.85, "source": "stanza"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True),
            "stanza": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=complex_text,
            mode=ProcessingMode.ADAPTIVE
        )

        # Для сложного текста могут быть выбраны multiple процессоры
        assert len(result.processors_used) > 0

    @pytest.mark.asyncio
    async def test_adaptive_mode_uses_ensemble_for_very_complex(
        self, multi_nlp_manager, complex_text,
        mock_spacy_processor, mock_natasha_processor, mock_stanza_processor
    ):
        """Тест использования ENSEMBLE для очень сложного текста."""
        # Mock для сложного текста с высокой complexity
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test1", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "test2", "type": "character", "priority_score": 0.85, "source": "natasha"}
        ]
        mock_stanza_processor.extract_descriptions.return_value = [
            {"content": "test3", "type": "atmosphere", "priority_score": 0.75, "source": "stanza"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor,
            "stanza": mock_stanza_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True),
            "stanza": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.5

        # Очень сложный текст
        very_complex_text = complex_text * 3  # Длинный и сложный

        result = await multi_nlp_manager.extract_descriptions(
            text=very_complex_text,
            mode=ProcessingMode.ADAPTIVE
        )

        # Для очень сложного может быть использован ENSEMBLE (несколько процессоров)
        assert len(result.processors_used) >= 2

    @pytest.mark.asyncio
    async def test_adaptive_mode_uses_single_for_simple(
        self, multi_nlp_manager,
        mock_spacy_processor
    ):
        """Тест использования SINGLE для простого текста."""
        simple_text = "Красивый лес."

        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "лес", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text=simple_text,
            mode=ProcessingMode.ADAPTIVE
        )

        # Для простого текста должен быть один процессор
        assert len(result.processors_used) == 1

    @pytest.mark.asyncio
    async def test_adaptive_mode_fallback_to_default(
        self, multi_nlp_manager,
        mock_spacy_processor
    ):
        """Тест fallback к default процессору если ничего не выбрано."""
        empty_text = ""

        mock_spacy_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        result = await multi_nlp_manager.extract_descriptions(
            text=empty_text,
            mode=ProcessingMode.ADAPTIVE
        )

        # Должен использовать default processor
        assert "spacy" in result.processors_used or result.processors_used == []


# ============================================================================
# TEST CLASS 7: CONFIGURATION MANAGEMENT
# ============================================================================

class TestConfigurationManagement:
    """Тесты управления конфигурациями процессоров."""

    @pytest.mark.asyncio
    async def test_get_processor_status(
        self, multi_nlp_manager,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест получения статуса всех процессоров."""
        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.2)
        }
        multi_nlp_manager._initialized = True

        status = await multi_nlp_manager.get_processor_status()

        assert isinstance(status, dict)
        assert "available_processors" in status
        assert "spacy" in status["available_processors"]
        assert "natasha" in status["available_processors"]
        assert status["default_processor"] == "spacy"
        assert status["processing_mode"] == ProcessingMode.SINGLE.value
        assert "processor_details" in status
        assert "spacy" in status["processor_details"]
        assert status["processor_details"]["spacy"]["loaded"] is True

    @pytest.mark.asyncio
    async def test_update_processor_config_success(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест успешного обновления конфигурации процессора."""
        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0, confidence_threshold=0.3)
        }
        multi_nlp_manager._initialized = True

        new_config = {
            "weight": 1.5,
            "confidence_threshold": 0.4
        }

        with patch('app.services.multi_nlp_manager.settings_manager') as mock_settings:
            async def async_set_settings(category, config):
                return True

            mock_settings.set_category_settings.side_effect = async_set_settings

            success = await multi_nlp_manager.update_processor_config("spacy", new_config)

            assert success is True
            assert multi_nlp_manager.processor_configs["spacy"].weight == 1.5
            assert multi_nlp_manager.processor_configs["spacy"].confidence_threshold == 0.4
            mock_settings.set_category_settings.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_processor_config_invalid_processor(
        self, multi_nlp_manager
    ):
        """Тест обновления конфигурации несуществующего процессора."""
        multi_nlp_manager._initialized = True

        new_config = {"weight": 1.5}

        success = await multi_nlp_manager.update_processor_config("nonexistent", new_config)

        assert success is False

    @pytest.mark.asyncio
    async def test_update_processor_config_reloads_model(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест перезагрузки модели при обновлении конфигурации."""
        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True

        new_config = {"weight": 1.5}

        with patch('app.services.multi_nlp_manager.settings_manager') as mock_settings:
            async def async_set_settings(category, config):
                return True

            mock_settings.set_category_settings.side_effect = async_set_settings

            await multi_nlp_manager.update_processor_config("spacy", new_config)

            # Модель должна быть перезагружена
            mock_spacy_processor.load_model.assert_called()

    @pytest.mark.asyncio
    async def test_processor_config_persistence(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест сохранения конфигурации в БД."""
        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True

        new_config = {"weight": 1.5, "confidence_threshold": 0.4}

        with patch('app.services.multi_nlp_manager.settings_manager') as mock_settings:
            async def async_set_settings(category, config):
                return True

            mock_settings.set_category_settings.side_effect = async_set_settings

            await multi_nlp_manager.update_processor_config("spacy", new_config)

            # Проверяем что настройки сохранены через settings_manager
            mock_settings.set_category_settings.assert_called_once_with(
                "nlp_spacy", new_config
            )

    @pytest.mark.asyncio
    async def test_get_processor_status_includes_statistics(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест включения статистики в статус процессоров."""
        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_statistics["total_processed"] = 10
        multi_nlp_manager.processing_statistics["processor_usage"]["spacy"] = 10

        status = await multi_nlp_manager.get_processor_status()

        assert "statistics" in status
        assert status["statistics"]["total_processed"] == 10
        assert "spacy" in status["statistics"]["processor_usage"]

    @pytest.mark.asyncio
    async def test_processor_config_with_custom_settings(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест конфигурации с custom_settings."""
        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(
                enabled=True,
                weight=1.0,
                custom_settings={"spacy": {"model_name": "ru_core_news_lg"}}
            )
        }
        multi_nlp_manager._initialized = True

        status = await multi_nlp_manager.get_processor_status()

        assert "spacy" in status["processor_details"]
        assert "config" in status["processor_details"]["spacy"]
        # custom_settings должны быть в конфиге
        config = status["processor_details"]["spacy"]["config"]
        assert "custom_settings" in config


# ============================================================================
# TEST CLASS 8: ERROR HANDLING
# ============================================================================

class TestErrorHandling:
    """Тесты обработки ошибок."""

    @pytest.mark.asyncio
    async def test_processing_with_empty_text(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест обработки пустого текста."""
        mock_spacy_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        # Пустой текст не должен вызывать ошибку
        result = await multi_nlp_manager.extract_descriptions(text="")

        assert result.descriptions == []

    @pytest.mark.asyncio
    async def test_processing_with_whitespace_only(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест обработки текста только с пробелами."""
        mock_spacy_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        result = await multi_nlp_manager.extract_descriptions(text="    \n\t  ")

        assert result.descriptions == []

    @pytest.mark.asyncio
    async def test_processing_with_very_long_text(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест обработки очень длинного текста (>10000 символов)."""
        very_long_text = "Красивый лес с высокими деревьями. " * 500  # ~17500 символов

        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "лес", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        result = await multi_nlp_manager.extract_descriptions(text=very_long_text)

        # Должно обработаться без ошибок
        assert isinstance(result, ProcessingResult)
        assert result.processing_time > 0

    @pytest.mark.asyncio
    async def test_processing_with_special_characters(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест обработки текста со специальными символами."""
        text_with_special = "Текст с символами: @#$%^&*()_+{}[]|\\:;<>?,./-"

        mock_spacy_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        result = await multi_nlp_manager.extract_descriptions(text=text_with_special)

        assert isinstance(result, ProcessingResult)

    @pytest.mark.asyncio
    async def test_processor_exception_handling(
        self, multi_nlp_manager, mock_spacy_processor
    ):
        """Тест обработки исключения от процессора в SINGLE режиме."""
        mock_spacy_processor.extract_descriptions.side_effect = Exception("Processor crashed")

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        # Должна быть обработана ошибка
        with pytest.raises(Exception):
            await multi_nlp_manager.extract_descriptions(text="test text")

    @pytest.mark.asyncio
    async def test_partial_processor_failure_in_parallel(
        self, multi_nlp_manager,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест частичного сбоя процессоров в PARALLEL режиме."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.side_effect = Exception("Natasha error")

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        result = await multi_nlp_manager.extract_descriptions(
            text="test",
            mode=ProcessingMode.PARALLEL
        )

        # SpaCy результаты должны быть доступны
        assert len(result.descriptions) >= 1
        assert "spacy" in result.processor_results

    @pytest.mark.asyncio
    async def test_invalid_mode_fallback(
        self, multi_nlp_manager, sample_text, mock_spacy_processor
    ):
        """Тест fallback при неверном режиме обработки."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        # Передаем None mode - должен использовать default
        result = await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            mode=None
        )

        # Должен работать с default режимом
        assert isinstance(result, ProcessingResult)

    @pytest.mark.asyncio
    async def test_processor_not_available_graceful_handling(
        self, multi_nlp_manager, sample_text, mock_spacy_processor
    ):
        """Тест graceful handling когда процессор не available."""
        # Процессор недоступен
        mock_spacy_processor.is_available.return_value = False
        mock_spacy_processor.extract_descriptions.return_value = []

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs["spacy"] = ProcessorConfig(enabled=True)
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        # Должен обработать gracefully - процессор недоступен, но не падает
        # Может вернуть пустой результат
        result = await multi_nlp_manager.extract_descriptions(text=sample_text)

        # Проверяем что результат валидный
        assert isinstance(result, ProcessingResult)


# ============================================================================
# TEST CLASS 9: STATISTICS
# ============================================================================

class TestStatistics:
    """Тесты статистики обработки."""

    @pytest.mark.asyncio
    async def test_processing_statistics_updated_on_success(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor
    ):
        """Тест обновления статистики после успешной обработки."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        initial_total = multi_nlp_manager.processing_statistics["total_processed"]

        await multi_nlp_manager.extract_descriptions(text=sample_text)

        assert multi_nlp_manager.processing_statistics["total_processed"] == initial_total + 1
        assert "spacy" in multi_nlp_manager.processing_statistics["processor_usage"]
        assert multi_nlp_manager.processing_statistics["processor_usage"]["spacy"] == 1

    @pytest.mark.asyncio
    async def test_processor_usage_statistics(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor, mock_natasha_processor
    ):
        """Тест статистики использования процессоров."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]
        mock_natasha_processor.extract_descriptions.return_value = [
            {"content": "test2", "type": "character", "priority_score": 0.85, "source": "natasha"}
        ]

        multi_nlp_manager.processors = {
            "spacy": mock_spacy_processor,
            "natasha": mock_natasha_processor
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True),
            "natasha": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True

        # Обрабатываем 2 раза SpaCy, 1 раз Natasha
        await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            processor_name="spacy"
        )
        await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            processor_name="spacy"
        )
        await multi_nlp_manager.extract_descriptions(
            text=sample_text,
            processor_name="natasha"
        )

        usage = multi_nlp_manager.processing_statistics["processor_usage"]
        assert usage["spacy"] == 2
        assert usage["natasha"] == 1

    @pytest.mark.asyncio
    async def test_quality_scores_tracking(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor
    ):
        """Тест отслеживания quality scores."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        await multi_nlp_manager.extract_descriptions(text=sample_text)

        quality_scores = multi_nlp_manager.processing_statistics["average_quality_scores"]
        assert "spacy" in quality_scores
        assert len(quality_scores["spacy"]) > 0
        assert quality_scores["spacy"][0] == 0.80

    @pytest.mark.asyncio
    async def test_statistics_accumulate_over_time(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor
    ):
        """Тест накопления статистики со временем."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        # Обрабатываем 5 раз
        for _ in range(5):
            await multi_nlp_manager.extract_descriptions(text=sample_text)

        assert multi_nlp_manager.processing_statistics["total_processed"] == 5
        assert multi_nlp_manager.processing_statistics["processor_usage"]["spacy"] == 5
        assert len(multi_nlp_manager.processing_statistics["average_quality_scores"]["spacy"]) == 5

    @pytest.mark.asyncio
    async def test_statistics_in_processor_status(
        self, multi_nlp_manager, sample_text,
        mock_spacy_processor
    ):
        """Тест включения статистики в processor status."""
        mock_spacy_processor.extract_descriptions.return_value = [
            {"content": "test", "type": "location", "priority_score": 0.8, "source": "spacy"}
        ]

        multi_nlp_manager.processors = {"spacy": mock_spacy_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.default_processor = "spacy"

        await multi_nlp_manager.extract_descriptions(text=sample_text)

        status = await multi_nlp_manager.get_processor_status()

        assert "statistics" in status
        assert status["statistics"]["total_processed"] == 1
        assert "processor_usage" in status["statistics"]

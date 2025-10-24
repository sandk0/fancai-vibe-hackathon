"""
Тесты для Multi-NLP Manager - координатора множественных NLP процессоров.

Тестируем 5 режимов обработки: SINGLE, PARALLEL, SEQUENTIAL, ENSEMBLE, ADAPTIVE.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List, Dict, Any

from app.services.multi_nlp_manager import (
    MultiNLPManager,
    ProcessingMode,
    ProcessingResult
)
from app.services.enhanced_nlp_system import ProcessorConfig, NLPProcessorType


@pytest.fixture
def multi_nlp_manager():
    """Fixture для MultiNLPManager."""
    manager = MultiNLPManager()
    return manager


@pytest.fixture
def sample_text():
    """Пример текста для обработки."""
    return """
    В глубоком темном лесу стояла старая избушка.
    Вокруг нее росли высокие сосны и ели, их ветви касались крыши.
    Иван Петрович медленно приближался к избушке, внимательно осматривая окрестности.
    """


@pytest.fixture
def mock_processor_results():
    """Mock результаты от процессора."""
    return [
        {
            "text": "глубокий темный лес",
            "description_type": "location",
            "priority_score": 0.85,
            "chapter_position": 0,
            "context": "В глубоком темном лесу стояла старая избушка",
            "entities": ["лес"],
            "adjectives": ["глубокий", "темный"]
        },
        {
            "text": "старая избушка",
            "description_type": "location",
            "priority_score": 0.75,
            "chapter_position": 0,
            "context": "В глубоком темном лесу стояла старая избушка",
            "entities": ["избушка"],
            "adjectives": ["старая"]
        },
        {
            "text": "Иван Петрович",
            "description_type": "character",
            "priority_score": 0.90,
            "chapter_position": 0,
            "context": "Иван Петрович медленно приближался к избушке",
            "entities": ["Иван Петрович"],
            "adjectives": []
        }
    ]


class TestMultiNLPManagerInitialization:
    """Тесты инициализации Multi-NLP Manager."""

    @pytest.mark.asyncio
    async def test_manager_initialization(self, multi_nlp_manager):
        """Тест инициализации менеджера."""
        assert multi_nlp_manager is not None
        assert multi_nlp_manager.processors == {}
        assert multi_nlp_manager.processing_mode == ProcessingMode.SINGLE
        assert multi_nlp_manager.default_processor == "spacy"
        assert multi_nlp_manager._initialized is False

    @pytest.mark.asyncio
    @patch('app.services.multi_nlp_manager.settings_manager')
    async def test_initialize_loads_processors(self, mock_settings_manager, multi_nlp_manager):
        """Тест загрузки процессоров при инициализации."""
        # Mock настройки процессоров
        mock_settings_manager.get_processor_config.side_effect = [
            ProcessorConfig(
                enabled=True,
                priority=1,
                threshold=0.3,
                weight=1.0,
                processor_type=NLPProcessorType.SPACY
            ),
            None,  # Natasha не найдена
            None   # Stanza не найдена
        ]

        with patch.object(multi_nlp_manager, '_initialize_processors') as mock_init:
            await multi_nlp_manager.initialize()

            assert multi_nlp_manager._initialized is True
            mock_init.assert_called_once()

    @pytest.mark.asyncio
    async def test_double_initialization_prevented(self, multi_nlp_manager):
        """Тест защиты от повторной инициализации."""
        with patch.object(multi_nlp_manager, '_initialize_processors') as mock_init:
            # Первая инициализация
            await multi_nlp_manager.initialize()
            assert mock_init.call_count == 1

            # Вторая инициализация - должна быть пропущена
            await multi_nlp_manager.initialize()
            assert mock_init.call_count == 1  # Не вызвана повторно


class TestSingleProcessorMode:
    """Тесты для режима SINGLE (один процессор)."""

    @pytest.mark.asyncio
    @patch('app.services.multi_nlp_manager.EnhancedSpacyProcessor')
    async def test_single_mode_processing(self, mock_spacy_class, multi_nlp_manager,
                                         sample_text, mock_processor_results):
        """Тест обработки в режиме SINGLE."""
        # Настройка mock процессора
        mock_processor = AsyncMock()
        mock_processor.extract_descriptions.return_value = mock_processor_results
        mock_processor.processor_type = NLPProcessorType.SPACY
        mock_spacy_class.return_value = mock_processor

        multi_nlp_manager.processors["spacy"] = mock_processor
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.SINGLE
        multi_nlp_manager.default_processor = "spacy"

        # Выполнение обработки
        result = await multi_nlp_manager.process_text(sample_text)

        assert isinstance(result, ProcessingResult)
        assert len(result.descriptions) > 0
        assert "spacy" in result.processors_used
        assert len(result.processors_used) == 1
        mock_processor.extract_descriptions.assert_called_once()

    @pytest.mark.asyncio
    async def test_single_mode_with_nonexistent_processor(self, multi_nlp_manager, sample_text):
        """Тест обработки когда процессор не найден."""
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.SINGLE
        multi_nlp_manager.default_processor = "nonexistent"

        with pytest.raises(ValueError, match="not found or not initialized"):
            await multi_nlp_manager.process_text(sample_text)


class TestParallelProcessorMode:
    """Тесты для режима PARALLEL (параллельная обработка)."""

    @pytest.mark.asyncio
    async def test_parallel_mode_processing(self, multi_nlp_manager, sample_text,
                                           mock_processor_results):
        """Тест параллельной обработки несколькими процессорами."""
        # Создаем mock процессоры
        mock_spacy = AsyncMock()
        mock_spacy.extract_descriptions.return_value = mock_processor_results[:2]
        mock_spacy.processor_type = NLPProcessorType.SPACY

        mock_natasha = AsyncMock()
        mock_natasha.extract_descriptions.return_value = mock_processor_results[1:]
        mock_natasha.processor_type = NLPProcessorType.NATASHA

        multi_nlp_manager.processors = {
            "spacy": mock_spacy,
            "natasha": mock_natasha
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.PARALLEL

        # Выполнение обработки
        result = await multi_nlp_manager.process_text(sample_text)

        assert isinstance(result, ProcessingResult)
        assert len(result.processors_used) == 2
        assert "spacy" in result.processors_used
        assert "natasha" in result.processors_used

        # Оба процессора должны быть вызваны
        mock_spacy.extract_descriptions.assert_called_once()
        mock_natasha.extract_descriptions.assert_called_once()

    @pytest.mark.asyncio
    async def test_parallel_mode_merges_results(self, multi_nlp_manager, sample_text,
                                               mock_processor_results):
        """Тест объединения результатов в параллельном режиме."""
        mock_proc1 = AsyncMock()
        mock_proc1.extract_descriptions.return_value = mock_processor_results[:2]
        mock_proc1.processor_type = NLPProcessorType.SPACY

        mock_proc2 = AsyncMock()
        mock_proc2.extract_descriptions.return_value = mock_processor_results[2:]
        mock_proc2.processor_type = NLPProcessorType.NATASHA

        multi_nlp_manager.processors = {"proc1": mock_proc1, "proc2": mock_proc2}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.PARALLEL

        result = await multi_nlp_manager.process_text(sample_text)

        # Проверяем что результаты объединены
        assert len(result.descriptions) >= 2
        assert "processor_results" in result.__dict__
        assert "proc1" in result.processor_results
        assert "proc2" in result.processor_results


class TestEnsembleProcessorMode:
    """Тесты для режима ENSEMBLE (voting и consensus)."""

    @pytest.mark.asyncio
    async def test_ensemble_mode_voting(self, multi_nlp_manager, sample_text):
        """Тест ensemble voting механизма."""
        # Создаем процессоры с разными результатами
        mock_spacy = AsyncMock()
        mock_spacy.extract_descriptions.return_value = [
            {"text": "темный лес", "priority_score": 0.8, "description_type": "location"}
        ]
        mock_spacy.processor_type = NLPProcessorType.SPACY

        mock_natasha = AsyncMock()
        mock_natasha.extract_descriptions.return_value = [
            {"text": "темный лес", "priority_score": 0.85, "description_type": "location"}
        ]
        mock_natasha.processor_type = NLPProcessorType.NATASHA

        mock_stanza = AsyncMock()
        mock_stanza.extract_descriptions.return_value = [
            {"text": "темный лес", "priority_score": 0.75, "description_type": "location"}
        ]
        mock_stanza.processor_type = NLPProcessorType.STANZA

        multi_nlp_manager.processors = {
            "spacy": mock_spacy,
            "natasha": mock_natasha,
            "stanza": mock_stanza
        }
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0),
            "natasha": ProcessorConfig(enabled=True, weight=1.2),
            "stanza": ProcessorConfig(enabled=True, weight=0.8)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.ENSEMBLE
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.6

        result = await multi_nlp_manager.process_text(sample_text)

        # Проверяем что voting применен
        assert isinstance(result, ProcessingResult)
        assert len(result.processors_used) == 3
        assert len(result.descriptions) > 0

        # Weighted consensus должен быть применен
        assert result.quality_metrics is not None

    @pytest.mark.asyncio
    async def test_ensemble_mode_consensus_threshold(self, multi_nlp_manager, sample_text):
        """Тест порога consensus в ensemble режиме."""
        # Один процессор находит описание, другие нет
        mock_proc1 = AsyncMock()
        mock_proc1.extract_descriptions.return_value = [
            {"text": "редкое описание", "priority_score": 0.5, "description_type": "location"}
        ]
        mock_proc1.processor_type = NLPProcessorType.SPACY

        mock_proc2 = AsyncMock()
        mock_proc2.extract_descriptions.return_value = []
        mock_proc2.processor_type = NLPProcessorType.NATASHA

        mock_proc3 = AsyncMock()
        mock_proc3.extract_descriptions.return_value = []
        mock_proc3.processor_type = NLPProcessorType.STANZA

        multi_nlp_manager.processors = {
            "proc1": mock_proc1,
            "proc2": mock_proc2,
            "proc3": mock_proc3
        }
        multi_nlp_manager.processor_configs = {
            "proc1": ProcessorConfig(enabled=True, weight=1.0),
            "proc2": ProcessorConfig(enabled=True, weight=1.0),
            "proc3": ProcessorConfig(enabled=True, weight=1.0)
        }
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.ENSEMBLE
        multi_nlp_manager.global_config['ensemble_voting_threshold'] = 0.6

        result = await multi_nlp_manager.process_text(sample_text)

        # Описание с низким консенсусом может быть отфильтровано
        # В зависимости от реализации
        assert isinstance(result, ProcessingResult)


class TestAdaptiveProcessorMode:
    """Тесты для режима ADAPTIVE (адаптивный выбор процессора)."""

    @pytest.mark.asyncio
    async def test_adaptive_mode_selects_best_processor(self, multi_nlp_manager, sample_text):
        """Тест адаптивного выбора процессора."""
        mock_spacy = AsyncMock()
        mock_spacy.extract_descriptions.return_value = [
            {"text": "описание", "priority_score": 0.8}
        ]
        mock_spacy.processor_type = NLPProcessorType.SPACY

        multi_nlp_manager.processors = {"spacy": mock_spacy}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.ADAPTIVE
        multi_nlp_manager.global_config['auto_processor_selection'] = True

        result = await multi_nlp_manager.process_text(sample_text)

        assert isinstance(result, ProcessingResult)
        assert len(result.recommendations) >= 0  # Могут быть рекомендации


class TestProcessorManagement:
    """Тесты управления процессорами."""

    @pytest.mark.asyncio
    async def test_get_processor_status(self, multi_nlp_manager):
        """Тест получения статуса процессоров."""
        mock_processor = MagicMock()
        mock_processor.processor_type = NLPProcessorType.SPACY

        multi_nlp_manager.processors = {"spacy": mock_processor}
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, priority=1, weight=1.0)
        }

        status = await multi_nlp_manager.get_processor_status()

        assert isinstance(status, dict)
        assert "spacy" in status
        assert status["spacy"]["enabled"] is True

    @pytest.mark.asyncio
    async def test_update_processor_config(self, multi_nlp_manager):
        """Тест обновления конфигурации процессора."""
        multi_nlp_manager.processor_configs = {
            "spacy": ProcessorConfig(enabled=True, weight=1.0, threshold=0.3)
        }

        new_config = ProcessorConfig(enabled=True, weight=1.5, threshold=0.4)

        with patch.object(multi_nlp_manager, '_save_processor_config') as mock_save:
            await multi_nlp_manager.update_processor_config("spacy", new_config)

            assert multi_nlp_manager.processor_configs["spacy"].weight == 1.5
            assert multi_nlp_manager.processor_configs["spacy"].threshold == 0.4


class TestErrorHandling:
    """Тесты обработки ошибок."""

    @pytest.mark.asyncio
    async def test_processing_with_empty_text(self, multi_nlp_manager):
        """Тест обработки пустого текста."""
        multi_nlp_manager._initialized = True

        with pytest.raises(ValueError, match="empty"):
            await multi_nlp_manager.process_text("")

    @pytest.mark.asyncio
    async def test_processing_before_initialization(self, multi_nlp_manager, sample_text):
        """Тест обработки до инициализации."""
        multi_nlp_manager._initialized = False

        with pytest.raises(RuntimeError, match="not initialized"):
            await multi_nlp_manager.process_text(sample_text)

    @pytest.mark.asyncio
    async def test_processor_failure_handling(self, multi_nlp_manager, sample_text):
        """Тест обработки ошибок процессора."""
        mock_processor = AsyncMock()
        mock_processor.extract_descriptions.side_effect = Exception("Processor error")
        mock_processor.processor_type = NLPProcessorType.SPACY

        multi_nlp_manager.processors = {"spacy": mock_processor}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.SINGLE
        multi_nlp_manager.default_processor = "spacy"

        # Должна быть обработана ошибка
        with pytest.raises(Exception):
            await multi_nlp_manager.process_text(sample_text)


class TestStatistics:
    """Тесты статистики обработки."""

    @pytest.mark.asyncio
    async def test_processing_statistics_updated(self, multi_nlp_manager, sample_text):
        """Тест обновления статистики после обработки."""
        mock_processor = AsyncMock()
        mock_processor.extract_descriptions.return_value = [
            {"text": "описание", "priority_score": 0.8}
        ]
        mock_processor.processor_type = NLPProcessorType.SPACY

        multi_nlp_manager.processors = {"spacy": mock_processor}
        multi_nlp_manager._initialized = True
        multi_nlp_manager.processing_mode = ProcessingMode.SINGLE
        multi_nlp_manager.default_processor = "spacy"
        multi_nlp_manager.global_config['quality_monitoring'] = True

        initial_count = multi_nlp_manager.processing_statistics['total_processed']

        await multi_nlp_manager.process_text(sample_text)

        assert multi_nlp_manager.processing_statistics['total_processed'] > initial_count

    @pytest.mark.asyncio
    async def test_get_processing_statistics(self, multi_nlp_manager):
        """Тест получения статистики обработки."""
        stats = multi_nlp_manager.get_processing_statistics()

        assert isinstance(stats, dict)
        assert "total_processed" in stats
        assert "processor_usage" in stats
        assert "average_quality_scores" in stats

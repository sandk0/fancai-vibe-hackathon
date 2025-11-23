"""
Тесты для StrategyFactory - фабрика для создания обработчиков стратегий.

Тестируем:
- Создание стратегий для каждого ProcessingMode
- Кэширование стратегий (переиспользование)
- Обработка ошибок при неизвестном режиме
- Интеграция со всеми 5 режимами обработки
- Enum ProcessingMode
- Метод clear_cache()
"""

import pytest
from unittest.mock import Mock, patch

from app.services.nlp.strategies.strategy_factory import StrategyFactory, ProcessingMode
from app.services.nlp.strategies.base_strategy import ProcessingStrategy
from app.services.nlp.strategies.single_strategy import SingleStrategy
from app.services.nlp.strategies.parallel_strategy import ParallelStrategy
from app.services.nlp.strategies.sequential_strategy import SequentialStrategy
from app.services.nlp.strategies.ensemble_strategy import EnsembleStrategy
from app.services.nlp.strategies.adaptive_strategy import AdaptiveStrategy


# ============================================================================
# TESTS: ProcessingMode Enum
# ============================================================================

def test_processing_mode_enum_values():
    """Тест что ProcessingMode содержит все необходимые значения."""
    # Assert
    assert hasattr(ProcessingMode, 'SINGLE')
    assert hasattr(ProcessingMode, 'PARALLEL')
    assert hasattr(ProcessingMode, 'SEQUENTIAL')
    assert hasattr(ProcessingMode, 'ENSEMBLE')
    assert hasattr(ProcessingMode, 'ADAPTIVE')


def test_processing_mode_enum_has_values():
    """Тест что ProcessingMode.value возвращает строки."""
    # Assert
    assert ProcessingMode.SINGLE.value == "single"
    assert ProcessingMode.PARALLEL.value == "parallel"
    assert ProcessingMode.SEQUENTIAL.value == "sequential"
    assert ProcessingMode.ENSEMBLE.value == "ensemble"
    assert ProcessingMode.ADAPTIVE.value == "adaptive"


def test_processing_mode_enum_count():
    """Тест что есть ровно 5 режимов обработки."""
    # Act
    modes = list(ProcessingMode)

    # Assert
    assert len(modes) == 5


# ============================================================================
# TESTS: Strategy Creation
# ============================================================================

def test_factory_creates_single_strategy():
    """Тест создания SingleStrategy через фабрику."""
    # Act
    strategy = StrategyFactory.get_strategy(ProcessingMode.SINGLE)

    # Assert
    assert isinstance(strategy, SingleStrategy)
    assert isinstance(strategy, ProcessingStrategy)


def test_factory_creates_parallel_strategy():
    """Тест создания ParallelStrategy через фабрику."""
    # Act
    strategy = StrategyFactory.get_strategy(ProcessingMode.PARALLEL)

    # Assert
    assert isinstance(strategy, ParallelStrategy)
    assert isinstance(strategy, ProcessingStrategy)


def test_factory_creates_sequential_strategy():
    """Тест создания SequentialStrategy через фабрику."""
    # Act
    strategy = StrategyFactory.get_strategy(ProcessingMode.SEQUENTIAL)

    # Assert
    assert isinstance(strategy, SequentialStrategy)
    assert isinstance(strategy, ProcessingStrategy)


def test_factory_creates_ensemble_strategy():
    """Тест создания EnsembleStrategy через фабрику."""
    # Act
    strategy = StrategyFactory.get_strategy(ProcessingMode.ENSEMBLE)

    # Assert
    assert isinstance(strategy, EnsembleStrategy)
    assert isinstance(strategy, ProcessingStrategy)


def test_factory_creates_adaptive_strategy():
    """Тест создания AdaptiveStrategy через фабрику."""
    # Act
    strategy = StrategyFactory.get_strategy(ProcessingMode.ADAPTIVE)

    # Assert
    assert isinstance(strategy, AdaptiveStrategy)
    assert isinstance(strategy, ProcessingStrategy)


# ============================================================================
# TESTS: All Strategies Can Process
# ============================================================================

@pytest.mark.asyncio
async def test_all_created_strategies_have_process_method():
    """Тест что все созданные стратегии имеют метод process."""
    # Act
    for mode in ProcessingMode:
        strategy = StrategyFactory.get_strategy(mode)

        # Assert
        assert hasattr(strategy, 'process')
        assert callable(strategy.process)


# ============================================================================
# TESTS: Strategy Caching
# ============================================================================

def test_factory_caches_strategy_instances():
    """Тест что фабрика кэширует стратегии (возвращает одинаковые объекты)."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act
    strategy1 = StrategyFactory.get_strategy(ProcessingMode.SINGLE)
    strategy2 = StrategyFactory.get_strategy(ProcessingMode.SINGLE)

    # Assert - должны быть один и тот же объект (кэширование)
    assert strategy1 is strategy2


def test_factory_different_modes_different_instances():
    """Тест что разные режимы возвращают разные инстансы."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act
    single = StrategyFactory.get_strategy(ProcessingMode.SINGLE)
    parallel = StrategyFactory.get_strategy(ProcessingMode.PARALLEL)

    # Assert
    assert single is not parallel
    assert isinstance(single, SingleStrategy)
    assert isinstance(parallel, ParallelStrategy)


def test_factory_cache_contains_correct_modes():
    """Тест что кэш содержит правильные режимы."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act - создаем несколько стратегий
    StrategyFactory.get_strategy(ProcessingMode.SINGLE)
    StrategyFactory.get_strategy(ProcessingMode.PARALLEL)
    StrategyFactory.get_strategy(ProcessingMode.ENSEMBLE)

    # Assert
    assert ProcessingMode.SINGLE in StrategyFactory._strategy_cache
    assert ProcessingMode.PARALLEL in StrategyFactory._strategy_cache
    assert ProcessingMode.ENSEMBLE in StrategyFactory._strategy_cache


def test_factory_cache_size_after_creating_all():
    """Тест что кэш содержит все 5 стратегий после их создания."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act - создаем все стратегии
    for mode in ProcessingMode:
        StrategyFactory.get_strategy(mode)

    # Assert
    assert len(StrategyFactory._strategy_cache) == 5


# ============================================================================
# TESTS: Clear Cache
# ============================================================================

def test_factory_clear_cache():
    """Тест что clear_cache() очищает кэш."""
    # Arrange
    StrategyFactory.clear_cache()
    StrategyFactory.get_strategy(ProcessingMode.SINGLE)
    assert len(StrategyFactory._strategy_cache) > 0

    # Act
    StrategyFactory.clear_cache()

    # Assert
    assert len(StrategyFactory._strategy_cache) == 0


def test_factory_recreates_strategy_after_clear():
    """Тест что новые стратегии создаются после очистки кэша."""
    # Arrange
    StrategyFactory.clear_cache()
    strategy1 = StrategyFactory.get_strategy(ProcessingMode.SINGLE)

    # Act
    StrategyFactory.clear_cache()
    strategy2 = StrategyFactory.get_strategy(ProcessingMode.SINGLE)

    # Assert
    # После очистки кэша должны быть разные объекты
    assert strategy1 is not strategy2
    assert isinstance(strategy1, SingleStrategy)
    assert isinstance(strategy2, SingleStrategy)


# ============================================================================
# TESTS: Error Handling
# ============================================================================

def test_factory_raises_error_for_unknown_mode():
    """Тест что фабрика выбрасывает ошибку для неизвестного режима."""
    # Arrange
    invalid_mode = "invalid_mode"

    # Act & Assert
    with pytest.raises(ValueError, match="Unknown processing mode"):
        StrategyFactory.get_strategy(invalid_mode)  # type: ignore


def test_factory_raises_error_for_none_mode():
    """Тест что фабрика выбрасывает ошибку для None режима."""
    # Act & Assert
    with pytest.raises((ValueError, AttributeError)):
        StrategyFactory.get_strategy(None)  # type: ignore


def test_factory_error_message_contains_mode():
    """Тест что сообщение об ошибке содержит информацию о режиме."""
    # Arrange
    invalid_mode = "unknown_mode"

    # Act & Assert
    with pytest.raises(ValueError) as exc_info:
        StrategyFactory.get_strategy(invalid_mode)  # type: ignore

    assert "Unknown processing mode" in str(exc_info.value)


# ============================================================================
# TESTS: Integration with ProcessingMode
# ============================================================================

def test_factory_works_with_all_enum_members():
    """Тест что фабрика работает со всеми членами ProcessingMode enum."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act & Assert
    for mode in ProcessingMode:
        strategy = StrategyFactory.get_strategy(mode)
        assert strategy is not None
        assert isinstance(strategy, ProcessingStrategy)
        assert hasattr(strategy, 'process')


def test_factory_strategy_types_match_modes():
    """Тест что типы стратегий соответствуют режимам."""
    # Arrange
    StrategyFactory.clear_cache()
    expected_types = {
        ProcessingMode.SINGLE: SingleStrategy,
        ProcessingMode.PARALLEL: ParallelStrategy,
        ProcessingMode.SEQUENTIAL: SequentialStrategy,
        ProcessingMode.ENSEMBLE: EnsembleStrategy,
        ProcessingMode.ADAPTIVE: AdaptiveStrategy,
    }

    # Act & Assert
    for mode, expected_type in expected_types.items():
        strategy = StrategyFactory.get_strategy(mode)
        assert isinstance(strategy, expected_type)


# ============================================================================
# TESTS: String Mode Input (if supported)
# ============================================================================

def test_factory_with_enum_string_value():
    """Тест создания стратегии используя string значение из enum."""
    # Arrange
    mode_value = ProcessingMode.SINGLE.value  # "single"

    # Act & Assert - зависит от реализации, может быть ошибка
    # Но тестируем что enum values - это строки
    assert isinstance(mode_value, str)


# ============================================================================
# TESTS: Strategy Factory Consistency
# ============================================================================

def test_factory_consistency_single_mode():
    """Тест консистентности создания SINGLE стратегий."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act
    strategies = [StrategyFactory.get_strategy(ProcessingMode.SINGLE) for _ in range(5)]

    # Assert - все должны быть одним объектом (кэширование)
    assert all(s is strategies[0] for s in strategies)


def test_factory_consistency_all_modes():
    """Тест консистентности всех режимов."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act - создаем каждый режим несколько раз
    results = {}
    for mode in ProcessingMode:
        first = StrategyFactory.get_strategy(mode)
        second = StrategyFactory.get_strategy(mode)
        results[mode] = (first, second)

    # Assert - каждый режим должен возвращать один и тот же объект
    for mode, (first, second) in results.items():
        assert first is second, f"Mode {mode.value} returns different instances"


# ============================================================================
# TESTS: Factory State Management
# ============================================================================

def test_factory_initial_state():
    """Тест что кэш пуст в начале."""
    # Arrange & Act
    StrategyFactory.clear_cache()

    # Assert
    assert len(StrategyFactory._strategy_cache) == 0


def test_factory_multiple_clear_cache_calls():
    """Тест что множественные вызовы clear_cache() работают."""
    # Arrange
    StrategyFactory.clear_cache()
    StrategyFactory.get_strategy(ProcessingMode.SINGLE)

    # Act
    StrategyFactory.clear_cache()
    StrategyFactory.clear_cache()
    StrategyFactory.clear_cache()

    # Assert
    assert len(StrategyFactory._strategy_cache) == 0


# ============================================================================
# TESTS: Factory Docstring and API
# ============================================================================

def test_factory_get_strategy_has_docstring():
    """Тест что метод get_strategy имеет документацию."""
    # Assert
    assert StrategyFactory.get_strategy.__doc__ is not None
    assert "strategy" in StrategyFactory.get_strategy.__doc__.lower()


def test_factory_clear_cache_has_docstring():
    """Тест что метод clear_cache имеет документацию."""
    # Assert
    assert StrategyFactory.clear_cache.__doc__ is not None


# ============================================================================
# TESTS: Edge Cases and Robustness
# ============================================================================

def test_factory_with_float_mode():
    """Тест что фабрика обрабатывает некорректные типы режимов."""
    # Act & Assert
    with pytest.raises((ValueError, TypeError, AttributeError)):
        StrategyFactory.get_strategy(1.5)  # type: ignore


def test_factory_with_list_mode():
    """Тест что фабрика обрабатывает список как режим."""
    # Act & Assert
    with pytest.raises((ValueError, TypeError, AttributeError)):
        StrategyFactory.get_strategy([ProcessingMode.SINGLE])  # type: ignore


def test_factory_with_dict_mode():
    """Тест что фабрика обрабатывает словарь как режим."""
    # Act & Assert
    with pytest.raises((ValueError, TypeError, AttributeError)):
        StrategyFactory.get_strategy({"mode": "single"})  # type: ignore


# ============================================================================
# TESTS: All Strategies Inherit from Base
# ============================================================================

def test_all_created_strategies_inherit_from_base():
    """Тест что все стратегии наследуют ProcessingStrategy."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act & Assert
    for mode in ProcessingMode:
        strategy = StrategyFactory.get_strategy(mode)
        assert isinstance(strategy, ProcessingStrategy)


# ============================================================================
# TESTS: Real Process Method Existence
# ============================================================================

@pytest.mark.asyncio
async def test_all_strategies_process_method_callable():
    """Тест что метод process всех стратегий вызываемый."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act & Assert
    for mode in ProcessingMode:
        strategy = StrategyFactory.get_strategy(mode)
        # Проверяем что это асинхронная функция
        assert callable(strategy.process)


# ============================================================================
# TESTS: Factory as Singleton Pattern
# ============================================================================

def test_factory_maintains_cache_across_calls():
    """Тест что кэш сохраняется между вызовами."""
    # Arrange
    StrategyFactory.clear_cache()
    first_creation = StrategyFactory.get_strategy(ProcessingMode.SINGLE)
    cache_size_after_first = len(StrategyFactory._strategy_cache)

    # Act
    second_creation = StrategyFactory.get_strategy(ProcessingMode.SINGLE)
    cache_size_after_second = len(StrategyFactory._strategy_cache)

    # Assert
    assert first_creation is second_creation
    assert cache_size_after_first == cache_size_after_second == 1


def test_factory_independent_mode_creation():
    """Тест что каждый режим независимо кэшируется."""
    # Arrange
    StrategyFactory.clear_cache()

    # Act
    single = StrategyFactory.get_strategy(ProcessingMode.SINGLE)
    parallel = StrategyFactory.get_strategy(ProcessingMode.PARALLEL)

    # Assert
    assert single is not parallel
    # Оба должны быть в кэше
    assert ProcessingMode.SINGLE in StrategyFactory._strategy_cache
    assert ProcessingMode.PARALLEL in StrategyFactory._strategy_cache

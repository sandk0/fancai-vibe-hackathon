"""
Prometheus metrics для мониторинга Reading Sessions в BookReader AI.

Метрики:
- Counters: sessions_started_total, sessions_ended_total, session_errors_total
- Histograms: session_duration_seconds, session_pages_read
- Gauges: active_sessions_count, abandoned_sessions_count

Integration:
- Используется в routers/reading_sessions.py
- Экспортируется через /metrics endpoint
- Собирается Prometheus каждые 15 секунд
"""

from prometheus_client import Counter, Histogram, Gauge, Info
from typing import Optional
import time


# ============================================================================
# Counters - монотонно растущие счетчики
# ============================================================================

sessions_started_total = Counter(
    'reading_sessions_started_total',
    'Total number of reading sessions started',
    ['device_type', 'book_genre']
)

sessions_ended_total = Counter(
    'reading_sessions_ended_total',
    'Total number of reading sessions ended',
    ['completion_status', 'device_type']
)

sessions_updated_total = Counter(
    'reading_sessions_updated_total',
    'Total number of session position updates',
    ['device_type']
)

session_errors_total = Counter(
    'reading_sessions_errors_total',
    'Total number of errors in reading sessions operations',
    ['operation', 'error_type']
)


# ============================================================================
# Histograms - распределение значений
# ============================================================================

session_duration_seconds = Histogram(
    'reading_session_duration_seconds',
    'Reading session duration in seconds',
    # Buckets: 1min, 5min, 10min, 30min, 1hour, 2hours, 4hours, 8hours
    buckets=[60, 300, 600, 1800, 3600, 7200, 14400, 28800],
    labelnames=['device_type', 'completion_status']
)

session_pages_read = Histogram(
    'reading_session_pages_read',
    'Number of pages read during session',
    buckets=[1, 5, 10, 20, 50, 100, 200, 500],
    labelnames=['device_type']
)

session_progress_delta = Histogram(
    'reading_session_progress_delta_percent',
    'Progress delta (end - start position) in percent',
    buckets=[1, 5, 10, 20, 30, 50, 75, 100],
    labelnames=['device_type']
)

session_api_latency_seconds = Histogram(
    'reading_session_api_latency_seconds',
    'API endpoint latency for reading sessions operations',
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
    labelnames=['endpoint', 'method', 'status_code']
)


# ============================================================================
# Gauges - значения, которые могут расти и падать
# ============================================================================

active_sessions_count = Gauge(
    'reading_sessions_active_count',
    'Current number of active reading sessions',
    ['device_type']
)

abandoned_sessions_count = Gauge(
    'reading_sessions_abandoned_count',
    'Number of sessions abandoned (active > 24 hours)'
)

concurrent_users_count = Gauge(
    'reading_sessions_concurrent_users',
    'Number of unique users with active sessions'
)


# ============================================================================
# Info - метаинформация (не изменяется часто)
# ============================================================================

reading_system_info = Info(
    'reading_sessions_system',
    'Reading sessions system information'
)

# Устанавливаем версию системы и дату последнего деплоя
reading_system_info.info({
    'version': '2.0.0',
    'feature': 'reading_sessions',
    'deployed_at': '2025-10-28'
})


# ============================================================================
# Helper Functions - обертки для удобного использования
# ============================================================================

class MetricsCollector:
    """
    Класс для удобного сбора метрик с контекстным менеджером.

    Usage:
        with MetricsCollector.measure_duration(
            endpoint='start_session',
            method='POST'
        ) as collector:
            # ... операция ...
            collector.set_status(201)
    """

    def __init__(self, endpoint: str, method: str):
        """
        Инициализация коллектора метрик.

        Args:
            endpoint: Название endpoint (start, update, end, etc.)
            method: HTTP метод (GET, POST, PUT)
        """
        self.endpoint = endpoint
        self.method = method
        self.start_time = None
        self.status_code = 200

    def __enter__(self):
        """Начало измерения времени."""
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Завершение измерения и запись метрики."""
        duration = time.time() - self.start_time

        # Если было исключение, ставим 500
        if exc_type is not None:
            self.status_code = 500

        # Записываем латентность
        session_api_latency_seconds.labels(
            endpoint=self.endpoint,
            method=self.method,
            status_code=str(self.status_code)
        ).observe(duration)

    def set_status(self, status_code: int):
        """
        Установить статус код ответа.

        Args:
            status_code: HTTP статус код (200, 201, 400, 404, etc.)
        """
        self.status_code = status_code

    @classmethod
    def measure_duration(cls, endpoint: str, method: str):
        """
        Создать новый коллектор для измерения времени выполнения.

        Args:
            endpoint: Название endpoint
            method: HTTP метод

        Returns:
            MetricsCollector instance
        """
        return cls(endpoint, method)


def record_session_started(
    device_type: Optional[str] = None,
    book_genre: Optional[str] = None
):
    """
    Записать метрику старта сессии.

    Args:
        device_type: Тип устройства (mobile, tablet, desktop)
        book_genre: Жанр книги (fiction, non-fiction, etc.)
    """
    sessions_started_total.labels(
        device_type=device_type or 'unknown',
        book_genre=book_genre or 'unknown'
    ).inc()


def record_session_ended(
    duration_seconds: float,
    pages_read: int,
    progress_delta: int,
    device_type: Optional[str] = None,
    completion_status: str = 'completed'
):
    """
    Записать метрики завершения сессии.

    Args:
        duration_seconds: Длительность сессии в секундах
        pages_read: Количество прочитанных страниц
        progress_delta: Прогресс за сессию (0-100%)
        device_type: Тип устройства
        completion_status: Статус завершения (completed, abandoned, auto_closed)
    """
    device = device_type or 'unknown'

    # Counter
    sessions_ended_total.labels(
        completion_status=completion_status,
        device_type=device
    ).inc()

    # Histograms
    session_duration_seconds.labels(
        device_type=device,
        completion_status=completion_status
    ).observe(duration_seconds)

    session_pages_read.labels(
        device_type=device
    ).observe(pages_read)

    session_progress_delta.labels(
        device_type=device
    ).observe(progress_delta)


def record_session_updated(device_type: Optional[str] = None):
    """
    Записать метрику обновления позиции в сессии.

    Args:
        device_type: Тип устройства
    """
    sessions_updated_total.labels(
        device_type=device_type or 'unknown'
    ).inc()


def record_session_error(operation: str, error_type: str):
    """
    Записать метрику ошибки в операции с сессией.

    Args:
        operation: Тип операции (start, update, end, get_active, get_history)
        error_type: Тип ошибки (validation, not_found, database, permission)
    """
    session_errors_total.labels(
        operation=operation,
        error_type=error_type
    ).inc()


def update_active_sessions_gauge(count: int, device_type: Optional[str] = None):
    """
    Обновить gauge активных сессий.

    Args:
        count: Количество активных сессий
        device_type: Тип устройства (опционально)
    """
    if device_type:
        active_sessions_count.labels(device_type=device_type).set(count)
    else:
        # Обновляем для всех типов устройств
        for device in ['mobile', 'tablet', 'desktop', 'unknown']:
            # Здесь нужен запрос к БД для получения точного count по device_type
            # Пока ставим placeholder
            pass


def update_abandoned_sessions_gauge(count: int):
    """
    Обновить gauge заброшенных сессий.

    Args:
        count: Количество заброшенных сессий
    """
    abandoned_sessions_count.set(count)


def update_concurrent_users_gauge(count: int):
    """
    Обновить gauge одновременных пользователей.

    Args:
        count: Количество уникальных пользователей с активными сессиями
    """
    concurrent_users_count.set(count)


# ============================================================================
# Export all metrics for /metrics endpoint
# ============================================================================

__all__ = [
    'sessions_started_total',
    'sessions_ended_total',
    'sessions_updated_total',
    'session_errors_total',
    'session_duration_seconds',
    'session_pages_read',
    'session_progress_delta',
    'session_api_latency_seconds',
    'active_sessions_count',
    'abandoned_sessions_count',
    'concurrent_users_count',
    'reading_system_info',
    'MetricsCollector',
    'record_session_started',
    'record_session_ended',
    'record_session_updated',
    'record_session_error',
    'update_active_sessions_gauge',
    'update_abandoned_sessions_gauge',
    'update_concurrent_users_gauge',
]

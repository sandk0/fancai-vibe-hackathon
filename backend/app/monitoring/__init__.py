"""
Monitoring package для BookReader AI.

Modules:
- metrics.py - Prometheus metrics definitions
- middleware.py - FastAPI middleware для автоматического сбора метрик
"""

from .metrics import (
    sessions_started_total,
    sessions_ended_total,
    sessions_updated_total,
    session_errors_total,
    session_duration_seconds,
    session_pages_read,
    session_progress_delta,
    session_api_latency_seconds,
    active_sessions_count,
    abandoned_sessions_count,
    concurrent_users_count,
    MetricsCollector,
    record_session_started,
    record_session_ended,
    record_session_updated,
    record_session_error,
)

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
    'MetricsCollector',
    'record_session_started',
    'record_session_ended',
    'record_session_updated',
    'record_session_error',
]

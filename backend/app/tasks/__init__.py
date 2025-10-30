"""
Celery задачи для BookReader AI.

Модуль содержит все фоновые задачи приложения:
- reading_sessions_tasks: автоматическое закрытие заброшенных сессий чтения
"""

from .reading_sessions_tasks import close_abandoned_sessions

__all__ = [
    "close_abandoned_sessions",
]

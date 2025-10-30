"""
Admin API routes for reading sessions monitoring and management.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional

from ...core.auth import get_current_admin_user
from ...models.user import User
from ...tasks.reading_sessions_tasks import (
    close_abandoned_sessions,
    get_cleanup_statistics,
)

router = APIRouter()


class CleanupStatsResponse(BaseModel):
    """Response model для статистики cleanup задачи."""

    total_closed: int = Field(..., description="Количество закрытых сессий за период")
    total_active: int = Field(..., description="Количество активных сессий")
    avg_duration_minutes: float = Field(
        ..., description="Средняя длительность сессий в минутах"
    )
    no_progress_count: int = Field(
        ..., description="Количество сессий без прогресса"
    )
    period_hours: int = Field(..., description="Период анализа в часах")
    timestamp: str = Field(..., description="Время генерации статистики")


class TaskExecutionResponse(BaseModel):
    """Response model для результата выполнения задачи."""

    task_id: str = Field(..., description="ID Celery задачи")
    status: str = Field(..., description="Статус задачи (PENDING, STARTED, SUCCESS)")
    message: str = Field(..., description="Сообщение о результате")


class ManualCleanupResponse(BaseModel):
    """Response model для результата ручного cleanup."""

    closed_count: int = Field(..., description="Количество закрытых сессий")
    execution_time_ms: float = Field(..., description="Время выполнения в мс")
    deadline: Optional[str] = Field(None, description="Deadline timestamp")
    error: Optional[str] = Field(None, description="Сообщение об ошибке")


@router.get("/reading-sessions/cleanup-stats", response_model=CleanupStatsResponse)
async def get_reading_sessions_cleanup_stats(
    hours: int = Query(
        default=24, ge=1, le=168, description="Период анализа в часах (1-168)"
    ),
    admin_user: User = Depends(get_current_admin_user),
):
    """
    Получить статистику закрытых reading sessions за последние N часов.

    **Параметры:**
    - **hours**: Период анализа в часах (по умолчанию 24, макс 168)

    **Возвращает:**
    - Статистика закрытых и активных сессий
    - Средняя длительность сессий
    - Количество сессий без прогресса
    - Timestamp генерации статистики

    **Требуется:** Admin права доступа
    """
    # Вызываем Celery задачу синхронно (get результат сразу)
    task = get_cleanup_statistics.apply_async(args=[hours])
    result = task.get(timeout=10)  # Ожидаем до 10 секунд

    return CleanupStatsResponse(**result)


@router.post("/reading-sessions/cleanup", response_model=ManualCleanupResponse)
async def trigger_manual_cleanup(admin_user: User = Depends(get_current_admin_user)):
    """
    Вручную запустить задачу закрытия заброшенных reading sessions.

    Закрывает все сессии где:
    - is_active=True
    - Прошло более 2 часов с started_at
    - ended_at is NULL

    **Возвращает:**
    - Количество закрытых сессий
    - Время выполнения
    - Ошибки (если были)

    **Требуется:** Admin права доступа

    **Примечание:** Обычно эта задача выполняется автоматически каждые 30 минут.
    Используйте этот endpoint только для ручного управления.
    """
    # Вызываем задачу синхронно для немедленного результата
    task = close_abandoned_sessions.apply_async()
    result = task.get(timeout=30)  # Ожидаем до 30 секунд

    return ManualCleanupResponse(**result)


@router.post("/reading-sessions/cleanup-async", response_model=TaskExecutionResponse)
async def trigger_async_cleanup(admin_user: User = Depends(get_current_admin_user)):
    """
    Асинхронно запустить задачу закрытия заброшенных sessions.

    В отличие от `/cleanup`, этот endpoint не ждёт завершения задачи,
    а возвращает task_id для отслеживания статуса.

    **Возвращает:**
    - task_id для мониторинга через Flower или Celery API
    - Начальный статус задачи

    **Требуется:** Admin права доступа

    **Как проверить результат:**
    ```bash
    # Через Flower (если запущен)
    curl http://localhost:5555/api/task/info/{task_id}

    # Через Celery inspect
    celery -A app.core.celery_app inspect active
    ```
    """
    # Запускаем задачу асинхронно
    task = close_abandoned_sessions.delay()

    return TaskExecutionResponse(
        task_id=task.id,
        status=task.status,
        message=f"Cleanup task started with ID: {task.id}. "
        "Check status via Flower or Celery API.",
    )

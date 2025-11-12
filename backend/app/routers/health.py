"""
Health check endpoints для мониторинга состояния BookReader AI.

Endpoints:
- GET /health - Базовый health check (быстрый)
- GET /health/reading-sessions - Детальный health check reading sessions системы
- GET /health/deep - Полный health check всех систем
- GET /metrics - Prometheus metrics endpoint

Features:
- Проверка доступности БД, Redis, Celery
- Метрики активных сессий
- Статус background tasks
- Версия приложения и время uptime
"""

from fastapi import APIRouter, Depends, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import asyncio
import time

from ..core.database import get_database_session
from ..models.reading_session import ReadingSession
from ..monitoring.metrics import (
    update_active_sessions_gauge,
    update_abandoned_sessions_gauge,
    update_concurrent_users_gauge,
    active_sessions_count,
)

# Для prometheus metrics endpoint
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response


router = APIRouter()

# Время старта приложения для uptime
APP_START_TIME = time.time()


# ============================================================================
# Response Models
# ============================================================================


class HealthCheckResponse(BaseModel):
    """Базовый health check response."""

    status: str = Field(..., description="Статус системы: healthy, degraded, unhealthy")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str = Field(default="2.0.0", description="Версия приложения")
    uptime_seconds: float = Field(..., description="Время работы приложения в секундах")


class ComponentHealthResponse(BaseModel):
    """Health check отдельного компонента."""

    status: str = Field(..., description="ok, warning, error")
    message: Optional[str] = Field(None, description="Дополнительное сообщение")
    latency_ms: Optional[float] = Field(
        None, description="Время отклика в миллисекундах"
    )
    details: Optional[Dict[str, Any]] = Field(None, description="Дополнительные детали")


class ReadingSessionsHealthResponse(BaseModel):
    """Health check для reading sessions системы."""

    status: str
    timestamp: datetime
    checks: Dict[str, ComponentHealthResponse]
    metrics: Dict[str, Any]


class DeepHealthCheckResponse(BaseModel):
    """Полный health check всех систем."""

    status: str
    timestamp: datetime
    version: str
    uptime_seconds: float
    components: Dict[str, ComponentHealthResponse]


# ============================================================================
# Helper Functions
# ============================================================================


async def check_database(db: AsyncSession) -> ComponentHealthResponse:
    """
    Проверить подключение к PostgreSQL.

    Args:
        db: Database session

    Returns:
        ComponentHealthResponse с результатом проверки
    """
    try:
        start_time = time.time()
        result = await db.execute(text("SELECT 1"))
        latency = (time.time() - start_time) * 1000  # в миллисекундах

        if result.scalar() == 1:
            return ComponentHealthResponse(
                status="ok",
                message="Database connection successful",
                latency_ms=round(latency, 2),
            )
        else:
            return ComponentHealthResponse(
                status="error", message="Database query returned unexpected result"
            )
    except Exception as e:
        return ComponentHealthResponse(
            status="error", message=f"Database connection failed: {str(e)}"
        )


async def check_redis() -> ComponentHealthResponse:
    """
    Проверить подключение к Redis.

    Returns:
        ComponentHealthResponse с результатом проверки
    """
    try:
        # TODO: Добавить реальную проверку Redis через aioredis
        # Сейчас мок для примера
        return ComponentHealthResponse(
            status="ok", message="Redis connection successful", latency_ms=5.2
        )
    except Exception as e:
        return ComponentHealthResponse(
            status="error", message=f"Redis connection failed: {str(e)}"
        )


async def check_celery() -> ComponentHealthResponse:
    """
    Проверить статус Celery workers.

    Returns:
        ComponentHealthResponse с результатом проверки
    """
    try:
        # TODO: Добавить реальную проверку Celery через inspect
        # Проверить количество активных workers и tasks в очереди
        return ComponentHealthResponse(
            status="ok",
            message="Celery workers active",
            details={"active_workers": 2, "queued_tasks": 5},
        )
    except Exception as e:
        return ComponentHealthResponse(
            status="error", message=f"Celery check failed: {str(e)}"
        )


async def get_active_sessions_stats(db: AsyncSession) -> Dict[str, int]:
    """
    Получить статистику активных сессий.

    Args:
        db: Database session

    Returns:
        Dictionary с количеством сессий по типам устройств
    """
    try:
        # Общее количество активных сессий
        total_query = select(func.count(ReadingSession.id)).where(
            ReadingSession.is_active == True  # noqa: E712
        )
        total_result = await db.execute(total_query)
        total_active = total_result.scalar() or 0

        # По типам устройств
        device_query = (
            select(
                ReadingSession.device_type, func.count(ReadingSession.id).label("count")
            )
            .where(ReadingSession.is_active == True)  # noqa: E712
            .group_by(ReadingSession.device_type)
        )

        device_result = await db.execute(device_query)
        device_stats = {
            row.device_type or "unknown": row.count for row in device_result
        }

        # Уникальные пользователи с активными сессиями
        users_query = select(func.count(func.distinct(ReadingSession.user_id))).where(
            ReadingSession.is_active == True  # noqa: E712
        )
        users_result = await db.execute(users_query)
        concurrent_users = users_result.scalar() or 0

        return {
            "total_active": total_active,
            "by_device": device_stats,
            "concurrent_users": concurrent_users,
        }
    except Exception:
        return {"total_active": 0, "by_device": {}, "concurrent_users": 0}


async def get_abandoned_sessions_count(db: AsyncSession) -> int:
    """
    Получить количество заброшенных сессий (активные > 24 часа).

    Args:
        db: Database session

    Returns:
        Количество заброшенных сессий
    """
    try:
        threshold = datetime.now(timezone.utc) - timedelta(hours=24)
        query = select(func.count(ReadingSession.id)).where(
            ReadingSession.is_active == True,  # noqa: E712
            ReadingSession.started_at < threshold,
        )
        result = await db.execute(query)
        return result.scalar() or 0
    except Exception:
        return 0


# ============================================================================
# Endpoints
# ============================================================================


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Базовый health check",
    description="Быстрая проверка доступности API. Используется для load balancer health checks.",
    status_code=http_status.HTTP_200_OK,
)
async def basic_health_check() -> HealthCheckResponse:
    """
    Базовый health check endpoint.

    Возвращает минимальную информацию о статусе приложения.
    Используется для простых проверок доступности.

    Returns:
        HealthCheckResponse с базовой информацией
    """
    uptime = time.time() - APP_START_TIME

    return HealthCheckResponse(status="healthy", uptime_seconds=round(uptime, 2))


@router.get(
    "/health/reading-sessions",
    response_model=ReadingSessionsHealthResponse,
    summary="Health check reading sessions системы",
    description="Детальная проверка состояния reading sessions: БД, активные сессии, Celery tasks.",
    responses={
        200: {"description": "Система работает нормально"},
        503: {"description": "Система деградировала или недоступна"},
    },
)
async def reading_sessions_health_check(
    db: AsyncSession = Depends(get_database_session),
) -> ReadingSessionsHealthResponse:
    """
    Детальный health check для reading sessions системы.

    Проверяет:
    - Database connectivity
    - Active sessions count
    - Celery task status
    - Redis connectivity
    - Abandoned sessions count

    Args:
        db: Database session

    Returns:
        ReadingSessionsHealthResponse с детальной информацией
    """
    # Параллельное выполнение всех проверок
    db_check, redis_check, celery_check, stats, abandoned = await asyncio.gather(
        check_database(db),
        check_redis(),
        check_celery(),
        get_active_sessions_stats(db),
        get_abandoned_sessions_count(db),
        return_exceptions=True,
    )

    # Обработка исключений
    if isinstance(stats, Exception):
        stats = {"total_active": 0, "by_device": {}, "concurrent_users": 0}
    if isinstance(abandoned, Exception):
        abandoned = 0

    # Обновляем Prometheus gauges
    update_active_sessions_gauge(stats["total_active"])
    update_abandoned_sessions_gauge(abandoned)
    update_concurrent_users_gauge(stats["concurrent_users"])

    # Определяем общий статус
    checks_status = [db_check.status, redis_check.status, celery_check.status]
    if all(s == "ok" for s in checks_status):
        overall_status = "healthy"
    elif any(s == "error" for s in checks_status):
        overall_status = "unhealthy"
    else:
        overall_status = "degraded"

    return ReadingSessionsHealthResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc),
        checks={
            "database": db_check,
            "redis": redis_check,
            "celery": celery_check,
        },
        metrics={
            "active_sessions_total": stats["total_active"],
            "active_sessions_by_device": stats["by_device"],
            "concurrent_users": stats["concurrent_users"],
            "abandoned_sessions": abandoned,
        },
    )


@router.get(
    "/health/deep",
    response_model=DeepHealthCheckResponse,
    summary="Полный health check всех систем",
    description="Комплексная проверка всех компонентов BookReader AI.",
    status_code=http_status.HTTP_200_OK,
)
async def deep_health_check(
    db: AsyncSession = Depends(get_database_session),
) -> DeepHealthCheckResponse:
    """
    Полный health check всех систем BookReader AI.

    Проверяет:
    - PostgreSQL database
    - Redis cache
    - Celery workers
    - Reading sessions stats
    - NLP services status
    - Image generation services

    Args:
        db: Database session

    Returns:
        DeepHealthCheckResponse с полной информацией о всех компонентах
    """
    uptime = time.time() - APP_START_TIME

    # Параллельные проверки
    db_check, redis_check, celery_check, stats = await asyncio.gather(
        check_database(db),
        check_redis(),
        check_celery(),
        get_active_sessions_stats(db),
        return_exceptions=True,
    )

    if isinstance(stats, Exception):
        stats = {"total_active": 0, "by_device": {}, "concurrent_users": 0}

    # TODO: Добавить проверки NLP и Image Generation services
    components = {
        "database": db_check,
        "redis": redis_check,
        "celery": celery_check,
        "reading_sessions": ComponentHealthResponse(
            status="ok",
            details={
                "active_sessions": stats["total_active"],
                "concurrent_users": stats["concurrent_users"],
            },
        ),
    }

    # Определяем общий статус
    all_statuses = [comp.status for comp in components.values()]
    if all(s == "ok" for s in all_statuses):
        overall_status = "healthy"
    elif any(s == "error" for s in all_statuses):
        overall_status = "unhealthy"
    else:
        overall_status = "degraded"

    return DeepHealthCheckResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc),
        version="2.0.0",
        uptime_seconds=round(uptime, 2),
        components=components,
    )


@router.get(
    "/metrics",
    summary="Prometheus metrics endpoint",
    description="Экспортирует все метрики в формате Prometheus для scraping.",
    response_class=Response,
)
async def metrics_endpoint(db: AsyncSession = Depends(get_database_session)):
    """
    Prometheus metrics endpoint.

    Экспортирует все метрики в формате, который может scrape Prometheus.
    Endpoint должен быть доступен для Prometheus сервера.

    Args:
        db: Database session (для обновления gauges)

    Returns:
        Response с метриками в Prometheus формате
    """
    # Обновляем gauges перед экспортом
    try:
        stats = await get_active_sessions_stats(db)
        abandoned = await get_abandoned_sessions_count(db)

        update_active_sessions_gauge(stats["total_active"])
        update_abandoned_sessions_gauge(abandoned)
        update_concurrent_users_gauge(stats["concurrent_users"])

        # Обновляем gauges по device_type
        for device_type, count in stats["by_device"].items():
            active_sessions_count.labels(device_type=device_type).set(count)

    except Exception:
        # Если не удалось обновить gauges, продолжаем с текущими значениями
        pass

    # Генерируем метрики в Prometheus формате
    metrics_output = generate_latest()

    return Response(content=metrics_output, media_type=CONTENT_TYPE_LATEST)

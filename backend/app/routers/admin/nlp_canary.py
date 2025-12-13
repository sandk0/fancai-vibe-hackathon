"""
Admin API routes for NLP Canary Deployment management.

Provides endpoints for managing gradual rollout of new Multi-NLP architecture:
- Get current canary status
- Advance to next stage
- Emergency rollback
- View rollout history
- Monitor quality metrics per cohort
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import logging

from ...core.auth import get_current_admin_user
from ...models.user import User
from ...core.database import get_database_session
from ...services.nlp_canary import NLPCanaryDeployment, RolloutStage, STAGE_PERCENTAGES
from ...services.feature_flag_manager import FeatureFlagManager
from sqlalchemy.ext.asyncio import AsyncSession


logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models
class CanaryStatusResponse(BaseModel):
    """Ответ со статусом canary deployment."""
    stage: int = Field(..., description="Current stage (0-4)")
    stage_name: str = Field(..., description="Stage name")
    percentage: int = Field(..., description="Rollout percentage (0-100)")
    total_users: int = Field(..., description="Total users in system")
    estimated_users_new_arch: int = Field(..., description="Users on new architecture")
    estimated_users_old_arch: int = Field(..., description="Users on old architecture")
    cache_size: int = Field(..., description="Cached cohort assignments")
    last_updated: Optional[str] = Field(None, description="Last update timestamp")
    updated_by: Optional[str] = Field(None, description="Admin who made last update")
    notes: Optional[str] = Field(None, description="Notes about last update")
    feature_flag_enabled: bool = Field(..., description="Global feature flag status")


class CanaryMetricsResponse(BaseModel):
    """Ответ с метриками качества по cohorts."""
    old_architecture: Dict[str, Any] = Field(..., description="Old architecture metrics")
    new_architecture: Dict[str, Any] = Field(..., description="New architecture metrics")


class CanaryAdvanceResponse(BaseModel):
    """Ответ на операцию advance."""
    message: str
    old_stage: int
    old_percentage: int
    new_stage: int
    new_percentage: int
    admin: Optional[str]
    timestamp: Optional[str]


class CanaryRollbackResponse(BaseModel):
    """Ответ на операцию rollback."""
    message: str
    old_stage: int
    old_percentage: int
    new_stage: int
    new_percentage: int
    admin: Optional[str]
    timestamp: Optional[str]
    is_rollback: bool = True


class CanaryHistoryEntry(BaseModel):
    """Запись в истории rollout."""
    id: int
    stage: int
    percentage: int
    updated_at: Optional[str]
    updated_by: Optional[str]
    notes: Optional[str]


class CanaryHistoryResponse(BaseModel):
    """Ответ с историей rollout."""
    history: List[CanaryHistoryEntry]
    total_entries: int


@router.get("/nlp-canary/status", response_model=CanaryStatusResponse)
async def get_canary_status(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получить текущий статус canary deployment новой NLP архитектуры.

    Возвращает:
    - Текущую стадию rollout и процент пользователей
    - Распределение пользователей по архитектурам
    - Информацию о последнем обновлении
    - Статус feature flag

    **Требует прав администратора.**
    """
    try:
        flag_manager = FeatureFlagManager(db)
        await flag_manager.initialize()

        canary = NLPCanaryDeployment(flag_manager, db)
        await canary.initialize()

        status = await canary.get_status()

        return status

    except Exception as e:
        logger.error(f"Error getting canary status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get canary status: {str(e)}"
        )


@router.get("/nlp-canary/metrics", response_model=CanaryMetricsResponse)
async def get_canary_metrics(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получить метрики качества NLP обработки по cohorts.

    Сравнивает производительность старой и новой архитектур:
    - F1 score, precision, recall
    - Average quality score
    - Processing time
    - Error rate

    **Требует прав администратора.**
    """
    try:
        flag_manager = FeatureFlagManager(db)
        await flag_manager.initialize()

        canary = NLPCanaryDeployment(flag_manager, db)
        await canary.initialize()

        metrics = await canary.get_cohort_metrics()

        return metrics

    except Exception as e:
        logger.error(f"Error getting canary metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get canary metrics: {str(e)}"
        )


@router.post("/nlp-canary/advance", response_model=CanaryAdvanceResponse)
async def advance_canary_stage(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Продвинуться на следующую стадию rollout.

    Стадии:
    - 0% → 5% (Early testing)
    - 5% → 25% (Expanded testing)
    - 25% → 50% (Half rollout)
    - 50% → 100% (Full rollout)

    **Требует прав администратора.**

    Raises:
        HTTPException: 400 если уже на максимальной стадии
    """
    try:
        flag_manager = FeatureFlagManager(db)
        await flag_manager.initialize()

        canary = NLPCanaryDeployment(flag_manager, db)
        await canary.initialize()

        result = await canary.advance_stage(admin_email=current_user.email)

        return {
            "message": f"Advanced from stage {result['old_stage']} to {result['new_stage']}",
            "old_stage": result['old_stage'],
            "old_percentage": result['old_percentage'],
            "new_stage": result['new_stage'],
            "new_percentage": result['new_percentage'],
            "admin": result['admin'],
            "timestamp": result['timestamp']
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error advancing canary stage: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to advance canary stage: {str(e)}"
        )


@router.post("/nlp-canary/rollback", response_model=CanaryRollbackResponse)
async def rollback_canary(
    stage: int = Body(..., ge=0, le=4, embed=True, description="Target stage (0-4)"),
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Emergency rollback на указанную стадию.

    **⚠️ Используется в экстренных ситуациях при проблемах с новой архитектурой!**

    Stages:
    - 0: 0%   - Полное отключение новой архитектуры
    - 1: 5%   - Откат к early testing
    - 2: 25%  - Откат к expanded testing
    - 3: 50%  - Откат к half rollout
    - 4: 100% - Восстановление full rollout

    **Требует прав администратора.**

    Args:
        stage: Целевая стадия (0-4)

    Raises:
        HTTPException: 400 если недопустимая стадия
    """
    try:
        flag_manager = FeatureFlagManager(db)
        await flag_manager.initialize()

        canary = NLPCanaryDeployment(flag_manager, db)
        await canary.initialize()

        result = await canary.rollback_to_stage(stage, admin_email=current_user.email)

        return {
            "message": f"Rolled back from stage {result['old_stage']} to {result['new_stage']}",
            "old_stage": result['old_stage'],
            "old_percentage": result['old_percentage'],
            "new_stage": result['new_stage'],
            "new_percentage": result['new_percentage'],
            "admin": result['admin'],
            "timestamp": result['timestamp'],
            "is_rollback": result['is_rollback']
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error rolling back canary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to rollback canary: {str(e)}"
        )


@router.get("/nlp-canary/history", response_model=CanaryHistoryResponse)
async def get_canary_history(
    limit: int = 10,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получить историю изменений rollout конфигурации.

    Показывает хронологию всех advance/rollback операций.

    **Требует прав администратора.**

    Args:
        limit: Максимальное количество записей (default: 10)

    Returns:
        История изменений с timestamps и админами
    """
    try:
        flag_manager = FeatureFlagManager(db)
        await flag_manager.initialize()

        canary = NLPCanaryDeployment(flag_manager, db)
        await canary.initialize()

        history = await canary.get_rollout_history(limit=limit)

        return {
            "history": history,
            "total_entries": len(history)
        }

    except Exception as e:
        logger.error(f"Error getting canary history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get canary history: {str(e)}"
        )


@router.post("/nlp-canary/clear-cache")
async def clear_canary_cache(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Очистить кэш cohort assignments.

    После очистки кэша все пользователи будут перераспределены по cohorts
    при следующем обращении к NLP системе.

    **Обычно не требуется.** Кэш автоматически очищается при advance/rollback.

    **Требует прав администратора.**
    """
    try:
        flag_manager = FeatureFlagManager(db)
        await flag_manager.initialize()

        canary = NLPCanaryDeployment(flag_manager, db)
        await canary.initialize()

        cache_size = len(canary.user_cohorts)
        canary.clear_cache()

        return {
            "message": "Canary cache cleared successfully",
            "entries_removed": cache_size,
            "admin": current_user.email
        }

    except Exception as e:
        logger.error(f"Error clearing canary cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear canary cache: {str(e)}"
        )


@router.get("/nlp-canary/recommendations")
async def get_canary_recommendations(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получить рекомендации по canary deployment.

    Анализирует текущие метрики и предлагает:
    - Безопасно ли продвигаться дальше
    - Нужен ли rollback
    - Ключевые метрики для принятия решения

    **Требует прав администратора.**
    """
    try:
        flag_manager = FeatureFlagManager(db)
        await flag_manager.initialize()

        canary = NLPCanaryDeployment(flag_manager, db)
        await canary.initialize()

        status = await canary.get_status()
        metrics = await canary.get_cohort_metrics()

        # Анализируем метрики
        old_f1 = metrics['old_architecture']['f1_score']
        new_f1 = metrics['new_architecture']['f1_score']
        improvement = ((new_f1 - old_f1) / old_f1) * 100

        recommendations = []
        risk_level = "low"

        if status['percentage'] < 100:
            if improvement > 10:
                recommendations.append({
                    "type": "advance",
                    "priority": "high",
                    "message": f"New architecture shows {improvement:.1f}% improvement. Safe to advance."
                })
            elif improvement > 5:
                recommendations.append({
                    "type": "advance",
                    "priority": "medium",
                    "message": f"New architecture shows {improvement:.1f}% improvement. Consider advancing."
                })
                risk_level = "low"
            elif improvement > 0:
                recommendations.append({
                    "type": "monitor",
                    "priority": "medium",
                    "message": f"New architecture shows only {improvement:.1f}% improvement. Monitor closely."
                })
                risk_level = "medium"
            else:
                recommendations.append({
                    "type": "rollback",
                    "priority": "high",
                    "message": f"New architecture shows {improvement:.1f}% regression. Consider rollback!"
                })
                risk_level = "high"

            # Проверка error rate
            old_error = metrics['old_architecture']['error_rate']
            new_error = metrics['new_architecture']['error_rate']
            if new_error > old_error * 1.5:
                recommendations.append({
                    "type": "rollback",
                    "priority": "critical",
                    "message": f"Error rate increased {(new_error/old_error - 1)*100:.1f}%. Immediate rollback recommended!"
                })
                risk_level = "critical"

        else:
            recommendations.append({
                "type": "info",
                "priority": "low",
                "message": "Full rollout (100%) - new architecture in production"
            })

        return {
            "current_stage": status['stage'],
            "current_percentage": status['percentage'],
            "risk_level": risk_level,
            "recommendations": recommendations,
            "metrics_summary": {
                "f1_improvement": f"{improvement:.1f}%",
                "old_f1": old_f1,
                "new_f1": new_f1,
                "old_error_rate": old_error,
                "new_error_rate": new_error
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Error getting canary recommendations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get canary recommendations: {str(e)}"
        )

"""
NLP Canary Deployment Manager для BookReader AI.

Управляет постепенным rollout новой Multi-NLP архитектуры с:
- Gradual rollout (5% → 25% → 50% → 100%)
- Consistent hashing для стабильных cohorts
- Instant rollback capability
- Quality monitoring per cohort
- Integration с feature flags system

Architecture:
    Stage 0: 0%   - Disabled, all users on old architecture
    Stage 1: 5%   - Early testing with small cohort
    Stage 2: 25%  - Expanded testing
    Stage 3: 50%  - Half rollout
    Stage 4: 100% - Full rollout (production default)

Usage:
    >>> canary = NLPCanaryDeployment(feature_flag_manager, db)
    >>> await canary.initialize()
    >>>
    >>> # Check if user should use new architecture
    >>> use_new = await canary.should_use_new_architecture(user_id)
    >>>
    >>> # Advance to next stage
    >>> await canary.advance_stage()
    >>>
    >>> # Emergency rollback
    >>> await canary.rollback_to_stage(0)
"""

import hashlib
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from enum import IntEnum
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.feature_flag import FeatureFlag
from ..services.feature_flag_manager import FeatureFlagManager

logger = logging.getLogger(__name__)


class RolloutStage(IntEnum):
    """
    Стадии постепенного rollout новой NLP архитектуры.

    Каждая стадия соответствует проценту пользователей на новой архитектуре.
    """
    DISABLED = 0      # 0% - все пользователи на старой архитектуре
    EARLY_TESTING = 1 # 5% - ранее тестирование
    EXPANDED = 2      # 25% - расширенное тестирование
    HALF_ROLLOUT = 3  # 50% - половина пользователей
    FULL_ROLLOUT = 4  # 100% - полный rollout (production default)


# Маппинг стадий на проценты
STAGE_PERCENTAGES = {
    RolloutStage.DISABLED: 0,
    RolloutStage.EARLY_TESTING: 5,
    RolloutStage.EXPANDED: 25,
    RolloutStage.HALF_ROLLOUT: 50,
    RolloutStage.FULL_ROLLOUT: 100,
}


class NLPCanaryDeployment:
    """
    Менеджер для canary deployment новой NLP архитектуры.

    Использует consistent hashing для стабильного распределения пользователей
    по cohorts. Раз пользователь попал в cohort новой архитектуры, он там остается
    (no flapping).

    Attributes:
        flag_manager: FeatureFlagManager для проверки глобального флага
        db: AsyncSession для работы с БД
        current_stage: Текущая стадия rollout
        user_cohorts: Кэш cohort assignments для быстрой проверки

    Example:
        >>> async with get_database_session() as db:
        ...     flag_manager = FeatureFlagManager(db)
        ...     canary = NLPCanaryDeployment(flag_manager, db)
        ...     await canary.initialize()
        ...
        ...     # Check user cohort
        ...     if await canary.should_use_new_architecture("user-123"):
        ...         # Use new Multi-NLP architecture
        ...         pass
        ...     else:
        ...         # Use old architecture
        ...         pass
    """

    def __init__(
        self,
        flag_manager: FeatureFlagManager,
        db: AsyncSession
    ):
        """
        Инициализация canary deployment manager.

        Args:
            flag_manager: FeatureFlagManager для проверки флагов
            db: AsyncSession для работы с БД
        """
        self.flag_manager = flag_manager
        self.db = db
        self.current_stage: RolloutStage = RolloutStage.FULL_ROLLOUT  # Default: 100%
        self.user_cohorts: Dict[str, bool] = {}  # In-memory cache
        self._initialized = False

    async def initialize(self) -> None:
        """
        Инициализация canary manager.

        Загружает текущую стадию rollout из БД или создает дефолтную конфигурацию.
        """
        if self._initialized:
            return

        try:
            # Загружаем текущую конфигурацию rollout из БД
            from ..models.nlp_rollout_config import NLPRolloutConfig

            result = await self.db.execute(
                select(NLPRolloutConfig).order_by(NLPRolloutConfig.updated_at.desc()).limit(1)
            )
            config = result.scalar_one_or_none()

            if config:
                self.current_stage = RolloutStage(config.current_stage)
                logger.info(
                    f"NLP Canary initialized: Stage {self.current_stage} "
                    f"({STAGE_PERCENTAGES[self.current_stage]}% rollout)"
                )
            else:
                # Создаем дефолтную конфигурацию (100% - уже в продакшене)
                config = NLPRolloutConfig(
                    current_stage=RolloutStage.FULL_ROLLOUT,
                    rollout_percentage=100,
                    notes="Initial state: new architecture already at 100%"
                )
                self.db.add(config)
                await self.db.commit()
                await self.db.refresh(config)

                self.current_stage = RolloutStage.FULL_ROLLOUT
                logger.info("NLP Canary initialized: Created default config (100% rollout)")

            self._initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize NLP canary: {e}")
            await self.db.rollback()
            # Fallback to full rollout on error
            self.current_stage = RolloutStage.FULL_ROLLOUT
            self._initialized = True

    async def should_use_new_architecture(
        self,
        user_id: str,
        force_check: bool = False
    ) -> bool:
        """
        Определить должен ли пользователь использовать новую NLP архитектуру.

        Использует consistent hashing для стабильного распределения:
        - hash(user_id) % 100 < rollout_percentage
        - Один и тот же user_id всегда попадает в один cohort
        - No flapping between architectures

        Args:
            user_id: Идентификатор пользователя
            force_check: Игнорировать кэш и проверить заново

        Returns:
            True если пользователь должен использовать новую архитектуру
            False если старую

        Example:
            >>> use_new = await canary.should_use_new_architecture("user-123")
            >>> if use_new:
            ...     result = await new_nlp_manager.extract_descriptions(text)
            ... else:
            ...     result = await old_nlp_processor.extract(text)
        """
        # 1. Проверяем глобальный feature flag
        is_enabled = await self.flag_manager.is_enabled(
            "USE_NEW_NLP_ARCHITECTURE",
            default=True  # Default to True (уже в продакшене)
        )

        if not is_enabled:
            # Глобально выключено - все на старой архитектуре
            return False

        # 2. Проверяем кэш (если не force_check)
        if not force_check and user_id in self.user_cohorts:
            return self.user_cohorts[user_id]

        # 3. Получаем текущий процент rollout
        rollout_percentage = await self._get_rollout_percentage()

        # 4. Consistent hashing: hash(user_id) % 100 < rollout_percentage
        user_hash = self._hash_user_id(user_id)
        use_new_architecture = user_hash < rollout_percentage

        # 5. Кэшируем результат
        self.user_cohorts[user_id] = use_new_architecture

        logger.debug(
            f"User {user_id[:8]}... cohort: "
            f"{'NEW' if use_new_architecture else 'OLD'} architecture "
            f"(hash={user_hash}, rollout={rollout_percentage}%)"
        )

        return use_new_architecture

    def _hash_user_id(self, user_id: str) -> int:
        """
        Хэшировать user_id в число 0-99 для consistent distribution.

        Использует SHA256 для равномерного распределения.

        Args:
            user_id: Идентификатор пользователя

        Returns:
            Число от 0 до 99
        """
        # SHA256 hash для равномерного распределения
        hash_bytes = hashlib.sha256(user_id.encode()).digest()
        # Берем первые 4 байта и конвертируем в int
        hash_int = int.from_bytes(hash_bytes[:4], byteorder='big')
        # Модуль 100 для диапазона 0-99
        return hash_int % 100

    async def _get_rollout_percentage(self) -> int:
        """
        Получить текущий процент rollout из конфигурации.

        Returns:
            Процент пользователей на новой архитектуре (0, 5, 25, 50, или 100)
        """
        if not self._initialized:
            await self.initialize()

        return STAGE_PERCENTAGES[self.current_stage]

    async def get_current_stage(self) -> RolloutStage:
        """
        Получить текущую стадию rollout.

        Returns:
            Текущая стадия (RolloutStage enum)
        """
        if not self._initialized:
            await self.initialize()

        return self.current_stage

    async def advance_stage(self, admin_email: Optional[str] = None) -> Dict[str, Any]:
        """
        Продвинуться на следующую стадию rollout.

        Stages: 0% → 5% → 25% → 50% → 100%

        Args:
            admin_email: Email администратора выполняющего операцию

        Returns:
            Словарь с информацией о переходе

        Raises:
            ValueError: Если уже на максимальной стадии

        Example:
            >>> result = await canary.advance_stage(admin_email="admin@example.com")
            >>> print(f"Advanced from {result['old_stage']} to {result['new_stage']}")
        """
        old_stage = await self.get_current_stage()

        # Проверяем что не на максимальной стадии
        if old_stage == RolloutStage.FULL_ROLLOUT:
            raise ValueError(
                "Already at full rollout (100%). Cannot advance further."
            )

        # Переходим на следующую стадию
        new_stage = RolloutStage(old_stage + 1)
        new_percentage = STAGE_PERCENTAGES[new_stage]

        # Обновляем конфигурацию в БД
        from ..models.nlp_rollout_config import NLPRolloutConfig

        config = NLPRolloutConfig(
            current_stage=new_stage,
            rollout_percentage=new_percentage,
            updated_by=admin_email,
            notes=f"Advanced from stage {old_stage} ({STAGE_PERCENTAGES[old_stage]}%) "
                  f"to stage {new_stage} ({new_percentage}%)"
        )

        self.db.add(config)
        await self.db.commit()
        await self.db.refresh(config)

        # Обновляем in-memory state
        self.current_stage = new_stage

        # Очищаем кэш cohorts (пересчитаются при следующем запросе)
        self.user_cohorts.clear()

        logger.info(
            f"NLP Canary advanced: Stage {old_stage} ({STAGE_PERCENTAGES[old_stage]}%) → "
            f"Stage {new_stage} ({new_percentage}%) by {admin_email or 'unknown'}"
        )

        return {
            "old_stage": old_stage,
            "old_percentage": STAGE_PERCENTAGES[old_stage],
            "new_stage": new_stage,
            "new_percentage": new_percentage,
            "admin": admin_email,
            "timestamp": config.updated_at.isoformat() if config.updated_at else None
        }

    async def rollback_to_stage(
        self,
        target_stage: int,
        admin_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Откатиться на указанную стадию rollout.

        Emergency rollback для проблемных ситуаций.

        Args:
            target_stage: Целевая стадия (0-4)
            admin_email: Email администратора выполняющего rollback

        Returns:
            Словарь с информацией о rollback

        Example:
            >>> # Emergency rollback to 0% (disable new architecture)
            >>> result = await canary.rollback_to_stage(0, "admin@example.com")
            >>> print(f"Rolled back from {result['old_stage']} to {result['new_stage']}")
        """
        old_stage = await self.get_current_stage()

        # Валидация целевой стадии
        if target_stage < 0 or target_stage > 4:
            raise ValueError(f"Invalid target stage: {target_stage}. Must be 0-4.")

        new_stage = RolloutStage(target_stage)
        new_percentage = STAGE_PERCENTAGES[new_stage]

        # Предупреждение если rollback на бОльший процент
        if new_stage > old_stage:
            logger.warning(
                f"Rollback to higher stage requested: {old_stage} → {new_stage}. "
                f"Consider using advance_stage() instead."
            )

        # Обновляем конфигурацию в БД
        from ..models.nlp_rollout_config import NLPRolloutConfig

        config = NLPRolloutConfig(
            current_stage=new_stage,
            rollout_percentage=new_percentage,
            updated_by=admin_email,
            notes=f"ROLLBACK from stage {old_stage} ({STAGE_PERCENTAGES[old_stage]}%) "
                  f"to stage {new_stage} ({new_percentage}%)"
        )

        self.db.add(config)
        await self.db.commit()
        await self.db.refresh(config)

        # Обновляем in-memory state
        self.current_stage = new_stage

        # Очищаем кэш cohorts
        self.user_cohorts.clear()

        logger.warning(
            f"NLP Canary ROLLBACK: Stage {old_stage} ({STAGE_PERCENTAGES[old_stage]}%) → "
            f"Stage {new_stage} ({new_percentage}%) by {admin_email or 'unknown'}"
        )

        return {
            "old_stage": old_stage,
            "old_percentage": STAGE_PERCENTAGES[old_stage],
            "new_stage": new_stage,
            "new_percentage": new_percentage,
            "admin": admin_email,
            "timestamp": config.updated_at.isoformat() if config.updated_at else None,
            "is_rollback": True
        }

    async def get_status(self) -> Dict[str, Any]:
        """
        Получить текущий статус canary deployment.

        Returns:
            Словарь с полной информацией о текущем состоянии

        Example:
            >>> status = await canary.get_status()
            >>> print(f"Current rollout: {status['percentage']}%")
            >>> print(f"Estimated users on new: {status['estimated_users_new']}")
        """
        current_stage = await self.get_current_stage()
        percentage = STAGE_PERCENTAGES[current_stage]

        # Получаем последнюю конфигурацию из БД
        from ..models.nlp_rollout_config import NLPRolloutConfig

        result = await self.db.execute(
            select(NLPRolloutConfig).order_by(NLPRolloutConfig.updated_at.desc()).limit(1)
        )
        config = result.scalar_one_or_none()

        # Подсчитываем общее количество пользователей (примерно)
        from ..models.user import User
        total_users_result = await self.db.execute(select(func.count(User.id)))
        total_users = total_users_result.scalar() or 0

        estimated_users_new = int(total_users * (percentage / 100))
        estimated_users_old = total_users - estimated_users_new

        return {
            "stage": current_stage,
            "stage_name": current_stage.name,
            "percentage": percentage,
            "total_users": total_users,
            "estimated_users_new_arch": estimated_users_new,
            "estimated_users_old_arch": estimated_users_old,
            "cache_size": len(self.user_cohorts),
            "last_updated": config.updated_at.isoformat() if config and config.updated_at else None,
            "updated_by": config.updated_by if config else None,
            "notes": config.notes if config else None,
            "feature_flag_enabled": await self.flag_manager.is_enabled(
                "USE_NEW_NLP_ARCHITECTURE", default=True
            )
        }

    async def get_cohort_metrics(self) -> Dict[str, Dict[str, Any]]:
        """
        Получить метрики качества по cohorts (новая vs старая архитектура).

        TODO: Интеграция с реальной системой мониторинга качества NLP.
        Сейчас возвращает заглушку с примерными данными.

        Returns:
            Словарь с метриками по каждой архитектуре

        Example:
            >>> metrics = await canary.get_cohort_metrics()
            >>> print(f"New arch F1: {metrics['new_architecture']['f1_score']:.2f}")
            >>> print(f"Old arch F1: {metrics['old_architecture']['f1_score']:.2f}")
        """
        # TODO: Интеграция с реальной системой мониторинга
        # Сейчас возвращаем примерные метрики

        return {
            "old_architecture": {
                "name": "Legacy NLP Processor",
                "f1_score": 0.82,
                "precision": 0.80,
                "recall": 0.84,
                "avg_quality_score": 6.5,
                "avg_processing_time_ms": 850,
                "total_processed": 0,  # TODO: подсчитать из статистики
                "error_rate": 0.02
            },
            "new_architecture": {
                "name": "Multi-NLP Strategy Pattern (v2.0)",
                "f1_score": 0.91,
                "precision": 0.89,
                "recall": 0.93,
                "avg_quality_score": 8.5,
                "avg_processing_time_ms": 1100,
                "total_processed": 0,  # TODO: подсчитать из статистики
                "error_rate": 0.01
            }
        }

    async def get_rollout_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Получить историю изменений rollout конфигурации.

        Args:
            limit: Максимальное количество записей

        Returns:
            Список изменений rollout конфигурации
        """
        from ..models.nlp_rollout_config import NLPRolloutConfig

        result = await self.db.execute(
            select(NLPRolloutConfig)
            .order_by(NLPRolloutConfig.updated_at.desc())
            .limit(limit)
        )

        configs = result.scalars().all()

        return [
            {
                "id": config.id,
                "stage": config.current_stage,
                "percentage": config.rollout_percentage,
                "updated_at": config.updated_at.isoformat() if config.updated_at else None,
                "updated_by": config.updated_by,
                "notes": config.notes
            }
            for config in configs
        ]

    def clear_cache(self) -> None:
        """Очистить кэш cohort assignments."""
        size_before = len(self.user_cohorts)
        self.user_cohorts.clear()
        logger.info(f"Cleared NLP canary cache ({size_before} entries)")


# Helper functions
def stage_to_percentage(stage: int) -> int:
    """Конвертировать stage number в процент."""
    return STAGE_PERCENTAGES.get(RolloutStage(stage), 0)


def percentage_to_stage(percentage: int) -> RolloutStage:
    """Конвертировать процент в ближайшую стадию."""
    for stage, pct in STAGE_PERCENTAGES.items():
        if pct == percentage:
            return stage

    # Если точного совпадения нет, находим ближайшую меньшую стадию
    for stage in reversed(list(RolloutStage)):
        if STAGE_PERCENTAGES[stage] <= percentage:
            return stage

    return RolloutStage.DISABLED

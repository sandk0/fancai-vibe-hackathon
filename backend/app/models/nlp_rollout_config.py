"""
Модель для NLP Rollout Configuration в BookReader AI.

Хранит историю изменений rollout конфигурации для canary deployment
новой Multi-NLP архитектуры.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func

from ..core.database import Base


class NLPRolloutConfig(Base):
    """
    Модель для хранения конфигурации canary rollout NLP архитектуры.

    Каждая запись представляет собой изменение rollout конфигурации:
    - Продвижение на следующую стадию (advance)
    - Откат на предыдущую стадию (rollback)
    - Изменение процента пользователей

    Attributes:
        id: Уникальный идентификатор записи
        current_stage: Текущая стадия rollout (0-4)
        rollout_percentage: Процент пользователей на новой архитектуре (0-100)
        updated_at: Время изменения конфигурации
        updated_by: Email администратора выполнившего изменение
        notes: Заметки об изменении

    Stages:
        0: 0%   - Disabled
        1: 5%   - Early testing
        2: 25%  - Expanded testing
        3: 50%  - Half rollout
        4: 100% - Full rollout

    Example:
        >>> config = NLPRolloutConfig(
        ...     current_stage=1,
        ...     rollout_percentage=5,
        ...     updated_by="admin@example.com",
        ...     notes="Advanced to 5% for early testing"
        ... )
    """

    __tablename__ = "nlp_rollout_config"

    # Primary key
    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier"
    )

    # Rollout configuration
    current_stage = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Current rollout stage (0-4)"
    )

    rollout_percentage = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Percentage of users on new architecture (0-100)"
    )

    # Audit fields
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="Timestamp of configuration change"
    )

    updated_by = Column(
        String(255),
        nullable=True,
        comment="Email of admin who made the change"
    )

    notes = Column(
        Text,
        nullable=True,
        comment="Notes about the configuration change"
    )

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<NLPRolloutConfig(id={self.id}, stage={self.current_stage}, "
            f"percentage={self.rollout_percentage}%, "
            f"updated_by='{self.updated_by}')>"
        )

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "current_stage": self.current_stage,
            "rollout_percentage": self.rollout_percentage,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updated_by": self.updated_by,
            "notes": self.notes,
        }

    @property
    def stage_name(self) -> str:
        """Get human-readable stage name."""
        stage_names = {
            0: "DISABLED",
            1: "EARLY_TESTING",
            2: "EXPANDED",
            3: "HALF_ROLLOUT",
            4: "FULL_ROLLOUT",
        }
        return stage_names.get(self.current_stage, "UNKNOWN")

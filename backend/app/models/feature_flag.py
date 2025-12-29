"""
Модель для feature flags системы fancai.

Feature flags позволяют включать/выключать функциональность без перезапуска приложения.
Используется для безопасного rollout новых функций и A/B тестирования.
"""

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Boolean,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from ..core.database import Base


class FeatureFlagCategory(enum.Enum):
    """Категории feature flags."""

    NLP = "nlp"  # NLP-related features
    PARSER = "parser"  # Book parsing features
    IMAGES = "images"  # Image generation features
    SYSTEM = "system"  # System-level features
    EXPERIMENTAL = "experimental"  # Experimental features


class FeatureFlag(Base):
    """
    Модель feature flag для управления функциональностью.

    Feature flags используются для:
    - Безопасного rollout новых функций
    - A/B тестирования
    - Временного отключения проблемных компонентов
    - Постепенной миграции между архитектурами

    Attributes:
        id: Уникальный идентификатор флага
        name: Название флага (уникальное, например "USE_NEW_NLP_ARCHITECTURE")
        enabled: Включен ли флаг (True/False)
        category: Категория флага (NLP, PARSER, IMAGES, SYSTEM, EXPERIMENTAL)
        description: Человекочитаемое описание назначения флага
        default_value: Значение по умолчанию (для fallback)
        metadata: JSON метаданные (для дополнительной конфигурации)
        created_at: Дата создания флага
        updated_at: Дата последнего изменения

    Example:
        >>> flag = FeatureFlag(
        ...     name="USE_NEW_NLP_ARCHITECTURE",
        ...     enabled=True,
        ...     category="nlp",
        ...     description="Enable Strategy Pattern NLP architecture"
        ... )
    """

    __tablename__ = "feature_flags"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Core fields
    name = Column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique flag name (e.g., 'USE_NEW_NLP_ARCHITECTURE')",
    )

    enabled = Column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
        index=True,
        comment="Whether the flag is enabled",
    )

    category = Column(
        String(50),
        default=FeatureFlagCategory.SYSTEM.value,
        nullable=False,
        index=True,
        comment="Flag category (nlp, parser, images, system, experimental)",
    )

    description = Column(
        Text,
        nullable=True,
        comment="Human-readable description of the flag's purpose",
    )

    default_value = Column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
        comment="Default value (fallback if flag not found)",
    )

    # Временные метки
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<FeatureFlag(name='{self.name}', enabled={self.enabled}, "
            f"category='{self.category}')>"
        )

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": str(self.id),
            "name": self.name,
            "enabled": self.enabled,
            "category": self.category,
            "description": self.description,
            "default_value": self.default_value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# Предопределенные feature flags для системы
DEFAULT_FEATURE_FLAGS = [
    {
        "name": "USE_NEW_NLP_ARCHITECTURE",
        "enabled": True,  # Already in production
        "category": FeatureFlagCategory.NLP.value,
        "description": "Enable Strategy Pattern Multi-NLP architecture (v2.0)",
        "default_value": True,
    },
    {
        "name": "USE_ADVANCED_PARSER",
        "enabled": False,  # Not integrated yet
        "category": FeatureFlagCategory.PARSER.value,
        "description": "Enable Advanced Parser with dependency parsing",
        "default_value": False,
    },
    {
        "name": "USE_LLM_ENRICHMENT",
        "enabled": False,  # Needs API key
        "category": FeatureFlagCategory.NLP.value,
        "description": "Enable LangExtract LLM-based semantic enrichment",
        "default_value": False,
    },
    {
        "name": "ENABLE_ENSEMBLE_VOTING",
        "enabled": True,
        "category": FeatureFlagCategory.NLP.value,
        "description": "Enable ensemble voting in NLP processing",
        "default_value": True,
    },
    {
        "name": "ENABLE_PARALLEL_PROCESSING",
        "enabled": True,
        "category": FeatureFlagCategory.NLP.value,
        "description": "Enable parallel NLP processor execution",
        "default_value": True,
    },
    {
        "name": "ENABLE_IMAGE_CACHING",
        "enabled": True,
        "category": FeatureFlagCategory.IMAGES.value,
        "description": "Enable image generation caching",
        "default_value": True,
    },
]

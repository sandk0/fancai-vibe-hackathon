"""
Модель пользователя для BookReader AI.

Содержит модели User, Subscription и связанные таблицы.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func
import uuid
import enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .book import Book

from ..core.database import Base


class SubscriptionPlan(enum.Enum):
    """Типы подписки."""

    FREE = "free"
    PREMIUM = "premium"
    ULTIMATE = "ultimate"


class SubscriptionStatus(enum.Enum):
    """Статусы подписки."""

    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"


class User(Base):
    """
    Модель пользователя системы.

    Attributes:
        id: Уникальный идентификатор пользователя
        email: Email адрес (уникальный)
        password_hash: Хешированный пароль
        full_name: Полное имя пользователя
        is_active: Активен ли аккаунт
        is_verified: Подтвержден ли email
        created_at: Дата создания аккаунта
        updated_at: Дата последнего обновления
    """

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)

    # Статус аккаунта
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)

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
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Отношения
    books = relationship("Book", back_populates="user", cascade="all, delete-orphan")
    reading_progress = relationship(
        "ReadingProgress", back_populates="user", cascade="all, delete-orphan"
    )
    subscription = relationship(
        "Subscription",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    generated_images = relationship(
        "GeneratedImage", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"


class Subscription(Base):
    """
    Модель подписки пользователя.

    Attributes:
        id: Уникальный идентификатор подписки
        user_id: ID пользователя (внешний ключ)
        plan: Тип подписки (FREE, PREMIUM, ULTIMATE)
        status: Статус подписки (ACTIVE, EXPIRED, CANCELLED)
        start_date: Дата начала подписки
        end_date: Дата окончания подписки
        auto_renewal: Автоматическое продление
    """

    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    plan: Mapped[SubscriptionPlan] = Column(
        SQLEnum(SubscriptionPlan), default=SubscriptionPlan.FREE, nullable=False
    )
    status: Mapped[SubscriptionStatus] = Column(
        SQLEnum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False
    )

    # Даты подписки
    start_date = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    end_date = Column(DateTime(timezone=True), nullable=True)

    # Настройки
    auto_renewal = Column(Boolean, default=False, nullable=False)

    # Использование лимитов
    books_uploaded = Column(Integer, default=0, nullable=False)
    images_generated_month = Column(Integer, default=0, nullable=False)
    last_reset_date = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
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

    # Отношения
    user = relationship("User", back_populates="subscription")

    def __repr__(self):
        return f"<Subscription(id={self.id}, user_id={self.user_id}, plan={self.plan.value})>"

    def is_within_books_limit(self, limit: int) -> bool:
        """
        Проверяет, не превышен ли лимит загруженных книг.

        Args:
            limit: Максимальное количество книг для плана

        Returns:
            True если лимит не превышен
        """
        return self.books_uploaded < limit

    def is_within_generation_limit(self, limit: int) -> bool:
        """
        Проверяет, не превышен ли лимит генераций изображений за месяц.

        Args:
            limit: Максимальное количество генераций для плана

        Returns:
            True если лимит не превышен
        """
        return self.images_generated_month < limit

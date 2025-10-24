"""
Конфигурация базы данных для BookReader AI.

Настройка SQLAlchemy, создание асинхронных сессий и базовые модели.
"""

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from typing import AsyncGenerator
import logging

from .config import settings

# Настройка логирования SQL запросов
logging.basicConfig()
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

# Создание асинхронного движка базы данных
# Connection pool optimization for high concurrency:
# - pool_size: 10 connections (baseline for normal load)
# - max_overflow: 20 connections (handle traffic bursts up to 30 total)
# - pool_recycle: 3600s (1 hour) - recycle connections to prevent stale connections
# - pool_pre_ping: True - verify connection health before using
# Total capacity: 30 concurrent database operations (10 + 20 overflow)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # Вывод SQL запросов в debug режиме
    pool_size=10,  # Base connection pool size (increased from default 5)
    max_overflow=20,  # Allow up to 20 additional connections for bursts
    pool_pre_ping=True,  # Проверка соединений перед использованием
    pool_recycle=3600,  # Пересоздание соединений каждый час (increased from 5 min)
    pool_timeout=30,  # Timeout waiting for connection from pool (30 seconds)
    pool_use_lifo=True,  # Use LIFO for better connection reuse
)

# Создание фабрики асинхронных сессий
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Базовый класс для моделей
Base = declarative_base()

# Метаданные для миграций
metadata = MetaData()


async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency для получения асинхронной сессии базы данных.

    Yields:
        AsyncSession: Асинхронная сессия SQLAlchemy

    Example:
        @app.get("/users/")
        async def get_users(db: AsyncSession = Depends(get_database_session)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Асинхронная инициализация базы данных.

    Создает все таблицы, определенные в моделях.
    """
    # Импорт всех моделей для создания таблиц

    # Создание таблиц
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("✅ Database initialized successfully")

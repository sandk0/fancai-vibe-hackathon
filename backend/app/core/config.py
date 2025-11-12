"""
Конфигурация приложения BookReader AI.

Настройки базы данных, Redis, AI сервисов и других компонентов.
"""

from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Optional


class Settings(BaseSettings):
    """Настройки приложения."""

    # Основные настройки приложения
    APP_NAME: str = "BookReader AI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = (
        True  # Development mode по умолчанию (установите DEBUG=false в production!)
    )
    SECRET_KEY: str = "dev-secret-key-change-in-production"

    # База данных
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres123@postgres:5432/bookreader_dev"
    )

    # Redis
    REDIS_URL: str = "redis://:redis123@redis:6379"
    REDIS_CACHE_ENABLED: bool = True  # Enable/disable Redis caching
    REDIS_CACHE_DEFAULT_TTL: int = 3600  # Default TTL in seconds (1 hour)

    # Безопасность
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720  # 12 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Файловые загрузки
    MAX_UPLOAD_SIZE: int = 52428800  # 50MB
    UPLOAD_DIRECTORY: str = "./uploads"
    ALLOWED_EXTENSIONS: list = [".epub", ".fb2"]

    # AI сервисы
    POLLINATIONS_ENABLED: bool = True
    POLLINATIONS_BASE_URL: str = "https://image.pollinations.ai"
    OPENAI_API_KEY: Optional[str] = None
    MIDJOURNEY_API_KEY: Optional[str] = None

    # Платежные системы
    YOOKASSA_SHOP_ID: Optional[str] = None
    YOOKASSA_SECRET_KEY: Optional[str] = None
    CLOUDPAYMENTS_PUBLIC_ID: Optional[str] = None

    # NLP настройки
    SPACY_MODEL: str = "ru_core_news_lg"
    NLTK_DATA_PATH: str = "./nltk_data"

    # Лимиты подписок
    FREE_BOOKS_LIMIT: int = 3
    FREE_GENERATIONS_LIMIT: int = 50
    PREMIUM_BOOKS_LIMIT: int = 50
    PREMIUM_GENERATIONS_LIMIT: int = 500

    # Логирование
    LOG_LEVEL: str = "INFO"

    # CORS - загружается из .env (docker-compose передает полный список)
    CORS_ORIGINS: str = "http://localhost:3000"  # Minimal fallback, should be overridden by .env

    @model_validator(mode="after")
    def validate_production_settings(self):
        """
        Валидация критических настроек для production режима.

        В production (DEBUG=False) требуются безопасные значения для:
        - SECRET_KEY (не может быть дефолтным)
        - DATABASE_URL (не может содержать тестовые пароли)
        - REDIS_URL (не может содержать тестовые пароли)
        """
        if not self.DEBUG:
            # Проверка SECRET_KEY
            if self.SECRET_KEY == "dev-secret-key-change-in-production":
                raise ValueError(
                    "❌ SECURITY ERROR: SECRET_KEY must be set via environment variable in production mode. "
                    "Default development secret key is not allowed in production."
                )

            # Проверка DATABASE_URL
            if (
                "postgres123" in self.DATABASE_URL
                or "bookreader_dev" in self.DATABASE_URL
            ):
                raise ValueError(
                    "❌ SECURITY ERROR: DATABASE_URL contains default development credentials. "
                    "Production database must use secure credentials set via environment variable."
                )

            # Проверка REDIS_URL
            if "redis123" in self.REDIS_URL:
                raise ValueError(
                    "❌ SECURITY ERROR: REDIS_URL contains default development password. "
                    "Production Redis must use secure credentials set via environment variable."
                )

        return self

    @property
    def cors_origins_list(self) -> list:
        """Возвращает список CORS origins из строки."""
        if isinstance(self.CORS_ORIGINS, str):
            return [
                origin.strip()
                for origin in self.CORS_ORIGINS.split(",")
                if origin.strip()
            ]
        return self.CORS_ORIGINS

    class Config:
        """Настройка загрузки переменных окружения."""

        env_file = ".env"
        case_sensitive = True


# Глобальный экземпляр настроек
settings = Settings()

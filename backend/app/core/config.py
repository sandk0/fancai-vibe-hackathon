"""
Конфигурация приложения BookReader AI.

Настройки базы данных, Redis, AI сервисов и других компонентов.
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Настройки приложения."""
    
    # Основные настройки приложения
    APP_NAME: str = "BookReader AI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    
    # База данных
    DATABASE_URL: str = "postgresql+asyncpg://bookreader_user:bookreader_pass@postgres:5432/bookreader"
    
    # Redis
    REDIS_URL: str = "redis://:redis_password@redis:6379"
    
    # Безопасность
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
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
    
    # CORS  
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    @property
    def cors_origins_list(self) -> list:
        """Возвращает список CORS origins из строки."""
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
        return self.CORS_ORIGINS
    
    class Config:
        """Настройка загрузки переменных окружения."""
        env_file = ".env"
        case_sensitive = True


# Глобальный экземпляр настроек
settings = Settings()
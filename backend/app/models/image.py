"""
Модель сгенерированных изображений для BookReader AI.

Содержит информацию о изображениях, созданных AI-сервисами.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from ..core.database import Base


class ImageService(enum.Enum):
    """AI сервисы для генерации изображений."""
    POLLINATIONS = "pollinations"      # pollinations.ai (основной)
    OPENAI_DALLE = "openai_dalle"     # OpenAI DALL-E 3
    MIDJOURNEY = "midjourney"         # Midjourney API
    STABLE_DIFFUSION = "stable_diffusion"  # Stable Diffusion


class ImageStatus(enum.Enum):
    """Статусы генерации изображений."""
    PENDING = "pending"        # В очереди на генерацию
    GENERATING = "generating"  # Генерируется в данный момент
    COMPLETED = "completed"    # Успешно сгенерировано
    FAILED = "failed"         # Ошибка генерации
    MODERATED = "moderated"   # Отклонено модерацией


class GeneratedImage(Base):
    """
    Модель сгенерированного изображения.
    
    Attributes:
        id: Уникальный идентификатор изображения
        description_id: ID описания (внешний ключ)
        service_used: AI сервис, использованный для генерации
        status: Статус генерации
        image_url: URL сгенерированного изображения
        local_path: Локальный путь к файлу изображения
        prompt_used: Промпт, отправленный в AI сервис
        generation_parameters: Параметры генерации (размер, стиль, etc.)
        generation_time_seconds: Время генерации в секундах
        file_size: Размер файла изображения в байтах
        image_width: Ширина изображения в пикселях
        image_height: Высота изображения в пикселях
        quality_score: Оценка качества изображения (если есть)
        is_moderated: Прошло ли модерацию
        moderation_result: Результат модерации
    """
    
    __tablename__ = "generated_images"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    description_id = Column(UUID(as_uuid=True), ForeignKey("descriptions.id"), nullable=False, index=True)
    
    # Информация о генерации
    service_used = Column(String(50), nullable=False, index=True)  # pollinations, openai_dalle, etc.
    status = Column(String(20), default=ImageStatus.PENDING.value, nullable=False, index=True)
    
    # Результат генерации
    image_url = Column(String(2000), nullable=True)  # URL от сервиса
    local_path = Column(String(1000), nullable=True)  # Локальный путь
    prompt_used = Column(Text, nullable=False)  # Использованный промпт
    
    # Параметры генерации
    generation_parameters = Column(JSON, nullable=True)  # {"width": 512, "height": 512, "style": "fantasy"}
    generation_time_seconds = Column(Float, nullable=True)
    
    # Информация о файле
    file_size = Column(Integer, nullable=True)  # размер в байтах
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    file_format = Column(String(10), nullable=True)  # jpg, png, webp
    
    # Качество и модерация
    quality_score = Column(Float, nullable=True)  # 0.0-1.0
    is_moderated = Column(Boolean, default=False, nullable=False)
    moderation_result = Column(JSON, nullable=True)  # Результат проверки на NSFW, etc.
    moderation_notes = Column(Text, nullable=True)
    
    # Статистика использования
    view_count = Column(Integer, default=0, nullable=False)
    download_count = Column(Integer, default=0, nullable=False)
    
    # Ошибки
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Отношения
    description = relationship("Description", back_populates="generated_images")
    
    def __repr__(self):
        return f"<GeneratedImage(id={self.id}, service={self.service_used}, status={self.status})>"
    
    def is_ready_for_display(self) -> bool:
        """
        Проверяет, готово ли изображение для отображения пользователю.
        
        Returns:
            True если изображение успешно сгенерировано и прошло модерацию
        """
        return (
            self.status == ImageStatus.COMPLETED.value and
            self.is_moderated and
            (self.image_url is not None or self.local_path is not None)
        )
    
    def get_display_url(self, base_url: str = "") -> str:
        """
        Получает URL для отображения изображения.
        
        Args:
            base_url: Базовый URL сервера для локальных файлов
            
        Returns:
            URL для отображения изображения
        """
        if self.image_url:
            return self.image_url
        elif self.local_path and base_url:
            return f"{base_url.rstrip('/')}/images/{self.local_path}"
        else:
            return ""
    
    def get_generation_info(self) -> dict:
        """
        Получает информацию о генерации для отображения пользователю.
        
        Returns:
            Словарь с информацией о генерации
        """
        return {
            "service": self.service_used,
            "status": self.status,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
            "generation_time": self.generation_time_seconds,
            "dimensions": f"{self.image_width}x{self.image_height}" if self.image_width and self.image_height else None,
            "file_size_kb": round(self.file_size / 1024) if self.file_size else None,
            "quality_score": self.quality_score
        }
"""
Модель сгенерированного изображения в BookReader AI.

Содержит информацию об изображениях, сгенерированных AI
по описаниям из книг, включая метаданные генерации.
"""

from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from .base import Base


class GeneratedImage(Base):
    """
    Модель сгенерированного AI изображения.
    
    Хранит информацию об изображениях, созданных на основе
    описаний из книг с использованием AI генерации.
    """
    
    __tablename__ = "generated_images"
    
    # Основные поля
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description_id = Column(UUID(as_uuid=True), ForeignKey("descriptions.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # URL и путь к изображению
    image_url = Column(String(500), nullable=True)  # URL для доступа к изображению
    local_path = Column(String(500), nullable=True)  # Локальный путь к файлу
    
    # Метаданные генерации
    generation_prompt = Column(Text, nullable=True)  # Промпт, используемый для генерации
    negative_prompt = Column(Text, nullable=True)  # Негативный промпт
    generation_model = Column(String(100), default="flux")  # Модель ИИ для генерации
    generation_time_seconds = Column(Float, nullable=True)  # Время генерации в секундах
    
    # Параметры изображения
    width = Column(Integer, default=1024)
    height = Column(Integer, default=768)
    file_size_bytes = Column(Integer, nullable=True)
    file_format = Column(String(10), default="PNG")
    
    # Временные метки
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи
    description = relationship("Description", back_populates="generated_images")
    user = relationship("User", back_populates="generated_images")
    
    def __repr__(self) -> str:
        return f"<GeneratedImage(id={self.id}, description_id={self.description_id}, created_at={self.created_at})>"
    
    def to_dict(self) -> dict:
        """
        Преобразует объект в словарь для API ответов.
        
        Returns:
            Словарь с данными изображения
        """
        return {
            "id": str(self.id),
            "description_id": str(self.description_id),
            "user_id": str(self.user_id),
            "image_url": self.image_url,
            "local_path": self.local_path,
            "generation_prompt": self.generation_prompt,
            "generation_model": self.generation_model,
            "generation_time_seconds": self.generation_time_seconds,
            "width": self.width,
            "height": self.height,
            "file_size_bytes": self.file_size_bytes,
            "file_format": self.file_format,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @property
    def is_available(self) -> bool:
        """
        Проверяет доступность изображения.
        
        Returns:
            True если изображение доступно
        """
        return bool(self.image_url or self.local_path)
    
    @property
    def generation_status(self) -> str:
        """
        Возвращает статус генерации изображения.
        
        Returns:
            Строка со статусом
        """
        if self.is_available:
            return "completed"
        elif self.created_at:
            return "failed"
        else:
            return "pending"
"""
Модели для книг и прогресса чтения в BookReader AI.

Содержит модели Book, ReadingProgress и связанные функции.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from ..core.database import Base


class BookFormat(enum.Enum):
    """Форматы поддерживаемых книг."""
    EPUB = "epub"
    FB2 = "fb2"


class BookGenre(enum.Enum):
    """Жанры книг для настройки стилей генерации изображений."""
    FANTASY = "fantasy"
    DETECTIVE = "detective"
    SCIFI = "science_fiction"
    HISTORICAL = "historical"
    ROMANCE = "romance"
    THRILLER = "thriller"
    HORROR = "horror"
    CLASSIC = "classic"
    OTHER = "other"


class Book(Base):
    """
    Модель книги в системе.
    
    Attributes:
        id: Уникальный идентификатор книги
        user_id: ID владельца книги
        title: Название книги
        author: Автор книги
        genre: Жанр (влияет на стиль генерации изображений)
        language: Язык книги
        file_path: Путь к файлу книги на сервере
        file_format: Формат файла (EPUB, FB2)
        file_size: Размер файла в байтах
        cover_image: Путь к обложке книги
        description: Описание/аннотация книги
        metadata: Дополнительные метаданные из файла
        total_pages: Общее количество страниц (расчетное)
        estimated_reading_time: Расчетное время чтения в минутах
        is_parsed: Флаг завершения парсинга содержимого
        parsing_progress: Прогресс парсинга (0-100)
    """
    
    __tablename__ = "books"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Основная информация
    title = Column(String(500), nullable=False, index=True)
    author = Column(String(255), nullable=True, index=True)
    genre = Column(String(50), default=BookGenre.OTHER.value, nullable=False)
    language = Column(String(10), default="ru", nullable=False)
    
    # Файл
    file_path = Column(String(1000), nullable=False)
    file_format = Column(String(10), nullable=False)  # epub, fb2
    file_size = Column(Integer, nullable=False)  # размер в байтах
    
    # Контент
    cover_image = Column(String(1000), nullable=True)
    description = Column(Text, nullable=True)
    book_metadata = Column(JSON, nullable=True)  # метаданные из файла
    
    # Статистика
    total_pages = Column(Integer, default=0, nullable=False)
    estimated_reading_time = Column(Integer, default=0, nullable=False)  # минуты
    
    # Статус обработки
    is_parsed = Column(Boolean, default=False, nullable=False)
    parsing_progress = Column(Integer, default=0, nullable=False)  # 0-100%
    parsing_error = Column(Text, nullable=True)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_accessed = Column(DateTime(timezone=True), nullable=True)
    
    # Отношения
    user = relationship("User", back_populates="books")
    chapters = relationship("Chapter", back_populates="book", cascade="all, delete-orphan")
    reading_progress = relationship("ReadingProgress", back_populates="book", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Book(id={self.id}, title='{self.title}', author='{self.author}')>"
    
    def get_reading_progress_percent(self, user_id: UUID) -> float:
        """
        Получает прогресс чтения книги пользователем в процентах.
        
        Прогресс рассчитывается на основе глав, а не страниц,
        так как это более точный показатель для электронных книг.
        
        Args:
            user_id: ID пользователя
            
        Returns:
            Прогресс чтения от 0.0 до 100.0
        """
        progress = next(
            (p for p in self.reading_progress if p.user_id == user_id), 
            None
        )
        if not progress:
            return 0.0
        
        # Получаем общее количество глав
        total_chapters = len(self.chapters)
        if total_chapters == 0:
            return 0.0
        
        # Прогресс на основе глав: завершенные главы + прогресс внутри текущей
        current_chapter = max(1, progress.current_chapter)
        
        if current_chapter > total_chapters:
            return 100.0
        
        # Базовый прогресс от завершенных глав
        completed_chapters = current_chapter - 1
        base_progress = (completed_chapters / total_chapters) * 100
        
        # Добавляем прогресс внутри текущей главы (оцениваем как 0-20% от главы)
        if current_chapter <= total_chapters:
            chapter_progress = min(20.0, (progress.current_position / 1000) * 20) if progress.current_position > 0 else 0.0
            chapter_contribution = chapter_progress / total_chapters
            base_progress += chapter_contribution
        
        return min(100.0, base_progress)


class ReadingProgress(Base):
    """
    Модель прогресса чтения книги пользователем.
    
    Attributes:
        id: Уникальный идентификатор записи
        user_id: ID пользователя
        book_id: ID книги
        current_chapter: Номер текущей главы
        current_page: Номер текущей страницы
        current_position: Позиция в главе (для точного позиционирования)
        reading_time_minutes: Время чтения в минутах
        reading_speed_wpm: Скорость чтения (слов в минуту)
    """
    
    __tablename__ = "reading_progress"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True)
    
    # Позиция чтения
    current_chapter = Column(Integer, default=1, nullable=False)
    current_page = Column(Integer, default=1, nullable=False)
    current_position = Column(Integer, default=0, nullable=False)  # позиция в главе
    
    # Статистика чтения
    reading_time_minutes = Column(Integer, default=0, nullable=False)
    reading_speed_wpm = Column(Float, default=0.0, nullable=False)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Отношения
    user = relationship("User", back_populates="reading_progress")
    book = relationship("Book", back_populates="reading_progress")
    
    def __repr__(self):
        return f"<ReadingProgress(user_id={self.user_id}, book_id={self.book_id}, chapter={self.current_chapter})>"
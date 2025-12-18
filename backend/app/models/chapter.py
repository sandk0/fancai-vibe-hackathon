"""
Модель глав книг для BookReader AI.

Содержит структуру глав и их контент для парсинга описаний.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from ..core.database import Base


class Chapter(Base):
    """
    Модель главы книги.

    Attributes:
        id: Уникальный идентификатор главы
        book_id: ID книги (внешний ключ)
        chapter_number: Номер главы в книге
        title: Название главы
        content: Текстовое содержимое главы
        html_content: HTML содержимое (если есть форматирование)
        word_count: Количество слов в главе
        estimated_reading_time: Расчетное время чтения в минутах
        is_description_parsed: Флаг завершения парсинга описаний
        descriptions_found: Количество найденных описаний
    """

    __tablename__ = "chapters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    book_id = Column(
        UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True
    )

    # Информация о главе
    chapter_number = Column(Integer, nullable=False, index=True)
    title = Column(String(500), nullable=True)

    # Контент
    content = Column(Text, nullable=False)  # Чистый текст
    html_content = Column(Text, nullable=True)  # HTML с форматированием

    # Статистика
    word_count = Column(Integer, default=0, nullable=False)
    estimated_reading_time = Column(Integer, default=0, nullable=False)  # минуты

    # Статус парсинга описаний
    is_description_parsed = Column(Boolean, default=False, nullable=False)
    descriptions_found = Column(Integer, default=0, nullable=False)
    parsing_progress = Column(Integer, default=0, nullable=False)  # 0-100%

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
    parsed_at = Column(DateTime(timezone=True), nullable=True)

    # Отношения
    book = relationship("Book", back_populates="chapters")
    descriptions = relationship(
        "Description", back_populates="chapter", cascade="all, delete-orphan"
    )
    generated_images = relationship(
        "GeneratedImage", back_populates="chapter", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Chapter(id={self.id}, book_id={self.book_id}, number={self.chapter_number}, title='{self.title}')>"

    def get_text_excerpt(self, max_length: int = 200) -> str:
        """
        Получает отрывок текста главы для предварительного просмотра.

        Args:
            max_length: Максимальная длина отрывка

        Returns:
            Отрывок текста с многоточием если текст длиннее max_length
        """
        if not self.content:
            return ""

        if len(self.content) <= max_length:
            return self.content

        # Находим последний пробел перед лимитом, чтобы не обрезать слово
        excerpt = self.content[:max_length]
        last_space = excerpt.rfind(" ")

        if last_space > max_length * 0.8:  # Если пробел не слишком далеко от конца
            excerpt = excerpt[:last_space]

        return excerpt + "..."

    def calculate_reading_time(self, words_per_minute: int = 200) -> int:
        """
        Рассчитывает предполагаемое время чтения главы.

        Args:
            words_per_minute: Скорость чтения (по умолчанию 200 слов/мин)

        Returns:
            Время чтения в минутах
        """
        if self.word_count == 0:
            return 0

        return max(1, round(self.word_count / words_per_minute))

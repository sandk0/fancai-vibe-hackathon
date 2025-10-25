"""
Сервис для управления парсингом книг и NLP обработкой.

Ответственности:
- Извлечение описаний из глав с помощью NLP
- Управление прогрессом парсинга
- Маппинг жанров (перенесено из BookService)
- Интеграция с Celery tasks для асинхронного парсинга

Single Responsibility Principle:
Сервис отвечает ТОЛЬКО за парсинг и NLP обработку.
Не занимается CRUD операциями книг или статистикой.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...models.book import Book
from ...models.chapter import Chapter
from ...models.description import Description, DescriptionType
from ...services.multi_nlp_manager import multi_nlp_manager


class BookParsingService:
    """Сервис для управления парсингом и NLP обработкой книг."""

    def __init__(self, book_service: Optional["BookService"] = None):
        """
        Инициализация сервиса парсинга.

        Args:
            book_service: Опциональная зависимость от BookService (Dependency Injection)
        """
        # Lazy import для избежания circular dependency
        if book_service is None:
            from .book_service import book_service as default_service

            self.book_service = default_service
        else:
            self.book_service = book_service

    async def extract_chapter_descriptions(
        self, db: AsyncSession, chapter_id: UUID
    ) -> List[Description]:
        """
        Извлекает описания из главы с помощью NLP и сохраняет в БД.

        Args:
            db: Сессия базы данных
            chapter_id: ID главы

        Returns:
            Список извлеченных описаний

        Raises:
            ValueError: Если глава не найдена

        Example:
            >>> descriptions = await parsing_service.extract_chapter_descriptions(db, chapter_id)
            >>> print(f"Найдено {len(descriptions)} описаний")
        """
        # Получаем главу
        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        # Проверяем, не обработана ли уже глава
        if chapter.is_description_parsed:
            existing_descriptions = await db.execute(
                select(Description).where(Description.chapter_id == chapter_id)
            )
            return existing_descriptions.scalars().all()

        # Извлекаем описания с помощью NLP
        result = await multi_nlp_manager.extract_descriptions(
            text=chapter.content, chapter_id=str(chapter_id)
        )
        nlp_descriptions = result.descriptions

        # Сохраняем описания в базу данных
        saved_descriptions = []
        for desc_data in nlp_descriptions:
            # Адаптируем поля под новую структуру multi_nlp_manager
            entities_list = desc_data.get("entities_mentioned", [])
            if isinstance(entities_list, str):
                entities_str = entities_list
            elif isinstance(entities_list, list):
                entities_str = ", ".join(entities_list)
            else:
                entities_str = ""

            description = Description(
                chapter_id=chapter_id,
                type=desc_data["type"],
                content=desc_data["content"],
                context=desc_data.get("context", ""),
                confidence_score=desc_data["confidence_score"],
                position_in_chapter=desc_data.get("position", 0),
                word_count=desc_data["word_count"],
                priority_score=desc_data["priority_score"],
                entities_mentioned=entities_str,
                is_suitable_for_generation=desc_data["confidence_score"]
                > 0.3,  # Минимальный порог
            )

            db.add(description)
            saved_descriptions.append(description)

        # Обновляем статус главы
        chapter.is_description_parsed = True
        chapter.descriptions_found = len(saved_descriptions)
        chapter.parsing_progress = 100
        chapter.parsed_at = datetime.now(timezone.utc)

        await db.commit()
        return saved_descriptions

    async def get_book_descriptions(
        self,
        db: AsyncSession,
        book_id: UUID,
        description_type: Optional[DescriptionType] = None,
        limit: int = 100,
    ) -> List[Description]:
        """
        Получает описания из всех глав книги.

        Args:
            db: Сессия базы данных
            book_id: ID книги
            description_type: Фильтр по типу описания
            limit: Максимальное количество описаний

        Returns:
            Список описаний, отсортированных по приоритету
        """
        from sqlalchemy import desc

        query = (
            select(Description)
            .join(Chapter)
            .where(Chapter.book_id == book_id)
            .order_by(desc(Description.priority_score))
            .limit(limit)
        )

        if description_type:
            query = query.where(Description.type == description_type)

        result = await db.execute(query)
        return result.scalars().all()

    async def update_parsing_progress(
        self, db: AsyncSession, book_id: UUID, progress_percent: int
    ) -> Book:
        """
        Обновляет прогресс парсинга книги.

        Args:
            db: Сессия базы данных
            book_id: ID книги
            progress_percent: Процент выполнения парсинга (0-100)

        Returns:
            Обновленный объект Book

        Raises:
            ValueError: Если книга не найдена
        """
        result = await db.execute(select(Book).where(Book.id == book_id))
        book = result.scalar_one_or_none()

        if not book:
            raise ValueError(f"Book with id {book_id} not found")

        book.parsing_progress = max(0, min(100, progress_percent))

        # Если парсинг завершен, обновляем флаг
        if progress_percent >= 100:
            book.is_parsed = True

        await db.commit()
        return book

    async def get_parsing_status(self, db: AsyncSession, book_id: UUID) -> dict:
        """
        Получает статус парсинга книги.

        Args:
            db: Сессия базы данных
            book_id: ID книги

        Returns:
            Словарь со статусом парсинга:
            - is_parsed: Завершен ли парсинг
            - parsing_progress: Прогресс в процентах
            - total_chapters: Всего глав
            - parsed_chapters: Обработано глав
            - total_descriptions: Всего найдено описаний

        Raises:
            ValueError: Если книга не найдена
        """
        from sqlalchemy import func

        result = await db.execute(select(Book).where(Book.id == book_id))
        book = result.scalar_one_or_none()

        if not book:
            raise ValueError(f"Book with id {book_id} not found")

        # Подсчитываем главы
        total_chapters_result = await db.execute(
            select(func.count(Chapter.id)).where(Chapter.book_id == book_id)
        )
        total_chapters = total_chapters_result.scalar() or 0

        # Подсчитываем обработанные главы
        parsed_chapters_result = await db.execute(
            select(func.count(Chapter.id))
            .where(Chapter.book_id == book_id)
            .where(Chapter.is_description_parsed == True)
        )
        parsed_chapters = parsed_chapters_result.scalar() or 0

        # Подсчитываем описания
        total_descriptions_result = await db.execute(
            select(func.count(Description.id))
            .join(Chapter)
            .where(Chapter.book_id == book_id)
        )
        total_descriptions = total_descriptions_result.scalar() or 0

        return {
            "is_parsed": book.is_parsed,
            "parsing_progress": book.parsing_progress,
            "total_chapters": total_chapters,
            "parsed_chapters": parsed_chapters,
            "total_descriptions": total_descriptions,
        }


# Глобальный экземпляр сервиса (для обратной совместимости)
book_parsing_service = BookParsingService()

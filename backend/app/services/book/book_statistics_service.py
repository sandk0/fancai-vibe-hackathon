"""
Сервис для статистики и поиска книг.

Ответственности:
- Подсчет книг пользователя
- Сбор статистики по чтению
- Статистика по описаниям
- Поиск книг (в будущем)

Single Responsibility Principle:
Сервис отвечает ТОЛЬКО за статистику и аналитику.
Не занимается CRUD операциями или прогрессом.
"""

from typing import Dict, Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ...models.book import Book, ReadingProgress
from ...models.chapter import Chapter
from ...models.description import Description


class BookStatisticsService:
    """Сервис для работы со статистикой книг."""

    def __init__(self, book_service: Optional["BookService"] = None):
        """
        Инициализация сервиса статистики.

        Args:
            book_service: Опциональная зависимость от BookService (Dependency Injection)
        """
        # Lazy import для избежания circular dependency
        if book_service is None:
            from .book_service import book_service as default_service

            self.book_service = default_service
        else:
            self.book_service = book_service

    async def count_user_books(self, db: AsyncSession, user_id: UUID) -> int:
        """
        Подсчитывает общее количество книг пользователя.

        Args:
            db: Сессия базы данных
            user_id: ID пользователя

        Returns:
            Количество книг
        """
        result = await db.execute(
            select(func.count(Book.id)).where(Book.user_id == user_id)
        )
        return result.scalar() or 0

    async def get_book_statistics(
        self, db: AsyncSession, user_id: UUID
    ) -> Dict[str, Any]:
        """
        Получает детальную статистику книг пользователя.

        Args:
            db: Сессия базы данных
            user_id: ID пользователя

        Returns:
            Словарь со статистикой:
            - total_books: Общее количество книг
            - total_pages_read: Общее количество прочитанных страниц
            - total_reading_time_hours: Общее время чтения в часах
            - descriptions_extracted: Всего извлечено описаний
            - descriptions_by_type: Распределение описаний по типам

        Example:
            >>> stats = await stats_service.get_book_statistics(db, user_id)
            >>> print(f"У вас {stats['total_books']} книг")
        """
        # Общее количество книг
        total_books = await db.execute(
            select(func.count(Book.id)).where(Book.user_id == user_id)
        )
        total_books_count = total_books.scalar()

        # Количество прочитанных страниц
        total_pages_read = await db.execute(
            select(func.sum(ReadingProgress.current_page)).where(
                ReadingProgress.user_id == user_id
            )
        )
        pages_read = total_pages_read.scalar() or 0

        # Общее время чтения
        total_reading_time = await db.execute(
            select(func.sum(ReadingProgress.reading_time_minutes)).where(
                ReadingProgress.user_id == user_id
            )
        )
        reading_time = total_reading_time.scalar() or 0

        # Количество описаний по типам
        descriptions_by_type = await db.execute(
            select(Description.type, func.count(Description.id))
            .join(Chapter)
            .join(Book)
            .where(Book.user_id == user_id)
            .group_by(Description.type)
        )

        descriptions_stats = {}
        for desc_type, count in descriptions_by_type.fetchall():
            descriptions_stats[desc_type.value] = count

        return {
            "total_books": total_books_count,
            "total_pages_read": pages_read,
            "total_reading_time_hours": round(reading_time / 60, 1),
            "descriptions_extracted": sum(descriptions_stats.values()),
            "descriptions_by_type": descriptions_stats,
        }


# Глобальный экземпляр сервиса (для обратной совместимости)
book_statistics_service = BookStatisticsService()

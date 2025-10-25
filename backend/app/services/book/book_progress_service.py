"""
Сервис для работы с прогрессом чтения книг.

Ответственности:
- Получение книг с предрасчитанным прогрессом
- Расчет прогресса чтения (CFI и legacy режимы)
- Обновление прогресса чтения
- Валидация данных прогресса

Single Responsibility Principle:
Сервис отвечает ТОЛЬКО за прогресс чтения.
Все остальные операции с книгами делегируются BookService.
"""

from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from ...models.book import Book, ReadingProgress
from ...models.chapter import Chapter


class BookProgressService:
    """Сервис для работы с прогрессом чтения книг."""

    def __init__(self, book_service: Optional["BookService"] = None):
        """
        Инициализация сервиса прогресса.

        Args:
            book_service: Опциональная зависимость от BookService (Dependency Injection)
        """
        # Lazy import для избежания circular dependency
        if book_service is None:
            from .book_service import book_service as default_service

            self.book_service = default_service
        else:
            self.book_service = book_service

    async def get_books_with_progress(
        self, db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 50
    ) -> List[Tuple[Book, float]]:
        """
        Получает список книг пользователя с предрасчитанным прогрессом чтения.

        ОПТИМИЗАЦИЯ: Использует eager loading для устранения N+1 queries.
        Вместо 51 запроса (1 для книг + 50 для прогресса) делает всего 2 запроса.

        Args:
            db: Сессия базы данных
            user_id: ID пользователя
            skip: Количество записей для пропуска
            limit: Максимальное количество записей

        Returns:
            Список кортежей (Book, reading_progress_percent)
        """
        # Используем BookService для получения книг с eager loading
        books = await self.book_service.get_user_books(db, user_id, skip, limit)

        # Вычисляем прогресс для каждой книги БЕЗ дополнительных запросов
        books_with_progress = []
        for book in books:
            progress_percent = self.calculate_reading_progress(book, user_id)
            books_with_progress.append((book, progress_percent))

        return books_with_progress

    def calculate_reading_progress(self, book: Book, user_id: UUID) -> float:
        """
        Вычисляет прогресс чтения используя уже загруженные relationships.

        ВАЖНО: Не делает дополнительных запросов к БД!
        Использует book.reading_progress и book.chapters которые уже загружены.

        Поддерживает два режима:
        1. CFI mode (epub.js): Использует reading_location_cfi и current_position
        2. Legacy mode: Использует current_chapter и current_position для старых данных

        Args:
            book: Объект книги с загруженными relationships
            user_id: ID пользователя

        Returns:
            Прогресс чтения от 0.0 до 100.0

        Example:
            >>> progress = progress_service.calculate_reading_progress(book, user_id)
            >>> print(f"Прочитано: {progress:.1f}%")
        """
        try:
            # Находим reading_progress для текущего пользователя
            # из уже загруженной relationship (NO QUERY!)
            progress = None
            for rp in book.reading_progress:
                if rp.user_id == user_id:
                    progress = rp
                    break

            if not progress:
                return 0.0

            # НОВАЯ ЛОГИКА: Если есть CFI - это EPUB reader с точным процентом
            if progress.reading_location_cfi:
                # current_position уже содержит общий процент по всей книге (0-100)
                current_position = max(
                    0.0, min(100.0, float(progress.current_position))
                )
                return current_position

            # СТАРАЯ ЛОГИКА: Для обратной совместимости со старыми данными без CFI
            # Используем уже загруженные chapters (NO QUERY!)
            total_chapters = len(book.chapters) if book.chapters else 0

            if not total_chapters or total_chapters == 0:
                return 0.0

            # Валидация данных
            current_chapter = max(1, min(progress.current_chapter, total_chapters))
            current_position = max(0.0, min(100.0, float(progress.current_position)))

            # Если читает главу за пределами книги, возвращаем 100%
            if current_chapter > total_chapters:
                return 100.0

            # Расчет прогресса:
            # - Завершенные главы: (current_chapter - 1) глав
            # - Текущая глава: current_position% от 1/total_chapters
            completed_chapters_progress = ((current_chapter - 1) / total_chapters) * 100
            current_chapter_progress = (current_position / 100) * (100 / total_chapters)

            total_progress = completed_chapters_progress + current_chapter_progress

            return min(100.0, max(0.0, total_progress))
        except Exception as e:
            # В случае любой ошибки возвращаем 0
            print(f"⚠️ Error calculating reading progress: {e}")
            return 0.0

    async def update_reading_progress(
        self,
        db: AsyncSession,
        user_id: UUID,
        book_id: UUID,
        chapter_number: int,
        position_percent: float = 0.0,
        reading_location_cfi: str = None,
        scroll_offset_percent: float = 0.0,
    ) -> ReadingProgress:
        """
        Обновляет прогресс чтения книги пользователем.

        Args:
            db: Сессия базы данных
            user_id: ID пользователя
            book_id: ID книги
            chapter_number: Номер текущей главы (начиная с 1)
            position_percent: Процент прочитанного в текущей главе (0.0-100.0)
            reading_location_cfi: CFI (Canonical Fragment Identifier) для epub.js
            scroll_offset_percent: Точный процент скролла внутри страницы (0.0-100.0)

        Returns:
            Объект ReadingProgress

        Raises:
            ValueError: Если книга не найдена
        """
        # Получаем книгу для валидации
        book_result = await db.execute(select(Book).where(Book.id == book_id))
        book = book_result.scalar_one_or_none()
        if not book:
            raise ValueError(f"Book with id {book_id} not found")

        # Загружаем главы для валидации номера главы
        chapters_result = await db.execute(
            select(Chapter).where(Chapter.book_id == book_id)
        )
        chapters = chapters_result.scalars().all()
        total_chapters = len(chapters)

        # Валидируем и нормализуем входные данные
        valid_chapter = (
            max(1, min(chapter_number or 1, total_chapters))
            if total_chapters > 0
            else 1
        )
        valid_position = max(0.0, min(100.0, float(position_percent or 0.0)))

        # Для обратной совместимости сохраняем current_page = 1
        # (в будущем можно убрать это поле из модели)
        valid_page = 1

        # Ищем существующий прогресс
        result = await db.execute(
            select(ReadingProgress).where(
                and_(
                    ReadingProgress.user_id == user_id,
                    ReadingProgress.book_id == book_id,
                )
            )
        )
        progress = result.scalar_one_or_none()

        if not progress:
            # Создаем новый прогресс
            progress = ReadingProgress(
                user_id=user_id,
                book_id=book_id,
                current_chapter=valid_chapter,
                current_page=valid_page,
                current_position=valid_position,  # Теперь хранит процент 0-100
                reading_location_cfi=reading_location_cfi,  # CFI для epub.js
                scroll_offset_percent=scroll_offset_percent,  # Точный скролл внутри страницы
            )
            db.add(progress)
        else:
            # Обновляем существующий
            progress.current_chapter = valid_chapter
            progress.current_page = valid_page
            progress.current_position = valid_position  # Теперь хранит процент 0-100
            progress.reading_location_cfi = reading_location_cfi  # CFI для epub.js
            progress.scroll_offset_percent = (
                scroll_offset_percent  # Точный скролл внутри страницы
            )
            progress.last_read_at = datetime.now(timezone.utc)

        # Обновляем время последнего доступа к книге
        book_result = await db.execute(select(Book).where(Book.id == book_id))
        book = book_result.scalar_one()
        book.last_accessed = datetime.now(timezone.utc)

        await db.commit()
        return progress


# Глобальный экземпляр сервиса (для обратной совместимости)
book_progress_service = BookProgressService()

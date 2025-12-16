"""
Сервис для управления парсингом книг и LLM обработкой.

Ответственности:
- Извлечение описаний из глав с помощью LLM (LangExtract/Gemini)
- Управление прогрессом парсинга
- Маппинг жанров (перенесено из BookService)
- Интеграция с Celery tasks для асинхронного парсинга

Single Responsibility Principle:
Сервис отвечает ТОЛЬКО за парсинг и LLM обработку.
Не занимается CRUD операциями книг или статистикой.

NLP REMOVAL (December 2025):
- Удален multi_nlp_manager (требовал 10-12 ГБ RAM)
- Используется langextract_processor (LLM-based, ~500 МБ)
- Описания больше не хранятся в отдельной таблице
- Извлечение происходит on-demand через LLM API
"""

from typing import List, Optional, Dict, Any, TYPE_CHECKING
from uuid import UUID
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...models.book import Book
from ...models.chapter import Chapter

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from .book_service import BookService


class BookParsingService:
    """Сервис для управления парсингом и LLM обработкой книг."""

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
    ) -> List[Dict[str, Any]]:
        """
        Извлекает описания из главы с помощью LLM (on-demand).

        После удаления NLP системы описания не сохраняются в БД,
        а извлекаются по запросу через LangExtract/Gemini API.

        Args:
            db: Сессия базы данных
            chapter_id: ID главы

        Returns:
            Список словарей с описаниями (не модели Description)

        Raises:
            ValueError: Если глава не найдена
        """
        from ...services.langextract_processor import LangExtractProcessor

        # Получаем главу
        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        # Извлекаем описания с помощью LLM
        processor = LangExtractProcessor()
        if not processor.is_available():
            logger.warning("LangExtract processor not available, returning empty list")
            return []

        try:
            result = await processor.extract_descriptions(
                text=chapter.content,
                chapter_id=str(chapter_id)
            )
            return result.descriptions
        except Exception as e:
            logger.error(f"Error extracting descriptions for chapter {chapter_id}: {e}")
            return []

    async def get_book_descriptions(
        self,
        db: AsyncSession,
        book_id: UUID,
        description_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Получает описания из всех глав книги (on-demand через LLM).

        После удаления NLP системы описания извлекаются по запросу.

        Args:
            db: Сессия базы данных
            book_id: ID книги
            description_type: Фильтр по типу описания (location, character, atmosphere)
            limit: Максимальное количество описаний

        Returns:
            Список описаний в виде словарей
        """
        from ...services.langextract_processor import LangExtractProcessor

        # Получаем главы книги
        chapters_result = await db.execute(
            select(Chapter)
            .where(Chapter.book_id == book_id)
            .order_by(Chapter.order)
        )
        chapters = chapters_result.scalars().all()

        if not chapters:
            return []

        processor = LangExtractProcessor()
        if not processor.is_available():
            logger.warning("LangExtract processor not available")
            return []

        all_descriptions = []
        for chapter in chapters:
            if len(all_descriptions) >= limit:
                break

            try:
                result = await processor.extract_descriptions(
                    text=chapter.content,
                    chapter_id=str(chapter.id)
                )

                for desc in result.descriptions:
                    if description_type and desc.get("type") != description_type:
                        continue
                    all_descriptions.append(desc)
                    if len(all_descriptions) >= limit:
                        break
            except Exception as e:
                logger.error(f"Error extracting descriptions for chapter {chapter.id}: {e}")
                continue

        # Сортируем по priority_score
        all_descriptions.sort(key=lambda x: x.get("priority_score", 0), reverse=True)
        return all_descriptions[:limit]

    async def get_parsing_status(self, db: AsyncSession, book_id: UUID) -> dict:
        """
        Получает статус парсинга книги.

        После удаления NLP системы возвращает упрощенный статус.

        Args:
            db: Сессия базы данных
            book_id: ID книги

        Returns:
            Словарь со статусом:
            - total_chapters: Всего глав
            - llm_available: Доступен ли LLM процессор

        Raises:
            ValueError: Если книга не найдена
        """
        from sqlalchemy import func
        from ...services.langextract_processor import LangExtractProcessor

        result = await db.execute(select(Book).where(Book.id == book_id))
        book = result.scalar_one_or_none()

        if not book:
            raise ValueError(f"Book with id {book_id} not found")

        # Подсчитываем главы
        total_chapters_result = await db.execute(
            select(func.count(Chapter.id)).where(Chapter.book_id == book_id)
        )
        total_chapters = total_chapters_result.scalar() or 0

        # Проверяем доступность LLM
        processor = LangExtractProcessor()
        llm_available = processor.is_available()

        return {
            "total_chapters": total_chapters,
            "llm_available": llm_available,
            "extraction_mode": "on_demand",
            "message": "Descriptions are extracted on-demand via LLM API"
        }


# Глобальный экземпляр сервиса (для обратной совместимости)
book_parsing_service = BookParsingService()

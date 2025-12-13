"""
API роуты для работы с главами книг в BookReader AI.

Этот модуль содержит endpoints для управления главами книг:
- Получение списка глав
- Получение содержимого конкретной главы
- Навигация между главами
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any

from ..core.database import get_database_session
from ..core.auth import get_current_active_user
from ..core.dependencies import get_user_book, get_chapter_by_number
from ..core.cache import cache_manager, cache_key, CACHE_TTL
from ..core.exceptions import ChapterFetchException
from ..services.book import book_service
from ..models.user import User
from ..models.book import Book
from ..models.chapter import Chapter
from ..models.description import Description
from ..models.image import GeneratedImage
from ..schemas.responses import (
    ChapterResponse,
    ChapterDetailResponse,
    NavigationInfo,
    BookMinimalInfo,
    DescriptionWithImageResponse,
)


router = APIRouter()


@router.get("/{book_id}/chapters")
async def list_chapters(
    book: Book = Depends(get_user_book),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает список всех глав книги.

    Args:
        book: Книга (автоматически получена через dependency)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Список глав с метаданными

    Raises:
        BookNotFoundException: Если книга не найдена
        BookAccessDeniedException: Если доступ запрещен

    Cache:
        TTL: 1 hour (rarely changes)
        Key: book:{book_id}:chapters:list
    """
    # Try to get from cache
    cache_key_str = cache_key("book", book.id, "chapters", "list")
    cached_result = await cache_manager.get(cache_key_str)
    if cached_result is not None:
        return cached_result

    try:
        book_id = book.id

        # Получаем главы
        chapters = await book_service.get_book_chapters(
            db=db, book_id=book_id, user_id=current_user.id
        )

        # Формируем ответ
        chapters_data = []
        for chapter in sorted(chapters, key=lambda c: c.chapter_number):
            chapters_data.append(
                {
                    "id": str(chapter.id),
                    "number": chapter.chapter_number,
                    "title": chapter.title,
                    "word_count": chapter.word_count,
                    "estimated_reading_time_minutes": chapter.estimated_reading_time,
                    "is_description_parsed": chapter.is_description_parsed,
                    "descriptions_found": chapter.descriptions_found,
                }
            )

        response = {
            "book_id": str(book_id),
            "total_chapters": len(chapters_data),
            "chapters": chapters_data,
        }

        # Cache the result (1 hour TTL)
        await cache_manager.set(cache_key_str, response, ttl=CACHE_TTL["book_chapters"])

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise ChapterFetchException(str(e))


@router.get("/{book_id}/chapters/{chapter_number}", response_model=ChapterDetailResponse)
async def get_chapter(
    chapter: Chapter = Depends(get_chapter_by_number),
    db: AsyncSession = Depends(get_database_session),
) -> ChapterDetailResponse:
    """
    Получает содержимое конкретной главы книги.

    Args:
        chapter: Глава (автоматически получена через dependency)
        db: Сессия базы данных

    Returns:
        Содержимое главы с навигационной информацией

    Raises:
        BookNotFoundException: Если книга не найдена
        BookAccessDeniedException: Если доступ к книге запрещен
        ChapterNotFoundException: Если глава не найдена

    Cache:
        TTL: 1 hour (content rarely changes)
        Key: book:{book_id}:chapter:{chapter_number}

    Example:
        ```bash
        curl -X GET http://localhost:8000/api/v1/books/{book_id}/chapters/{chapter_number} \\
             -H "Authorization: Bearer <token>"
        ```
    """
    # Try to get from cache
    cache_key_str = cache_key(
        "book", chapter.book_id, "chapter", chapter.chapter_number
    )
    cached_result = await cache_manager.get(cache_key_str)
    if cached_result is not None:
        return cached_result

    try:
        # Загружаем книгу для навигационной информации
        book_result = await db.execute(select(Book).where(Book.id == chapter.book_id))
        book = book_result.scalar_one()

        # Получаем описания для этой главы с изображениями (лимитируем до 50)
        descriptions_result = await db.execute(
            select(Description, GeneratedImage)
            .outerjoin(GeneratedImage, Description.id == GeneratedImage.description_id)
            .where(Description.chapter_id == chapter.id)
            .order_by(Description.priority_score.desc())
            .limit(50)  # Лимитируем для предотвращения проблем с памятью
        )

        descriptions_data = []
        descriptions_rows = descriptions_result.fetchall()

        for description, generated_image in descriptions_rows:
            # Создаем DescriptionWithImageResponse
            desc_response = DescriptionWithImageResponse.model_validate(description)

            # Добавляем изображение только если оно есть
            if generated_image:
                desc_response.image_url = generated_image.image_url
                desc_response.image_id = generated_image.id

            descriptions_data.append(desc_response)

        # Навигационная информация
        has_previous = chapter.chapter_number > 1
        has_next = chapter.chapter_number < len(book.chapters)
        previous_chapter = chapter.chapter_number - 1 if has_previous else None
        next_chapter = chapter.chapter_number + 1 if has_next else None

        # Создаем response objects
        chapter_response = ChapterResponse.model_validate(chapter)

        navigation = NavigationInfo(
            has_previous=has_previous,
            has_next=has_next,
            previous_chapter=previous_chapter,
            next_chapter=next_chapter,
        )

        book_info = BookMinimalInfo(
            id=book.id,
            title=book.title,
            author=book.author,
            total_chapters=len(book.chapters),
        )

        response = ChapterDetailResponse(
            chapter=chapter_response,
            descriptions=descriptions_data,
            navigation=navigation,
            book_info=book_info,
        )

        # Cache the result (1 hour TTL for chapter content)
        await cache_manager.set(
            cache_key_str, response, ttl=CACHE_TTL["chapter_content"]
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise ChapterFetchException(str(e))

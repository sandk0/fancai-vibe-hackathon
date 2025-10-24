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
from uuid import UUID

from ..core.database import get_database_session
from ..core.auth import get_current_active_user
from ..services.book_service import book_service
from ..models.user import User
from ..models.description import Description
from ..models.image import GeneratedImage


router = APIRouter()


@router.get("/{book_id}/chapters")
async def list_chapters(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает список всех глав книги.

    Args:
        book_id: ID книги
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Список глав с метаданными

    Raises:
        HTTPException: 404 если книга не найдена
    """
    try:
        # Проверяем доступ к книге
        book = await book_service.get_book_by_id(
            db=db, book_id=book_id, user_id=current_user.id
        )

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

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

        return {
            "book_id": str(book_id),
            "total_chapters": len(chapters_data),
            "chapters": chapters_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching chapters: {str(e)}"
        )


@router.get("/{book_id}/chapters/{chapter_number}")
async def get_chapter(
    book_id: UUID,
    chapter_number: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает содержимое конкретной главы книги.

    Args:
        book_id: ID книги
        chapter_number: Номер главы
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Содержимое главы с навигационной информацией

    Raises:
        HTTPException: 404 если книга или глава не найдена
    """
    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db, book_id=book_id, user_id=current_user.id
        )

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Ищем главу
        chapter = None
        for c in book.chapters:
            if c.chapter_number == chapter_number:
                chapter = c
                break

        if not chapter:
            raise HTTPException(
                status_code=404, detail=f"Chapter {chapter_number} not found"
            )

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
            # Упрощенная структура данных для уменьшения потребления памяти
            desc_data = {
                "id": str(description.id),
                "type": description.type.value,
                "content": description.content,
                "confidence_score": description.confidence_score,
                "priority_score": description.priority_score,
                "position_in_chapter": description.position_in_chapter,
            }

            # Добавляем изображение только если оно есть
            if generated_image:
                desc_data["generated_image"] = {
                    "id": str(generated_image.id),
                    "image_url": generated_image.image_url,
                    "created_at": generated_image.created_at.isoformat(),
                }

            descriptions_data.append(desc_data)

        # Навигационная информация
        has_previous = chapter_number > 1
        has_next = chapter_number < len(book.chapters)
        previous_chapter = chapter_number - 1 if has_previous else None
        next_chapter = chapter_number + 1 if has_next else None

        return {
            "chapter": {
                "id": str(chapter.id),
                "number": chapter.chapter_number,
                "title": chapter.title,
                "content": chapter.content,
                "html_content": chapter.html_content,
                "word_count": chapter.word_count,
                "estimated_reading_time_minutes": chapter.estimated_reading_time,
            },
            "descriptions": descriptions_data,
            "navigation": {
                "has_previous": has_previous,
                "has_next": has_next,
                "previous_chapter": previous_chapter,
                "next_chapter": next_chapter,
            },
            "book_info": {
                "id": str(book.id),
                "title": book.title,
                "author": book.author,
                "total_chapters": len(book.chapters),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching chapter: {str(e)}")

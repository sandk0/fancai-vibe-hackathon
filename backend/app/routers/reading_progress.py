"""
API роуты для работы с прогрессом чтения в BookReader AI.

Этот модуль содержит endpoints для управления прогрессом чтения:
- Получение текущего прогресса
- Обновление прогресса чтения
- CFI (Canonical Fragment Identifier) tracking для epub.js
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Dict, Any
from uuid import UUID

from ..core.database import get_database_session
from ..core.auth import get_current_active_user
from ..core.cache import cache_manager, cache_key, CACHE_TTL
from ..services.book import book_service, book_progress_service
from ..models.user import User
from ..models.book import ReadingProgress


router = APIRouter()


@router.get("/{book_id}/progress")
async def get_reading_progress(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает прогресс чтения книги пользователем.

    Args:
        book_id: ID книги
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Текущий прогресс чтения с CFI локацией

    Raises:
        HTTPException: 404 если книга не найдена

    Cache:
        TTL: 5 minutes (frequently updated)
        Key: user:{user_id}:progress:{book_id}
    """
    # Try to get from cache
    cache_key_str = cache_key("user", current_user.id, "progress", book_id)
    cached_result = await cache_manager.get(cache_key_str)
    if cached_result is not None:
        return cached_result

    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db, book_id=book_id, user_id=current_user.id
        )

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Ищем прогресс напрямую в БД (избегаем кэширования)
        progress_query = select(ReadingProgress).where(
            and_(
                ReadingProgress.book_id == book_id,
                ReadingProgress.user_id == current_user.id,
            )
        )
        progress_result = await db.execute(progress_query)
        progress = progress_result.scalar_one_or_none()

        response = {
            "progress": {
                "id": str(progress.id) if progress else None,
                "current_chapter": progress.current_chapter if progress else 1,
                "current_page": progress.current_page if progress else 1,
                "current_position": progress.current_position if progress else 0,
                "current_position_percent": progress.current_position
                if progress
                else 0,  # Процент для EPUB reader (совпадает с current_position)
                "reading_location_cfi": progress.reading_location_cfi
                if progress
                else None,
                "scroll_offset_percent": progress.scroll_offset_percent
                if progress
                else 0.0,  # Точный % скролла внутри страницы
                "reading_time_minutes": progress.reading_time_minutes
                if progress
                else 0,
                "reading_speed_wpm": progress.reading_speed_wpm if progress else 0.0,
                "last_read_at": progress.last_read_at.isoformat()
                if progress and progress.last_read_at
                else None,
            }
            if progress
            else None
        }

        # Cache the result (5 minutes TTL for progress data)
        await cache_manager.set(cache_key_str, response, ttl=CACHE_TTL["user_progress"])

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching progress: {str(e)}"
        )


@router.post("/{book_id}/progress")
async def update_reading_progress(
    book_id: UUID,
    progress_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Обновляет прогресс чтения книги пользователем.

    Args:
        book_id: ID книги
        progress_data: Данные прогресса:
            - current_chapter: номер текущей главы (обязательно)
            - current_position_percent: процент прочитанного в главе 0-100 (опционально)
            - reading_location_cfi: CFI для epub.js (опционально)
            - scroll_offset_percent: точный скролл внутри страницы (опционально)
            - current_page: номер страницы для обратной совместимости (опционально)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Обновленный прогресс чтения

    Raises:
        HTTPException: 404 если книга не найдена
    """
    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db, book_id=book_id, user_id=current_user.id
        )

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        current_chapter = max(1, progress_data.get("current_chapter", 1))

        # Получаем CFI если передан (для epub.js)
        reading_location_cfi = progress_data.get("reading_location_cfi")

        # Получаем scroll_offset_percent если передан (для точного восстановления позиции)
        scroll_offset_percent = progress_data.get("scroll_offset_percent", 0.0)
        scroll_offset_percent = max(0.0, min(100.0, float(scroll_offset_percent)))

        # Поддерживаем оба формата: новый (current_position_percent) и старый (current_page)
        position_percent = progress_data.get("current_position_percent")
        if position_percent is None:
            # Обратная совместимость: если передали current_page, игнорируем его
            # и устанавливаем позицию в 0% (начало главы)
            position_percent = 0.0

        position_percent = max(0.0, min(100.0, float(position_percent)))

        # Обновляем прогресс чтения
        progress = await book_progress_service.update_reading_progress(
            db=db,
            user_id=current_user.id,
            book_id=book_id,
            chapter_number=current_chapter,
            position_percent=position_percent,
            reading_location_cfi=reading_location_cfi,
            scroll_offset_percent=scroll_offset_percent,
        )

        # Invalidate cache for this user's progress
        cache_key_str = cache_key("user", current_user.id, "progress", book_id)
        await cache_manager.delete(cache_key_str)

        # Also invalidate user's book list cache (progress affects book list)
        await cache_manager.delete_pattern(f"user:{current_user.id}:books:*")

        return {
            "progress": {
                "id": str(progress.id),
                "current_chapter": progress.current_chapter,
                "current_page": progress.current_page,
                "current_position": progress.current_position,
                "reading_location_cfi": progress.reading_location_cfi,
                "scroll_offset_percent": progress.scroll_offset_percent,
                "reading_time_minutes": progress.reading_time_minutes,
                "reading_speed_wpm": progress.reading_speed_wpm,
                "last_read_at": progress.last_read_at.isoformat()
                if progress.last_read_at
                else None,
            },
            "message": "Reading progress updated successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error updating progress: {str(e)}"
        )

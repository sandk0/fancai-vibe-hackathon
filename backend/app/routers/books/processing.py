"""
Processing & status endpoints для работы с книгами.

Этот модуль содержит операции обработки книг и мониторинга статуса:
- Запуск парсинга описаний
- Получение статуса парсинга
- Управление очередью обработки
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from uuid import UUID

from ...core.database import get_database_session
from ...core.auth import get_current_active_user
from ...services.book_service import book_service
from ...models.user import User
from ...core.tasks import process_book_task


router = APIRouter()


@router.post("/{book_id}/process")
async def process_book_descriptions(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Запускает обработку книги для извлечения описаний.

    Args:
        book_id: ID книги
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Статус запуска обработки

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

        # Импортируем менеджер парсинга
        from ...services.parsing_manager import parsing_manager

        # Проверяем текущий статус парсинга
        parsing_status = await parsing_manager.get_parsing_status(book_id)
        if parsing_status and parsing_status["status"] in ["queued", "processing"]:
            return {
                "book_id": book_id,
                "status": parsing_status["status"],
                "message": parsing_status.get("message", ""),
                "progress": parsing_status.get("progress", 0),
                "position": parsing_status.get("position"),
                "descriptions_found": parsing_status.get("descriptions_found", 0),
            }

        # Проверяем, можно ли начать парсинг сейчас
        can_parse, message = await parsing_manager.can_start_parsing()

        # Получаем приоритет пользователя
        priority = await parsing_manager.get_user_priority(current_user, db)

        if can_parse:
            # Пытаемся получить блокировку и начать парсинг сразу
            if await parsing_manager.acquire_parsing_lock(
                book_id, str(current_user.id)
            ):
                try:
                    # Обновляем статус
                    await parsing_manager.update_parsing_status(
                        book_id,
                        status="processing",
                        progress=0,
                        message="Starting book parsing...",
                    )

                    # Запускаем задачу
                    process_book_task.delay(book_id)

                    return {
                        "book_id": book_id,
                        "status": "processing",
                        "message": "Book parsing started immediately",
                        "priority": priority,
                    }

                except Exception:
                    # Освобождаем блокировку при ошибке
                    await parsing_manager.release_parsing_lock(book_id)

                    # Fallback на синхронную обработку
                    from ...services.nlp_processor import process_book_descriptions

                    result = await process_book_descriptions(book_id, db)

                    return {
                        "book_id": book_id,
                        "status": "completed",
                        "message": "Book processing completed synchronously",
                        "descriptions_found": result.get("total_descriptions", 0),
                    }

        # Если парсинг сейчас невозможен, добавляем в очередь
        queue_info = await parsing_manager.add_to_parsing_queue(
            book_id, str(current_user.id), priority, db
        )

        return {
            "book_id": book_id,
            "status": "queued",
            "message": f"Added to parsing queue. {message}",
            "position": queue_info["position"],
            "total_in_queue": queue_info["total_in_queue"],
            "estimated_wait_time": queue_info["estimated_wait_time"],
            "priority": priority,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error starting book processing: {str(e)}"
        )


@router.get("/{book_id}/parsing-status")
async def get_parsing_status(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает статус парсинга книги.

    Args:
        book_id: ID книги
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Статус парсинга и прогресс

    Raises:
        HTTPException: 404 если книга не найдена
    """
    print(f"[PARSING-STATUS] Request for book_id={book_id}, user={current_user.email}")
    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db, book_id=book_id, user_id=current_user.id
        )

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Определяем статус парсинга на основе данных книги
        if book.is_parsed:
            response = {
                "book_id": book_id,
                "status": "completed",
                "progress": 100,
                "message": "Parsing completed",
                "descriptions_found": sum(ch.descriptions_found for ch in book.chapters)
                if book.chapters
                else 0,
            }
        elif book.parsing_progress > 0:
            response = {
                "book_id": book_id,
                "status": "processing",
                "progress": book.parsing_progress,
                "message": f"Parsing in progress: {book.parsing_progress}%",
            }
        else:
            response = {
                "book_id": book_id,
                "status": "not_started",
                "progress": 0,
                "message": "Parsing not started",
            }

        print(f"[PARSING-STATUS] Response: {response}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching parsing status: {str(e)}"
        )

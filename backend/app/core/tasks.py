"""
Background tasks for BookReader AI.
Фоновые задачи для BookReader AI.

NLP REMOVAL (December 2025):
- Удален multi_nlp_manager (требовал 10-12 ГБ RAM)
- Используется langextract_processor (LLM-based, ~500 МБ)
- Описания извлекаются on-demand, не сохраняются в БД
- Задачи обработки книг упрощены
"""

from app.core.celery_app import celery_app
import asyncio
import os
from typing import Dict, Any, List
import logging
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.book import Book
from app.models.chapter import Chapter
from app.services.image_generator import image_generator_service

logger = logging.getLogger(__name__)


def _run_async_task(coro):
    """
    Helper function to run async functions in Celery tasks.

    ВАЖНО: НЕ закрываем event loop после выполнения, так как:
    1. После run_until_complete() loop уже не running
    2. Закрытие loop может сломать последующие async операции
    3. Позволяем asyncio управлять жизненным циклом loop
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # Worker thread не имеет event loop - создаем новый
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        return loop.run_until_complete(coro)
    finally:
        # НЕ закрываем loop - позволяем asyncio управлять им
        pass


@celery_app.task(name="process_book", bind=True, max_retries=3, default_retry_delay=60)
def process_book_task(self, book_id_str: str) -> Dict[str, Any]:
    """
    Асинхронная обработка книги: валидация и подготовка к on-demand извлечению.

    После удаления NLP системы эта задача только:
    - Валидирует книгу и главы
    - Проверяет доступность LLM
    - Помечает книгу как готовую к обработке

    Args:
        book_id_str: String ID книги для обработки (UUID)

    Returns:
        Результат обработки
    """
    try:
        print(f"🚀 [CELERY TASK] Starting book processing for book_id={book_id_str}")
        book_id = UUID(book_id_str)
        logger.info(f"Starting book processing for book_id={book_id}")

        result = _run_async_task(_process_book_async(book_id))

        print(
            f"✅ [CELERY TASK] Book processing completed for book_id={book_id}, result: {result}"
        )
        logger.info(f"Book processing completed for book_id={book_id}")
        return result

    except Exception as e:
        error_msg = f"Error processing book {book_id_str}: {str(e)}"
        print(f"❌ [CELERY TASK] {error_msg}")
        logger.error(error_msg)
        import traceback

        print(f"🔍 [CELERY TASK] Full traceback: {traceback.format_exc()}")
        return {"book_id": book_id_str, "status": "failed", "error": str(e)}


async def _process_book_async(book_id: UUID) -> Dict[str, Any]:
    """
    Асинхронная функция обработки книги.

    После удаления NLP: просто помечает книгу как готовую.
    Извлечение описаний происходит on-demand через LLM API.
    """
    async with AsyncSessionLocal() as db:
        print(f"🔍 [ASYNC TASK] Starting async processing for book {book_id}")

        # Проверяем доступность LLM
        from app.services.langextract_processor import LangExtractProcessor
        processor = LangExtractProcessor()
        llm_available = processor.is_available()

        if not llm_available:
            print("⚠️ [ASYNC TASK] LangExtract not available - checking API key")
            logger.warning("LangExtract processor not available")

        # Получаем книгу
        book_result = await db.execute(select(Book).where(Book.id == book_id))
        book = book_result.scalar_one_or_none()

        if not book:
            error_msg = f"Book with id {book_id} not found"
            print(f"❌ [ASYNC TASK] {error_msg}")
            raise ValueError(error_msg)

        print(f"📚 [ASYNC TASK] Found book: {book.title} by {book.author}")

        # Получаем главы
        chapters_result = await db.execute(
            select(Chapter)
            .where(Chapter.book_id == book_id)
            .order_by(Chapter.chapter_number)
        )
        chapters = chapters_result.scalars().all()

        print(f"📖 [ASYNC TASK] Found {len(chapters)} chapters")

        # Помечаем книгу как готовую
        # is_parsed теперь означает "ready for on-demand extraction"
        book.is_processing = False
        book.is_parsed = True
        book.parsing_progress = 100
        await db.commit()

        # Инвалидируем кэш
        try:
            from app.core.cache import cache_manager
            print(f"[CACHE] Invalidating book list cache for user {book.user_id}")
            pattern = f"user:{book.user_id}:books:*"
            deleted_count = await cache_manager.delete_pattern(pattern)
            print(f"[CACHE] Cache invalidated ({deleted_count} keys deleted)")
        except Exception as e:
            print(f"[CACHE ERROR] Failed to invalidate cache: {str(e)}")

        result = {
            "book_id": str(book_id),
            "status": "completed",
            "chapters_count": len(chapters),
            "llm_available": llm_available,
            "extraction_mode": "on_demand",
            "message": "Book ready for on-demand description extraction via LLM"
        }

        print(f"🎉 [ASYNC TASK] Final result: {result}")
        return result


@celery_app.task(name="generate_image_for_text")
def generate_image_for_text_task(
    text: str,
    chapter_id_str: str,
    user_id_str: str,
    description_type: str = "location"
) -> Dict[str, Any]:
    """
    Генерация изображения для текстового описания.

    После удаления NLP: изображения генерируются напрямую из текста,
    без сохранения в таблицу descriptions.

    Args:
        text: Текст описания для генерации
        chapter_id_str: String ID главы
        user_id_str: String ID пользователя
        description_type: Тип описания (location, character, atmosphere)

    Returns:
        Результат генерации
    """
    try:
        logger.info(f"Starting image generation for chapter {chapter_id_str}")

        result = _run_async_task(
            _generate_image_for_text_async(text, chapter_id_str, user_id_str, description_type)
        )

        logger.info(f"Image generation completed for chapter {chapter_id_str}")
        return result

    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        return {"chapter_id": chapter_id_str, "status": "failed", "error": str(e)}


async def _generate_image_for_text_async(
    text: str,
    chapter_id_str: str,
    user_id_str: str,
    description_type: str
) -> Dict[str, Any]:
    """Асинхронная функция генерации изображения из текста."""
    async with AsyncSessionLocal() as db:
        user_id = UUID(user_id_str)
        chapter_id = UUID(chapter_id_str)

        try:
            # Генерируем изображение напрямую
            generation_result = await image_generator_service.generate_image_from_text(
                text=text,
                description_type=description_type,
                user_id=str(user_id),
            )

            if generation_result.success:
                # Сохраняем результат
                from app.models.image import GeneratedImage

                generated_image = GeneratedImage(
                    chapter_id=chapter_id,
                    user_id=user_id,
                    image_url=generation_result.image_url,
                    local_path=generation_result.local_path,
                    generation_prompt=text[:500],  # Сохраняем начало текста
                    description_text=text,  # Денормализованное поле
                    description_type=description_type,
                    generation_time_seconds=generation_result.generation_time_seconds,
                )

                db.add(generated_image)
                await db.commit()
                await db.refresh(generated_image)

                return {
                    "id": str(generated_image.id),
                    "chapter_id": chapter_id_str,
                    "image_url": generation_result.image_url,
                    "generation_time": generation_result.generation_time_seconds,
                    "status": "success"
                }
            else:
                return {
                    "chapter_id": chapter_id_str,
                    "status": "failed",
                    "error": generation_result.error_message
                }

        except Exception as e:
            logger.error(f"Error generating image for chapter {chapter_id_str}: {str(e)}")
            return {
                "chapter_id": chapter_id_str,
                "status": "failed",
                "error": str(e)
            }


@celery_app.task(name="cleanup_old_images")
def cleanup_old_images_task(days_old: int = 30) -> Dict[str, Any]:
    """
    Очистка старых сгенерированных изображений.

    Args:
        days_old: Удалить изображения старше указанного количества дней

    Returns:
        Количество удаленных изображений
    """
    try:
        logger.info(f"Starting cleanup of images older than {days_old} days")

        result = _run_async_task(_cleanup_old_images_async(days_old))

        logger.info("Image cleanup completed")
        return result

    except Exception as e:
        logger.error(f"Error in image cleanup: {str(e)}")
        return {"status": "failed", "error": str(e)}


async def _cleanup_old_images_async(days_old: int) -> Dict[str, Any]:
    """Асинхронная функция очистки старых изображений."""
    from datetime import timedelta
    import os
    from app.models.image import GeneratedImage

    async with AsyncSessionLocal() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)

        old_images_result = await db.execute(
            select(GeneratedImage).where(GeneratedImage.created_at < cutoff_date)
        )
        old_images = old_images_result.scalars().all()

        deleted_files = 0
        deleted_records = 0

        for image in old_images:
            try:
                if image.local_path and os.path.exists(image.local_path):
                    os.unlink(image.local_path)
                    deleted_files += 1

                await db.delete(image)
                deleted_records += 1

            except Exception as e:
                logger.error(f"Error deleting image {image.id}: {str(e)}")
                continue

        await db.commit()

        return {
            "status": "completed",
            "deleted_files": deleted_files,
            "deleted_records": deleted_records,
            "cutoff_date": cutoff_date.isoformat(),
        }


@celery_app.task(name="health_check")
def health_check_task() -> str:
    """Проверка работоспособности Celery worker."""
    return "Celery is working!"


@celery_app.task(name="system_stats")
def system_stats_task() -> Dict[str, Any]:
    """Получение системной статистики для мониторинга."""
    try:
        result = _run_async_task(_get_system_stats_async())
        return result

    except Exception as e:
        logger.error(f"Error getting system stats: {str(e)}")
        return {"status": "failed", "error": str(e)}


async def _get_system_stats_async() -> Dict[str, Any]:
    """Асинхронная функция получения системной статистики."""
    from sqlalchemy import func
    from app.models.image import GeneratedImage

    async with AsyncSessionLocal() as db:
        # Общее количество книг
        books_count = await db.execute(select(func.count(Book.id)))
        total_books = books_count.scalar()

        # Общее количество глав
        chapters_count = await db.execute(select(func.count(Chapter.id)))
        total_chapters = chapters_count.scalar()

        # Общее количество сгенерированных изображений
        images_count = await db.execute(select(func.count(GeneratedImage.id)))
        total_images = images_count.scalar()

        # Проверяем LLM
        from app.services.langextract_processor import LangExtractProcessor
        processor = LangExtractProcessor()
        llm_available = processor.is_available()

        return {
            "status": "operational",
            "total_books": total_books,
            "total_chapters": total_chapters,
            "total_images": total_images,
            "llm_available": llm_available,
            "extraction_mode": "on_demand",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

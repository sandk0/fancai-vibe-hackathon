"""
Background tasks for BookReader AI.
Фоновые задачи для BookReader AI.
"""

from app.core.celery_app import celery_app
import asyncio
from typing import Dict, Any, List
import logging
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.description import Description, DescriptionType

# Lazy import to avoid loading spaCy model at startup
# from app.services.nlp_processor import nlp_processor
from app.services.image_generator import image_generator_service

# Optional imports for optimization (graceful fallback)
try:
    import psutil  # noqa: F401
    import gc  # noqa: F401

    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

try:
    from app.services.optimized_parser import optimized_parser  # noqa: F401

    USE_OPTIMIZED_PARSER = True
except ImportError:
    USE_OPTIMIZED_PARSER = False

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
    Асинхронная обработка книги: парсинг глав и извлечение описаний.

    Args:
        book_id_str: String ID книги для обработки (UUID)

    Returns:
        Результат обработки с количеством найденных описаний
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
    """Асинхронная функция обработки книги."""
    async with AsyncSessionLocal() as db:
        print(f"🔍 [ASYNC TASK] Starting async processing for book {book_id}")

        # Получаем книгу
        book_result = await db.execute(select(Book).where(Book.id == book_id))
        book = book_result.scalar_one_or_none()

        if not book:
            error_msg = f"Book with id {book_id} not found"
            print(f"❌ [ASYNC TASK] {error_msg}")
            raise ValueError(error_msg)

        print(f"📚 [ASYNC TASK] Found book: {book.title} by {book.author}")

        # Получаем главы для обработки
        chapters_result = await db.execute(
            select(Chapter)
            .where(Chapter.book_id == book_id)
            .order_by(Chapter.chapter_number)
        )
        chapters = chapters_result.scalars().all()

        print(f"📖 [ASYNC TASK] Found {len(chapters)} chapters to process")

        total_descriptions = 0
        processed_chapters = 0

        # Обрабатываем каждую главу
        for chapter in chapters:
            try:
                print(
                    f"🔄 [ASYNC TASK] Processing chapter {chapter.chapter_number}: {chapter.title}"
                )
                logger.info(
                    f"Processing chapter {chapter.chapter_number} of book {book_id}"
                )

                # Извлекаем описания из текста главы (с ленивой загрузкой)
                from app.services.multi_nlp_manager import multi_nlp_manager

                print(
                    f"📝 [ASYNC TASK] Chapter content length: {len(chapter.content)} chars"
                )

                # Инициализируем если нужно
                if (
                    not hasattr(multi_nlp_manager, "_initialized")
                    or not multi_nlp_manager._initialized
                ):
                    print("🧠 [ASYNC TASK] Initializing multi NLP manager...")
                    await multi_nlp_manager.initialize()

                print(
                    f"🧠 [ASYNC TASK] Multi-NLP manager initialized: {multi_nlp_manager._initialized}"
                )

                # Извлекаем описания
                result = await multi_nlp_manager.extract_descriptions(
                    text=chapter.content,
                    chapter_id=str(chapter.id),
                    processor_name=None,  # Используем настройки по умолчанию
                )
                descriptions = result.descriptions

                print(f"🔍 [ASYNC TASK] NLP extracted {len(descriptions)} descriptions")
                if descriptions:
                    print(f"🔍 [ASYNC TASK] First description sample: {descriptions[0]}")

                # Сохраняем описания в базе данных
                for i, desc_data in enumerate(descriptions):
                    print(
                        f"💾 [ASYNC TASK] Saving description {i+1}/{len(descriptions)}: type={desc_data['type']}"
                    )

                    # Конвертируем строку типа в enum
                    try:
                        desc_type = DescriptionType(desc_data["type"])
                    except ValueError:
                        print(
                            f"⚠️ [ASYNC TASK] Invalid description type '{desc_data['type']}', skipping"
                        )
                        continue

                    description = Description(
                        chapter_id=chapter.id,
                        type=desc_type,  # Используем enum вместо строки
                        content=desc_data["content"],
                        context=desc_data.get("context", ""),
                        confidence_score=desc_data["confidence_score"],
                        position_in_chapter=desc_data.get("position_in_chapter", 0),
                        word_count=desc_data.get(
                            "word_count", len(desc_data["content"].split())
                        ),
                        priority_score=desc_data["priority_score"],
                        entities_mentioned=", ".join(desc_data["entities_mentioned"])
                        if desc_data.get("entities_mentioned")
                        else "",
                    )
                    db.add(description)
                    print(
                        f"✅ [ASYNC TASK] Added description to session: {description.content[:50]}..."
                    )

                print(
                    f"💾 [ASYNC TASK] Committing {len(descriptions)} descriptions to database..."
                )
                await db.commit()
                print("✅ [ASYNC TASK] Successfully committed descriptions")

                total_descriptions += len(descriptions)
                processed_chapters += 1

                # Обновляем прогресс парсинга главы
                chapter.is_description_parsed = True
                chapter.descriptions_found = len(descriptions)
                chapter.parsing_progress = 100.0

                # Обновляем прогресс парсинга книги
                book.parsing_progress = int((processed_chapters / len(chapters)) * 100)
                await db.commit()

                print(
                    f"✅ [ASYNC TASK] Chapter {chapter.chapter_number} completed: {len(descriptions)} descriptions"
                )
                logger.info(
                    f"Found {len(descriptions)} descriptions in chapter {chapter.chapter_number}"
                )

            except Exception as e:
                error_msg = (
                    f"Error processing chapter {chapter.chapter_number}: {str(e)}"
                )
                print(f"❌ [ASYNC TASK] {error_msg}")
                logger.error(error_msg)
                import traceback

                print(
                    f"🔍 [ASYNC TASK] Chapter error traceback: {traceback.format_exc()}"
                )
                # Продолжаем обработку других глав
                continue

        # Помечаем книгу как обработанную
        print(
            f"🏁 [ASYNC TASK] Marking book as parsed: {total_descriptions} total descriptions"
        )
        book.is_parsed = True
        book.parsing_progress = 100
        await db.commit()

        result = {
            "book_id": str(book_id),
            "status": "completed",
            "descriptions_found": total_descriptions,
            "chapters_processed": processed_chapters,
            "total_chapters": len(chapters),
        }

        print(f"🎉 [ASYNC TASK] Final result: {result}")
        return result


@celery_app.task(name="generate_images")
def generate_images_task(
    description_ids: List[str], user_id_str: str
) -> Dict[str, Any]:
    """
    Генерация изображений для списка описаний.

    Args:
        description_ids: Список string ID описаний для генерации
        user_id_str: String ID пользователя

    Returns:
        Результат генерации с количеством созданных изображений
    """
    try:
        logger.info(
            f"Starting image generation for {len(description_ids)} descriptions"
        )

        result = _run_async_task(_generate_images_async(description_ids, user_id_str))

        logger.info(
            f"Image generation completed for {len(description_ids)} descriptions"
        )
        return result

    except Exception as e:
        logger.error(f"Error generating images: {str(e)}")
        return {"description_ids": description_ids, "status": "failed", "error": str(e)}


async def _generate_images_async(
    description_ids: List[str], user_id_str: str
) -> Dict[str, Any]:
    """Асинхронная функция генерации изображений."""
    async with AsyncSessionLocal() as db:
        user_id = UUID(user_id_str)
        images_generated = 0
        failed_generations = 0
        generated_images = []

        for desc_id_str in description_ids:
            try:
                desc_id = UUID(desc_id_str)

                # Получаем описание
                desc_result = await db.execute(
                    select(Description).where(Description.id == desc_id)
                )
                description = desc_result.scalar_one_or_none()

                if not description:
                    logger.warning(f"Description {desc_id} not found")
                    failed_generations += 1
                    continue

                logger.info(
                    f"Generating image for description {desc_id}: {description.type.value}"
                )

                # Генерируем изображение через сервис
                generation_result = (
                    await image_generator_service.generate_image_for_description(
                        description=description,
                        user_id=str(user_id),
                        custom_style=None,  # Используем стиль по умолчанию
                    )
                )

                if generation_result.success:
                    # Сохраняем результат в базе данных
                    from app.models.image import GeneratedImage

                    generated_image = GeneratedImage(
                        description_id=description.id,
                        user_id=user_id,
                        image_url=generation_result.image_url,
                        local_path=generation_result.local_path,
                        generation_prompt="auto-generated",
                        generation_time_seconds=generation_result.generation_time_seconds,
                    )

                    db.add(generated_image)
                    await db.commit()
                    await db.refresh(generated_image)

                    generated_images.append(
                        {
                            "id": str(generated_image.id),
                            "description_id": str(description.id),
                            "image_url": generation_result.image_url,
                            "generation_time": generation_result.generation_time_seconds,
                        }
                    )

                    images_generated += 1
                    logger.info(
                        f"Successfully generated image for description {desc_id}"
                    )

                    # Обновляем флаг генерации в описании
                    description.image_generated = True
                    await db.commit()

                else:
                    failed_generations += 1
                    logger.error(
                        f"Failed to generate image for description {desc_id}: {generation_result.error_message}"
                    )

            except Exception as e:
                failed_generations += 1
                logger.error(f"Error processing description {desc_id_str}: {str(e)}")
                continue

        return {
            "description_ids": description_ids,
            "user_id": user_id_str,
            "status": "completed",
            "images_generated": images_generated,
            "failed_generations": failed_generations,
            "generated_images": generated_images,
            "total_processed": len(description_ids),
        }


@celery_app.task(name="batch_generate_for_book")
def batch_generate_for_book_task(
    book_id_str: str, user_id_str: str, max_images: int = 10
) -> Dict[str, Any]:
    """
    Пакетная генерация изображений для всех подходящих описаний книги.

    Args:
        book_id_str: String ID книги
        user_id_str: String ID пользователя
        max_images: Максимальное количество изображений для генерации

    Returns:
        Результат пакетной генерации
    """
    try:
        logger.info(
            f"Starting batch generation for book {book_id_str}, max_images={max_images}"
        )

        result = _run_async_task(
            _batch_generate_for_book_async(book_id_str, user_id_str, max_images)
        )

        logger.info(f"Batch generation completed for book {book_id_str}")
        return result

    except Exception as e:
        logger.error(f"Error in batch generation for book {book_id_str}: {str(e)}")
        return {"book_id": book_id_str, "status": "failed", "error": str(e)}


async def _batch_generate_for_book_async(
    book_id_str: str, user_id_str: str, max_images: int
) -> Dict[str, Any]:
    """Асинхронная функция пакетной генерации для книги."""
    async with AsyncSessionLocal() as db:
        book_id = UUID(book_id_str)

        # Получаем топ описания по приоритету, исключая уже сгенерированные
        descriptions_query = (
            select(Description)
            .join(Chapter)
            .where(Chapter.book_id == book_id)
            .where(Description.is_suitable_for_generation is True)
            .where(Description.image_generated is False)
            .order_by(Description.priority_score.desc())
            .limit(max_images)
        )

        descriptions_result = await db.execute(descriptions_query)
        descriptions = descriptions_result.scalars().all()

        if not descriptions:
            return {
                "book_id": book_id_str,
                "status": "completed",
                "message": "No suitable descriptions found for generation",
                "images_generated": 0,
            }

        # Запускаем генерацию для найденных описаний
        description_ids = [str(d.id) for d in descriptions]

        return await _generate_images_async(description_ids, user_id_str)


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
    from datetime import datetime, timedelta, timezone
    import os
    from app.models.image import GeneratedImage

    async with AsyncSessionLocal() as db:
        # Находим старые изображения
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)

        old_images_result = await db.execute(
            select(GeneratedImage).where(GeneratedImage.created_at < cutoff_date)
        )
        old_images = old_images_result.scalars().all()

        deleted_files = 0
        deleted_records = 0

        for image in old_images:
            try:
                # Удаляем локальный файл если существует
                if image.local_path and os.path.exists(image.local_path):
                    os.unlink(image.local_path)
                    deleted_files += 1

                # Удаляем запись из БД
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

        # Общее количество описаний
        descriptions_count = await db.execute(select(func.count(Description.id)))
        total_descriptions = descriptions_count.scalar()

        # Общее количество сгенерированных изображений
        images_count = await db.execute(select(func.count(GeneratedImage.id)))
        total_images = images_count.scalar()

        # Количество обработанных книг
        processed_books_count = await db.execute(
            select(func.count(Book.id)).where(Book.is_parsed is True)
        )
        processed_books = processed_books_count.scalar()

        return {
            "status": "operational",
            "total_books": total_books,
            "processed_books": processed_books,
            "total_descriptions": total_descriptions,
            "total_images": total_images,
            "processing_rate": round((processed_books / total_books * 100), 2)
            if total_books > 0
            else 0.0,
            "generation_rate": round((total_images / total_descriptions * 100), 2)
            if total_descriptions > 0
            else 0.0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

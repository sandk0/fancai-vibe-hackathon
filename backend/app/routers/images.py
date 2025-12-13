"""
API роуты для генерации изображений в BookReader AI.

Содержит endpoints для генерации изображений по описаниям из книг
с использованием AI и управления очередью генерации.
"""

from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, Any, List, Optional
from uuid import UUID
from pydantic import BaseModel
from pathlib import Path
import tempfile
import os

from ..core.database import get_database_session
from ..core.auth import get_current_active_user, get_current_admin_user
from ..services.image_generator import image_generator_service
from ..models.user import User
from ..models.book import Book
from ..models.chapter import Chapter
from ..models.description import Description, DescriptionType
from ..models.image import GeneratedImage
from ..schemas.responses.images import (
    ImageGenerationStatusResponse,
    UserImageStatsResponse,
    ImageGenerationSuccessResponse,
    QueueStats,
    UserGenerationInfo,
    APIProviderInfo,
)
from ..schemas.responses import ImageGenerationTaskResponse


router = APIRouter()

# Directory where Imagen saves images (persistent storage)
# Uses /app/storage which is mounted as Docker volume for persistence
GENERATED_IMAGES_DIR = Path("/app/storage/generated_images")


@router.get("/images/file/{filename}")
async def get_generated_image_file(filename: str):
    """
    Serve generated image file.

    This endpoint serves image files from the generated_images directory.
    No authentication required for image access (images are accessed by random filename).
    """
    # Validate filename (prevent path traversal)
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename"
        )

    # Check if file exists
    file_path = GENERATED_IMAGES_DIR / filename
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Use content_disposition_type="inline" to display image in browser
    # instead of forcing download (which happens with filename parameter)
    return FileResponse(
        path=str(file_path),
        media_type="image/png",
        content_disposition_type="inline"
    )


# Pydantic модели для запросов
class ImageGenerationParams(BaseModel):
    """Параметры генерации изображения."""

    style_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    width: Optional[int] = 1024
    height: Optional[int] = 768


class BatchGenerationRequest(BaseModel):
    """Запрос на пакетную генерацию изображений."""

    chapter_id: UUID
    max_images: int = 5
    style_prompt: Optional[str] = None
    description_types: Optional[List[DescriptionType]] = None


@router.get(
    "/images/generation/status",
    response_model=ImageGenerationStatusResponse,
    summary="Get image generation service status",
    description="Returns current status of image generation service including queue stats, user quota, and API info"
)
async def get_generation_status(
    current_user: User = Depends(get_current_active_user),
) -> ImageGenerationStatusResponse:
    """
    Получение статуса системы генерации изображений.

    Включает:
    - Статус сервиса (operational, degraded, down)
    - Статистику очереди генерации
    - Информацию о квоте пользователя
    - Информацию об API провайдере

    Args:
        current_user: Текущий авторизованный пользователь

    Returns:
        ImageGenerationStatusResponse: Полная информация о статусе генерации
    """
    stats = await image_generator_service.get_generation_stats()

    # Map service stats to QueueStats
    queue_stats = QueueStats(
        pending_tasks=stats.get("queue_size", 0),
        processing_tasks=1 if stats.get("is_processing", False) else 0,
        completed_today=0,  # TODO: implement tracking
        failed_today=0,  # TODO: implement tracking
    )

    # User generation info
    user_info = UserGenerationInfo(
        id=current_user.id,
        can_generate=current_user.is_active,
        remaining_quota=None,  # None = unlimited for now
    )

    # API provider info
    api_info = APIProviderInfo(
        provider="Google Imagen 4",
        supported_formats=["PNG"],
        max_resolution="1024x1024",
        estimated_time_per_image="5-15 seconds",
    )

    return ImageGenerationStatusResponse(
        status="operational",
        queue_stats=queue_stats,
        user_info=user_info,
        api_info=api_info,
    )


@router.get(
    "/images/user/stats",
    response_model=UserImageStatsResponse,
    summary="Get user's image generation statistics",
    description="Returns statistics about generated images and found descriptions for the current user"
)
async def get_user_images_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> UserImageStatsResponse:
    """
    Получение статистики изображений и описаний пользователя.

    Подсчитывает:
    - Реальное количество сгенерированных изображений
    - Общее количество найденных описаний
    - Распределение изображений по типам описаний

    Args:
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        UserImageStatsResponse: Статистика генерации изображений пользователя
    """
    # Подсчитываем реальное количество сгенерированных изображений
    images_count_query = await db.execute(
        select(func.count(GeneratedImage.id))
        .join(Description, GeneratedImage.description_id == Description.id)
        .join(Chapter, Description.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(Book.user_id == current_user.id)
    )
    total_images = images_count_query.scalar() or 0

    # Подсчитываем общее количество найденных описаний
    descriptions_count_query = await db.execute(
        select(func.count(Description.id))
        .join(Chapter, Description.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(Book.user_id == current_user.id)
    )
    total_descriptions = descriptions_count_query.scalar() or 0

    # Подсчитываем изображения по типам описаний
    images_by_type_query = await db.execute(
        select(Description.type, func.count(GeneratedImage.id))
        .join(GeneratedImage, GeneratedImage.description_id == Description.id)
        .join(Chapter, Description.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(Book.user_id == current_user.id)
        .group_by(Description.type)
    )

    images_by_type = {
        desc_type.value: count
        for desc_type, count in images_by_type_query.fetchall()
    }

    return UserImageStatsResponse(
        total_images_generated=total_images,
        total_descriptions_found=total_descriptions,
        images_by_type=images_by_type,
    )


@router.post(
    "/images/generate/description/{description_id}",
    response_model=ImageGenerationSuccessResponse,
    status_code=201,
    summary="Generate image for description",
    description="Generates an AI image for a specific book description"
)
async def generate_image_for_description(
    description_id: UUID,
    params: ImageGenerationParams,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> ImageGenerationSuccessResponse:
    """
    Генерирует изображение для конкретного описания.

    Синхронно генерирует изображение через Google Imagen 4 API и
    сохраняет результат в базу данных.

    Args:
        description_id: ID описания из базы данных
        params: Параметры генерации (style_prompt, width, height, etc.)
        background_tasks: Фоновые задачи для асинхронной обработки
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        ImageGenerationSuccessResponse: Информация о сгенерированном изображении

    Raises:
        HTTPException 404: Description not found or access denied
        HTTPException 409: Image already exists for this description
        HTTPException 500: Image generation failed
    """
    # Получаем описание
    description_result = await db.execute(
        select(Description)
        .join(Chapter)
        .join(Book)
        .where(Description.id == description_id)
        .where(
            Book.user_id == current_user.id
        )  # Проверяем что книга принадлежит пользователю
    )
    description = description_result.scalar_one_or_none()

    if not description:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Description not found or access denied",
        )

    # Проверяем, не сгенерировано ли уже изображение для этого описания
    existing_image_result = await db.execute(
        select(GeneratedImage).where(GeneratedImage.description_id == description_id)
    )
    existing_image = existing_image_result.scalar_one_or_none()
    if existing_image:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Image already exists for this description",
        )

    try:
        # Генерируем изображение
        result = await image_generator_service.generate_image_for_description(
            description=description,
            user_id=str(current_user.id),
            custom_style=params.style_prompt,
        )

        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Image generation failed: {result.error_message}",
            )

        # Create HTTP URL from local_path (extract filename)
        filename = os.path.basename(result.local_path) if result.local_path else None
        http_url = f"/api/v1/images/file/{filename}" if filename else None

        # Сохраняем результат в базе данных
        generated_image = GeneratedImage(
            description_id=description.id,
            user_id=current_user.id,
            service_used="imagen",
            status="completed",
            image_url=http_url,  # Store HTTP URL instead of data URL
            local_path=result.local_path,
            prompt_used=result.prompt_used or params.style_prompt or "default",
            generation_time_seconds=result.generation_time_seconds,
        )

        db.add(generated_image)
        await db.commit()
        await db.refresh(generated_image)

        return ImageGenerationSuccessResponse(
            image_id=generated_image.id,
            description_id=description.id,
            image_url=http_url or result.image_url,
            generation_time=result.generation_time_seconds,
            status="completed",
            created_at=generated_image.created_at.isoformat(),
            message="Image generated successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during generation: {str(e)}",
        )


@router.post("/images/generate/chapter/{chapter_id}")
async def generate_images_for_chapter(
    chapter_id: UUID,
    request: BatchGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Генерирует изображения для всех подходящих описаний в главе.

    Args:
        chapter_id: ID главы
        request: Параметры пакетной генерации
        background_tasks: Фоновые задачи
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Информация о запущенной пакетной генерации
    """
    # Проверяем, что глава принадлежит пользователю
    chapter_result = await db.execute(
        select(Chapter)
        .join(Book)
        .where(Chapter.id == chapter_id)
        .where(Book.user_id == current_user.id)
    )
    chapter = chapter_result.scalar_one_or_none()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found or access denied",
        )

    # Получаем описания для генерации
    descriptions_query = select(Description).where(Description.chapter_id == chapter_id)

    # Фильтруем по типам описаний если указано
    if request.description_types:
        descriptions_query = descriptions_query.where(
            Description.type.in_(request.description_types)
        )

    descriptions_result = await db.execute(
        descriptions_query.order_by(Description.priority_score.desc())
    )
    all_descriptions = descriptions_result.scalars().all()

    if not all_descriptions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No descriptions found in this chapter",
        )

    # Исключаем описания, для которых уже есть изображения
    existing_images = await db.execute(
        select(GeneratedImage.description_id).where(
            GeneratedImage.description_id.in_([d.id for d in all_descriptions])
        )
    )
    existing_desc_ids = set(img_id for img_id, in existing_images.fetchall())

    descriptions_to_process = [
        d for d in all_descriptions if d.id not in existing_desc_ids
    ][: request.max_images]

    if not descriptions_to_process:
        return {
            "message": "All suitable descriptions already have images",
            "chapter_id": str(chapter_id),
            "processed": 0,
            "skipped": len(all_descriptions),
        }

    # Запускаем пакетную генерацию
    try:
        results = await image_generator_service.batch_generate_for_chapter(
            descriptions=descriptions_to_process,
            user_id=str(current_user.id),
            max_images=request.max_images,
        )

        # Сохраняем результаты в базе данных
        generated_images = []
        successful_generations = 0

        for i, result in enumerate(results):
            if result.success and i < len(descriptions_to_process):
                description = descriptions_to_process[i]

                # Create HTTP URL from local_path
                filename = os.path.basename(result.local_path) if result.local_path else None
                http_url = f"/api/v1/images/file/{filename}" if filename else None

                generated_image = GeneratedImage(
                    description_id=description.id,
                    user_id=current_user.id,
                    service_used="imagen",
                    status="completed",
                    image_url=http_url,  # Store HTTP URL instead of data URL
                    local_path=result.local_path,
                    prompt_used=result.prompt_used or request.style_prompt or "default",
                    generation_time_seconds=result.generation_time_seconds,
                )

                db.add(generated_image)
                generated_images.append(
                    {
                        "description_id": str(description.id),
                        "description_type": description.type.value,
                        "image_url": http_url or result.image_url,
                        "generation_time": result.generation_time_seconds,
                    }
                )
                successful_generations += 1

        await db.commit()

        return {
            "chapter_id": str(chapter_id),
            "total_descriptions": len(all_descriptions),
            "processed": len(descriptions_to_process),
            "successful": successful_generations,
            "failed": len(descriptions_to_process) - successful_generations,
            "images": generated_images,
            "message": f"Generated {successful_generations} images for chapter",
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch generation failed: {str(e)}",
        )


@router.get("/images/description/{description_id}")
async def get_image_for_description(
    description_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает изображение для конкретного описания.

    Args:
        description_id: ID описания
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Данные изображения или 404 если не найдено

    Raises:
        HTTPException 404: Описание или изображение не найдено
    """
    # Получаем изображение с описанием и главой
    query = (
        select(GeneratedImage, Description, Chapter)
        .join(Description, GeneratedImage.description_id == Description.id)
        .join(Chapter, Description.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(Description.id == description_id)
        .where(Book.user_id == current_user.id)
    )

    result = await db.execute(query)
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found for this description",
        )

    generated_image, description, chapter = row

    return {
        "id": str(generated_image.id),
        "image_url": generated_image.image_url,
        "created_at": generated_image.created_at.isoformat(),
        "generation_time_seconds": generated_image.generation_time_seconds,
        "service_used": generated_image.service_used or "imagen",
        "status": generated_image.status or "completed",
        "is_moderated": generated_image.is_moderated or False,
        "view_count": generated_image.view_count or 0,
        "download_count": generated_image.download_count or 0,
        "description": {
            "id": str(description.id),
            "type": description.type.value,
            "text": description.content,
            "content": (
                description.content[:100] + "..."
                if len(description.content) > 100
                else description.content
            ),
            "confidence_score": description.confidence_score,
            "priority_score": description.priority_score,
        },
        "chapter": {
            "id": str(chapter.id),
            "number": chapter.chapter_number,
            "title": chapter.title,
        },
    }


@router.get("/images/book/{book_id}")
async def get_book_images(
    book_id: UUID,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает все сгенерированные изображения для книги.

    Args:
        book_id: ID книги
        skip: Количество изображений для пропуска
        limit: Максимальное количество изображений
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Список изображений книги
    """
    # Проверяем доступ к книге
    book_result = await db.execute(
        select(Book).where(Book.id == book_id).where(Book.user_id == current_user.id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found or access denied",
        )

    # Получаем изображения
    images_query = (
        select(GeneratedImage, Description, Chapter)
        .join(Description, GeneratedImage.description_id == Description.id)
        .join(Chapter, Description.chapter_id == Chapter.id)
        .where(Chapter.book_id == book_id)
        .order_by(Chapter.chapter_number, Description.priority_score.desc())
        .offset(skip)
        .limit(limit)
    )

    images_result = await db.execute(images_query)
    images_data = []

    for generated_image, description, chapter in images_result.fetchall():
        images_data.append(
            {
                "id": str(generated_image.id),
                "image_url": generated_image.image_url,
                "created_at": generated_image.created_at.isoformat(),
                "generation_time_seconds": generated_image.generation_time_seconds,
                "description": {
                    "id": str(description.id),
                    "type": description.type.value,
                    "text": description.content,  # Полный текст
                    "content": (
                        description.content[:100] + "..."
                        if len(description.content) > 100
                        else description.content
                    ),  # Сокращенный для превью
                    "confidence_score": description.confidence_score,
                    "priority_score": description.priority_score,
                    "entities_mentioned": description.entities_mentioned,
                },
                "chapter": {
                    "id": str(chapter.id),
                    "number": chapter.chapter_number,
                    "title": chapter.title,
                },
            }
        )

    return {
        "book_id": str(book_id),
        "book_title": book.title,
        "images": images_data,
        "pagination": {"skip": skip, "limit": limit, "total_found": len(images_data)},
    }


@router.delete("/images/{image_id}")
async def delete_generated_image(
    image_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, str]:
    """
    Удаляет сгенерированное изображение.

    Args:
        image_id: ID изображения
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Сообщение об успешном удалении
    """
    # Проверяем, что изображение принадлежит пользователю
    image_result = await db.execute(
        select(GeneratedImage).where(
            GeneratedImage.id == image_id, GeneratedImage.user_id == current_user.id
        )
    )
    image = image_result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or access denied",
        )

    try:
        # Удаляем локальный файл если он существует
        if image.local_path:
            import os

            try:
                os.unlink(image.local_path)
            except OSError:
                pass  # Файл уже удален или недоступен

        # Удаляем запись из базы данных
        await db.delete(image)
        await db.commit()

        return {"message": "Image deleted successfully"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete image: {str(e)}",
        )


@router.post("/images/regenerate/{image_id}")
async def regenerate_image(
    image_id: UUID,
    params: ImageGenerationParams,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Перегенерирует существующее изображение с новыми параметрами.

    Args:
        image_id: ID существующего изображения
        params: Новые параметры генерации
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Информация о новом сгенерированном изображении
    """
    # Получаем существующее изображение с проверкой прав доступа
    existing_image_result = await db.execute(
        select(GeneratedImage, Description)
        .join(Description, GeneratedImage.description_id == Description.id)
        .join(Chapter, Description.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(GeneratedImage.id == image_id)
        .where(Book.user_id == current_user.id)
    )

    result_row = existing_image_result.first()
    if not result_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or access denied",
        )

    existing_image, description = result_row

    try:
        # Удаляем старый локальный файл если существует
        if existing_image.local_path:
            import os

            try:
                os.unlink(existing_image.local_path)
            except OSError:
                pass  # Файл уже удален или недоступен

        # Генерируем новое изображение
        generation_result = (
            await image_generator_service.generate_image_for_description(
                description=description,
                user_id=str(current_user.id),
                custom_style=params.style_prompt,
            )
        )

        if not generation_result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Image regeneration failed: {generation_result.error_message}",
            )

        # Обновляем существующую запись в базе данных
        existing_image.image_url = generation_result.image_url
        existing_image.local_path = generation_result.local_path
        existing_image.prompt_used = params.style_prompt or "default"
        existing_image.generation_time_seconds = (
            generation_result.generation_time_seconds
        )
        existing_image.updated_at = func.now()  # Обновляем время изменения

        await db.commit()
        await db.refresh(existing_image)

        return {
            "image_id": str(existing_image.id),
            "description_id": str(description.id),
            "image_url": generation_result.image_url,
            "generation_time": generation_result.generation_time_seconds,
            "status": "regenerated",
            "updated_at": existing_image.updated_at.isoformat(),
            "message": "Image regenerated successfully",
            "description": {
                "id": str(description.id),
                "type": description.type.value,
                "text": description.content,
                "content": (
                    description.content[:100] + "..."
                    if len(description.content) > 100
                    else description.content
                ),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during regeneration: {str(e)}",
        )


@router.get("/images/admin/stats")
async def get_admin_image_stats(
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получение статистики генерации изображений для администраторов.

    Args:
        current_admin: Текущий администратор
        db: Сессия базы данных

    Returns:
        Подробная статистика системы генерации
    """
    from sqlalchemy import func

    # Общее количество сгенерированных изображений
    total_images = await db.execute(select(func.count(GeneratedImage.id)))
    total_count = total_images.scalar()

    # Статистика по типам описаний
    type_stats = await db.execute(
        select(Description.type, func.count(GeneratedImage.id).label("count"))
        .join(GeneratedImage, GeneratedImage.description_id == Description.id)
        .group_by(Description.type)
    )

    type_distribution = {row.type.value: row.count for row in type_stats.fetchall()}

    # Среднее время генерации
    avg_time = await db.execute(
        select(func.avg(GeneratedImage.generation_time_seconds)).where(
            GeneratedImage.generation_time_seconds.is_not(None)
        )
    )
    average_generation_time = avg_time.scalar() or 0

    # Получаем статистику сервиса
    service_stats = await image_generator_service.get_generation_stats()

    return {
        "total_images_generated": total_count,
        "generation_by_type": type_distribution,
        "performance": {
            "average_generation_time_seconds": round(average_generation_time, 2),
            "current_queue_size": service_stats["queue_size"],
            "is_processing": service_stats["is_processing"],
        },
        "system_status": {
            "service_operational": True,
            "api_provider": "Google Imagen 4",
            "supported_types": service_stats["supported_types"],
        },
    }

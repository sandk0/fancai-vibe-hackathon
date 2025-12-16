"""
API роуты для генерации изображений в BookReader AI.

Содержит endpoints для генерации изображений по описаниям из книг
с использованием AI и управления очередью генерации.

NLP REMOVAL (December 2025):
- Description model removed
- Images generated from text descriptions extracted on-demand via LLM
- GeneratedImage linked to chapters with description_text field
"""

from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, Any, List, Optional
from uuid import UUID
from pydantic import BaseModel
from pathlib import Path
from enum import Enum
import os

from ..core.database import get_database_session
from ..core.auth import get_current_active_user, get_current_admin_user
from ..services.image_generator import image_generator_service
from ..models.user import User
from ..models.book import Book
from ..models.chapter import Chapter
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


# DescriptionType enum defined locally after NLP removal
class DescriptionType(str, Enum):
    """Types of descriptions for image generation."""
    LOCATION = "location"
    CHARACTER = "character"
    ATMOSPHERE = "atmosphere"


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


class TextImageGenerationRequest(BaseModel):
    """Request for generating image from text description."""

    description_text: str
    description_type: DescriptionType = DescriptionType.LOCATION
    chapter_id: Optional[UUID] = None
    style_prompt: Optional[str] = None


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
    description="Returns statistics about generated images for the current user"
)
async def get_user_images_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> UserImageStatsResponse:
    """
    Получение статистики изображений пользователя.

    NLP REMOVAL: total_descriptions_found is now 0 (descriptions extracted on-demand)

    Args:
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        UserImageStatsResponse: Статистика генерации изображений пользователя
    """
    # Подсчитываем реальное количество сгенерированных изображений
    images_count_query = await db.execute(
        select(func.count(GeneratedImage.id))
        .where(GeneratedImage.user_id == current_user.id)
    )
    total_images = images_count_query.scalar() or 0

    # NLP REMOVAL: Descriptions extracted on-demand
    total_descriptions = 0

    # Подсчитываем изображения по типам описаний
    images_by_type_query = await db.execute(
        select(GeneratedImage.description_type, func.count(GeneratedImage.id))
        .where(GeneratedImage.user_id == current_user.id)
        .where(GeneratedImage.description_type.is_not(None))
        .group_by(GeneratedImage.description_type)
    )

    images_by_type = {
        desc_type: count
        for desc_type, count in images_by_type_query.fetchall()
    }

    return UserImageStatsResponse(
        total_images_generated=total_images,
        total_descriptions_found=total_descriptions,
        images_by_type=images_by_type,
    )


@router.post(
    "/images/generate/text",
    response_model=ImageGenerationSuccessResponse,
    status_code=201,
    summary="Generate image from text description",
    description="Generates an AI image from a text description"
)
async def generate_image_from_text(
    request: TextImageGenerationRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> ImageGenerationSuccessResponse:
    """
    Генерирует изображение по текстовому описанию.

    NLP REMOVAL: New endpoint that generates images from text directly,
    without requiring Description model.

    Args:
        request: Параметры генерации (text, type, chapter_id, style)
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        ImageGenerationSuccessResponse: Информация о сгенерированном изображении
    """
    # If chapter_id provided, verify access
    chapter = None
    if request.chapter_id:
        chapter_result = await db.execute(
            select(Chapter)
            .join(Book)
            .where(Chapter.id == request.chapter_id)
            .where(Book.user_id == current_user.id)
        )
        chapter = chapter_result.scalar_one_or_none()
        if not chapter:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chapter not found or access denied",
            )

    try:
        # Generate image from text
        result = await image_generator_service.generate_image_from_text(
            text=request.description_text,
            description_type=request.description_type.value,
            custom_style=request.style_prompt,
        )

        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Image generation failed: {result.error_message}",
            )

        # Create HTTP URL from local_path (extract filename)
        filename = os.path.basename(result.local_path) if result.local_path else None
        http_url = f"/api/v1/images/file/{filename}" if filename else None

        # Save to database
        generated_image = GeneratedImage(
            user_id=current_user.id,
            chapter_id=request.chapter_id,
            description_text=request.description_text,
            description_type=request.description_type.value,
            service_used="imagen",
            status="completed",
            image_url=http_url,
            local_path=result.local_path,
            prompt_used=result.prompt_used or request.style_prompt or "default",
            generation_time_seconds=result.generation_time_seconds,
        )

        db.add(generated_image)
        await db.commit()
        await db.refresh(generated_image)

        return ImageGenerationSuccessResponse(
            image_id=generated_image.id,
            description_id=None,  # No description model anymore
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
    Extracts descriptions from chapter via LLM and generates images.

    NLP REMOVAL: Now uses LangExtract to get descriptions on-demand,
    then generates images for the extracted descriptions.

    Args:
        chapter_id: ID главы
        request: Параметры пакетной генерации
        background_tasks: Фоновые задачи
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Информация о запущенной пакетной генерации
    """
    # Verify chapter access
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

    # Get book for genre info
    book_result = await db.execute(select(Book).where(Book.id == chapter.book_id))
    book = book_result.scalar_one()

    # Use LangExtract to get descriptions on-demand
    try:
        from ..services.langextract_processor import LangExtractProcessor

        processor = LangExtractProcessor()
        if not processor.is_available():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="LLM extraction service not available. Check GOOGLE_API_KEY.",
            )

        # Extract descriptions from chapter content
        extraction_result = await processor.extract_descriptions(
            text=chapter.content,
            chapter_id=str(chapter_id)
        )

        descriptions = extraction_result.descriptions[:request.max_images]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract descriptions: {str(e)}",
        )

    if not descriptions:
        return {
            "message": "No descriptions found in this chapter",
            "chapter_id": str(chapter_id),
            "processed": 0,
            "skipped": 0,
        }

    # Generate images for extracted descriptions
    try:
        results = await image_generator_service.batch_generate_for_chapter(
            descriptions=descriptions,
            user_id=str(current_user.id),
            book_genre=book.genre,
            max_images=request.max_images,
        )

        # Save results to database
        generated_images = []
        successful_generations = 0

        for i, result in enumerate(results):
            if result.success and i < len(descriptions):
                desc = descriptions[i]

                # Create HTTP URL from local_path
                filename = os.path.basename(result.local_path) if result.local_path else None
                http_url = f"/api/v1/images/file/{filename}" if filename else None

                generated_image = GeneratedImage(
                    user_id=current_user.id,
                    chapter_id=chapter_id,
                    description_text=desc.get("content", ""),
                    description_type=desc.get("type", "location"),
                    service_used="imagen",
                    status="completed",
                    image_url=http_url,
                    local_path=result.local_path,
                    prompt_used=result.prompt_used or request.style_prompt or "default",
                    generation_time_seconds=result.generation_time_seconds,
                )

                db.add(generated_image)
                generated_images.append(
                    {
                        "description_text": desc.get("content", "")[:100] + "...",
                        "description_type": desc.get("type", "location"),
                        "image_url": http_url or result.image_url,
                        "generation_time": result.generation_time_seconds,
                    }
                )
                successful_generations += 1

        await db.commit()

        return {
            "chapter_id": str(chapter_id),
            "total_descriptions": len(descriptions),
            "processed": len(descriptions),
            "successful": successful_generations,
            "failed": len(descriptions) - successful_generations,
            "images": generated_images,
            "message": f"Generated {successful_generations} images for chapter",
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch generation failed: {str(e)}",
        )


@router.get("/images/{image_id}")
async def get_image(
    image_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Get image details by ID.

    Args:
        image_id: ID изображения
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Image details
    """
    # Get image with access check
    query = (
        select(GeneratedImage)
        .where(GeneratedImage.id == image_id)
        .where(GeneratedImage.user_id == current_user.id)
    )

    result = await db.execute(query)
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or access denied",
        )

    # Get chapter info if linked
    chapter_info = None
    if image.chapter_id:
        chapter_result = await db.execute(
            select(Chapter).where(Chapter.id == image.chapter_id)
        )
        chapter = chapter_result.scalar_one_or_none()
        if chapter:
            chapter_info = {
                "id": str(chapter.id),
                "number": chapter.chapter_number,
                "title": chapter.title,
            }

    return {
        "id": str(image.id),
        "image_url": image.image_url,
        "created_at": image.created_at.isoformat(),
        "generation_time_seconds": image.generation_time_seconds,
        "service_used": image.service_used or "imagen",
        "status": image.status or "completed",
        "is_moderated": image.is_moderated or False,
        "view_count": image.view_count or 0,
        "download_count": image.download_count or 0,
        "description_text": image.description_text,
        "description_type": image.description_type,
        "chapter": chapter_info,
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
    # Check book access
    book_result = await db.execute(
        select(Book).where(Book.id == book_id).where(Book.user_id == current_user.id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found or access denied",
        )

    # Get images linked to book's chapters
    images_query = (
        select(GeneratedImage, Chapter)
        .join(Chapter, GeneratedImage.chapter_id == Chapter.id)
        .where(Chapter.book_id == book_id)
        .order_by(Chapter.chapter_number)
        .offset(skip)
        .limit(limit)
    )

    images_result = await db.execute(images_query)
    images_data = []

    for generated_image, chapter in images_result.fetchall():
        images_data.append(
            {
                "id": str(generated_image.id),
                "image_url": generated_image.image_url,
                "created_at": generated_image.created_at.isoformat(),
                "generation_time_seconds": generated_image.generation_time_seconds,
                "description_text": generated_image.description_text,
                "description_type": generated_image.description_type,
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
    # Check access
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
        # Delete local file if exists
        if image.local_path:
            try:
                os.unlink(image.local_path)
            except OSError:
                pass  # File already deleted or inaccessible

        # Delete from database
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
    # Get existing image with access check
    existing_image_result = await db.execute(
        select(GeneratedImage)
        .where(GeneratedImage.id == image_id)
        .where(GeneratedImage.user_id == current_user.id)
    )

    existing_image = existing_image_result.scalar_one_or_none()
    if not existing_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or access denied",
        )

    try:
        # Delete old local file if exists
        if existing_image.local_path:
            try:
                os.unlink(existing_image.local_path)
            except OSError:
                pass

        # Generate new image
        generation_result = await image_generator_service.generate_image_from_text(
            text=existing_image.description_text or "",
            description_type=existing_image.description_type or "location",
            custom_style=params.style_prompt,
        )

        if not generation_result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Image regeneration failed: {generation_result.error_message}",
            )

        # Create HTTP URL from local_path
        filename = os.path.basename(generation_result.local_path) if generation_result.local_path else None
        http_url = f"/api/v1/images/file/{filename}" if filename else None

        # Update existing record
        existing_image.image_url = http_url or generation_result.image_url
        existing_image.local_path = generation_result.local_path
        existing_image.prompt_used = params.style_prompt or "default"
        existing_image.generation_time_seconds = generation_result.generation_time_seconds

        await db.commit()
        await db.refresh(existing_image)

        return {
            "image_id": str(existing_image.id),
            "image_url": existing_image.image_url,
            "generation_time": generation_result.generation_time_seconds,
            "status": "regenerated",
            "updated_at": existing_image.updated_at.isoformat() if existing_image.updated_at else None,
            "message": "Image regenerated successfully",
            "description_text": existing_image.description_text,
            "description_type": existing_image.description_type,
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
    # Total generated images
    total_images = await db.execute(select(func.count(GeneratedImage.id)))
    total_count = total_images.scalar()

    # Stats by description type
    type_stats = await db.execute(
        select(GeneratedImage.description_type, func.count(GeneratedImage.id).label("count"))
        .where(GeneratedImage.description_type.is_not(None))
        .group_by(GeneratedImage.description_type)
    )

    type_distribution = {row.description_type: row.count for row in type_stats.fetchall()}

    # Average generation time
    avg_time = await db.execute(
        select(func.avg(GeneratedImage.generation_time_seconds)).where(
            GeneratedImage.generation_time_seconds.is_not(None)
        )
    )
    average_generation_time = avg_time.scalar() or 0

    # Get service stats
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

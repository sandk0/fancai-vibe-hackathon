"""
API роуты для работы с описаниями в книгах BookReader AI.

Этот модуль содержит endpoints для управления описаниями:
- Получение описаний главы
- Извлечение новых описаний с помощью LLM (LangExtract)
- Статистика по описаниям
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, List
from uuid import UUID
from datetime import datetime

from ..core.database import get_database_session
from ..core.auth import get_current_active_user
from ..core.exceptions import (
    ChapterNotFoundException,
    BookNotFoundException,
)
from ..services.book import book_service
from ..services.langextract_processor import langextract_processor
from ..models.user import User
from ..models.description import Description, DescriptionType
from ..models.chapter import Chapter
from ..schemas.responses.descriptions import (
    ChapterDescriptionsResponse,
    ChapterMinimalInfo,
    NLPAnalysisResult,
)
from ..schemas.responses import DescriptionResponse, DescriptionListResponse


router = APIRouter()


@router.get(
    "/{book_id}/chapters/{chapter_number}/descriptions",
    response_model=ChapterDescriptionsResponse,
    summary="Get descriptions from chapter",
    description="Returns all extracted descriptions from a specific chapter"
)
async def get_chapter_descriptions(
    book_id: UUID,
    chapter_number: int,
    extract_new: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> ChapterDescriptionsResponse:
    """
    Получает описания для конкретной главы книги.

    Может либо вернуть существующие описания из БД, либо
    выполнить новый LLM анализ главы (extract_new=True).

    Args:
        book_id: ID книги
        chapter_number: Номер главы (1-indexed)
        extract_new: Извлечь новые описания (перепарсить главу)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        ChapterDescriptionsResponse: Анализ главы с описаниями
    """
    # Получаем книгу
    book = await book_service.get_book_by_id(
        db=db, book_id=book_id, user_id=current_user.id
    )

    if not book:
        raise BookNotFoundException(book_id)

    # Ищем главу
    chapter = None
    for c in book.chapters:
        if c.chapter_number == chapter_number:
            chapter = c
            break

    if not chapter:
        raise ChapterNotFoundException(chapter_number, book_id)

    # Если требуется извлечь новые описания
    if extract_new:
        if not langextract_processor.is_available():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="LLM processor unavailable. Check GOOGLE_API_KEY.",
            )

        # Удаляем старые описания для этой главы
        old_descriptions = (
            (
                await db.execute(
                    select(Description).where(Description.chapter_id == chapter.id)
                )
            )
            .scalars()
            .all()
        )

        for old_desc in old_descriptions:
            await db.delete(old_desc)

        # Извлекаем описания из контента главы через LLM
        result = await langextract_processor.extract_descriptions(chapter.content)

        # ProcessingResult has 'descriptions' list directly, not 'success' attr
        descriptions_data = result.descriptions if result.descriptions else []

        # Сохраняем новые описания в базе
        position = 0
        for desc_data in descriptions_data:
            desc_dict = desc_data.to_dict() if hasattr(desc_data, 'to_dict') else desc_data

            # Map string type to enum
            type_str = desc_dict.get("type", "location")
            try:
                desc_type = DescriptionType(type_str)
            except ValueError:
                desc_type = DescriptionType.LOCATION

            new_description = Description(
                chapter_id=chapter.id,
                type=desc_type,
                content=desc_dict.get("content", ""),
                confidence_score=desc_dict.get("confidence_score", 0.8),
                priority_score=desc_dict.get("priority_score", 0.5),
                entities_mentioned=",".join(desc_dict.get("entities_mentioned", [])),
                position_in_chapter=position,
                word_count=desc_dict.get("word_count", len(desc_dict.get("content", "").split())),
            )
            position += 1
            db.add(new_description)

        # Update chapter stats
        chapter.descriptions_found = len(descriptions_data)
        chapter.is_description_parsed = True
        chapter.parsed_at = datetime.utcnow()

        await db.commit()
        await db.refresh(chapter)

    # Получаем описания для этой главы
    descriptions_result = await db.execute(
        select(Description)
        .where(Description.chapter_id == chapter.id)
        .order_by(Description.position_in_chapter)
    )
    descriptions = descriptions_result.scalars().all()

    # Формируем ответ
    chapter_info = ChapterMinimalInfo(
        id=chapter.id,
        number=chapter.chapter_number,  # Field name is 'number', not 'chapter_number'
        title=chapter.title or f"Глава {chapter.chapter_number}",
        word_count=chapter.word_count,
    )

    # Группируем по типам
    by_type: Dict[str, int] = {}
    desc_responses: List[DescriptionResponse] = []

    for desc in descriptions:
        type_value = desc.type.value if desc.type else "location"
        by_type[type_value] = by_type.get(type_value, 0) + 1

        desc_responses.append(DescriptionResponse(
            id=desc.id,
            chapter_id=desc.chapter_id,
            type=desc.type,
            content=desc.content,
            context=desc.context or "",
            confidence_score=desc.confidence_score,
            priority_score=desc.priority_score,
            position_in_chapter=desc.position_in_chapter,
            word_count=desc.word_count,
            is_suitable_for_generation=desc.is_suitable_for_generation,
            image_generated=desc.image_generated,
            entities_mentioned=desc.entities_mentioned or "",
            created_at=desc.created_at,
            updated_at=desc.updated_at,
        ))

    analysis_result = NLPAnalysisResult(
        total_descriptions=len(descriptions),
        by_type=by_type,
        descriptions=desc_responses,
    )

    return ChapterDescriptionsResponse(
        chapter_info=chapter_info,  # Fixed: was 'chapter'
        nlp_analysis=analysis_result,  # Fixed: was 'analysis'
    )


@router.get(
    "/descriptions/{description_id}",
    response_model=DescriptionResponse,
    summary="Get description by ID",
    description="Returns a specific description by its ID"
)
async def get_description(
    description_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> DescriptionResponse:
    """
    Получает описание по ID.

    Args:
        description_id: ID описания
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        DescriptionResponse: Информация об описании
    """
    from ..models.book import Book

    # Get description with access check
    result = await db.execute(
        select(Description)
        .join(Chapter, Description.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(Description.id == description_id)
        .where(Book.user_id == current_user.id)
    )
    description = result.scalar_one_or_none()

    if not description:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Description not found or access denied",
        )

    return DescriptionResponse(
        id=description.id,
        chapter_id=description.chapter_id,
        type=description.type,
        content=description.content,
        context=description.context or "",
        confidence_score=description.confidence_score,
        priority_score=description.priority_score,
        position_in_chapter=description.position_in_chapter,
        word_count=description.word_count,
        is_suitable_for_generation=description.is_suitable_for_generation,
        image_generated=description.image_generated,
        entities_mentioned=description.entities_mentioned or "",
        created_at=description.created_at,
        updated_at=description.updated_at,
    )

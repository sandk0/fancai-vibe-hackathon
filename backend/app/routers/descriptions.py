"""
API роуты для работы с описаниями в книгах BookReader AI.

Этот модуль содержит endpoints для управления описаниями:
- Получение описаний главы
- Извлечение новых описаний с помощью NLP
- Статистика по описаниям
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any
from uuid import UUID
from pathlib import Path
from datetime import datetime
import tempfile
import os

from ..core.database import get_database_session
from ..core.auth import get_current_active_user
from ..core.exceptions import (
    ChapterDescriptionFetchException,
    ChapterNotFoundException,
    NLPProcessorUnavailableException,
)
from ..services.book import book_service, book_parsing_service
from ..services.nlp_processor import nlp_processor
from ..services.book_parser import book_parser
from ..models.user import User
from ..models.description import Description
from ..schemas.responses.descriptions import (
    ChapterDescriptionsResponse,
    ChapterAnalysisResponse,
    ChapterMinimalInfo,
    ChapterAnalysisPreview,
    NLPAnalysisResult,
)
from ..schemas.responses import DescriptionResponse, DescriptionListResponse


router = APIRouter()


@router.get(
    "/{book_id}/chapters/{chapter_number}/descriptions",
    response_model=ChapterDescriptionsResponse,
    summary="Get descriptions from chapter",
    description="Returns all NLP-extracted descriptions from a specific chapter"
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
    выполнить новый NLP анализ главы (extract_new=True).

    Args:
        book_id: ID книги
        chapter_number: Номер главы (1-indexed)
        extract_new: Извлечь новые описания (перепарсить главу)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        ChapterDescriptionsResponse: NLP анализ главы с описаниями

    Raises:
        HTTPException 404: Книга или глава не найдена
        HTTPException 503: NLP процессор недоступен
    """
    try:
        print("[DEBUG] get_chapter_descriptions called:")
        print(f"[DEBUG]   book_id: {book_id}")
        print(f"[DEBUG]   chapter_number: {chapter_number}")
        print(f"[DEBUG]   current_user.id: {current_user.id}")
        print(f"[DEBUG]   current_user.email: {current_user.email}")

        # Получаем книгу через dependency (уже проверена)
        book = await book_service.get_book_by_id(
            db=db, book_id=book_id, user_id=current_user.id
        )
        print(f"[DEBUG] Book found: {book is not None}")

        if not book:
            from ..core.exceptions import BookNotFoundException

            raise BookNotFoundException(book_id)

        # Ищем главу
        chapter = None
        print(f"[DEBUG] Searching for chapter {chapter_number} in book {book_id}")
        print(f"[DEBUG] Book has {len(book.chapters)} chapters loaded")
        for c in book.chapters:
            print(f"[DEBUG] Checking chapter: {c.chapter_number}")
            if c.chapter_number == chapter_number:
                chapter = c
                break

        if not chapter:
            print(f"[DEBUG] Chapter {chapter_number} not found in book!")
            raise ChapterNotFoundException(chapter_number, book_id)

        # Если требуется извлечь новые описания
        if extract_new:
            if not nlp_processor.is_available():
                raise NLPProcessorUnavailableException()

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

            # Извлекаем описания из контента главы
            descriptions_data = nlp_processor.extract_descriptions_from_text(
                chapter.content, str(chapter.chapter_number)
            )

            # Сохраняем новые описания в базе
            for desc_data in descriptions_data:
                new_description = Description(
                    chapter_id=chapter.id,
                    type=desc_data["type"],
                    content=desc_data["content"],
                    confidence_score=desc_data["confidence_score"],
                    priority_score=desc_data["priority_score"],
                    entities_mentioned=desc_data.get("entities_mentioned", []),
                    position_in_chapter=desc_data.get("position_in_chapter", 0),
                )
                db.add(new_description)

            await db.commit()
            await db.refresh(chapter)

        # Получаем описания для этой главы
        descriptions_result = await db.execute(
            select(Description)
            .where(Description.chapter_id == chapter.id)
            .order_by(Description.priority_score.desc())
        )

        descriptions = descriptions_result.scalars().all()

        # Статистика по типам описаний
        type_stats = {}
        for desc in descriptions:
            desc_type = desc.type.value
            if desc_type not in type_stats:
                type_stats[desc_type] = 0
            type_stats[desc_type] += 1

        # Формируем ответ - конвертируем ORM модели в Pydantic
        descriptions_data = [
            DescriptionResponse.model_validate(desc) for desc in descriptions
        ]

        chapter_info = ChapterMinimalInfo(
            id=chapter.id,
            number=chapter.chapter_number,
            title=chapter.title,
            word_count=chapter.word_count,
        )

        nlp_analysis = NLPAnalysisResult(
            total_descriptions=len(descriptions),
            by_type=type_stats,
            descriptions=descriptions_data,
            processing_time_seconds=None,  # Not tracked for existing descriptions
        )

        return ChapterDescriptionsResponse(
            chapter_info=chapter_info,
            nlp_analysis=nlp_analysis,
            message=f"Found {len(descriptions)} descriptions in chapter {chapter_number}",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise ChapterDescriptionFetchException(str(e))


@router.post(
    "/analyze-chapter",
    response_model=ChapterAnalysisResponse,
    summary="Analyze chapter content (preview)",
    description="Analyzes a chapter from uploaded book file without saving to database"
)
async def analyze_chapter_content(
    file: UploadFile = File(...), chapter_number: int = 1
) -> ChapterAnalysisResponse:
    """
    Анализирует конкретную главу книги с помощью NLP (preview без сохранения).

    Preview режим - НЕ сохраняет результаты в базу данных.
    Полезно для:
    - Тестирования качества NLP перед загрузкой книги
    - Демонстрации возможностей системы
    - Проверки формата файла

    Args:
        file: Загруженный файл книги (EPUB, FB2)
        chapter_number: Номер главы для анализа (default: 1)

    Returns:
        ChapterAnalysisResponse: NLP анализ главы с извлеченными описаниями

    Raises:
        HTTPException 503: NLP процессор недоступен
        HTTPException 404: Глава не найдена
        HTTPException 500: Ошибка парсинга или анализа
    """
    if not nlp_processor.is_available():
        raise HTTPException(status_code=503, detail="NLP processor is not available")

    # Парсим книгу
    file_content = await file.read()
    file_extension = Path(file.filename).suffix.lower()

    with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
        temp_file.write(file_content)
        temp_file_path = temp_file.name

    try:
        parsed_book = book_parser.parse_book(temp_file_path)

        # Находим нужную главу
        target_chapter = None
        for chapter in parsed_book.chapters:
            if chapter.number == chapter_number:
                target_chapter = chapter
                break

        if not target_chapter:
            raise HTTPException(
                status_code=404,
                detail=f"Chapter {chapter_number} not found. Available chapters: 1-{len(parsed_book.chapters)}",
            )

        # Анализируем главу с помощью NLP
        descriptions = nlp_processor.extract_descriptions_from_text(
            target_chapter.content, str(target_chapter.number)
        )

        # Статистика по типам описаний
        type_stats = {}
        for desc in descriptions:
            desc_type = desc["type"].value
            if desc_type not in type_stats:
                type_stats[desc_type] = 0
            type_stats[desc_type] += 1

        # Формируем ответ
        chapter_info = ChapterAnalysisPreview(
            chapter_number=target_chapter.number,
            title=target_chapter.title,
            word_count=target_chapter.word_count,
            preview_text=target_chapter.content[:200] + "..." if len(target_chapter.content) > 200 else target_chapter.content,
        )

        # NLP processor возвращает dict, конвертируем в Pydantic (только топ-10)
        # Note: We can't use DescriptionResponse directly because NLP output doesn't have all fields
        # Create a mock UUID for preview mode
        from uuid import uuid4
        descriptions_responses = []
        for desc in descriptions[:10]:
            # Create minimal DescriptionResponse from dict
            desc_response = DescriptionResponse(
                id=uuid4(),  # Mock UUID for preview
                chapter_id=uuid4(),  # Mock UUID for preview
                type=desc["type"],
                content=desc["content"],
                context=desc.get("context", ""),
                confidence_score=round(desc["confidence_score"], 3),
                priority_score=round(desc["priority_score"], 2),
                position_in_chapter=desc.get("position_in_chapter", 0),
                word_count=len(desc["content"].split()),
                is_suitable_for_generation=True,
                image_generated=False,
                entities_mentioned=", ".join(desc.get("entities_mentioned", [])),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            descriptions_responses.append(desc_response)

        nlp_analysis = NLPAnalysisResult(
            total_descriptions=len(descriptions),
            by_type=type_stats,
            descriptions=descriptions_responses,
            processing_time_seconds=None,
        )

        return ChapterAnalysisResponse(
            chapter_info=chapter_info,
            nlp_analysis=nlp_analysis,
            message=f"Chapter {chapter_number} analyzed: {len(descriptions)} descriptions extracted",
            test_mode=True,  # Preview mode - not saved to DB
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error analyzing chapter: {str(e)}"
        )

    finally:
        try:
            os.unlink(temp_file_path)
        except OSError:
            pass


@router.get(
    "/{book_id}/descriptions",
    response_model=DescriptionListResponse,
    summary="Get all book descriptions",
    description="Returns descriptions from all chapters of a book, optionally filtered by type"
)
async def get_book_descriptions(
    book_id: UUID,
    description_type: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> DescriptionListResponse:
    """
    Получает описания из всех глав книги.

    Возвращает paginated список описаний с фильтрацией по типу.
    Отсортировано по priority_score (убывание).

    Args:
        book_id: ID книги
        description_type: Фильтр по типу описания (LOCATION, CHARACTER, ATMOSPHERE, etc.)
        skip: Количество описаний для пропуска (pagination)
        limit: Максимальное количество описаний (1-100, default: 100)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        DescriptionListResponse: Paginated список описаний

    Raises:
        HTTPException 404: Книга не найдена
        HTTPException 400: Некорректный тип описания
    """
    try:
        # Проверяем доступ к книге
        book = await book_service.get_book_by_id(
            db=db, book_id=book_id, user_id=current_user.id
        )

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Получаем описания
        from ..models.description import DescriptionType

        desc_type_filter = None
        if description_type:
            try:
                desc_type_filter = DescriptionType(description_type)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid description type: {description_type}",
                )

        descriptions = await book_parsing_service.get_book_descriptions(
            db=db, book_id=book_id, description_type=desc_type_filter, limit=limit
        )

        # Конвертируем ORM модели в Pydantic
        descriptions_data = [
            DescriptionResponse.model_validate(desc) for desc in descriptions
        ]

        return DescriptionListResponse(
            descriptions=descriptions_data,
            total=len(descriptions_data),
            skip=skip,
            limit=min(limit, 100),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching descriptions: {str(e)}"
        )

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
import tempfile
import os

from ..core.database import get_database_session
from ..core.auth import get_current_active_user
from ..services.book_service import book_service
from ..services.book_parser import book_parser
from ..services.nlp_processor import nlp_processor
from ..models.user import User
from ..models.description import Description


router = APIRouter()


@router.get("/{book_id}/chapters/{chapter_number}/descriptions")
async def get_chapter_descriptions(
    book_id: UUID,
    chapter_number: int,
    extract_new: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает описания для конкретной главы книги.

    Args:
        book_id: ID книги
        chapter_number: Номер главы
        extract_new: Извлечь новые описания (перепарсить главу)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        NLP анализ главы с описаниями

    Raises:
        HTTPException: 404 если книга или глава не найдена
        HTTPException: 503 если NLP процессор недоступен
    """
    try:
        print("[DEBUG] get_chapter_descriptions called:")
        print(f"[DEBUG]   book_id: {book_id}")
        print(f"[DEBUG]   chapter_number: {chapter_number}")
        print(f"[DEBUG]   current_user.id: {current_user.id}")
        print(f"[DEBUG]   current_user.email: {current_user.email}")

        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db, book_id=book_id, user_id=current_user.id
        )
        print(f"[DEBUG] Book found: {book is not None}")

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

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
            raise HTTPException(
                status_code=404, detail=f"Chapter {chapter_number} not found"
            )

        # Если требуется извлечь новые описания
        if extract_new:
            if not nlp_processor.is_available():
                raise HTTPException(
                    status_code=503, detail="NLP processor is not available"
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

        # Формируем ответ
        descriptions_data = []
        for desc in descriptions:
            descriptions_data.append(
                {
                    "id": str(desc.id),
                    "type": desc.type.value,
                    "text": desc.content,  # Добавляем text как алиас для content
                    "content": desc.content,
                    "confidence_score": desc.confidence_score,
                    "priority_score": desc.priority_score,
                    "entities_mentioned": desc.entities_mentioned or [],
                    "position_in_chapter": desc.position_in_chapter,
                }
            )

        return {
            "chapter_info": {
                "id": str(chapter.id),
                "number": chapter.chapter_number,
                "title": chapter.title,
                "word_count": chapter.word_count,
            },
            "nlp_analysis": {
                "total_descriptions": len(descriptions),
                "by_type": type_stats,
                "descriptions": descriptions_data,
            },
            "message": f"Found {len(descriptions)} descriptions in chapter {chapter_number}",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching chapter descriptions: {str(e)}"
        )


@router.post("/analyze-chapter")
async def analyze_chapter_content(
    file: UploadFile = File(...), chapter_number: int = 1
) -> Dict[str, Any]:
    """
    Анализирует конкретную главу книги с помощью NLP (preview без сохранения).

    Args:
        file: Загруженный файл книги
        chapter_number: Номер главы для анализа

    Returns:
        NLP анализ главы с извлеченными описаниями

    Raises:
        HTTPException: 503 если NLP процессор недоступен
        HTTPException: 404 если глава не найдена
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

        return {
            "chapter_info": {
                "number": target_chapter.number,
                "title": target_chapter.title,
                "word_count": target_chapter.word_count,
                "content_preview": target_chapter.content[:300] + "...",
            },
            "nlp_analysis": {
                "total_descriptions": len(descriptions),
                "by_type": type_stats,
                "descriptions": [
                    {
                        "type": desc["type"].value,
                        "content": desc["content"],
                        "confidence_score": round(desc["confidence_score"], 3),
                        "priority_score": round(desc["priority_score"], 2),
                        "entities_mentioned": desc["entities_mentioned"],
                    }
                    for desc in descriptions[:10]  # Топ-10 описаний
                ],
            },
            "message": f"Chapter {chapter_number} analyzed: {len(descriptions)} descriptions extracted",
        }

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


@router.get("/{book_id}/descriptions")
async def get_book_descriptions(
    book_id: UUID,
    description_type: str = None,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает описания из всех глав книги.

    Args:
        book_id: ID книги
        description_type: Фильтр по типу описания (location, character, atmosphere, etc.)
        limit: Максимальное количество описаний (по умолчанию 100)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Список описаний, отсортированных по приоритету

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

        # Получаем описания
        from ..models.description import DescriptionType

        desc_type_filter = None
        if description_type:
            try:
                desc_type_filter = DescriptionType(description_type)
            except ValueError:
                raise HTTPException(
                    status_code=400, detail=f"Invalid description type: {description_type}"
                )

        descriptions = await book_service.get_book_descriptions(
            db=db, book_id=book_id, description_type=desc_type_filter, limit=limit
        )

        # Формируем ответ
        descriptions_data = []
        for desc in descriptions:
            descriptions_data.append(
                {
                    "id": str(desc.id),
                    "chapter_id": str(desc.chapter_id),
                    "type": desc.type.value,
                    "content": desc.content,
                    "confidence_score": desc.confidence_score,
                    "priority_score": desc.priority_score,
                    "entities_mentioned": desc.entities_mentioned or [],
                    "position_in_chapter": desc.position_in_chapter,
                }
            )

        return {
            "book_id": str(book_id),
            "total_descriptions": len(descriptions_data),
            "descriptions": descriptions_data,
            "filter": {"type": description_type, "limit": limit},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching descriptions: {str(e)}"
        )

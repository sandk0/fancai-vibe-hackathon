"""
API роуты для работы с книгами в BookReader AI.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List
import tempfile
import os
from pathlib import Path

from ..core.database import get_database_session
from ..core.auth import get_current_active_user, get_optional_current_user
from ..services.book_parser import book_parser
from ..services.nlp_processor import nlp_processor
from ..services.book_service import book_service
from ..models.book import Book
from ..models.user import User
from ..models.description import DescriptionType
import shutil
from uuid import uuid4


router = APIRouter()


@router.get("/books/parser-status")
async def get_parser_status() -> Dict[str, Any]:
    """
    Проверяет статус парсера книг.
    
    Returns:
        Информация о поддерживаемых форматах и доступности парсера
    """
    return {
        "supported_formats": book_parser.get_supported_formats(),
        "nlp_available": nlp_processor.is_available(),
        "parser_ready": len(book_parser.get_supported_formats()) > 0,
        "max_file_size_mb": 50,
        "message": f"Book parser supports: {', '.join(book_parser.get_supported_formats())}"
    }


@router.post("/books/validate-file")
async def validate_book_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Валидирует загруженный файл книги без сохранения.
    
    Args:
        file: Загруженный файл
        
    Returns:
        Результат валидации файла
    """
    # Проверяем базовые параметры файла
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ['.epub', '.fb2']:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_extension}. Supported: .epub, .fb2"
        )
    
    # Проверяем размер файла
    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size > 50 * 1024 * 1024:  # 50MB
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    if file_size < 1024:  # 1KB
        raise HTTPException(status_code=400, detail="File too small")
    
    # Создаём временный файл для валидации
    with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
        temp_file.write(file_content)
        temp_file_path = temp_file.name
    
    try:
        # Валидируем файл
        validation_result = book_parser.validate_book_file(temp_file_path)
        
        return {
            "filename": file.filename,
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "validation": validation_result,
            "message": "File validated successfully" if validation_result["is_valid"] else "File validation failed"
        }
        
    finally:
        # Удаляем временный файл
        try:
            os.unlink(temp_file_path)
        except:
            pass


@router.post("/books/parse-preview")
async def parse_book_preview(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Парсит книгу и возвращает предварительный просмотр без сохранения в БД.
    
    Args:
        file: Загруженный файл книги
        
    Returns:
        Метаданные и превью содержимого книги
    """
    # Валидируем файл
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ['.epub', '.fb2']:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_extension}"
        )
    
    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    # Создаём временный файл
    with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
        temp_file.write(file_content)
        temp_file_path = temp_file.name
    
    try:
        # Парсим книгу
        parsed_book = book_parser.parse_book(temp_file_path)
        
        # Подготавливаем превью глав (первые 3 главы)
        chapters_preview = []
        for i, chapter in enumerate(parsed_book.chapters[:3]):
            preview_text = chapter.content[:500] + "..." if len(chapter.content) > 500 else chapter.content
            chapters_preview.append({
                "number": chapter.number,
                "title": chapter.title,
                "content_preview": preview_text,
                "word_count": chapter.word_count,
                "estimated_reading_time_minutes": max(1, chapter.word_count // 200)
            })
        
        return {
            "metadata": {
                "title": parsed_book.metadata.title,
                "author": parsed_book.metadata.author,
                "language": parsed_book.metadata.language,
                "genre": parsed_book.metadata.genre,
                "description": parsed_book.metadata.description[:1000] + "..." if len(parsed_book.metadata.description) > 1000 else parsed_book.metadata.description,
                "publisher": parsed_book.metadata.publisher,
                "publish_date": parsed_book.metadata.publish_date,
                "has_cover": parsed_book.metadata.cover_image_data is not None
            },
            "statistics": {
                "total_chapters": len(parsed_book.chapters),
                "total_pages": parsed_book.total_pages,
                "estimated_reading_time_hours": round(parsed_book.estimated_reading_time / 60, 1),
                "file_format": parsed_book.file_format,
                "file_size_mb": round(file_size / (1024 * 1024), 2)
            },
            "chapters_preview": chapters_preview,
            "message": f"Book parsed successfully: {len(parsed_book.chapters)} chapters found"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error parsing book: {str(e)}"
        )
        
    finally:
        # Удаляем временный файл
        try:
            os.unlink(temp_file_path)
        except:
            pass


@router.post("/books/analyze-chapter")
async def analyze_chapter_content(file: UploadFile = File(...), chapter_number: int = 1) -> Dict[str, Any]:
    """
    Анализирует конкретную главу книги с помощью NLP.
    
    Args:
        file: Загруженный файл книги
        chapter_number: Номер главы для анализа
        
    Returns:
        NLP анализ главы с извлеченными описаниями
    """
    if not nlp_processor.is_available():
        raise HTTPException(
            status_code=503, 
            detail="NLP processor is not available"
        )
    
    # Парсим книгу (как в предыдущем endpoint)
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
                detail=f"Chapter {chapter_number} not found. Available chapters: 1-{len(parsed_book.chapters)}"
            )
        
        # Анализируем главу с помощью NLP
        descriptions = nlp_processor.extract_descriptions_from_text(
            target_chapter.content, 
            str(target_chapter.number)
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
                        "entities_mentioned": desc["entities_mentioned"]
                    }
                    for desc in descriptions[:10]  # Топ-10 описаний
                ]
            },
            "message": f"Chapter {chapter_number} analyzed: {len(descriptions)} descriptions extracted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error analyzing chapter: {str(e)}"
        )
        
    finally:
        try:
            os.unlink(temp_file_path)
        except:
            pass


@router.post("/books/upload")
async def upload_book(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Загружает книгу, парсит её и сохраняет в базе данных.
    
    Args:
        file: Загруженный файл книги
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Информация о загруженной и обработанной книге
    """
    
    # Валидируем файл
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ['.epub', '.fb2']:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_extension}"
        )
    
    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    # Создаем временный файл для парсинга
    with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
        temp_file.write(file_content)
        temp_file_path = temp_file.name
    
    try:
        # Парсим книгу
        parsed_book = book_parser.parse_book(temp_file_path)
        
        # Создаем постоянное хранилище для файла
        storage_dir = Path("/tmp/books")  # В продакшене это должно быть постоянное хранилище
        storage_dir.mkdir(exist_ok=True)
        
        permanent_path = storage_dir / f"{uuid4()}{file_extension}"
        shutil.move(temp_file_path, permanent_path)
        
        # Сохраняем книгу в базе данных
        book = await book_service.create_book_from_upload(
            db=db,
            user_id=current_user.id,
            file_path=str(permanent_path),
            original_filename=file.filename,
            parsed_book=parsed_book
        )
        
        return {
            "book_id": str(book.id),
            "title": book.title,
            "author": book.author,
            "chapters_count": len(parsed_book.chapters),
            "total_pages": book.total_pages,
            "estimated_reading_time_hours": round(book.estimated_reading_time / 60, 1),
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "has_cover": bool(book.cover_image),
            "created_at": book.created_at.isoformat(),
            "message": f"Book '{book.title}' uploaded and processed successfully"
        }
        
    except Exception as e:
        # Удаляем временный файл в случае ошибки
        try:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        except:
            pass
            
        raise HTTPException(
            status_code=500, 
            detail=f"Error processing book: {str(e)}"
        )


@router.get("/books")
async def get_user_books(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получает список книг пользователя.
    
    Args:
        skip: Количество книг для пропуска
        limit: Максимальное количество книг
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Список книг пользователя с метаданными
    """
    
    try:
        books = await book_service.get_user_books(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit
        )
        
        books_data = []
        for book in books:
            progress_percent = 0.0
            if book.reading_progress:
                progress = book.reading_progress[0]  # Первый прогресс для пользователя
                if book.total_pages > 0:
                    progress_percent = (progress.current_page / book.total_pages) * 100
            
            books_data.append({
                "id": str(book.id),
                "title": book.title,
                "author": book.author,
                "genre": book.genre,
                "language": book.language,
                "description": book.description[:200] + "..." if len(book.description) > 200 else book.description,
                "total_pages": book.total_pages,
                "estimated_reading_time_hours": round(book.estimated_reading_time / 60, 1),
                "chapters_count": len(book.chapters),
                "reading_progress_percent": round(progress_percent, 1),
                "has_cover": bool(book.cover_image),
                "is_parsed": book.is_parsed,
                "created_at": book.created_at.isoformat(),
                "last_accessed": book.last_accessed.isoformat() if book.last_accessed else None
            })
        
        return {
            "books": books_data,
            "total": len(books_data),
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching books: {str(e)}"
        )
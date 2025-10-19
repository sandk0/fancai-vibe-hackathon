"""
API роуты для работы с книгами в BookReader AI.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
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
from ..models.description import DescriptionType, Description
from ..models.image import GeneratedImage
from ..models.chapter import Chapter
from ..core.tasks import process_book_task
import shutil
from uuid import uuid4, UUID


router = APIRouter()

@router.get("/simple-test")
async def simple_test():
    """Simple test without any dependencies"""
    return {"status": "ok", "message": "Router is working"}

@router.get("/test-with-params")
async def test_with_params(skip: int = 0, limit: int = 12):
    """Test with query parameters like main endpoint"""
    return {"status": "ok", "skip": skip, "limit": limit}


@router.get("/parser-status")
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


@router.post("/validate-file")
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


@router.post("/parse-preview")
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


@router.post("/analyze-chapter")
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



@router.post("/debug-upload")
async def debug_upload_book(file: UploadFile = File(None)) -> Dict[str, Any]:
    """Debug endpoint to check what frontend sends."""
    print(f"[DEBUG] File received: {file}")
    if file:
        print(f"[DEBUG] File name: {file.filename}")
        print(f"[DEBUG] File type: {file.content_type}")
    else:
        print("[DEBUG] No file received")
    return {"debug": "ok", "has_file": file is not None}


@router.post("/upload")
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
    
    print(f"[UPLOAD] Request received from user: {current_user.email}")
    print(f"[UPLOAD] File info: name={file.filename}, type={file.content_type}")
    print(f"[UPLOAD] File object: {file}")
    print(f"[UPLOAD] File size check...")
    
    # Валидируем файл
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ['.epub', '.fb2']:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_extension}"
        )
    
    try:
        file_content = await file.read()
        file_size = len(file_content)
        print(f"[UPLOAD] File read successfully, size: {file_size} bytes")
    except Exception as e:
        print(f"[UPLOAD ERROR] Failed to read file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
    
    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    print(f"[UPLOAD] Creating temporary file...")
    # Создаем временный файл для парсинга
    with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
        temp_file.write(file_content)
        temp_file_path = temp_file.name
    
    try:
        print(f"[UPLOAD] Parsing book from: {temp_file_path}")
        # Парсим книгу
        parsed_book = book_parser.parse_book(temp_file_path)
        print(f"[UPLOAD] Book parsed successfully: {parsed_book.metadata.title}")
        
        # Создаем постоянное хранилище для файла
        storage_dir = Path("/app/storage/books")  # Используем тот же путь, что и в book_service
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        permanent_path = storage_dir / f"{uuid4()}{file_extension}"
        shutil.move(temp_file_path, permanent_path)
        print(f"[UPLOAD] File moved to permanent storage: {permanent_path}")
        
        # Сохраняем книгу в базе данных
        print(f"[UPLOAD] Creating book in database...")
        book = await book_service.create_book_from_upload(
            db=db,
            user_id=current_user.id,
            file_path=str(permanent_path),
            original_filename=file.filename,
            parsed_book=parsed_book
        )
        print(f"[UPLOAD] Book created in database with ID: {book.id}")
        
        # Запускаем асинхронную обработку книги для извлечения описаний
        try:
            print(f"[CELERY] Starting background processing for book {book.id}")
            process_book_task.delay(str(book.id))
            print(f"[CELERY] Background task started successfully")
        except Exception as e:
            print(f"[CELERY ERROR] Failed to start background task: {str(e)}")
            # Не прерываем процесс, если Celery недоступен
        
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
            "is_parsed": book.is_parsed,
            "parsing_progress": book.parsing_progress,
            "is_processing": True,
            "message": f"Book '{book.title}' uploaded successfully. Processing descriptions in background..."
        }
        
    except Exception as e:
        print(f"[UPLOAD ERROR] Processing failed: {str(e)}")
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



@router.get("/")
async def get_user_books(
    skip: int = 0, 
    limit: int = 50,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    print(f"[BOOKS ENDPOINT] FUNCTION CALLED - user={current_user.id}, skip={skip}, limit={limit}")
    """
    Получает список книг пользователя.
    
    Args:
        skip: Количество записей для пропуска
        limit: Максимальное количество записей
        db: Сессия базы данных
        current_user: Текущий пользователь
        
    Returns:
        Список книг пользователя с пагинацией
    """
    print(f"[BOOKS ENDPOINT] Starting books request for user {current_user.id}")
    try:
        print(f"[BOOKS ENDPOINT] Getting books for user {current_user.id} (type: {type(current_user.id)}) (skip={skip}, limit={limit})")
        
        # Получаем книги пользователя
        books = await book_service.get_user_books(db, current_user.id, skip, limit)
        print(f"[BOOKS ENDPOINT] Retrieved {len(books)} books from service")
        
        # Формируем ответ
        books_data = []
        for book in books:
            try:
                reading_progress = await book.get_reading_progress_percent(db, current_user.id)
                
                books_data.append({
                    "id": str(book.id),
                    "title": book.title,
                    "author": book.author or "Неизвестный автор",
                    "genre": book.genre,
                    "language": book.language,
                    "description": book.description or "",
                    "total_pages": book.total_pages,
                    "estimated_reading_time_hours": round(book.estimated_reading_time / 60, 1) if book.estimated_reading_time > 0 else 0.0,
                    "chapters_count": len(book.chapters) if hasattr(book, 'chapters') and book.chapters else 0,
                    "reading_progress_percent": round(reading_progress, 1),
                    "has_cover": bool(book.cover_image),
                    "is_parsed": book.is_parsed,
                    "parsing_progress": book.parsing_progress,
                    "created_at": book.created_at.isoformat() if book.created_at else None,
                    "last_accessed": book.last_accessed.isoformat() if book.last_accessed else None
                })
            except Exception as e:
                print(f"[BOOKS ENDPOINT] Error processing book {book.id}: {e}")
                # Добавляем книгу с базовыми данными
                books_data.append({
                    "id": str(book.id),
                    "title": book.title,
                    "author": book.author or "Неизвестный автор",
                    "genre": book.genre,
                    "language": book.language,
                    "description": book.description or "",
                    "total_pages": book.total_pages,
                    "estimated_reading_time_hours": 0.0,
                    "chapters_count": 0,
                    "reading_progress_percent": 0.0,
                    "has_cover": bool(book.cover_image),
                    "is_parsed": book.is_parsed,
                    "parsing_progress": book.parsing_progress,
                    "created_at": book.created_at.isoformat() if book.created_at else None,
                    "last_accessed": book.last_accessed.isoformat() if book.last_accessed else None
                })
        
        # Получаем общее количество книг для пагинации
        total_books_result = await db.execute(
            select(func.count(Book.id)).where(Book.user_id == current_user.id)
        )
        total_books = total_books_result.scalar() or 0
        
        print(f"[BOOKS ENDPOINT] Successfully returning {len(books_data)} books (total: {total_books})")
        
        return {
            "books": books_data,
            "total": total_books,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        print(f"[BOOKS ENDPOINT] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching books: {str(e)}")


@router.get("/{book_id}")
async def get_book(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получает информацию о конкретной книге.
    
    Args:
        book_id: ID книги
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Подробная информация о книге
    """
    
    try:
        book = await book_service.get_book_by_id(
            db=db,
            book_id=book_id,
            user_id=current_user.id
        )
        
        if not book:
            raise HTTPException(
                status_code=404,
                detail="Book not found"
            )
        
        # Прогресс чтения - используем унифицированный метод из модели
        progress_percent = await book.get_reading_progress_percent(db, current_user.id)

        # Получаем текущую позицию для интерфейса
        current_chapter = 1
        current_page = 1
        current_position = 0
        reading_location_cfi = None
        if book.reading_progress:
            progress = book.reading_progress[0]
            current_chapter = progress.current_chapter
            current_page = progress.current_page
            current_position = progress.current_position
            reading_location_cfi = progress.reading_location_cfi
        
        # Информация о главах
        chapters_data = []
        for chapter in sorted(book.chapters, key=lambda c: c.chapter_number):
            chapters_data.append({
                "id": str(chapter.id),
                "number": chapter.chapter_number,
                "title": chapter.title,
                "word_count": chapter.word_count,
                "estimated_reading_time_minutes": chapter.estimated_reading_time,
                "is_description_parsed": chapter.is_description_parsed,
                "descriptions_found": chapter.descriptions_found
            })
        
        return {
            "id": str(book.id),
            "title": book.title,
            "author": book.author,
            "genre": book.genre,
            "language": book.language,
            "description": book.description,
            "total_pages": book.total_pages,
            "estimated_reading_time_hours": round(book.estimated_reading_time / 60, 1),
            "file_format": book.file_format,
            "file_size_mb": round(book.file_size / (1024 * 1024), 2),
            "has_cover": bool(book.cover_image),
            "is_parsed": book.is_parsed,
            "parsing_progress": book.parsing_progress,
            "chapters": chapters_data,
            "reading_progress": {
                "current_chapter": current_chapter,
                "current_page": current_page,
                "current_position": current_position,
                "reading_location_cfi": reading_location_cfi,
                "progress_percent": round(progress_percent, 1)
            },
            "created_at": book.created_at.isoformat(),
            "last_accessed": book.last_accessed.isoformat() if book.last_accessed else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching book: {str(e)}"
        )


@router.get("/{book_id}/file")
async def get_book_file(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
):
    """
    Возвращает EPUB файл для чтения в epub.js.

    Args:
        book_id: ID книги
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        FileResponse с EPUB файлом
    """
    try:
        book = await book_service.get_book_by_id(
            db=db,
            book_id=book_id,
            user_id=current_user.id
        )

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Проверяем существование файла
        if not os.path.exists(book.file_path):
            raise HTTPException(status_code=404, detail="Book file not found on server")

        # Возвращаем файл
        return FileResponse(
            path=book.file_path,
            media_type="application/epub+zip",
            filename=f"{book.title}.epub"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving book file: {str(e)}"
        )


@router.get("/{book_id}/chapters/{chapter_number}")
async def get_chapter(
    book_id: UUID,
    chapter_number: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получает содержимое конкретной главы книги.
    
    Args:
        book_id: ID книги
        chapter_number: Номер главы
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Содержимое главы с навигационной информацией
    """
    
    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db,
            book_id=book_id,
            user_id=current_user.id
        )
        
        if not book:
            raise HTTPException(
                status_code=404,
                detail="Book not found"
            )
        
        # Ищем главу
        chapter = None
        for c in book.chapters:
            if c.chapter_number == chapter_number:
                chapter = c
                break
        
        if not chapter:
            raise HTTPException(
                status_code=404,
                detail=f"Chapter {chapter_number} not found"
            )
        
        # Получаем описания для этой главы с изображениями (лимитируем до 50)
        descriptions_result = await db.execute(
            select(Description, GeneratedImage)
            .outerjoin(GeneratedImage, Description.id == GeneratedImage.description_id)
            .where(Description.chapter_id == chapter.id)
            .order_by(Description.priority_score.desc())
            .limit(50)  # Лимитируем количество описаний для предотвращения проблем с памятью
        )
        
        descriptions_data = []
        descriptions_rows = descriptions_result.fetchall()
        
        for description, generated_image in descriptions_rows:
            # Упрощенная структура данных для уменьшения потребления памяти
            desc_data = {
                "id": str(description.id),
                "type": description.type.value,
                "content": description.content,
                "confidence_score": description.confidence_score,
                "priority_score": description.priority_score,
                "position_in_chapter": description.position_in_chapter
            }
            
            # Добавляем изображение только если оно есть
            if generated_image:
                desc_data["generated_image"] = {
                    "id": str(generated_image.id),
                    "image_url": generated_image.image_url,
                    "created_at": generated_image.created_at.isoformat()
                }
            
            descriptions_data.append(desc_data)
        
        # Навигационная информация
        has_previous = chapter_number > 1
        has_next = chapter_number < len(book.chapters)
        previous_chapter = chapter_number - 1 if has_previous else None
        next_chapter = chapter_number + 1 if has_next else None
        
        return {
            "chapter": {
                "id": str(chapter.id),
                "number": chapter.chapter_number,
                "title": chapter.title,
                "content": chapter.content,
                "html_content": chapter.html_content,
                "word_count": chapter.word_count,
                "estimated_reading_time_minutes": chapter.estimated_reading_time
            },
            "descriptions": descriptions_data,
            "navigation": {
                "has_previous": has_previous,
                "has_next": has_next,
                "previous_chapter": previous_chapter,
                "next_chapter": next_chapter
            },
            "book_info": {
                "id": str(book.id),
                "title": book.title,
                "author": book.author,
                "total_chapters": len(book.chapters)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching chapter: {str(e)}"
        )


@router.post("/{book_id}/progress")
async def update_reading_progress(
    book_id: UUID,
    progress_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Обновляет прогресс чтения книги пользователем.

    Args:
        book_id: ID книги
        progress_data: Данные прогресса:
            - current_chapter: номер текущей главы (обязательно)
            - current_position_percent: процент прочитанного в главе 0-100 (опционально)
            - current_page: номер страницы для обратной совместимости (опционально)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Обновленный прогресс чтения
    """

    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db,
            book_id=book_id,
            user_id=current_user.id
        )

        if not book:
            raise HTTPException(
                status_code=404,
                detail="Book not found"
            )

        current_chapter = max(1, progress_data.get('current_chapter', 1))

        # Получаем CFI если передан (для epub.js)
        reading_location_cfi = progress_data.get('reading_location_cfi')

        # Поддерживаем оба формата: новый (current_position_percent) и старый (current_page)
        position_percent = progress_data.get('current_position_percent')
        if position_percent is None:
            # Обратная совместимость: если передали current_page, игнорируем его
            # и устанавливаем позицию в 0% (начало главы)
            position_percent = 0.0

        position_percent = max(0.0, min(100.0, float(position_percent)))

        # Обновляем прогресс чтения
        progress = await book_service.update_reading_progress(
            db=db,
            user_id=current_user.id,
            book_id=book_id,
            chapter_number=current_chapter,
            position_percent=position_percent,
            reading_location_cfi=reading_location_cfi
        )

        return {
            "progress": {
                "id": str(progress.id),
                "current_chapter": progress.current_chapter,
                "current_page": progress.current_page,
                "current_position": progress.current_position,
                "reading_location_cfi": progress.reading_location_cfi,
                "reading_time_minutes": progress.reading_time_minutes,
                "reading_speed_wpm": progress.reading_speed_wpm,
                "last_read_at": progress.last_read_at.isoformat() if progress.last_read_at else None
            },
            "message": "Reading progress updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating progress: {str(e)}"
        )


@router.post("/{book_id}/process")
async def process_book_descriptions(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Запускает обработку книги для извлечения описаний.
    
    Args:
        book_id: ID книги
        current_user: Текущий пользователь
        db: Сессия базы данных
        
    Returns:
        Статус запуска обработки
    """
    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db,
            book_id=book_id,
            user_id=current_user.id
        )
        
        if not book:
            raise HTTPException(
                status_code=404,
                detail="Book not found"
            )
        
        # Импортируем менеджер парсинга
        from ..services.parsing_manager import parsing_manager
        
        # Проверяем текущий статус парсинга
        parsing_status = await parsing_manager.get_parsing_status(book_id)
        if parsing_status and parsing_status['status'] in ['queued', 'processing']:
            return {
                "book_id": book_id,
                "status": parsing_status['status'],
                "message": parsing_status.get('message', ''),
                "progress": parsing_status.get('progress', 0),
                "position": parsing_status.get('position'),
                "descriptions_found": parsing_status.get('descriptions_found', 0)
            }
        
        # Проверяем, можно ли начать парсинг сейчас
        can_parse, message = await parsing_manager.can_start_parsing()
        
        # Получаем приоритет пользователя
        priority = await parsing_manager.get_user_priority(current_user, db)
        
        if can_parse:
            # Пытаемся получить блокировку и начать парсинг сразу
            if await parsing_manager.acquire_parsing_lock(book_id, str(current_user.id)):
                try:
                    # Обновляем статус
                    await parsing_manager.update_parsing_status(
                        book_id,
                        status='processing',
                        progress=0,
                        message='Starting book parsing...'
                    )
                    
                    # Запускаем задачу
                    process_book_task.delay(book_id)
                    
                    return {
                        "book_id": book_id,
                        "status": "processing",
                        "message": "Book parsing started immediately",
                        "priority": priority
                    }
                    
                except Exception as e:
                    # Освобождаем блокировку при ошибке
                    await parsing_manager.release_parsing_lock(book_id)
                    
                    # Fallback на синхронную обработку
                    from ..services.nlp_processor import process_book_descriptions
                    result = await process_book_descriptions(book_id, db)
                    
                    return {
                        "book_id": book_id,
                        "status": "completed",
                        "message": "Book processing completed synchronously",
                        "descriptions_found": result.get("total_descriptions", 0)
                    }
        
        # Если парсинг сейчас невозможен, добавляем в очередь
        queue_info = await parsing_manager.add_to_parsing_queue(
            book_id,
            str(current_user.id),
            priority,
            db
        )
        
        return {
            "book_id": book_id,
            "status": "queued",
            "message": f"Added to parsing queue. {message}",
            "position": queue_info['position'],
            "total_in_queue": queue_info['total_in_queue'],
            "estimated_wait_time": queue_info['estimated_wait_time'],
            "priority": priority
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error starting book processing: {str(e)}"
        )



@router.get("/{book_id}/parsing-status")
async def get_parsing_status(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получает статус парсинга книги.
    
    Args:
        book_id: ID книги
        current_user: Текущий пользователь
        db: Сессия базы данных
        
    Returns:
        Статус парсинга и прогресс
    """
    print(f"[PARSING-STATUS] Request for book_id={book_id}, user={current_user.email}")
    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db,
            book_id=book_id,
            user_id=current_user.id
        )
        
        if not book:
            raise HTTPException(
                status_code=404,
                detail="Book not found"
            )
        
        # Определяем статус парсинга на основе данных книги
        if book.is_parsed:
            response = {
                "book_id": book_id,
                "status": "completed",
                "progress": 100,
                "message": "Parsing completed",
                "descriptions_found": sum(ch.descriptions_found for ch in book.chapters) if book.chapters else 0
            }
        elif book.parsing_progress > 0:
            response = {
                "book_id": book_id,
                "status": "processing",
                "progress": book.parsing_progress,
                "message": f"Parsing in progress: {book.parsing_progress}%"
            }
        else:
            response = {
                "book_id": book_id,
                "status": "not_started",
                "progress": 0,
                "message": "Parsing not started"
            }
        
        print(f"[PARSING-STATUS] Response: {response}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching parsing status: {str(e)}"
        )


@router.get("/{book_id}/progress")
async def get_reading_progress(
    book_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получает прогресс чтения книги пользователем.
    
    Args:
        book_id: ID книги
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Текущий прогресс чтения
    """
    
    try:
        # Проверяем, что книга принадлежит пользователю
        book = await book_service.get_book_by_id(
            db=db,
            book_id=book_id,
            user_id=current_user.id
        )
        
        if not book:
            raise HTTPException(
                status_code=404,
                detail="Book not found"
            )
        
        # Ищем прогресс напрямую в БД (не через relationship - избегаем кэширования)
        from sqlalchemy import select, and_
        from ..models.book import ReadingProgress

        progress_query = select(ReadingProgress).where(
            and_(
                ReadingProgress.book_id == book_id,
                ReadingProgress.user_id == current_user.id
            )
        )
        progress_result = await db.execute(progress_query)
        progress = progress_result.scalar_one_or_none()

        return {
            "progress": {
                "id": str(progress.id) if progress else None,
                "current_chapter": progress.current_chapter if progress else 1,
                "current_page": progress.current_page if progress else 1,
                "current_position": progress.current_position if progress else 0,
                "reading_location_cfi": progress.reading_location_cfi if progress else None,
                "reading_time_minutes": progress.reading_time_minutes if progress else 0,
                "reading_speed_wpm": progress.reading_speed_wpm if progress else 0.0,
                "last_read_at": progress.last_read_at.isoformat() if progress and progress.last_read_at else None
            } if progress else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching progress: {str(e)}"
        )


@router.get("/{book_id}/cover")
async def get_book_cover(
    book_id: UUID,
    db: AsyncSession = Depends(get_database_session)
):
    """
    Получает обложку книги.
    
    Args:
        book_id: ID книги
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Файл обложки книги
    """
    
    try:
        # Получаем книгу по ID (без проверки владельца для публичного доступа к обложке)
        result = await db.execute(
            select(Book).where(Book.id == book_id)
        )
        book = result.scalar_one_or_none()
        
        if not book:
            raise HTTPException(
                status_code=404,
                detail="Book not found"
            )
        
        # Проверяем, есть ли обложка
        if not book.cover_image or not os.path.exists(book.cover_image):
            raise HTTPException(
                status_code=404,
                detail="Cover image not found"
            )
        
        # Возвращаем файл обложки
        return FileResponse(
            path=book.cover_image,
            media_type="image/jpeg",
            filename=f"{book.title}_cover.jpg"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching cover: {str(e)}"
        )
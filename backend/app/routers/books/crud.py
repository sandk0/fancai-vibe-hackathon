"""
Core CRUD operations для работы с книгами.

Этот модуль содержит базовые операции создания, чтения и удаления книг:
- Загрузка новых книг
- Получение списка книг пользователя
- Получение деталей конкретной книги
- Получение файлов книг (EPUB для epub.js)
- Получение обложек книг
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, Any
import tempfile
import os
from pathlib import Path
import shutil
from uuid import uuid4, UUID

from ...core.database import get_database_session
from ...core.auth import get_current_active_user
from ...core.dependencies import get_user_book, get_any_book
from ...core.exceptions import (
    InvalidFileFormatException,
    FileTooLargeException,
    NoFilenameProvidedException,
    FileReadException,
    BookProcessingException,
    BookListFetchException,
    BookFetchException,
    BookFileNotFoundException,
    BookRetrievalException,
    CoverImageNotFoundException,
    CoverFetchException,
)
from ...services.book_parser import book_parser
from ...services.book import book_service, book_progress_service
from ...models.book import Book
from ...models.user import User
from ...core.tasks import process_book_task


router = APIRouter()


@router.post("/upload")
async def upload_book(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Загружает книгу, парсит её и сохраняет в базе данных.

    Args:
        file: Загруженный файл книги
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Информация о загруженной и обработанной книге

    Raises:
        HTTPException: 400 если файл невалидный
    """
    print(f"[UPLOAD] Request received from user: {current_user.email}")
    print(f"[UPLOAD] File info: name={file.filename}, type={file.content_type}")

    # Валидируем файл
    if not file.filename:
        raise NoFilenameProvidedException()

    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in [".epub", ".fb2"]:
        raise InvalidFileFormatException(file_extension, [".epub", ".fb2"])

    try:
        file_content = await file.read()
        file_size = len(file_content)
        print(f"[UPLOAD] File read successfully, size: {file_size} bytes")
    except Exception as e:
        print(f"[UPLOAD ERROR] Failed to read file: {str(e)}")
        raise FileReadException(str(e))

    if file_size > 50 * 1024 * 1024:
        raise FileTooLargeException(50)

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
        storage_dir = Path("/app/storage/books")
        storage_dir.mkdir(parents=True, exist_ok=True)

        permanent_path = storage_dir / f"{uuid4()}{file_extension}"
        shutil.move(temp_file_path, permanent_path)
        print(f"[UPLOAD] File moved to permanent storage: {permanent_path}")

        # Сохраняем книгу в базе данных
        print("[UPLOAD] Creating book in database...")
        book = await book_service.create_book_from_upload(
            db=db,
            user_id=current_user.id,
            file_path=str(permanent_path),
            original_filename=file.filename,
            parsed_book=parsed_book,
        )
        print(f"[UPLOAD] Book created in database with ID: {book.id}")

        # Запускаем асинхронную обработку книги для извлечения описаний
        try:
            print(f"[CELERY] Starting background processing for book {book.id}")
            process_book_task.delay(str(book.id))
            print("[CELERY] Background task started successfully")
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
            "message": f"Book '{book.title}' uploaded successfully. Processing descriptions in background...",
        }

    except Exception as e:
        print(f"[UPLOAD ERROR] Processing failed: {str(e)}")
        # Удаляем временный файл в случае ошибки
        try:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        except OSError:
            pass

        raise BookProcessingException(str(e))


@router.get("/")
async def get_user_books(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
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
        # ОПТИМИЗАЦИЯ: Получаем книги пользователя с предрасчитанным прогрессом
        # Использует eager loading, чтобы избежать N+1 queries
        books_with_progress = await book_progress_service.get_books_with_progress(
            db, current_user.id, skip, limit
        )
        print(
            f"[BOOKS ENDPOINT] Retrieved {len(books_with_progress)} books from service"
        )

        # Формируем ответ
        books_data = []
        for book, reading_progress in books_with_progress:
            try:
                books_data.append(
                    {
                        "id": str(book.id),
                        "title": book.title,
                        "author": book.author or "Неизвестный автор",
                        "genre": book.genre,
                        "language": book.language,
                        "description": book.description or "",
                        "total_pages": book.total_pages,
                        "estimated_reading_time_hours": round(
                            book.estimated_reading_time / 60, 1
                        )
                        if book.estimated_reading_time > 0
                        else 0.0,
                        "chapters_count": len(book.chapters)
                        if hasattr(book, "chapters") and book.chapters
                        else 0,
                        "reading_progress_percent": round(reading_progress, 1),
                        "has_cover": bool(book.cover_image),
                        "is_parsed": book.is_parsed,
                        "parsing_progress": book.parsing_progress,
                        "created_at": book.created_at.isoformat()
                        if book.created_at
                        else None,
                        "last_accessed": book.last_accessed.isoformat()
                        if book.last_accessed
                        else None,
                    }
                )
            except Exception as e:
                print(f"[BOOKS ENDPOINT] Error processing book {book.id}: {e}")

        # Получаем общее количество книг для пагинации
        total_books_result = await db.execute(
            select(func.count(Book.id)).where(Book.user_id == current_user.id)
        )
        total_books = total_books_result.scalar() or 0

        print(
            f"[BOOKS ENDPOINT] Successfully returning {len(books_data)} books (total: {total_books})"
        )

        return {"books": books_data, "total": total_books, "skip": skip, "limit": limit}

    except Exception as e:
        print(f"[BOOKS ENDPOINT] Error: {e}")
        raise BookListFetchException(str(e))


@router.get("/{book_id}")
async def get_book(
    book: Book = Depends(get_user_book),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Получает информацию о конкретной книге.

    Args:
        book: Книга (автоматически получена через dependency)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных

    Returns:
        Подробная информация о книге

    Raises:
        BookNotFoundException: Если книга не найдена
        BookAccessDeniedException: Если доступ запрещен
    """
    try:

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
            chapters_data.append(
                {
                    "id": str(chapter.id),
                    "number": chapter.chapter_number,
                    "title": chapter.title,
                    "word_count": chapter.word_count,
                    "estimated_reading_time_minutes": chapter.estimated_reading_time,
                    "is_description_parsed": chapter.is_description_parsed,
                    "descriptions_found": chapter.descriptions_found,
                }
            )

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
                "progress_percent": round(progress_percent, 1),
            },
            "created_at": book.created_at.isoformat(),
            "last_accessed": book.last_accessed.isoformat()
            if book.last_accessed
            else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise BookFetchException(str(e))


@router.get("/{book_id}/file")
async def get_book_file(
    book: Book = Depends(get_user_book),
):
    """
    Возвращает EPUB файл для чтения в epub.js.

    Args:
        book: Книга (автоматически получена через dependency)

    Returns:
        FileResponse с EPUB файлом

    Raises:
        BookNotFoundException: Если книга не найдена
        BookAccessDeniedException: Если доступ запрещен
        BookFileNotFoundException: Если файл книги не найден на сервере
    """
    try:
        # Проверяем существование файла
        if not os.path.exists(book.file_path):
            raise BookFileNotFoundException(book.id)

        # Возвращаем файл
        return FileResponse(
            path=book.file_path,
            media_type="application/epub+zip",
            filename=f"{book.title}.epub",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise BookRetrievalException(str(e))


@router.get("/{book_id}/cover")
async def get_book_cover(
    book: Book = Depends(get_any_book),
):
    """
    Получает обложку книги.

    Args:
        book: Книга (автоматически получена через dependency, публичный доступ)

    Returns:
        Файл обложки книги

    Raises:
        BookNotFoundException: Если книга не найдена
        CoverImageNotFoundException: Если обложка не найдена
    """
    try:
        # Проверяем, есть ли обложка
        if not book.cover_image or not os.path.exists(book.cover_image):
            raise CoverImageNotFoundException(book.id)

        # Возвращаем файл обложки
        return FileResponse(
            path=book.cover_image,
            media_type="image/jpeg",
            filename=f"{book.title}_cover.jpg",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise CoverFetchException(str(e))

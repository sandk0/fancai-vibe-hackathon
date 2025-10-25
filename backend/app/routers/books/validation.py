"""
Validation & preview endpoints для работы с книгами.

Этот модуль содержит операции валидации и предварительного просмотра книг:
- Проверка статуса парсера
- Валидация файлов книг без сохранения
- Предварительный просмотр содержимого книги
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any
import tempfile
import os
from pathlib import Path

from ...services.book_parser import book_parser
from ...services.nlp_processor import nlp_processor


router = APIRouter()


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
        "message": f"Book parser supports: {', '.join(book_parser.get_supported_formats())}",
    }


@router.post("/validate-file")
async def validate_book_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Валидирует загруженный файл книги без сохранения.

    Args:
        file: Загруженный файл

    Returns:
        Результат валидации файла

    Raises:
        HTTPException: 400 если файл невалидный
    """
    # Проверяем базовые параметры файла
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in [".epub", ".fb2"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_extension}. Supported: .epub, .fb2",
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
            "message": "File validated successfully"
            if validation_result["is_valid"]
            else "File validation failed",
        }

    finally:
        # Удаляем временный файл
        try:
            os.unlink(temp_file_path)
        except OSError:
            pass


@router.post("/parse-preview")
async def parse_book_preview(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Парсит книгу и возвращает предварительный просмотр без сохранения в БД.

    Args:
        file: Загруженный файл книги

    Returns:
        Метаданные и превью содержимого книги

    Raises:
        HTTPException: 400 если файл невалидный
    """
    # Валидируем файл
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in [".epub", ".fb2"]:
        raise HTTPException(
            status_code=400, detail=f"Unsupported file type: {file_extension}"
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
            preview_text = (
                chapter.content[:500] + "..."
                if len(chapter.content) > 500
                else chapter.content
            )
            chapters_preview.append(
                {
                    "number": chapter.number,
                    "title": chapter.title,
                    "content_preview": preview_text,
                    "word_count": chapter.word_count,
                    "estimated_reading_time_minutes": max(1, chapter.word_count // 200),
                }
            )

        return {
            "metadata": {
                "title": parsed_book.metadata.title,
                "author": parsed_book.metadata.author,
                "language": parsed_book.metadata.language,
                "genre": parsed_book.metadata.genre,
                "description": parsed_book.metadata.description[:1000] + "..."
                if len(parsed_book.metadata.description) > 1000
                else parsed_book.metadata.description,
                "publisher": parsed_book.metadata.publisher,
                "publish_date": parsed_book.metadata.publish_date,
                "has_cover": parsed_book.metadata.cover_image_data is not None,
            },
            "statistics": {
                "total_chapters": len(parsed_book.chapters),
                "total_pages": parsed_book.total_pages,
                "estimated_reading_time_hours": round(
                    parsed_book.estimated_reading_time / 60, 1
                ),
                "file_format": parsed_book.file_format,
                "file_size_mb": round(file_size / (1024 * 1024), 2),
            },
            "chapters_preview": chapters_preview,
            "message": f"Book parsed successfully: {len(parsed_book.chapters)} chapters found",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing book: {str(e)}")

    finally:
        # Удаляем временный файл
        try:
            os.unlink(temp_file_path)
        except OSError:
            pass

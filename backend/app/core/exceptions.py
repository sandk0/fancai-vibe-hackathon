"""
Custom exception classes для BookReader AI.

Этот модуль содержит специализированные исключения для различных
типов ошибок в приложении, обеспечивая консистентные error messages
и коды статусов.
"""

from fastapi import HTTPException, status
from uuid import UUID
from typing import Optional


# ============================================================================
# Resource Not Found Exceptions (404)
# ============================================================================


class BookNotFoundException(HTTPException):
    """Исключение, когда книга не найдена."""

    def __init__(self, book_id: UUID):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {book_id} not found",
        )


class ChapterNotFoundException(HTTPException):
    """Исключение, когда глава не найдена."""

    def __init__(self, chapter_identifier: int | UUID, book_id: UUID | None = None):
        detail = f"Chapter {chapter_identifier} not found"
        if book_id:
            detail += f" in book {book_id}"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class DescriptionNotFoundException(HTTPException):
    """Исключение, когда описание не найдено."""

    def __init__(self, description_id: UUID):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Description with ID {description_id} not found",
        )


class ImageNotFoundException(HTTPException):
    """Исключение, когда изображение не найдено."""

    def __init__(self, image_id: UUID):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with ID {image_id} not found",
        )


class BookFileNotFoundException(HTTPException):
    """Исключение, когда файл книги не найден на сервере."""

    def __init__(self, book_id: UUID):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book file not found on server for book {book_id}",
        )


class CoverImageNotFoundException(HTTPException):
    """Исключение, когда обложка книги не найдена."""

    def __init__(self, book_id: UUID):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cover image not found for book {book_id}",
        )


# ============================================================================
# Access Denied Exceptions (403)
# ============================================================================


class BookAccessDeniedException(HTTPException):
    """Исключение, когда доступ к книге запрещен."""

    def __init__(self, book_id: UUID):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied to book {book_id}",
        )


class ChapterAccessDeniedException(HTTPException):
    """Исключение, когда доступ к главе запрещен."""

    def __init__(self, chapter_id: UUID):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied to chapter {chapter_id}",
        )


class DescriptionAccessDeniedException(HTTPException):
    """Исключение, когда доступ к описанию запрещен."""

    def __init__(self, description_id: UUID):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Description not found or access denied",
        )


class ImageAccessDeniedException(HTTPException):
    """Исключение, когда доступ к изображению запрещен."""

    def __init__(self, image_id: UUID):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or access denied",
        )


# ============================================================================
# Validation Exceptions (400)
# ============================================================================


class InvalidFileFormatException(HTTPException):
    """Исключение для невалидного формата файла."""

    def __init__(self, file_format: str, supported_formats: list[str] | None = None):
        if supported_formats is None:
            supported_formats = ["EPUB", "FB2"]
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file format: {file_format}. Supported formats: {', '.join(supported_formats)}",
        )


class FileTooLargeException(HTTPException):
    """Исключение для слишком большого файла."""

    def __init__(self, max_size_mb: int = 50):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large (max {max_size_mb}MB)",
        )


class FileTooSmallException(HTTPException):
    """Исключение для слишком маленького файла."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too small",
        )


class NoFilenameProvidedException(HTTPException):
    """Исключение, когда имя файла не предоставлено."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided",
        )


class EmptyTextException(HTTPException):
    """Исключение для пустого текста."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text cannot be empty",
        )


class InvalidDescriptionTypeException(HTTPException):
    """Исключение для невалидного типа описания."""

    def __init__(self, description_type: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid description type: {description_type}",
        )


# ============================================================================
# Conflict Exceptions (409)
# ============================================================================


class ImageAlreadyExistsException(HTTPException):
    """Исключение, когда изображение уже существует для описания."""

    def __init__(self, description_id: UUID):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Image already exists for description {description_id}",
        )


# ============================================================================
# Service Unavailable Exceptions (503)
# ============================================================================


class NLPProcessorUnavailableException(HTTPException):
    """Исключение, когда NLP процессор недоступен."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="NLP processor is not available",
        )


class ParsingServiceUnavailableException(HTTPException):
    """Исключение, когда сервис парсинга недоступен."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Parsing service is currently unavailable",
        )


# ============================================================================
# Internal Server Error Exceptions (500)
# ============================================================================


class BookProcessingException(HTTPException):
    """Исключение при ошибке обработки книги."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing book: {error_message}",
        )


class ChapterFetchException(HTTPException):
    """Исключение при ошибке получения главы."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching chapter: {error_message}",
        )


class DescriptionFetchException(HTTPException):
    """Исключение при ошибке получения описаний."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching descriptions: {error_message}",
        )


class ImageGenerationException(HTTPException):
    """Исключение при ошибке генерации изображения."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image generation failed: {error_message}",
        )


class ImageDeletionException(HTTPException):
    """Исключение при ошибке удаления изображения."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete image: {error_message}",
        )


class ImageRegenerationException(HTTPException):
    """Исключение при ошибке перегенерации изображения."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image regeneration failed: {error_message}",
        )


class FileReadException(HTTPException):
    """Исключение при ошибке чтения файла."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {error_message}",
        )


class BookRetrievalException(HTTPException):
    """Исключение при ошибке получения файла книги."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving book file: {error_message}",
        )


class CoverFetchException(HTTPException):
    """Исключение при ошибке получения обложки."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching cover: {error_message}",
        )


class ParsingStatusException(HTTPException):
    """Исключение при ошибке получения статуса парсинга."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching parsing status: {error_message}",
        )


class BookListFetchException(HTTPException):
    """Исключение при ошибке получения списка книг."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching books: {error_message}",
        )


class BookFetchException(HTTPException):
    """Исключение при ошибке получения книги."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching book: {error_message}",
        )


class ChapterAnalysisException(HTTPException):
    """Исключение при ошибке анализа главы."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing chapter: {error_message}",
        )


class BatchGenerationException(HTTPException):
    """Исключение при ошибке пакетной генерации."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch generation failed: {error_message}",
        )


class UnexpectedGenerationException(HTTPException):
    """Исключение при неожиданной ошибке генерации."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during generation: {error_message}",
        )


class UnexpectedRegenerationException(HTTPException):
    """Исключение при неожиданной ошибке перегенерации."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during regeneration: {error_message}",
        )


class ParsingStartException(HTTPException):
    """Исключение при ошибке запуска парсинга."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting book processing: {error_message}",
        )


class ChapterDescriptionFetchException(HTTPException):
    """Исключение при ошибке получения описаний главы."""

    def __init__(self, error_message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching chapter descriptions: {error_message}",
        )

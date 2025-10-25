"""
Пакет book services - модульная архитектура для работы с книгами.

Применен Single Responsibility Principle (SRP):
- BookService: Core CRUD операции с книгами
- BookProgressService: Прогресс чтения и расчеты
- BookStatisticsService: Статистика и аналитика
- BookParsingService: NLP парсинг и обработка описаний

Каждый сервис имеет одну четко определенную ответственность и может быть
протестирован и использован независимо от других.

Example usage:
    >>> from app.services.book import book_service, book_progress_service
    >>>
    >>> # Получить книги пользователя
    >>> books = await book_service.get_user_books(db, user_id)
    >>>
    >>> # Получить книги с прогрессом
    >>> books_with_progress = await book_progress_service.get_books_with_progress(db, user_id)
    >>>
    >>> # Получить статистику
    >>> from app.services.book import book_statistics_service
    >>> stats = await book_statistics_service.get_book_statistics(db, user_id)
"""

from .book_service import BookService, book_service
from .book_progress_service import BookProgressService, book_progress_service
from .book_statistics_service import BookStatisticsService, book_statistics_service
from .book_parsing_service import BookParsingService, book_parsing_service

__all__ = [
    # Classes
    "BookService",
    "BookProgressService",
    "BookStatisticsService",
    "BookParsingService",
    # Singleton instances (for backward compatibility)
    "book_service",
    "book_progress_service",
    "book_statistics_service",
    "book_parsing_service",
]

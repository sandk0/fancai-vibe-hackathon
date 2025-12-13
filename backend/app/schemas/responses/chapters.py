"""
Response schemas для chapter endpoints в BookReader AI.

Этот модуль содержит type-safe response schemas для endpoints
работы с главами книг, включая навигацию и метаданные.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID

from . import ChapterResponse, DescriptionWithImageResponse


# ============================================================================
# CHAPTER NAVIGATION SCHEMAS
# ============================================================================


class NavigationInfo(BaseModel):
    """
    Информация о навигации между главами.

    Attributes:
        has_previous: Есть ли предыдущая глава
        has_next: Есть ли следующая глава
        previous_chapter: Номер предыдущей главы (optional)
        next_chapter: Номер следующей главы (optional)
    """

    has_previous: bool = Field(description="Has previous chapter")
    has_next: bool = Field(description="Has next chapter")
    previous_chapter: Optional[int] = Field(None, ge=1, description="Previous chapter number")
    next_chapter: Optional[int] = Field(None, ge=1, description="Next chapter number")


class BookMinimalInfo(BaseModel):
    """
    Минимальная информация о книге для контекста главы.

    Attributes:
        id: UUID книги
        title: Название книги
        author: Автор книги (optional)
        total_chapters: Общее количество глав
    """

    id: UUID
    title: str = Field(description="Book title")
    author: Optional[str] = Field(None, description="Book author")
    total_chapters: int = Field(ge=0, description="Total chapters in book")


class ChapterDetailResponse(BaseModel):
    """
    Детальная информация о главе с содержимым и навигацией.

    Используется в GET /api/v1/books/{book_id}/chapters/{chapter_number}.

    Attributes:
        chapter: Информация о главе с содержимым
        descriptions: Список описаний с изображениями
        navigation: Навигационная информация
        book_info: Минимальная информация о книге

    Example:
        {
            "chapter": {
                "id": "uuid",
                "chapter_number": 3,
                "title": "Chapter 3",
                "content": "...",
                "word_count": 3500
            },
            "descriptions": [...],
            "navigation": {
                "has_previous": true,
                "has_next": true,
                "previous_chapter": 2,
                "next_chapter": 4
            },
            "book_info": {
                "id": "uuid",
                "title": "Book Title",
                "author": "Author Name",
                "total_chapters": 15
            }
        }
    """

    chapter: ChapterResponse
    descriptions: List[DescriptionWithImageResponse] = Field(
        default_factory=list, description="Descriptions with generated images"
    )
    navigation: NavigationInfo
    book_info: BookMinimalInfo


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "NavigationInfo",
    "BookMinimalInfo",
    "ChapterDetailResponse",
]

"""
Reusable FastAPI dependencies для BookReader AI.

Этот модуль содержит зависимости, которые можно переиспользовать
в различных endpoints для проверки доступа к ресурсам и их получения.
"""

from uuid import UUID
from typing import Optional, cast
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .database import get_database_session
from .auth import get_current_active_user
from .exceptions import (
    BookNotFoundException,
    BookAccessDeniedException,
    ChapterNotFoundException,
    ChapterAccessDeniedException,
    DescriptionNotFoundException,
    DescriptionAccessDeniedException,
    ImageNotFoundException,
    ImageAccessDeniedException,
)
from ..models.user import User
from ..models.book import Book
from ..models.chapter import Chapter
from ..models.description import Description
from ..models.image import GeneratedImage
from ..services.book import book_service


# ============================================================================
# Book Dependencies
# ============================================================================


async def get_user_book(
    book_id: UUID,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> Book:
    """
    Dependency для получения книги с проверкой доступа пользователя.

    Args:
        book_id: ID книги
        db: Сессия базы данных
        current_user: Текущий аутентифицированный пользователь

    Returns:
        Книга пользователя

    Raises:
        BookNotFoundException: Если книга не найдена
        BookAccessDeniedException: Если пользователь не имеет доступа к книге
    """
    book = await book_service.get_book_by_id(
        db=db, book_id=book_id, user_id=UUID(str(current_user.id))
    )

    if not book:
        # Проверяем, существует ли книга вообще
        result = await db.execute(select(Book).where(Book.id == book_id))
        existing_book = result.scalar_one_or_none()

        if existing_book:
            # Книга существует, но пользователь не имеет доступа
            raise BookAccessDeniedException(book_id)
        else:
            # Книга не существует
            raise BookNotFoundException(book_id)

    return book


async def get_any_book(
    book_id: UUID,
    db: AsyncSession = Depends(get_database_session),
) -> Book:
    """
    Dependency для получения книги без проверки владельца.
    Используется для публичных endpoints (например, обложки).

    Args:
        book_id: ID книги
        db: Сессия базы данных

    Returns:
        Книга

    Raises:
        BookNotFoundException: Если книга не найдена
    """
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()

    if not book:
        raise BookNotFoundException(book_id)

    return book


# ============================================================================
# Chapter Dependencies
# ============================================================================


async def get_user_chapter(
    chapter_id: UUID,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> Chapter:
    """
    Dependency для получения главы с проверкой доступа пользователя.

    Args:
        chapter_id: ID главы
        db: Сессия базы данных
        current_user: Текущий аутентифицированный пользователь

    Returns:
        Глава книги пользователя

    Raises:
        ChapterNotFoundException: Если глава не найдена
        ChapterAccessDeniedException: Если пользователь не имеет доступа к главе
    """
    result = await db.execute(
        select(Chapter)
        .join(Book)
        .where(Chapter.id == chapter_id)
        .where(Book.user_id == current_user.id)
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        # Проверяем, существует ли глава вообще
        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        existing_chapter = result.scalar_one_or_none()

        if existing_chapter:
            # Глава существует, но пользователь не имеет доступа
            raise ChapterAccessDeniedException(chapter_id)
        else:
            # Глава не существует
            raise ChapterNotFoundException(chapter_id)

    return chapter


async def get_chapter_by_number(
    book_id: UUID,
    chapter_number: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> Chapter:
    """
    Dependency для получения главы по номеру в книге.

    Args:
        book_id: ID книги
        chapter_number: Номер главы
        db: Сессия базы данных
        current_user: Текущий аутентифицированный пользователь

    Returns:
        Глава книги

    Raises:
        BookNotFoundException: Если книга не найдена
        BookAccessDeniedException: Если пользователь не имеет доступа к книге
        ChapterNotFoundException: Если глава не найдена
    """
    # Сначала проверяем доступ к книге
    book = await get_user_book(book_id, db, current_user)

    # Ищем главу по номеру
    result = await db.execute(
        select(Chapter)
        .where(Chapter.book_id == book_id)
        .where(Chapter.chapter_number == chapter_number)
    )
    chapter = result.scalar_one_or_none()

    if not chapter:
        raise ChapterNotFoundException(chapter_number, book_id)

    return chapter


# ============================================================================
# Description Dependencies
# ============================================================================


async def get_user_description(
    description_id: UUID,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> Description:
    """
    Dependency для получения описания с проверкой доступа пользователя.

    Args:
        description_id: ID описания
        db: Сессия базы данных
        current_user: Текущий аутентифицированный пользователь

    Returns:
        Описание из книги пользователя

    Raises:
        DescriptionNotFoundException: Если описание не найдено
        DescriptionAccessDeniedException: Если пользователь не имеет доступа
    """
    result = await db.execute(
        select(Description)
        .join(Chapter)
        .join(Book)
        .where(Description.id == description_id)
        .where(Book.user_id == current_user.id)
    )
    description = result.scalar_one_or_none()

    if not description:
        # Проверяем, существует ли описание вообще
        result = await db.execute(
            select(Description).where(Description.id == description_id)
        )
        existing_description = result.scalar_one_or_none()

        if existing_description:
            # Описание существует, но пользователь не имеет доступа
            raise DescriptionAccessDeniedException(description_id)
        else:
            # Описание не существует
            raise DescriptionNotFoundException(description_id)

    return description


# ============================================================================
# Image Dependencies
# ============================================================================


async def get_user_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> GeneratedImage:
    """
    Dependency для получения изображения с проверкой доступа пользователя.

    Args:
        image_id: ID изображения
        db: Сессия базы данных
        current_user: Текущий аутентифицированный пользователь

    Returns:
        Сгенерированное изображение пользователя

    Raises:
        ImageNotFoundException: Если изображение не найдено
        ImageAccessDeniedException: Если пользователь не имеет доступа
    """
    result = await db.execute(
        select(GeneratedImage).where(
            GeneratedImage.id == image_id, GeneratedImage.user_id == current_user.id
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        # Проверяем, существует ли изображение вообще
        result = await db.execute(
            select(GeneratedImage).where(GeneratedImage.id == image_id)
        )
        existing_image = result.scalar_one_or_none()

        if existing_image:
            # Изображение существует, но пользователь не имеет доступа
            raise ImageAccessDeniedException(image_id)
        else:
            # Изображение не существует
            raise ImageNotFoundException(image_id)

    return image


async def get_user_image_with_description(
    image_id: UUID,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> tuple[GeneratedImage, Description]:
    """
    Dependency для получения изображения с его описанием.

    Args:
        image_id: ID изображения
        db: Сессия базы данных
        current_user: Текущий аутентифицированный пользователь

    Returns:
        Кортеж (изображение, описание)

    Raises:
        ImageNotFoundException: Если изображение не найдено
        ImageAccessDeniedException: Если пользователь не имеет доступа
    """
    result = await db.execute(
        select(GeneratedImage, Description)
        .join(Description, GeneratedImage.description_id == Description.id)
        .join(Chapter, Description.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(GeneratedImage.id == image_id)
        .where(Book.user_id == current_user.id)
    )

    row = result.first()

    if not row:
        # Проверяем, существует ли изображение вообще
        result = await db.execute(
            select(GeneratedImage).where(GeneratedImage.id == image_id)
        )
        existing_image = result.scalar_one_or_none()

        if existing_image:
            # Изображение существует, но пользователь не имеет доступа
            raise ImageAccessDeniedException(image_id)
        else:
            # Изображение не существует
            raise ImageNotFoundException(image_id)

    # Cast Row to tuple for type safety
    return cast(tuple[GeneratedImage, Description], tuple(row))


# ============================================================================
# Helper Dependencies
# ============================================================================


def validate_chapter_number_in_book(book: Book, chapter_number: int) -> Chapter | None:
    """
    Проверяет существование главы по номеру в книге.

    Args:
        book: Книга
        chapter_number: Номер главы

    Returns:
        Глава или None если не найдена

    Raises:
        ChapterNotFoundException: Если глава не найдена
    """
    # Приводим к list для итерации (SQLAlchemy relationship может быть Mapped)
    chapters_list = list(book.chapters) if hasattr(book.chapters, '__iter__') else []
    for chapter in chapters_list:
        if chapter.chapter_number == chapter_number:
            return cast(Chapter, chapter)

    raise ChapterNotFoundException(chapter_number, UUID(str(book.id)))

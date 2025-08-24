"""
Сервис для работы с книгами в базе данных BookReader AI.

Содержит бизнес-логику для управления книгами, главами и описаниями.
"""

import os
import shutil
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload

from ..models.user import User, Subscription
from ..models.book import Book, ReadingProgress, BookGenre
from ..models.chapter import Chapter
from ..models.description import Description, DescriptionType
from ..models.image import GeneratedImage
from ..services.book_parser import book_parser, ParsedBook
from ..services.nlp_processor import nlp_processor


class BookService:
    """Сервис для работы с книгами."""
    
    def __init__(self):
        """Инициализация сервиса книг."""
        self.upload_directory = Path("/app/storage/books")
        self.upload_directory.mkdir(parents=True, exist_ok=True)
    
    async def create_book_from_upload(
        self, 
        db: AsyncSession,
        user_id: UUID,
        file_path: str,
        original_filename: str,
        parsed_book: ParsedBook
    ) -> Book:
        """
        Создает запись о книге в базе данных на основе загруженного файла.
        
        Args:
            db: Сессия базы данных
            user_id: ID пользователя-владельца
            file_path: Путь к загруженному файлу
            original_filename: Оригинальное название файла
            parsed_book: Результат парсинга книги
            
        Returns:
            Созданный объект Book
        """
        # Проверяем размер файла
        file_size = os.path.getsize(file_path)
        
        # Создаем запись о книге
        book = Book(
            user_id=user_id,
            title=parsed_book.metadata.title,
            author=parsed_book.metadata.author,
            genre=self._map_genre(parsed_book.metadata.genre),
            language=parsed_book.metadata.language,
            file_path=file_path,
            file_format=parsed_book.file_format,
            file_size=file_size,
            description=parsed_book.metadata.description,
            book_metadata={
                "isbn": parsed_book.metadata.isbn,
                "publisher": parsed_book.metadata.publisher,
                "publish_date": parsed_book.metadata.publish_date,
                "has_cover": parsed_book.metadata.cover_image_data is not None
            },
            total_pages=parsed_book.total_pages,
            estimated_reading_time=parsed_book.estimated_reading_time,
            is_parsed=True,
            parsing_progress=100
        )
        
        db.add(book)
        await db.flush()  # Получаем ID книги
        
        # Сохраняем обложку, если есть
        if parsed_book.metadata.cover_image_data:
            cover_path = await self._save_book_cover(
                book.id, 
                parsed_book.metadata.cover_image_data,
                parsed_book.metadata.cover_image_type
            )
            book.cover_image = str(cover_path)
        
        # Создаем главы
        for chapter_data in parsed_book.chapters:
            chapter = Chapter(
                book_id=book.id,
                chapter_number=chapter_data.number,
                title=chapter_data.title,
                content=chapter_data.content,
                html_content=chapter_data.html_content,
                word_count=chapter_data.word_count,
                estimated_reading_time=max(1, chapter_data.word_count // 200)
            )
            db.add(chapter)
        
        # Создаем прогресс чтения для пользователя
        reading_progress = ReadingProgress(
            user_id=user_id,
            book_id=book.id,
            current_chapter=1,
            current_page=1,
            current_position=0
        )
        db.add(reading_progress)
        
        await db.commit()
        return book
    
    async def get_user_books(
        self, 
        db: AsyncSession, 
        user_id: UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[Book]:
        """
        Получает список книг пользователя.
        
        Args:
            db: Сессия базы данных
            user_id: ID пользователя
            skip: Количество записей для пропуска
            limit: Максимальное количество записей
            
        Returns:
            Список книг пользователя
        """
        result = await db.execute(
            select(Book)
            .where(Book.user_id == user_id)
            .options(selectinload(Book.chapters))
            .options(selectinload(Book.reading_progress))
            .order_by(desc(Book.created_at))
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def get_book_by_id(
        self, 
        db: AsyncSession, 
        book_id: UUID,
        user_id: Optional[UUID] = None
    ) -> Optional[Book]:
        """
        Получает книгу по ID.
        
        Args:
            db: Сессия базы данных
            book_id: ID книги
            user_id: ID пользователя (для проверки доступа)
            
        Returns:
            Объект Book или None
        """
        query = (
            select(Book)
            .options(selectinload(Book.chapters))
            .options(selectinload(Book.reading_progress))
            .where(Book.id == book_id)
        )
        
        if user_id:
            query = query.where(Book.user_id == user_id)
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_book_chapters(
        self, 
        db: AsyncSession, 
        book_id: UUID,
        user_id: Optional[UUID] = None
    ) -> List[Chapter]:
        """
        Получает главы книги.
        
        Args:
            db: Сессия базы данных
            book_id: ID книги
            user_id: ID пользователя (для проверки доступа)
            
        Returns:
            Список глав
        """
        # Проверяем доступ к книге
        if user_id:
            book_check = await db.execute(
                select(Book.id).where(and_(Book.id == book_id, Book.user_id == user_id))
            )
            if not book_check.scalar_one_or_none():
                return []
        
        result = await db.execute(
            select(Chapter)
            .where(Chapter.book_id == book_id)
            .options(selectinload(Chapter.descriptions))
            .order_by(Chapter.chapter_number)
        )
        return result.scalars().all()
    
    async def get_chapter_by_number(
        self, 
        db: AsyncSession, 
        book_id: UUID,
        chapter_number: int,
        user_id: Optional[UUID] = None
    ) -> Optional[Chapter]:
        """
        Получает главу по номеру.
        
        Args:
            db: Сессия базы данных
            book_id: ID книги
            chapter_number: Номер главы
            user_id: ID пользователя (для проверки доступа)
            
        Returns:
            Объект Chapter или None
        """
        # Проверяем доступ к книге
        if user_id:
            book_check = await db.execute(
                select(Book.id).where(and_(Book.id == book_id, Book.user_id == user_id))
            )
            if not book_check.scalar_one_or_none():
                return None
        
        result = await db.execute(
            select(Chapter)
            .where(and_(Chapter.book_id == book_id, Chapter.chapter_number == chapter_number))
            .options(selectinload(Chapter.descriptions))
        )
        return result.scalar_one_or_none()
    
    async def extract_chapter_descriptions(
        self, 
        db: AsyncSession, 
        chapter_id: UUID
    ) -> List[Description]:
        """
        Извлекает описания из главы с помощью NLP и сохраняет в БД.
        
        Args:
            db: Сессия базы данных
            chapter_id: ID главы
            
        Returns:
            Список извлеченных описаний
        """
        # Получаем главу
        result = await db.execute(
            select(Chapter).where(Chapter.id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")
        
        # Проверяем, не обработана ли уже глава
        if chapter.is_description_parsed:
            existing_descriptions = await db.execute(
                select(Description).where(Description.chapter_id == chapter_id)
            )
            return existing_descriptions.scalars().all()
        
        # Извлекаем описания с помощью NLP
        nlp_descriptions = nlp_processor.extract_descriptions_from_text(
            chapter.content, 
            str(chapter.chapter_number)
        )
        
        # Сохраняем описания в базу данных
        saved_descriptions = []
        for desc_data in nlp_descriptions:
            description = Description(
                chapter_id=chapter_id,
                type=desc_data["type"],
                content=desc_data["content"],
                context=desc_data.get("context", ""),
                confidence_score=desc_data["confidence_score"],
                position_in_chapter=desc_data["position_in_chapter"],
                word_count=desc_data["word_count"],
                priority_score=desc_data["priority_score"],
                entities_mentioned=", ".join(desc_data["entities_mentioned"]) if desc_data["entities_mentioned"] else "",
                is_suitable_for_generation=desc_data["confidence_score"] > 0.3  # Минимальный порог
            )
            
            db.add(description)
            saved_descriptions.append(description)
        
        # Обновляем статус главы
        chapter.is_description_parsed = True
        chapter.descriptions_found = len(saved_descriptions)
        chapter.parsing_progress = 100
        chapter.parsed_at = datetime.utcnow()
        
        await db.commit()
        return saved_descriptions
    
    async def get_book_descriptions(
        self, 
        db: AsyncSession, 
        book_id: UUID,
        description_type: Optional[DescriptionType] = None,
        limit: int = 100
    ) -> List[Description]:
        """
        Получает описания из всех глав книги.
        
        Args:
            db: Сессия базы данных
            book_id: ID книги
            description_type: Фильтр по типу описания
            limit: Максимальное количество описаний
            
        Returns:
            Список описаний, отсортированных по приоритету
        """
        query = (
            select(Description)
            .join(Chapter)
            .where(Chapter.book_id == book_id)
            .order_by(desc(Description.priority_score))
            .limit(limit)
        )
        
        if description_type:
            query = query.where(Description.type == description_type)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def update_reading_progress(
        self, 
        db: AsyncSession, 
        user_id: UUID,
        book_id: UUID,
        chapter_number: int,
        page_number: int,
        position: int = 0
    ) -> ReadingProgress:
        """
        Обновляет прогресс чтения книги пользователем.
        
        Args:
            db: Сессия базы данных
            user_id: ID пользователя
            book_id: ID книги
            chapter_number: Номер текущей главы
            page_number: Номер текущей страницы
            position: Позиция в главе
            
        Returns:
            Объект ReadingProgress
        """
        # Получаем книгу для валидации
        book_result = await db.execute(
            select(Book).where(Book.id == book_id)
        )
        book = book_result.scalar_one_or_none()
        if not book:
            raise ValueError(f"Book with id {book_id} not found")
        
        # Загружаем главы для валидации номера главы
        chapters_result = await db.execute(
            select(Chapter).where(Chapter.book_id == book_id)
        )
        chapters = chapters_result.scalars().all()
        total_chapters = len(chapters)
        
        # Валидируем и нормализуем входные данные
        valid_chapter = max(1, min(chapter_number or 1, total_chapters)) if total_chapters > 0 else 1
        valid_page = max(1, page_number or 1)
        valid_position = max(0, position or 0)
        
        # Ищем существующий прогресс
        result = await db.execute(
            select(ReadingProgress)
            .where(and_(ReadingProgress.user_id == user_id, ReadingProgress.book_id == book_id))
        )
        progress = result.scalar_one_or_none()
        
        if not progress:
            # Создаем новый прогресс
            progress = ReadingProgress(
                user_id=user_id,
                book_id=book_id,
                current_chapter=valid_chapter,
                current_page=valid_page,
                current_position=valid_position
            )
            db.add(progress)
        else:
            # Обновляем существующий
            progress.current_chapter = valid_chapter
            progress.current_page = valid_page
            progress.current_position = valid_position
            progress.last_read_at = datetime.utcnow()
        
        # Обновляем время последнего доступа к книге
        await db.execute(
            select(Book).where(Book.id == book_id)
        )
        book = (await db.execute(select(Book).where(Book.id == book_id))).scalar_one()
        book.last_accessed = datetime.utcnow()
        
        await db.commit()
        return progress
    
    async def delete_book(
        self, 
        db: AsyncSession, 
        book_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Удаляет книгу и все связанные данные.
        
        Args:
            db: Сессия базы данных
            book_id: ID книги
            user_id: ID пользователя (для проверки прав)
            
        Returns:
            True если книга успешно удалена
        """
        # Получаем книгу с проверкой прав доступа
        result = await db.execute(
            select(Book)
            .where(and_(Book.id == book_id, Book.user_id == user_id))
        )
        book = result.scalar_one_or_none()
        
        if not book:
            return False
        
        # Удаляем файл книги
        try:
            if os.path.exists(book.file_path):
                os.remove(book.file_path)
        except Exception as e:
            print(f"Warning: Could not delete book file {book.file_path}: {e}")
        
        # Удаляем обложку
        try:
            if book.cover_image and os.path.exists(book.cover_image):
                os.remove(book.cover_image)
        except Exception as e:
            print(f"Warning: Could not delete cover image {book.cover_image}: {e}")
        
        # Удаляем запись из БД (cascade удалит связанные записи)
        await db.delete(book)
        await db.commit()
        
        return True
    
    def _map_genre(self, genre_string: str) -> str:
        """
        Маппит строку жанра в значение перечисления BookGenre.
        
        Args:
            genre_string: Строка жанра из метаданных
            
        Returns:
            Значение BookGenre
        """
        if not genre_string:
            return BookGenre.OTHER.value
        
        genre_lower = genre_string.lower()
        
        # Простой маппинг жанров
        genre_mapping = {
            "fantasy": BookGenre.FANTASY.value,
            "фэнтези": BookGenre.FANTASY.value,
            "detective": BookGenre.DETECTIVE.value,
            "детектив": BookGenre.DETECTIVE.value,
            "science_fiction": BookGenre.SCIFI.value,
            "sci-fi": BookGenre.SCIFI.value,
            "фантастика": BookGenre.SCIFI.value,
            "historical": BookGenre.HISTORICAL.value,
            "исторический": BookGenre.HISTORICAL.value,
            "romance": BookGenre.ROMANCE.value,
            "роман": BookGenre.ROMANCE.value,
            "любовный": BookGenre.ROMANCE.value,
            "thriller": BookGenre.THRILLER.value,
            "триллер": BookGenre.THRILLER.value,
            "horror": BookGenre.HORROR.value,
            "ужасы": BookGenre.HORROR.value,
            "classic": BookGenre.CLASSIC.value,
            "классика": BookGenre.CLASSIC.value
        }
        
        for keyword, genre in genre_mapping.items():
            if keyword in genre_lower:
                return genre
        
        return BookGenre.OTHER.value
    
    async def _save_book_cover(
        self, 
        book_id: UUID, 
        image_data: bytes, 
        content_type: str
    ) -> Path:
        """
        Сохраняет обложку книги.
        
        Args:
            book_id: ID книги
            image_data: Данные изображения
            content_type: MIME-тип изображения
            
        Returns:
            Путь к сохраненному файлу
        """
        # Определяем расширение файла
        extension = "jpg"
        if "png" in content_type:
            extension = "png"
        elif "webp" in content_type:
            extension = "webp"
        
        # Создаем директорию для обложек
        covers_dir = self.upload_directory / "covers"
        covers_dir.mkdir(exist_ok=True)
        
        # Путь к файлу обложки
        cover_path = covers_dir / f"{book_id}.{extension}"
        
        # Сохраняем файл
        with open(cover_path, "wb") as f:
            f.write(image_data)
        
        return cover_path
    
    async def get_book_statistics(
        self, 
        db: AsyncSession, 
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Получает статистику книг пользователя.
        
        Args:
            db: Сессия базы данных
            user_id: ID пользователя
            
        Returns:
            Словарь со статистикой
        """
        # Общее количество книг
        total_books = await db.execute(
            select(func.count(Book.id)).where(Book.user_id == user_id)
        )
        total_books_count = total_books.scalar()
        
        # Количество прочитанных страниц
        total_pages_read = await db.execute(
            select(func.sum(ReadingProgress.current_page))
            .where(ReadingProgress.user_id == user_id)
        )
        pages_read = total_pages_read.scalar() or 0
        
        # Общее время чтения
        total_reading_time = await db.execute(
            select(func.sum(ReadingProgress.reading_time_minutes))
            .where(ReadingProgress.user_id == user_id)
        )
        reading_time = total_reading_time.scalar() or 0
        
        # Количество описаний по типам
        descriptions_by_type = await db.execute(
            select(Description.type, func.count(Description.id))
            .join(Chapter)
            .join(Book)
            .where(Book.user_id == user_id)
            .group_by(Description.type)
        )
        
        descriptions_stats = {}
        for desc_type, count in descriptions_by_type.fetchall():
            descriptions_stats[desc_type.value] = count
        
        return {
            "total_books": total_books_count,
            "total_pages_read": pages_read,
            "total_reading_time_hours": round(reading_time / 60, 1),
            "descriptions_extracted": sum(descriptions_stats.values()),
            "descriptions_by_type": descriptions_stats
        }


# Глобальный экземпляр сервиса
book_service = BookService()
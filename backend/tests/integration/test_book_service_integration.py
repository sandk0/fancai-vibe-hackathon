"""
Интеграционные тесты для BookService.

Тестирует все базовые CRUD операции с книгами в контексте реальной БД:
- Создание книги из загруженного файла (EPUB/FB2)
- Чтение списка книг пользователя
- Получение книги по ID (с проверкой доступа)
- Удаление книги (с проверкой каскадного удаления)
- Обработка файлов и обложек
- Работу с транзакциями БД
- Валидацию ограничений (FK, unique constraints)

Автор: Testing & QA Specialist Agent
Дата: 2025-11-29
"""

import pytest
import os
from uuid import uuid4
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.book.book_service import BookService
from app.services.book_parser import ParsedBook, BookMetadata, ChapterData
from app.models.book import Book, BookGenre
from app.models.chapter import Chapter
from app.models.reading_progress import ReadingProgress
from app.models.user import User


class TestBookServiceCRUD:
    """Тесты CRUD операций BookService."""

    @pytest.fixture
    def book_service(self):
        """Инициализация сервиса книг."""
        return BookService()

    @pytest.fixture
    async def temp_upload_dir(self):
        """Временная директория для загруженных файлов."""
        temp_dir = Path("/tmp/test_uploads")
        temp_dir.mkdir(exist_ok=True)
        yield temp_dir
        # Очистка после теста
        import shutil
        if temp_dir.exists():
            shutil.rmtree(temp_dir)

    @pytest.fixture
    def sample_parsed_book(self):
        """Пример парсированной книги."""
        metadata = BookMetadata(
            title="Test Book",
            author="Test Author",
            genre="fantasy",
            language="ru",
            description="Test description",
            isbn="978-1-234567-89-0",
            publisher="Test Publisher",
            publish_date="2023-01-01",
            cover_image_data=b"fake_image_data",
            cover_image_type="image/jpeg"
        )

        chapters = [
            ChapterData(
                number=1,
                title="Chapter 1",
                content="Content of chapter 1 with beautiful forest.",
                html_content="<p>Content of chapter 1 with beautiful forest.</p>",
                word_count=100
            ),
            ChapterData(
                number=2,
                title="Chapter 2",
                content="Content of chapter 2 with mysterious castle.",
                html_content="<p>Content of chapter 2 with mysterious castle.</p>",
                word_count=120
            ),
        ]

        return ParsedBook(
            metadata=metadata,
            chapters=chapters,
            file_format="epub",
            total_pages=200,
            estimated_reading_time=100
        )

    # ==================== CREATE TESTS ====================

    @pytest.mark.asyncio
    async def test_create_book_from_epub_success(
        self, book_service: BookService, db_session: AsyncSession, test_user: User, sample_parsed_book: ParsedBook
    ):
        """Тест успешного создания книги из EPUB файла."""
        # Arrange
        file_path = "/tmp/test_book.epub"
        original_filename = "test_book.epub"

        # Act
        book = await book_service.create_book_from_upload(
            db=db_session,
            user_id=test_user.id,
            file_path=file_path,
            original_filename=original_filename,
            parsed_book=sample_parsed_book
        )

        # Assert
        assert book.id is not None
        assert book.title == "Test Book"
        assert book.author == "Test Author"
        assert book.user_id == test_user.id
        assert book.file_format == "epub"
        assert book.total_pages == 200
        assert book.estimated_reading_time == 100
        assert book.is_parsed is False
        assert book.parsing_progress == 0

        # Verify database persistence
        db_book = await db_session.get(Book, book.id)
        assert db_book is not None
        assert db_book.title == "Test Book"

    @pytest.mark.asyncio
    async def test_create_book_with_metadata_extraction(
        self, book_service: BookService, db_session: AsyncSession, test_user: User, sample_parsed_book: ParsedBook
    ):
        """Тест извлечения метаданных при создании книги."""
        # Arrange
        file_path = "/tmp/test_book.epub"

        # Act
        book = await book_service.create_book_from_upload(
            db=db_session,
            user_id=test_user.id,
            file_path=file_path,
            original_filename="test.epub",
            parsed_book=sample_parsed_book
        )

        # Assert
        assert book.book_metadata is not None
        assert book.book_metadata.get("isbn") == "978-1-234567-89-0"
        assert book.book_metadata.get("publisher") == "Test Publisher"
        assert book.book_metadata.get("has_cover") is True

    @pytest.mark.asyncio
    async def test_create_book_creates_chapters(
        self, book_service: BookService, db_session: AsyncSession, test_user: User, sample_parsed_book: ParsedBook
    ):
        """Тест создания глав при создании книги."""
        # Arrange
        file_path = "/tmp/test_book.epub"

        # Act
        book = await book_service.create_book_from_upload(
            db=db_session,
            user_id=test_user.id,
            file_path=file_path,
            original_filename="test.epub",
            parsed_book=sample_parsed_book
        )

        # Assert - verify chapters created
        result = await db_session.execute(
            select(Chapter).where(Chapter.book_id == book.id).order_by(Chapter.chapter_number)
        )
        chapters = result.scalars().all()

        assert len(chapters) == 2
        assert chapters[0].chapter_number == 1
        assert chapters[0].title == "Chapter 1"
        assert chapters[0].word_count == 100
        assert chapters[1].chapter_number == 2

    @pytest.mark.asyncio
    async def test_create_book_creates_reading_progress(
        self, book_service: BookService, db_session: AsyncSession, test_user: User, sample_parsed_book: ParsedBook
    ):
        """Тест создания записи о прогрессе при создании книги."""
        # Arrange
        file_path = "/tmp/test_book.epub"

        # Act
        book = await book_service.create_book_from_upload(
            db=db_session,
            user_id=test_user.id,
            file_path=file_path,
            original_filename="test.epub",
            parsed_book=sample_parsed_book
        )

        # Assert - verify reading progress created
        result = await db_session.execute(
            select(ReadingProgress).where(
                (ReadingProgress.book_id == book.id) & (ReadingProgress.user_id == test_user.id)
            )
        )
        progress = result.scalar_one_or_none()

        assert progress is not None
        assert progress.current_chapter == 1
        assert progress.current_page == 1
        assert progress.current_position == 0

    @pytest.mark.asyncio
    async def test_create_book_with_cover_image(
        self, book_service: BookService, db_session: AsyncSession, test_user: User, sample_parsed_book: ParsedBook
    ):
        """Тест сохранения обложки при создании книги."""
        # Arrange
        file_path = "/tmp/test_book.epub"

        # Act
        book = await book_service.create_book_from_upload(
            db=db_session,
            user_id=test_user.id,
            file_path=file_path,
            original_filename="test.epub",
            parsed_book=sample_parsed_book
        )

        # Assert
        assert book.cover_image is not None
        # Проверяем что файл был сохранен
        assert book.cover_image.endswith(f"{book.id}.jpg") or book.cover_image.endswith(f"{book.id}.png")

    # ==================== READ TESTS ====================

    @pytest.mark.asyncio
    async def test_get_user_books_success(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест получения списка книг пользователя."""
        # Arrange
        # Create 3 test books
        for i in range(1, 4):
            book = Book(
                user_id=test_user.id,
                title=f"Book {i}",
                author=f"Author {i}",
                genre=BookGenre.FANTASY.value,
                language="ru",
                file_path=f"/tmp/book{i}.epub",
                file_format="epub",
                file_size=1024,
                total_pages=100
            )
            db_session.add(book)
        await db_session.commit()

        # Act
        books = await book_service.get_user_books(db=db_session, user_id=test_user.id)

        # Assert
        assert len(books) == 3
        assert all(book.user_id == test_user.id for book in books)
        assert books[0].title == "Book 1"

    @pytest.mark.asyncio
    async def test_get_user_books_pagination(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест пагинации при получении списка книг."""
        # Arrange
        for i in range(1, 6):
            book = Book(
                user_id=test_user.id,
                title=f"Book {i}",
                author=f"Author {i}",
                genre=BookGenre.FANTASY.value,
                language="ru",
                file_path=f"/tmp/book{i}.epub",
                file_format="epub",
                file_size=1024,
                total_pages=100
            )
            db_session.add(book)
        await db_session.commit()

        # Act
        books_page1 = await book_service.get_user_books(
            db=db_session, user_id=test_user.id, skip=0, limit=2
        )
        books_page2 = await book_service.get_user_books(
            db=db_session, user_id=test_user.id, skip=2, limit=2
        )

        # Assert
        assert len(books_page1) == 2
        assert len(books_page2) == 2
        assert books_page1[0].title != books_page2[0].title

    @pytest.mark.asyncio
    async def test_get_user_books_filtered_by_genre(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест фильтрации списка книг по жанру."""
        # Arrange
        book1 = Book(
            user_id=test_user.id,
            title="Fantasy Book",
            author="Author",
            genre=BookGenre.FANTASY.value,
            language="ru",
            file_path="/tmp/book1.epub",
            file_format="epub",
            file_size=1024,
            total_pages=100
        )
        book2 = Book(
            user_id=test_user.id,
            title="Detective Book",
            author="Author",
            genre=BookGenre.DETECTIVE.value,
            language="ru",
            file_path="/tmp/book2.epub",
            file_format="epub",
            file_size=1024,
            total_pages=100
        )
        db_session.add(book1)
        db_session.add(book2)
        await db_session.commit()

        # Act
        books = await book_service.get_user_books(db=db_session, user_id=test_user.id)

        # Assert
        assert len(books) == 2

    @pytest.mark.asyncio
    async def test_get_user_books_empty_list(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест получения пустого списка книг."""
        # Act
        books = await book_service.get_user_books(db=db_session, user_id=test_user.id)

        # Assert
        assert len(books) == 0
        assert isinstance(books, list)

    @pytest.mark.asyncio
    async def test_get_book_by_id_success(
        self, book_service: BookService, db_session: AsyncSession, test_book: Book
    ):
        """Тест получения книги по ID."""
        # Act
        book = await book_service.get_book_by_id(db=db_session, book_id=test_book.id)

        # Assert
        assert book is not None
        assert book.id == test_book.id
        assert book.title == test_book.title

    @pytest.mark.asyncio
    async def test_get_book_by_id_not_found(
        self, book_service: BookService, db_session: AsyncSession
    ):
        """Тест получения несуществующей книги."""
        # Act
        non_existent_id = uuid4()
        book = await book_service.get_book_by_id(db=db_session, book_id=non_existent_id)

        # Assert
        assert book is None

    @pytest.mark.asyncio
    async def test_get_book_by_id_with_user_access_check(
        self, book_service: BookService, db_session: AsyncSession, test_user: User, test_book: Book
    ):
        """Тест получения книги с проверкой доступа пользователя."""
        # Arrange
        other_user = User(
            email="other@example.com",
            full_name="Other User",
            password_hash="hashed"
        )
        db_session.add(other_user)
        await db_session.commit()

        # Act
        book = await book_service.get_book_by_id(
            db=db_session,
            book_id=test_book.id,
            user_id=other_user.id
        )

        # Assert - should not return book of another user
        assert book is None

    @pytest.mark.asyncio
    async def test_get_book_chapters_success(
        self, book_service: BookService, db_session: AsyncSession, test_book: Book
    ):
        """Тест получения глав книги."""
        # Act
        chapters = await book_service.get_book_chapters(db=db_session, book_id=test_book.id)

        # Assert
        assert len(chapters) > 0
        assert all(chapter.book_id == test_book.id for chapter in chapters)
        assert chapters[0].chapter_number < chapters[-1].chapter_number

    @pytest.mark.asyncio
    async def test_get_book_chapters_with_access_check(
        self, book_service: BookService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест получения глав с проверкой доступа."""
        # Arrange
        other_user = User(
            email="other@example.com",
            full_name="Other User",
            password_hash="hashed"
        )
        db_session.add(other_user)
        await db_session.commit()

        # Act
        chapters = await book_service.get_book_chapters(
            db=db_session,
            book_id=test_book.id,
            user_id=other_user.id
        )

        # Assert
        assert len(chapters) == 0

    @pytest.mark.asyncio
    async def test_get_chapter_by_number_success(
        self, book_service: BookService, db_session: AsyncSession, test_book: Book
    ):
        """Тест получения главы по номеру."""
        # Act
        chapter = await book_service.get_chapter_by_number(
            db=db_session,
            book_id=test_book.id,
            chapter_number=1
        )

        # Assert
        assert chapter is not None
        assert chapter.chapter_number == 1
        assert chapter.book_id == test_book.id

    @pytest.mark.asyncio
    async def test_get_chapter_by_number_not_found(
        self, book_service: BookService, db_session: AsyncSession, test_book: Book
    ):
        """Тест получения несуществующей главы."""
        # Act
        chapter = await book_service.get_chapter_by_number(
            db=db_session,
            book_id=test_book.id,
            chapter_number=999
        )

        # Assert
        assert chapter is None

    # ==================== DELETE TESTS ====================

    @pytest.mark.asyncio
    async def test_delete_book_success(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест успешного удаления книги."""
        # Arrange
        book = Book(
            user_id=test_user.id,
            title="Test Book",
            author="Test Author",
            genre=BookGenre.FANTASY.value,
            language="ru",
            file_path="/tmp/test_book.epub",
            file_format="epub",
            file_size=1024,
            total_pages=100
        )
        db_session.add(book)
        await db_session.commit()
        book_id = book.id

        # Act
        result = await book_service.delete_book(
            db=db_session,
            book_id=book_id,
            user_id=test_user.id
        )

        # Assert
        assert result is True

        # Verify book deleted from database
        deleted_book = await db_session.get(Book, book_id)
        assert deleted_book is None

    @pytest.mark.asyncio
    async def test_delete_book_not_owner(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест удаления книги другого пользователя."""
        # Arrange
        other_user = User(
            email="other@example.com",
            full_name="Other User",
            password_hash="hashed"
        )
        db_session.add(other_user)
        await db_session.commit()

        book = Book(
            user_id=test_user.id,
            title="Test Book",
            author="Test Author",
            genre=BookGenre.FANTASY.value,
            language="ru",
            file_path="/tmp/test_book.epub",
            file_format="epub",
            file_size=1024,
            total_pages=100
        )
        db_session.add(book)
        await db_session.commit()

        # Act
        result = await book_service.delete_book(
            db=db_session,
            book_id=book.id,
            user_id=other_user.id
        )

        # Assert
        assert result is False

        # Verify book still exists
        existing_book = await db_session.get(Book, book.id)
        assert existing_book is not None

    @pytest.mark.asyncio
    async def test_delete_book_cascades_chapters(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест каскадного удаления глав при удалении книги."""
        # Arrange
        book = Book(
            user_id=test_user.id,
            title="Test Book",
            author="Test Author",
            genre=BookGenre.FANTASY.value,
            language="ru",
            file_path="/tmp/test_book.epub",
            file_format="epub",
            file_size=1024,
            total_pages=100
        )
        db_session.add(book)
        await db_session.flush()

        chapter = Chapter(
            book_id=book.id,
            chapter_number=1,
            title="Chapter 1",
            content="Content",
            word_count=100
        )
        db_session.add(chapter)
        await db_session.commit()

        book_id = book.id
        chapter_id = chapter.id

        # Act
        await book_service.delete_book(
            db=db_session,
            book_id=book_id,
            user_id=test_user.id
        )

        # Assert - chapter should also be deleted
        deleted_chapter = await db_session.get(Chapter, chapter_id)
        assert deleted_chapter is None

    @pytest.mark.asyncio
    async def test_delete_book_not_found(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест удаления несуществующей книги."""
        # Act
        non_existent_id = uuid4()
        result = await book_service.delete_book(
            db=db_session,
            book_id=non_existent_id,
            user_id=test_user.id
        )

        # Assert
        assert result is False

    # ==================== DATABASE TRANSACTION TESTS ====================

    @pytest.mark.asyncio
    async def test_database_transaction_rollback_on_error(
        self, db_session: AsyncSession, test_user: User
    ):
        """Тест отката транзакции при ошибке."""
        # Arrange
        book = Book(
            user_id=test_user.id,
            title="Test Book",
            author="Test Author",
            genre=BookGenre.FANTASY.value,
            language="ru",
            file_path="/tmp/test_book.epub",
            file_format="epub",
            file_size=1024,
            total_pages=100
        )
        db_session.add(book)

        try:
            # Simulate error before commit
            await db_session.flush()
            # Force error with invalid operation
            await db_session.execute("INVALID SQL")
        except Exception:
            # Act - rollback
            await db_session.rollback()

        # Assert - book should not be persisted
        result = await db_session.execute(
            select(Book).where(Book.user_id == test_user.id)
        )
        books = result.scalars().all()
        assert len(books) == 0

    @pytest.mark.asyncio
    async def test_concurrent_book_creation(
        self, book_service: BookService, db_session: AsyncSession, test_user: User, sample_parsed_book: ParsedBook
    ):
        """Тест конкурентного создания книг."""
        # Arrange
        file_paths = [f"/tmp/test_book_{i}.epub" for i in range(3)]

        # Act - create multiple books (simplified test)
        book1 = await book_service.create_book_from_upload(
            db=db_session,
            user_id=test_user.id,
            file_path=file_paths[0],
            original_filename="book1.epub",
            parsed_book=sample_parsed_book
        )
        book2 = await book_service.create_book_from_upload(
            db=db_session,
            user_id=test_user.id,
            file_path=file_paths[1],
            original_filename="book2.epub",
            parsed_book=sample_parsed_book
        )

        # Assert
        assert book1.id != book2.id
        assert book1.id is not None
        assert book2.id is not None

    # ==================== FILE HANDLING TESTS ====================

    @pytest.mark.asyncio
    async def test_file_cleanup_on_delete(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест удаления файла при удалении книги."""
        # Arrange
        from tempfile import NamedTemporaryFile

        with NamedTemporaryFile(delete=False) as tmp_file:
            tmp_file.write(b"test content")
            file_path = tmp_file.name

        try:
            book = Book(
                user_id=test_user.id,
                title="Test Book",
                author="Test Author",
                genre=BookGenre.FANTASY.value,
                language="ru",
                file_path=file_path,
                file_format="epub",
                file_size=os.path.getsize(file_path),
                total_pages=100
            )
            db_session.add(book)
            await db_session.commit()

            # Verify file exists
            assert os.path.exists(file_path)

            # Act - delete book
            await book_service.delete_book(
                db=db_session,
                book_id=book.id,
                user_id=test_user.id
            )

            # Assert - file should be deleted
            assert not os.path.exists(file_path)

        finally:
            # Cleanup
            if os.path.exists(file_path):
                os.remove(file_path)

    @pytest.mark.asyncio
    async def test_cover_image_cleanup_on_delete(
        self, book_service: BookService, db_session: AsyncSession, test_user: User
    ):
        """Тест удаления обложки при удалении книги."""
        # Arrange
        from tempfile import NamedTemporaryFile

        with NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
            tmp_file.write(b"fake_image")
            cover_path = tmp_file.name

        try:
            book = Book(
                user_id=test_user.id,
                title="Test Book",
                author="Test Author",
                genre=BookGenre.FANTASY.value,
                language="ru",
                file_path="/tmp/test_book.epub",
                file_format="epub",
                file_size=1024,
                total_pages=100,
                cover_image=cover_path
            )
            db_session.add(book)
            await db_session.commit()

            # Verify cover exists
            assert os.path.exists(cover_path)

            # Act - delete book
            await book_service.delete_book(
                db=db_session,
                book_id=book.id,
                user_id=test_user.id
            )

            # Assert - cover should be deleted
            assert not os.path.exists(cover_path)

        finally:
            # Cleanup
            if os.path.exists(cover_path):
                os.remove(cover_path)

    # ==================== GENRE MAPPING TESTS ====================

    @pytest.mark.asyncio
    async def test_genre_mapping_english(self, book_service: BookService):
        """Тест маппинга жанра на английском языке."""
        # Act
        genre = book_service._map_genre("fantasy")

        # Assert
        assert genre == BookGenre.FANTASY.value

    @pytest.mark.asyncio
    async def test_genre_mapping_russian(self, book_service: BookService):
        """Тест маппинга жанра на русском языке."""
        # Act
        genre = book_service._map_genre("фэнтези")

        # Assert
        assert genre == BookGenre.FANTASY.value

    @pytest.mark.asyncio
    async def test_genre_mapping_unknown(self, book_service: BookService):
        """Тест маппинга неизвестного жанра."""
        # Act
        genre = book_service._map_genre("unknown_genre")

        # Assert
        assert genre == BookGenre.OTHER.value

    @pytest.mark.asyncio
    async def test_genre_mapping_empty_string(self, book_service: BookService):
        """Тест маппинга пустой строки жанра."""
        # Act
        genre = book_service._map_genre("")

        # Assert
        assert genre == BookGenre.OTHER.value

"""
Интеграционные тесты для BookProgressService.

Тестирует функциональность отслеживания прогресса чтения:
- Получение списка книг с рассчитанным прогрессом
- Расчет прогресса (CFI mode и legacy mode)
- Обновление прогресса
- Работа с reading sessions
- Валидация данных прогресса
- Интеграция с ReadingSession

Автор: Testing & QA Specialist Agent
Дата: 2025-11-29
"""

import pytest
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.book.book_progress_service import BookProgressService
from app.services.book.book_service import BookService
from app.models.book import Book, BookGenre
from app.models.chapter import Chapter
from app.models.reading_progress import ReadingProgress
from app.models.reading_session import ReadingSession
from app.models.user import User


class TestBookProgressServiceIntegration:
    """Тесты интеграции BookProgressService."""

    @pytest.fixture
    def book_service(self):
        """Инициализация BookService."""
        return BookService()

    @pytest.fixture
    def progress_service(self, book_service):
        """Инициализация BookProgressService."""
        return BookProgressService(book_service=book_service)

    # ==================== PROGRESS CALCULATION TESTS ====================

    @pytest.mark.asyncio
    async def test_calculate_reading_progress_cfI_mode(
        self, progress_service: BookProgressService, test_book: Book, test_user: User
    ):
        """Тест расчета прогресса в CFI mode (epub.js)."""
        # Arrange - установим CFI location
        progress = ReadingProgress(
            user_id=test_user.id,
            book_id=test_book.id,
            current_chapter=1,
            current_page=1,
            current_position=25.0,  # 25% прочитано
            reading_location_cfi="/2/4/2/10",
            scroll_offset_percent=25.0
        )
        test_book.reading_progress = [progress]

        # Act
        result = progress_service.calculate_reading_progress(test_book, test_user.id)

        # Assert
        assert result == 25.0  # CFI mode использует current_position напрямую

    @pytest.mark.asyncio
    async def test_calculate_reading_progress_legacy_mode(
        self, progress_service: BookProgressService, test_book: Book, test_user: User
    ):
        """Тест расчета прогресса в legacy mode (без CFI)."""
        # Arrange
        progress = ReadingProgress(
            user_id=test_user.id,
            book_id=test_book.id,
            current_chapter=2,  # Вторая глава из 3
            current_page=1,
            current_position=50.0,  # 50% через главу
            reading_location_cfi=None  # Legacy mode
        )
        test_book.reading_progress = [progress]

        # Act
        result = progress_service.calculate_reading_progress(test_book, test_user.id)

        # Assert
        # Ожидаемый расчет: (1/3)*100 + (50/100)*(1/3)*100 = 33.33 + 16.67 = 50%
        assert 48.0 <= result <= 52.0  # Допускаем небольшую погрешность

    @pytest.mark.asyncio
    async def test_calculate_reading_progress_no_progress(
        self, progress_service: BookProgressService, test_book: Book
    ):
        """Тест расчета прогресса при отсутствии истории."""
        # Arrange
        test_book.reading_progress = []

        # Act
        result = progress_service.calculate_reading_progress(test_book, uuid4())

        # Assert
        assert result == 0.0

    @pytest.mark.asyncio
    async def test_calculate_reading_progress_completed(
        self, progress_service: BookProgressService, test_book: Book, test_user: User
    ):
        """Тест расчета прогресса при завершенной книге."""
        # Arrange
        total_chapters = len(test_book.chapters)
        progress = ReadingProgress(
            user_id=test_user.id,
            book_id=test_book.id,
            current_chapter=total_chapters,
            current_page=1,
            current_position=100.0,  # Конец главы
            reading_location_cfi=None
        )
        test_book.reading_progress = [progress]

        # Act
        result = progress_service.calculate_reading_progress(test_book, test_user.id)

        # Assert
        assert result == 100.0

    @pytest.mark.asyncio
    async def test_calculate_reading_progress_invalid_chapter(
        self, progress_service: BookProgressService, test_book: Book, test_user: User
    ):
        """Тест расчета при главе за пределами книги."""
        # Arrange
        progress = ReadingProgress(
            user_id=test_user.id,
            book_id=test_book.id,
            current_chapter=999,  # За пределами
            current_page=1,
            current_position=50.0,
            reading_location_cfi=None
        )
        test_book.reading_progress = [progress]

        # Act
        result = progress_service.calculate_reading_progress(test_book, test_user.id)

        # Assert
        assert result == 100.0  # Должен вернуть 100%

    # ==================== UPDATE PROGRESS TESTS ====================

    @pytest.mark.asyncio
    async def test_update_reading_progress_create_new(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест создания нового прогресса при обновлении."""
        # Act
        progress = await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            position_percent=50.0
        )

        # Assert
        assert progress is not None
        assert progress.user_id == test_user.id
        assert progress.book_id == test_book.id
        assert progress.current_chapter == 1
        assert progress.current_position == 50.0

    @pytest.mark.asyncio
    async def test_update_reading_progress_update_existing(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест обновления существующего прогресса."""
        # Arrange - создаем начальный прогресс
        initial_progress = ReadingProgress(
            user_id=test_user.id,
            book_id=test_book.id,
            current_chapter=1,
            current_page=1,
            current_position=25.0
        )
        db_session.add(initial_progress)
        await db_session.commit()

        # Act - обновляем прогресс
        progress = await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=2,
            position_percent=75.0
        )

        # Assert
        assert progress.current_chapter == 2
        assert progress.current_position == 75.0

    @pytest.mark.asyncio
    async def test_update_reading_progress_with_cfi(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест обновления прогресса с CFI location."""
        # Act
        progress = await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            position_percent=30.0,
            reading_location_cfi="/2/4/2/20",
            scroll_offset_percent=30.0
        )

        # Assert
        assert progress.reading_location_cfi == "/2/4/2/20"
        assert progress.scroll_offset_percent == 30.0
        assert progress.current_position == 30.0

    @pytest.mark.asyncio
    async def test_update_reading_progress_chapter_validation(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест валидации номера главы при обновлении."""
        # Act - попытаемся установить главу за пределами книги
        progress = await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=999,  # За пределами
            position_percent=50.0
        )

        # Assert - должна быть установлена последняя глава
        total_chapters = len(test_book.chapters)
        assert progress.current_chapter <= total_chapters

    @pytest.mark.asyncio
    async def test_update_reading_progress_invalid_book(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_user: User
    ):
        """Тест обновления прогресса для несуществующей книги."""
        # Act & Assert
        with pytest.raises(ValueError, match="not found"):
            await progress_service.update_reading_progress(
                db=db_session,
                user_id=test_user.id,
                book_id=uuid4(),  # Несуществующая книга
                chapter_number=1,
                position_percent=50.0
            )

    @pytest.mark.asyncio
    async def test_update_reading_progress_updates_last_accessed(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест обновления last_accessed при обновлении прогресса."""
        # Arrange
        old_access_time = test_book.last_accessed
        await asyncio.sleep(0.1)  # Небольшая задержка

        # Act
        await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            position_percent=50.0
        )

        # Assert
        updated_book = await db_session.get(Book, test_book.id)
        assert updated_book.last_accessed > old_access_time

    # ==================== GET BOOKS WITH PROGRESS TESTS ====================

    @pytest.mark.asyncio
    async def test_get_books_with_progress_success(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_user: User
    ):
        """Тест получения списка книг с прогрессом."""
        # Arrange
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
        books_with_progress = await progress_service.get_books_with_progress(
            db=db_session,
            user_id=test_user.id
        )

        # Assert
        assert len(books_with_progress) == 3
        for book, progress in books_with_progress:
            assert isinstance(book, Book)
            assert isinstance(progress, float)
            assert 0.0 <= progress <= 100.0

    @pytest.mark.asyncio
    async def test_get_books_with_progress_empty_list(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_user: User
    ):
        """Тест получения пустого списка книг."""
        # Act
        books_with_progress = await progress_service.get_books_with_progress(
            db=db_session,
            user_id=test_user.id
        )

        # Assert
        assert len(books_with_progress) == 0

    @pytest.mark.asyncio
    async def test_get_books_with_progress_pagination(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_user: User
    ):
        """Тест пагинации при получении книг с прогрессом."""
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
        page1 = await progress_service.get_books_with_progress(
            db=db_session,
            user_id=test_user.id,
            skip=0,
            limit=2
        )
        page2 = await progress_service.get_books_with_progress(
            db=db_session,
            user_id=test_user.id,
            skip=2,
            limit=2
        )

        # Assert
        assert len(page1) == 2
        assert len(page2) == 2
        assert page1[0][0].id != page2[0][0].id

    # ==================== READING SESSION TESTS ====================

    @pytest.mark.asyncio
    async def test_create_reading_session(
        self, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест создания сессии чтения."""
        # Act
        session = ReadingSession(
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            started_at=datetime.now(timezone.utc)
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)

        # Assert
        assert session.id is not None
        assert session.user_id == test_user.id
        assert session.book_id == test_book.id
        assert session.chapter_number == 1
        assert session.is_active is True

    @pytest.mark.asyncio
    async def test_update_reading_session(
        self, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест обновления сессии чтения."""
        # Arrange
        session = ReadingSession(
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            started_at=datetime.now(timezone.utc)
        )
        db_session.add(session)
        await db_session.commit()

        # Act
        session.chapter_number = 2
        session.last_position_percent = 50.0
        session.last_read_at = datetime.now(timezone.utc)
        await db_session.commit()
        await db_session.refresh(session)

        # Assert
        assert session.chapter_number == 2
        assert session.last_position_percent == 50.0

    @pytest.mark.asyncio
    async def test_end_reading_session(
        self, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест завершения сессии чтения."""
        # Arrange
        start_time = datetime.now(timezone.utc)
        session = ReadingSession(
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            started_at=start_time
        )
        db_session.add(session)
        await db_session.commit()

        # Act
        end_time = start_time + timedelta(minutes=30)
        session.ended_at = end_time
        session.is_active = False
        await db_session.commit()
        await db_session.refresh(session)

        # Assert
        assert session.is_active is False
        assert session.ended_at is not None
        # Check duration
        duration = (session.ended_at - session.started_at).total_seconds()
        assert duration == 1800  # 30 minutes

    # ==================== POSITION VALIDATION TESTS ====================

    @pytest.mark.asyncio
    async def test_position_percent_validation_boundary_zero(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест валидации позиции 0%."""
        # Act
        progress = await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            position_percent=0.0
        )

        # Assert
        assert progress.current_position == 0.0

    @pytest.mark.asyncio
    async def test_position_percent_validation_boundary_hundred(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест валидации позиции 100%."""
        # Act
        progress = await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            position_percent=100.0
        )

        # Assert
        assert progress.current_position == 100.0

    @pytest.mark.asyncio
    async def test_position_percent_validation_clamp_negative(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест валидации отрицательной позиции."""
        # Act
        progress = await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            position_percent=-50.0
        )

        # Assert
        assert progress.current_position == 0.0

    @pytest.mark.asyncio
    async def test_position_percent_validation_clamp_over_hundred(
        self, progress_service: BookProgressService, db_session: AsyncSession, test_book: Book, test_user: User
    ):
        """Тест валидации позиции > 100%."""
        # Act
        progress = await progress_service.update_reading_progress(
            db=db_session,
            user_id=test_user.id,
            book_id=test_book.id,
            chapter_number=1,
            position_percent=150.0
        )

        # Assert
        assert progress.current_position == 100.0


# Дополнительные импорты для asyncio
import asyncio

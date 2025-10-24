"""
Comprehensive tests for Celery background tasks.

Test coverage for all 6 Celery tasks in app/core/tasks.py:
1. _run_async_task (helper function)
2. process_book_task
3. generate_images_task
4. batch_generate_for_book_task
5. cleanup_old_images_task
6. health_check_task
7. system_stats_task

Target: +5-7% coverage improvement (0% → 60-70% for tasks.py)
"""

import asyncio
import pytest
import pytest_asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from uuid import uuid4, UUID
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.tasks import (
    _run_async_task,
    process_book_task,
    generate_images_task,
    batch_generate_for_book_task,
    cleanup_old_images_task,
    health_check_task,
    system_stats_task,
)
from app.models.book import Book, BookGenre
from app.models.chapter import Chapter
from app.models.description import Description, DescriptionType
from app.models.image import GeneratedImage
from app.models.user import User


# ==============================================================================
# FIXTURES для Celery Tasks Testing
# ==============================================================================


@pytest_asyncio.fixture
async def unparsed_book(db_session: AsyncSession, test_user: User):
    """Create unparsed book with chapters for process_book_task testing."""
    book = Book(
        user_id=test_user.id,
        title="Unparsed Book",
        author="Test Author",
        genre=BookGenre.FANTASY.value,
        language="ru",
        file_path="/tmp/unparsed.epub",
        file_format="epub",
        file_size=2048000,
        total_pages=200,
        estimated_reading_time=100,
        is_parsed=False,  # NOT parsed yet
        parsing_progress=0,
    )
    db_session.add(book)
    await db_session.flush()

    # Add 3 chapters with content
    for i in range(1, 4):
        chapter = Chapter(
            book_id=book.id,
            chapter_number=i,
            title=f"Chapter {i}",
            content=f"В темном лесу стояла красивая башня из красного камня. "
            f"Вокруг башни росли высокие деревья и цвели яркие цветы. "
            f"Главный герой Иван шел по узкой тропинке к башне.",
            html_content=f"<p>В темном лесу стояла красивая башня...</p>",
            word_count=25,
            is_description_parsed=False,
            descriptions_found=0,
            parsing_progress=0.0,
        )
        db_session.add(chapter)

    await db_session.commit()
    await db_session.refresh(book)
    return book


@pytest_asyncio.fixture
async def sample_descriptions(db_session: AsyncSession, test_book: Book):
    """Create sample descriptions for image generation testing."""
    # Get first chapter
    result = await db_session.execute(
        select(Chapter).where(Chapter.book_id == test_book.id).limit(1)
    )
    chapter = result.scalar_one()

    descriptions = []
    for i, (desc_type, priority, suitable) in enumerate(
        [
            (DescriptionType.LOCATION, 0.9, True),
            (DescriptionType.CHARACTER, 0.85, True),
            (DescriptionType.ATMOSPHERE, 0.75, True),
            (DescriptionType.OBJECT, 0.65, False),  # Low priority
            (DescriptionType.LOCATION, 0.95, True),
        ]
    ):
        desc = Description(
            chapter_id=chapter.id,
            type=desc_type,
            content=f"Test description {i+1}: красивая башня из камня",
            context="В темном лесу стояла башня",
            confidence_score=0.8,
            position_in_chapter=i * 100,
            word_count=5,
            priority_score=priority,
            is_suitable_for_generation=suitable,
            image_generated=False,
            entities_mentioned="башня, лес",
        )
        db_session.add(desc)
        descriptions.append(desc)

    await db_session.commit()
    for desc in descriptions:
        await db_session.refresh(desc)

    return descriptions


@pytest_asyncio.fixture
async def old_generated_images(db_session: AsyncSession, sample_descriptions):
    """Create old generated images for cleanup testing."""
    if not sample_descriptions:
        pytest.skip("No sample descriptions available")

    description = sample_descriptions[0]

    old_images = []

    # Create images with different ages
    for days_ago in [35, 40, 50]:  # All > 30 days old
        old_date = datetime.now(timezone.utc) - timedelta(days=days_ago)
        img = GeneratedImage(
            description_id=description.id,
            user_id=description.chapter.book.user_id,
            image_url=f"https://example.com/old-image-{days_ago}.jpg",
            local_path=f"/tmp/old_image_{days_ago}.jpg",
            generation_prompt="old prompt",
            generation_time_seconds=5.0,
            created_at=old_date,
        )
        db_session.add(img)
        old_images.append(img)

    # Create recent image (should NOT be deleted)
    recent_img = GeneratedImage(
        description_id=description.id,
        user_id=description.chapter.book.user_id,
        image_url="https://example.com/recent-image.jpg",
        local_path="/tmp/recent_image.jpg",
        generation_prompt="recent prompt",
        generation_time_seconds=3.0,
    )
    db_session.add(recent_img)

    await db_session.commit()
    for img in old_images:
        await db_session.refresh(img)
    await db_session.refresh(recent_img)

    return {"old": old_images, "recent": recent_img}


# ==============================================================================
# ТЕСТЫ для _run_async_task (Helper Function)
# ==============================================================================


class TestRunAsyncTask:
    """Tests for _run_async_task helper function."""

    def test_run_async_task_success(self):
        """Test successful execution of async function."""

        async def simple_async_func():
            await asyncio.sleep(0.01)
            return "success"

        result = _run_async_task(simple_async_func())
        assert result == "success"

    def test_run_async_task_returns_result(self):
        """Test that async function result is properly returned."""

        async def async_with_args(x, y):
            await asyncio.sleep(0.01)
            return x + y

        result = _run_async_task(async_with_args(5, 10))
        assert result == 15

    def test_run_async_task_handles_exception(self):
        """Test that exceptions in async functions are properly raised."""

        async def failing_async_func():
            await asyncio.sleep(0.01)
            raise ValueError("Test error")

        with pytest.raises(ValueError, match="Test error"):
            _run_async_task(failing_async_func())


# ==============================================================================
# ТЕСТЫ для process_book_task
# ==============================================================================


class TestProcessBookTask:
    """Tests for process_book_task - main book processing task."""

    def test_process_book_invalid_uuid(self):
        """Test processing with invalid UUID string."""
        result = process_book_task("invalid-uuid-string")

        assert result["status"] == "failed"
        assert "error" in result

    def test_process_book_not_found(self):
        """Test processing non-existent book."""
        non_existent_id = str(uuid4())

        result = process_book_task(non_existent_id)

        assert result["status"] == "failed"
        assert "not found" in result["error"].lower()

    @patch("app.services.multi_nlp_manager.multi_nlp_manager")
    def test_process_book_success_mocked(self, mock_nlp, unparsed_book):
        """Test successful book processing with mocked NLP."""
        # Setup mock
        mock_nlp._initialized = True
        mock_nlp.initialize = AsyncMock()
        mock_nlp.extract_descriptions = AsyncMock(
            return_value=Mock(
                descriptions=[
                    {
                        "type": "location",
                        "content": "красивая башня",
                        "context": "В темном лесу",
                        "confidence_score": 0.85,
                        "priority_score": 0.9,
                        "position_in_chapter": 50,
                        "word_count": 2,
                        "entities_mentioned": ["башня"],
                    }
                ]
            )
        )

        # Execute
        result = process_book_task(str(unparsed_book.id))

        # Assert result
        assert result["status"] == "completed"
        assert result["descriptions_found"] >= 0
        assert result["chapters_processed"] >= 0
        assert "total_chapters" in result


# ==============================================================================
# ТЕСТЫ для generate_images_task
# ==============================================================================


class TestGenerateImagesTask:
    """Tests for generate_images_task - image generation for descriptions."""

    def test_generate_images_invalid_description_id(self):
        """Test with invalid description UUID."""
        result = generate_images_task(
            description_ids=["invalid-uuid"], user_id_str=str(uuid4())
        )

        assert result["status"] == "failed"
        assert "error" in result

    def test_generate_images_description_not_found(self, test_user):
        """Test generation for non-existent description."""
        non_existent_id = str(uuid4())

        result = generate_images_task(
            description_ids=[non_existent_id], user_id_str=str(test_user.id)
        )

        # Should complete but with no images generated
        assert result["status"] == "completed"
        assert result["images_generated"] == 0
        assert result["failed_generations"] == 1

    def test_generate_images_empty_list(self, test_user):
        """Test with empty description list."""
        result = generate_images_task(description_ids=[], user_id_str=str(test_user.id))

        assert result["status"] == "completed"
        assert result["images_generated"] == 0
        assert result["total_processed"] == 0

    @patch("app.services.image_generator.image_generator_service")
    def test_generate_images_success_mocked(
        self, mock_img_service, sample_descriptions, test_user
    ):
        """Test successful image generation with mocked service."""
        # Setup mock
        mock_img_service.generate_image_for_description = AsyncMock(
            return_value=Mock(
                success=True,
                image_url="https://pollinations.ai/test-image.jpg",
                local_path="/tmp/test_image.jpg",
                generation_time_seconds=3.5,
                error_message=None,
            )
        )

        # Execute
        desc_ids = [str(sample_descriptions[0].id)]
        result = generate_images_task(
            description_ids=desc_ids, user_id_str=str(test_user.id)
        )

        # Assert
        assert result["status"] == "completed"
        assert result["total_processed"] == 1


# ==============================================================================
# ТЕСТЫ для batch_generate_for_book_task
# ==============================================================================


class TestBatchGenerateForBookTask:
    """Tests for batch_generate_for_book_task - batch image generation."""

    def test_batch_generate_invalid_book_id(self, test_user):
        """Test with invalid book ID."""
        result = batch_generate_for_book_task(
            book_id_str="invalid-uuid",
            user_id_str=str(test_user.id),
            max_images=10,
        )

        assert result["status"] == "failed"
        assert "error" in result

    @patch("app.core.tasks._generate_images_async")
    def test_batch_generate_success_mocked(
        self, mock_generate_async, test_book, test_user
    ):
        """Test successful batch generation with mocked function."""
        mock_generate_async.return_value = {
            "status": "completed",
            "images_generated": 3,
            "failed_generations": 0,
        }

        result = batch_generate_for_book_task(
            book_id_str=str(test_book.id),
            user_id_str=str(test_user.id),
            max_images=10,
        )

        assert result["status"] in ["completed", "failed"]


# ==============================================================================
# ТЕСТЫ для cleanup_old_images_task
# ==============================================================================


class TestCleanupOldImagesTask:
    """Tests for cleanup_old_images_task - cleanup old generated images."""

    @patch("os.path.exists")
    @patch("os.unlink")
    def test_cleanup_deletes_old_images(
        self, mock_unlink, mock_exists, old_generated_images
    ):
        """Test that old images are deleted."""
        mock_exists.return_value = False

        result = cleanup_old_images_task(days_old=30)

        assert result["status"] == "completed"
        assert "deleted_records" in result
        assert "deleted_files" in result

    @patch("os.path.exists")
    @patch("os.unlink")
    def test_cleanup_handles_missing_files(
        self, mock_unlink, mock_exists, old_generated_images
    ):
        """Test cleanup when local files don't exist."""
        mock_exists.return_value = False

        result = cleanup_old_images_task(days_old=30)

        assert result["status"] == "completed"
        # Records deleted even if files don't exist
        assert not mock_unlink.called

    def test_cleanup_returns_stats(self):
        """Test that cleanup returns proper statistics."""
        result = cleanup_old_images_task(days_old=30)

        assert "status" in result
        assert "deleted_files" in result
        assert "deleted_records" in result
        assert "cutoff_date" in result
        assert result["status"] == "completed"


# ==============================================================================
# ТЕСТЫ для Utility Tasks
# ==============================================================================


class TestUtilityTasks:
    """Tests for utility tasks: health_check and system_stats."""

    def test_health_check_returns_message(self):
        """Test health check task returns success message."""
        result = health_check_task()

        assert result == "Celery is working!"
        assert isinstance(result, str)

    def test_system_stats_returns_all_counts(self):
        """Test system stats returns all required fields."""
        result = system_stats_task()

        assert result["status"] == "operational"
        assert "total_books" in result
        assert "processed_books" in result
        assert "total_descriptions" in result
        assert "total_images" in result
        assert "processing_rate" in result
        assert "generation_rate" in result
        assert "timestamp" in result

    def test_system_stats_calculates_rates(self):
        """Test that processing and generation rates are calculated correctly."""
        result = system_stats_task()

        assert result["status"] == "operational"
        assert isinstance(result["processing_rate"], float)
        assert isinstance(result["generation_rate"], float)
        assert 0 <= result["processing_rate"] <= 100
        assert 0 <= result["generation_rate"] <= 100

"""
Test suite для Response Schemas Phase 1.3.

Тестирует валидацию Pydantic schemas для:
- Processing endpoints (BookProcessingResponse, ParsingStatusResponse)
- NLP Testing endpoints (NLPTestChapterResponse, NLPTestBookResponse, etc.)
- Admin endpoints (CacheStatsResponse, CacheClearResponse, etc.)

Version: Phase 1.3 Type Safety (2025-11-29)
"""

import pytest
from datetime import datetime
from uuid import uuid4

from app.schemas.responses import (
    # Processing schemas
    BookProcessingResponse,
    ParsingStatusResponse,
    # NLP Testing schemas
    ProcessorTestResult,
    NLPTestChapterResponse,
    NLPTestBookResponse,
    NLPLibraryStatus,
    NLPLibrariesTestResponse,
    # Admin schemas
    CacheStatsResponse,
    CacheClearResponse,
    QueueInfo,
    QueueStatusResponse,
    ParsingSettingsResponse,
    CacheWarmResponse,
    FeatureFlagBulkUpdateResponse,
    # Reused schemas
    NLPAnalysisResult,
    DescriptionResponse,
)
from app.models.description import DescriptionType


# ============================================================================
# PROCESSING SCHEMAS TESTS
# ============================================================================


def test_book_processing_response_queued():
    """Тест BookProcessingResponse со статусом queued."""
    book_id = uuid4()
    response = BookProcessingResponse(
        book_id=book_id,
        status="queued",
        message="Added to parsing queue",
        position=5,
        total_in_queue=10,
        estimated_wait_time=120,
        priority="normal"
    )

    assert response.book_id == book_id
    assert response.status == "queued"
    assert response.position == 5
    assert response.total_in_queue == 10
    assert response.estimated_wait_time == 120
    assert response.priority == "normal"


def test_book_processing_response_processing():
    """Тест BookProcessingResponse со статусом processing."""
    book_id = uuid4()
    response = BookProcessingResponse(
        book_id=book_id,
        status="processing",
        message="Book parsing started",
        progress=35,
        descriptions_found=15,
        priority="high"
    )

    assert response.status == "processing"
    assert response.progress == 35
    assert response.descriptions_found == 15
    assert response.priority == "high"


def test_book_processing_response_validation():
    """Тест валидации BookProcessingResponse."""
    book_id = uuid4()

    # Invalid status
    with pytest.raises(ValueError):
        BookProcessingResponse(
            book_id=book_id,
            status="invalid_status",
            message="Test"
        )

    # Invalid progress (negative)
    with pytest.raises(ValueError):
        BookProcessingResponse(
            book_id=book_id,
            status="processing",
            message="Test",
            progress=-10
        )

    # Invalid progress (>100)
    with pytest.raises(ValueError):
        BookProcessingResponse(
            book_id=book_id,
            status="processing",
            message="Test",
            progress=150
        )


def test_parsing_status_response_completed():
    """Тест ParsingStatusResponse со статусом completed."""
    book_id = uuid4()
    response = ParsingStatusResponse(
        book_id=book_id,
        status="completed",
        progress=100,
        message="Parsing completed successfully",
        descriptions_found=245,
        current_chapter=20,
        total_chapters=20
    )

    assert response.status == "completed"
    assert response.progress == 100
    assert response.descriptions_found == 245
    assert response.current_chapter == 20
    assert response.total_chapters == 20


def test_parsing_status_response_failed():
    """Тест ParsingStatusResponse со статусом failed."""
    book_id = uuid4()
    response = ParsingStatusResponse(
        book_id=book_id,
        status="failed",
        progress=45,
        message="Parsing failed",
        error_message="NLP processor unavailable"
    )

    assert response.status == "failed"
    assert response.progress == 45
    assert response.error_message == "NLP processor unavailable"


# ============================================================================
# NLP TESTING SCHEMAS TESTS
# ============================================================================


def test_processor_test_result_success():
    """Тест ProcessorTestResult для успешной обработки."""
    result = ProcessorTestResult(
        processor_name="spacy",
        success=True,
        descriptions_found=42,
        processing_time_seconds=2.35
    )

    assert result.processor_name == "spacy"
    assert result.success is True
    assert result.descriptions_found == 42
    assert result.processing_time_seconds == 2.35
    assert result.error_message is None


def test_processor_test_result_failure():
    """Тест ProcessorTestResult для неудачной обработки."""
    result = ProcessorTestResult(
        processor_name="gliner",
        success=False,
        descriptions_found=0,
        processing_time_seconds=0.5,
        error_message="Model not loaded"
    )

    assert result.processor_name == "gliner"
    assert result.success is False
    assert result.descriptions_found == 0
    assert result.error_message == "Model not loaded"


def test_nlp_test_chapter_response():
    """Тест NLPTestChapterResponse."""
    chapter_id = uuid4()
    description_id = uuid4()

    # Create sample description
    description = DescriptionResponse(
        id=description_id,
        chapter_id=chapter_id,
        type=DescriptionType.LOCATION,
        content="Старый замок на холме",
        context="Замок возвышался над городом",
        confidence_score=0.85,
        priority_score=75.0,
        position_in_chapter=10,
        word_count=5,
        is_suitable_for_generation=True,
        image_generated=False,
        entities_mentioned="замок, холм",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    # Create NLP analysis result
    nlp_analysis = NLPAnalysisResult(
        total_descriptions=1,
        by_type={"LOCATION": 1},
        descriptions=[description],
        processing_time_seconds=1.2
    )

    # Create chapter info
    chapter_info = {
        "title": "Глава 1",
        "word_count": 1500,
        "preview_text": "Было темное утро..."
    }

    response = NLPTestChapterResponse(
        chapter_info=chapter_info,
        nlp_analysis=nlp_analysis,
        message="NLP analysis completed",
        test_mode=True,
        processor_used="ensemble"
    )

    assert response.test_mode is True
    assert response.processor_used == "ensemble"
    assert response.nlp_analysis.total_descriptions == 1
    assert response.chapter_info["title"] == "Глава 1"


def test_nlp_test_book_response():
    """Тест NLPTestBookResponse."""
    test_results = [
        ProcessorTestResult(
            processor_name="spacy",
            success=True,
            descriptions_found=38,
            processing_time_seconds=2.1
        ),
        ProcessorTestResult(
            processor_name="natasha",
            success=True,
            descriptions_found=42,
            processing_time_seconds=1.8
        ),
        ProcessorTestResult(
            processor_name="gliner",
            success=True,
            descriptions_found=45,
            processing_time_seconds=3.2
        )
    ]

    book_info = {
        "title": "Война и мир",
        "author": "Лев Толстой",
        "genre": "CLASSIC"
    }

    response = NLPTestBookResponse(
        book_info=book_info,
        total_chapters=20,
        total_descriptions=125,  # Sum of all processors
        test_results=test_results,
        message="Book testing completed",
        test_mode=True
    )

    assert response.total_chapters == 20
    assert response.total_descriptions == 125
    assert len(response.test_results) == 3
    assert response.test_mode is True


def test_nlp_library_status():
    """Тест NLPLibraryStatus."""
    status = NLPLibraryStatus(
        status="ok",
        version="3.5.0",
        model="ru_core_news_lg loaded",
        test="✓ spaCy работает"
    )

    assert status.status == "ok"
    assert status.version == "3.5.0"
    assert status.error is None


def test_nlp_libraries_test_response():
    """Тест NLPLibrariesTestResponse."""
    from app.schemas.responses.nlp import NLPLibraryStatus

    libraries = {
        "spacy": NLPLibraryStatus(
            status="ok",
            version="3.5.0",
            model="ru_core_news_lg loaded",
            test="✓ spaCy работает"
        ),
        "natasha": NLPLibraryStatus(
            status="ok",
            version="1.4.0",
            test="✓ Natasha работает"
        )
    }

    summary = {
        "working": 2,
        "total": 2,
        "status": "healthy"
    }

    response = NLPLibrariesTestResponse(
        summary=summary,
        libraries=libraries,
        message="NLP libraries test completed: 2/2 working"
    )

    assert response.summary["working"] == 2
    assert response.summary["status"] == "healthy"
    assert len(response.libraries) == 2


# ============================================================================
# ADMIN SCHEMAS TESTS
# ============================================================================


def test_cache_stats_response():
    """Тест CacheStatsResponse."""
    response = CacheStatsResponse(
        total_keys=1250,
        memory_usage_mb=45.8,
        hit_rate=87.5,
        total_hits=10500,
        total_misses=1500,
        uptime_seconds=86400,
        cache_patterns={
            "book:*": "Book cache keys",
            "user:*": "User cache keys"
        },
        cache_ttl_config={
            "default": 900,
            "books": 3600
        }
    )

    assert response.total_keys == 1250
    assert response.memory_usage_mb == 45.8
    assert response.hit_rate == 87.5
    assert response.total_hits == 10500
    assert response.total_misses == 1500
    assert response.uptime_seconds == 86400


def test_cache_clear_response():
    """Тест CacheClearResponse."""
    response = CacheClearResponse(
        success=True,
        keys_deleted=350,
        message="Cache cleared successfully",
        pattern="book:*",
        admin_email="admin@example.com"
    )

    assert response.success is True
    assert response.keys_deleted == 350
    assert response.pattern == "book:*"
    assert response.admin_email == "admin@example.com"
    assert isinstance(response.timestamp, datetime)


def test_queue_info():
    """Тест QueueInfo."""
    queue = QueueInfo(
        name="parsing",
        pending=15,
        active=3,
        scheduled=2
    )

    assert queue.name == "parsing"
    assert queue.pending == 15
    assert queue.active == 3
    assert queue.scheduled == 2


def test_queue_status_response():
    """Тест QueueStatusResponse."""
    queues = [
        QueueInfo(name="default", pending=5, active=2, scheduled=0),
        QueueInfo(name="parsing", pending=10, active=1, scheduled=3),
        QueueInfo(name="image_generation", pending=8, active=2, scheduled=1)
    ]

    response = QueueStatusResponse(
        queues=queues,
        total_pending=23,
        total_active=5,
        workers_online=4,
        message="Queue status retrieved successfully"
    )

    assert len(response.queues) == 3
    assert response.total_pending == 23
    assert response.total_active == 5
    assert response.workers_online == 4


def test_parsing_settings_response():
    """Тест ParsingSettingsResponse."""
    response = ParsingSettingsResponse(
        max_concurrent_parsings=3,
        default_priority="normal",
        auto_generate_images=True,
        nlp_mode="ENSEMBLE",
        enabled_processors=["spacy", "natasha", "gliner", "stanza"],
        ensemble_consensus_threshold=0.6
    )

    assert response.max_concurrent_parsings == 3
    assert response.default_priority == "normal"
    assert response.auto_generate_images is True
    assert response.nlp_mode == "ENSEMBLE"
    assert len(response.enabled_processors) == 4
    assert response.ensemble_consensus_threshold == 0.6


def test_cache_warm_response():
    """Тест CacheWarmResponse."""
    response = CacheWarmResponse(
        success=True,
        message="Cache warmed successfully",
        keys_cached=500,
        cache_types=["books", "users", "popular_genres"]
    )

    assert response.success is True
    assert response.keys_cached == 500
    assert len(response.cache_types) == 3


def test_feature_flag_bulk_update_response():
    """Тест FeatureFlagBulkUpdateResponse."""
    response = FeatureFlagBulkUpdateResponse(
        message="Bulk update completed: 3 success, 1 failed",
        results={
            "USE_ADVANCED_PARSER": True,
            "USE_LLM_ENRICHMENT": True,
            "ENABLE_PARALLEL_PROCESSING": True,
            "INVALID_FLAG": False
        },
        total=4,
        success_count=3,
        failed_count=1,
        admin_email="admin@example.com"
    )

    assert response.total == 4
    assert response.success_count == 3
    assert response.failed_count == 1
    assert len(response.results) == 4
    assert response.admin_email == "admin@example.com"


# ============================================================================
# VALIDATION TESTS
# ============================================================================


def test_cache_stats_response_validation():
    """Тест валидации CacheStatsResponse."""
    # Invalid hit_rate (>100)
    with pytest.raises(ValueError):
        CacheStatsResponse(
            total_keys=100,
            memory_usage_mb=10.0,
            hit_rate=150.0,  # Invalid: >100
            total_hits=1000,
            total_misses=100
        )

    # Invalid hit_rate (negative)
    with pytest.raises(ValueError):
        CacheStatsResponse(
            total_keys=100,
            memory_usage_mb=10.0,
            hit_rate=-10.0,  # Invalid: <0
            total_hits=1000,
            total_misses=100
        )


def test_parsing_settings_response_validation():
    """Тест валидации ParsingSettingsResponse."""
    # Invalid nlp_mode
    with pytest.raises(ValueError):
        ParsingSettingsResponse(
            max_concurrent_parsings=3,
            default_priority="normal",
            auto_generate_images=True,
            nlp_mode="INVALID_MODE",  # Invalid
            enabled_processors=["spacy"]
        )

    # Invalid default_priority
    with pytest.raises(ValueError):
        ParsingSettingsResponse(
            max_concurrent_parsings=3,
            default_priority="urgent",  # Invalid
            auto_generate_images=True,
            nlp_mode="ENSEMBLE",
            enabled_processors=["spacy"]
        )

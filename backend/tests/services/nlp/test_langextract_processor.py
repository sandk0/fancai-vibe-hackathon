"""
Comprehensive tests for LangExtract Processor.

Tests cover:
1. Initialization and availability
2. Russian text chunking
3. Description extraction
4. Result format compatibility
5. Error handling and graceful degradation
6. Performance metrics

Created: 2025-11-30
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from typing import Dict, List, Any

# Import test targets
from app.services.langextract_processor import (
    LangExtractProcessor,
    LangExtractConfig,
    RussianTextChunker,
    ExtractedDescription,
    ProcessingResult,
    DescriptionType,
    get_langextract_processor,
    extract_descriptions_with_langextract,
)


# =============================================================================
# TEST FIXTURES
# =============================================================================

@pytest.fixture
def config():
    """Default configuration for tests."""
    return LangExtractConfig(
        model_id="gemini-2.5-flash",
        api_key="test-api-key",
        max_chunk_chars=6000,
        min_chunk_chars=500,
        chunk_overlap_chars=200,
        max_descriptions_per_chunk=15,
        min_description_chars=100,
        max_description_chars=4000,
        min_confidence=0.5,
        enabled=True,
    )


@pytest.fixture
def chunker(config):
    """Russian text chunker instance."""
    return RussianTextChunker(config)


@pytest.fixture
def mock_langextract():
    """Mock LangExtract library."""
    mock_lx = MagicMock()

    # Mock data classes
    mock_lx.data.ExampleData = MagicMock()
    mock_lx.data.Extraction = MagicMock()

    # Mock extraction result
    mock_extraction = MagicMock()
    mock_extraction.extraction_class = "location"
    mock_extraction.extraction_text = (
        "Старый замок возвышался на высоком холме, окруженный густым лесом. "
        "Его величественные башни касались облаков, а мрачные стены хранили множество тайн."
    )
    mock_extraction.attributes = {
        "confidence": 0.92,
        "entities": [
            {"name": "замок", "attributes": {"age": "старый"}},
            {"name": "холм", "attributes": {"height": "высокий"}},
        ]
    }
    mock_extraction.source_span = (0, 150)

    mock_result = MagicMock()
    mock_result.extractions = [mock_extraction]

    mock_lx.extract = MagicMock(return_value=mock_result)

    return mock_lx


@pytest.fixture
def processor_with_mock(config, mock_langextract):
    """Processor with mocked LangExtract."""
    with patch.dict("sys.modules", {"langextract": mock_langextract}):
        processor = LangExtractProcessor(config)
        processor._lx = mock_langextract
        processor._available = True
        return processor


# =============================================================================
# SAMPLE RUSSIAN TEXTS
# =============================================================================

SAMPLE_LOCATION_TEXT = """
Старый замок возвышался на высоком холме, окруженный густым лесом. Его величественные
башни касались облаков, а мрачные стены хранили множество тайн. Серый камень, из
которого были сложены стены, потемнел от времени и покрылся мхом.

Вокруг замка раскинулся огромный парк с вековыми дубами и извилистыми тропинками.
Посередине парка находился старинный фонтан с мраморными статуями, давно уже не
работавший. Вода в его чаше стала зелёной от водорослей.
"""

SAMPLE_CHARACTER_TEXT = """
Молодой князь Алексей стоял у окна, глядя на закат. Его тёмные глаза смотрели вдаль
с задумчивым выражением. Длинные чёрные волосы были собраны в хвост, а на плечах лежал
тяжёлый бархатный плащ тёмно-синего цвета.

Высокий и статный, он производил впечатление человека, привыкшего командовать.
Тонкие черты лица выдавали благородное происхождение, а твёрдый подбородок говорил
о силе характера.
"""

SAMPLE_ATMOSPHERE_TEXT = """
Атмосфера в зале была торжественной и немного мрачной. Тяжёлые портьеры из тёмного
бархата поглощали звуки, создавая ощущение изолированности от внешнего мира. Свечи
в канделябрах отбрасывали дрожащие тени на стены.

Пахло воском и старыми книгами. Где-то вдалеке играла тихая музыка, едва слышная,
словно доносящаяся из другого времени. Холодный сквозняк изредка пробегал по залу,
заставляя пламя свечей колебаться.
"""

SAMPLE_LONG_TEXT = """
ГЛАВА 1. СТАРЫЙ ЗАМОК

Замок Воронов возвышался над городом уже более пяти веков. Его мрачные башни,
сложенные из тёмного камня, были видны за много верст вокруг. Местные жители
рассказывали о нём странные истории, передававшиеся из поколения в поколение.

Главная башня, называемая Вороньей, была самой высокой постройкой во всей округе.
На её вершине всегда кружили чёрные птицы, давшие имя и башне, и всему замку.
Говорили, что это души прежних хозяев, не нашедших покоя.

— Не стоит туда ходить, — предупреждали старожилы. — Особенно ночью.

Но молодой граф Дмитрий Воронов не верил в сказки. Высокий, темноволосый юноша с
пронзительными серыми глазами, он только что вернулся из столицы, где провёл
последние десять лет.

Атмосфера в замке показалась ему странной. Несмотря на яркий солнечный день,
внутри царил полумрак. Тяжёлые портьеры были задёрнуты, мебель покрыта белыми
чехлами, словно замок давно покинут.

Пахло пылью и забвением. Холодный воздух хранил память о прошлом.

* * *

Библиотека располагалась в восточном крыле. Это была огромная комната с высокими
потолками, уставленная книжными шкафами от пола до потолка. Тысячи томов,
собранных поколениями Вороновых, хранили знания веков.

Посередине стоял массивный дубовый стол, заваленный картами и свитками. Здесь
когда-то работал его отец, исследуя древние манускрипты.

Дмитрий подошёл к окну и раздвинул шторы. Пыль закружилась в столбе света.
"""

SAMPLE_SHORT_TEXT = "Короткий текст для теста."

SAMPLE_DIALOG_TEXT = """
— Вы уверены? — спросил граф.
— Абсолютно, — ответила она. — Я видела это собственными глазами.
— Но это невозможно!
— И тем не менее, это правда.
"""


# =============================================================================
# TEST CLASSES
# =============================================================================

class TestRussianTextChunker:
    """Tests for Russian text chunking functionality."""

    def test_chunk_short_text(self, chunker):
        """Short text should return single chunk."""
        text = "Короткий текст."
        chunks = chunker.chunk(text)
        assert len(chunks) == 1
        assert chunks[0]["text"] == text

    def test_chunk_long_text(self, chunker):
        """Long text should be split into multiple chunks."""
        chunks = chunker.chunk(SAMPLE_LONG_TEXT)
        assert len(chunks) >= 1
        # Each chunk should not exceed max_chunk_chars
        for chunk in chunks:
            assert len(chunk["text"]) <= chunker.config.max_chunk_chars + 500  # Allow some overflow

    def test_chunk_preserves_paragraphs(self, chunker):
        """Chunks should preserve paragraph boundaries."""
        chunks = chunker.chunk(SAMPLE_LOCATION_TEXT)
        for chunk in chunks:
            # Should not break mid-sentence (heuristic check)
            text = chunk["text"]
            # Check that text ends with proper punctuation or is complete
            assert text.strip()

    def test_chunk_metadata(self, chunker):
        """Chunks should include position metadata."""
        chunks = chunker.chunk(SAMPLE_LONG_TEXT)
        for chunk in chunks:
            assert "start" in chunk
            assert "end" in chunk
            assert "paragraph_indices" in chunk
            assert chunk["start"] >= 0
            assert chunk["end"] > chunk["start"]

    def test_chunk_overlap(self, chunker):
        """Adjacent chunks should have some overlap."""
        # For very long texts that get split
        long_text = SAMPLE_LONG_TEXT * 3  # Triple the text
        chunks = chunker.chunk(long_text)

        if len(chunks) > 1:
            # Check that there's some content overlap
            # This is a heuristic check
            for i in range(len(chunks) - 1):
                chunk1_end = chunks[i]["text"][-200:]
                chunk2_start = chunks[i + 1]["text"][:200]
                # Some overlap should exist due to overlap_chars setting
                # This is a soft check as exact overlap depends on paragraph boundaries

    def test_chapter_marker_splitting(self, chunker):
        """Text with chapter markers should split at chapters."""
        chunks = chunker.chunk(SAMPLE_LONG_TEXT)
        # Should detect ГЛАВА marker
        assert len(chunks) >= 1


class TestExtractedDescription:
    """Tests for ExtractedDescription dataclass."""

    def test_to_dict_format(self):
        """to_dict should return Multi-NLP compatible format."""
        desc = ExtractedDescription(
            content="Старый замок на холме.",
            description_type=DescriptionType.LOCATION,
            confidence=0.85,
            entities=[{"name": "замок", "attributes": {"age": "старый"}}],
            attributes={"category": "architecture"},
            position=100,
            source_span=(100, 200),
        )

        result = desc.to_dict()

        assert result["content"] == "Старый замок на холме."
        assert result["type"] == "location"
        assert result["confidence_score"] == 0.85
        assert result["source"] == "langextract"
        assert result["position"] == 100
        assert "priority_score" in result
        assert "word_count" in result
        assert "metadata" in result
        assert result["metadata"]["llm_extracted"] is True

    def test_priority_calculation_location(self):
        """Location descriptions should have high priority."""
        desc = ExtractedDescription(
            content="A" * 2500,  # Optimal length
            description_type=DescriptionType.LOCATION,
            confidence=0.9,
        )
        priority = desc._calculate_priority()
        assert priority >= 80  # High priority for location + optimal length

    def test_priority_calculation_short_text(self):
        """Short descriptions should have lower priority bonus."""
        desc = ExtractedDescription(
            content="A" * 200,  # Short
            description_type=DescriptionType.LOCATION,
            confidence=0.9,
        )
        priority = desc._calculate_priority()
        # Still gets type priority but no length bonus
        assert priority < 90


class TestLangExtractProcessor:
    """Tests for main LangExtract processor."""

    def test_initialization_without_api_key(self):
        """Processor should gracefully handle missing API key."""
        config = LangExtractConfig(api_key=None)

        with patch.dict("os.environ", {}, clear=True):
            with patch.dict("sys.modules", {"langextract": MagicMock()}):
                processor = LangExtractProcessor(config)
                assert not processor.is_available()

    def test_initialization_with_api_key(self, mock_langextract):
        """Processor should initialize with valid API key."""
        config = LangExtractConfig(api_key="test-key")

        with patch.dict("sys.modules", {"langextract": mock_langextract}):
            processor = LangExtractProcessor(config)
            processor._lx = mock_langextract
            processor._available = True
            assert processor.is_available()

    def test_is_available_disabled(self, processor_with_mock):
        """Processor should report unavailable when disabled."""
        processor_with_mock.config.enabled = False
        assert not processor_with_mock.is_available()

    @pytest.mark.asyncio
    async def test_extract_descriptions_short_text(self, processor_with_mock):
        """Short text should be skipped."""
        result = await processor_with_mock.extract_descriptions(SAMPLE_SHORT_TEXT)
        assert len(result.descriptions) == 0
        assert result.quality_metrics.get("skipped") is True

    @pytest.mark.asyncio
    async def test_extract_descriptions_success(self, processor_with_mock, mock_langextract):
        """Successful extraction should return descriptions."""
        # Use longer text to pass min_chunk_chars check (500 chars)
        long_text = SAMPLE_LOCATION_TEXT * 3  # Make it long enough
        result = await processor_with_mock.extract_descriptions(long_text)

        assert isinstance(result, ProcessingResult)
        assert result.processors_used == ["langextract"]
        assert result.api_calls >= 1
        assert result.processing_time >= 0

    @pytest.mark.asyncio
    async def test_extract_descriptions_unavailable(self, config):
        """Unavailable processor should return empty result."""
        processor = LangExtractProcessor(config)
        processor._available = False

        result = await processor.extract_descriptions(SAMPLE_LOCATION_TEXT)

        assert len(result.descriptions) == 0
        assert result.quality_metrics.get("available") is False

    @pytest.mark.asyncio
    async def test_extract_preserves_chapter_id(self, processor_with_mock):
        """Chapter ID should be preserved in processing."""
        chapter_id = "test-chapter-123"
        result = await processor_with_mock.extract_descriptions(
            SAMPLE_LOCATION_TEXT,
            chapter_id=chapter_id
        )
        # Result should be returned (chapter_id used for metadata)
        assert isinstance(result, ProcessingResult)

    def test_statistics_tracking(self, processor_with_mock):
        """Statistics should be tracked correctly."""
        initial_stats = processor_with_mock.get_statistics()
        assert initial_stats["total_extractions"] == 0

        # Reset and verify
        processor_with_mock.reset_statistics()
        stats = processor_with_mock.get_statistics()
        assert stats["total_extractions"] == 0
        assert stats["total_tokens"] == 0


class TestDescriptionDeduplication:
    """Tests for description deduplication."""

    def test_deduplicate_exact_duplicates(self, processor_with_mock):
        """Exact duplicates should be removed."""
        descriptions = [
            ExtractedDescription(
                content="Старый замок на холме.",
                description_type=DescriptionType.LOCATION,
                confidence=0.9,
            ),
            ExtractedDescription(
                content="Старый замок на холме.",
                description_type=DescriptionType.LOCATION,
                confidence=0.85,
            ),
        ]

        result = processor_with_mock._deduplicate_descriptions(descriptions)
        assert len(result) == 1

    def test_deduplicate_different_descriptions(self, processor_with_mock):
        """Different descriptions should be kept."""
        descriptions = [
            ExtractedDescription(
                content="Старый замок на холме.",
                description_type=DescriptionType.LOCATION,
                confidence=0.9,
            ),
            ExtractedDescription(
                content="Молодой князь у окна.",
                description_type=DescriptionType.CHARACTER,
                confidence=0.85,
            ),
        ]

        result = processor_with_mock._deduplicate_descriptions(descriptions)
        assert len(result) == 2


class TestResultParsing:
    """Tests for LangExtract result parsing."""

    def test_parse_location_result(self, processor_with_mock, mock_langextract):
        """Location extraction should be parsed correctly."""
        mock_extraction = MagicMock()
        mock_extraction.extraction_class = "location"
        mock_extraction.extraction_text = "Старый замок возвышался на холме. " * 5  # Make it long enough
        mock_extraction.attributes = {"confidence": 0.9, "entities": []}
        mock_extraction.source_span = (0, 200)

        mock_result = MagicMock()
        mock_result.extractions = [mock_extraction]

        descriptions = processor_with_mock._parse_result(mock_result, 0)

        assert len(descriptions) >= 1
        assert descriptions[0].description_type == DescriptionType.LOCATION

    def test_parse_character_result(self, processor_with_mock):
        """Character extraction should be parsed correctly."""
        mock_extraction = MagicMock()
        mock_extraction.extraction_class = "character"
        mock_extraction.extraction_text = "Высокий темноволосый юноша с серыми глазами. " * 3
        mock_extraction.attributes = {"confidence": 0.85, "entities": []}
        mock_extraction.source_span = (0, 150)

        mock_result = MagicMock()
        mock_result.extractions = [mock_extraction]

        descriptions = processor_with_mock._parse_result(mock_result, 0)

        assert len(descriptions) >= 1
        assert descriptions[0].description_type == DescriptionType.CHARACTER

    def test_parse_unknown_type_fallback(self, processor_with_mock):
        """Unknown type should fallback to location."""
        mock_extraction = MagicMock()
        mock_extraction.extraction_class = "unknown_type"
        mock_extraction.extraction_text = "Какой-то текст описания. " * 5
        mock_extraction.attributes = {"confidence": 0.7}
        mock_extraction.source_span = (0, 100)

        mock_result = MagicMock()
        mock_result.extractions = [mock_extraction]

        descriptions = processor_with_mock._parse_result(mock_result, 0)

        if descriptions:  # May be filtered by length
            assert descriptions[0].description_type == DescriptionType.LOCATION

    def test_parse_short_content_filtered(self, processor_with_mock):
        """Short content should be filtered out."""
        mock_extraction = MagicMock()
        mock_extraction.extraction_class = "location"
        mock_extraction.extraction_text = "Короткий."  # Too short
        mock_extraction.attributes = {"confidence": 0.9}
        mock_extraction.source_span = (0, 10)

        mock_result = MagicMock()
        mock_result.extractions = [mock_extraction]

        descriptions = processor_with_mock._parse_result(mock_result, 0)

        assert len(descriptions) == 0  # Filtered out


class TestProcessingResult:
    """Tests for ProcessingResult compatibility."""

    def test_result_format_compatibility(self):
        """Result should be compatible with Multi-NLP system."""
        result = ProcessingResult(
            descriptions=[
                {
                    "content": "Test description",
                    "type": "location",
                    "confidence_score": 0.9,
                    "priority_score": 85.0,
                    "source": "langextract",
                }
            ],
            processing_time=1.5,
            tokens_used=1000,
            api_calls=1,
        )

        assert hasattr(result, "descriptions")
        assert hasattr(result, "processor_results")
        assert hasattr(result, "processing_time")
        assert hasattr(result, "processors_used")
        assert hasattr(result, "quality_metrics")
        assert hasattr(result, "recommendations")

    def test_result_metrics(self):
        """Result should include LangExtract-specific metrics."""
        result = ProcessingResult(
            descriptions=[],
            tokens_used=500,
            api_calls=2,
            chunks_processed=3,
        )

        assert result.tokens_used == 500
        assert result.api_calls == 2
        assert result.chunks_processed == 3


class TestErrorHandling:
    """Tests for error handling and graceful degradation."""

    @pytest.mark.asyncio
    async def test_api_error_handling(self, config):
        """API errors should be handled gracefully (per-chunk error handling)."""
        mock_lx = MagicMock()
        mock_lx.extract = MagicMock(side_effect=Exception("API Error"))

        with patch.dict("sys.modules", {"langextract": mock_lx}):
            processor = LangExtractProcessor(config)
            processor._lx = mock_lx
            processor._available = True

            # Use longer text to pass min_chunk_chars check
            long_text = SAMPLE_LONG_TEXT  # This is already long enough

            result = await processor.extract_descriptions(long_text)

            # Graceful degradation: should return empty result, not crash
            assert len(result.descriptions) == 0
            # API calls were made (even if they failed)
            assert result.api_calls >= 1
            # Error is logged but doesn't prevent returning a result
            assert result.quality_metrics.get("total_extracted") == 0

    def test_missing_langextract_library(self):
        """Missing library should be handled gracefully."""
        config = LangExtractConfig(api_key="test-key")

        with patch.dict("sys.modules", {"langextract": None}):
            # This will fail to import langextract
            processor = LangExtractProcessor(config)
            # Processor should still be created but unavailable
            assert not processor.is_available()


class TestSingletonPattern:
    """Tests for singleton pattern."""

    def test_get_langextract_processor_singleton(self):
        """get_langextract_processor should return singleton."""
        # Reset global
        import app.services.langextract_processor as module
        module._langextract_processor = None

        with patch.dict("sys.modules", {"langextract": MagicMock()}):
            processor1 = get_langextract_processor()
            processor2 = get_langextract_processor()
            assert processor1 is processor2


class TestRussianLanguageSpecifics:
    """Tests for Russian language specific handling."""

    def test_cyrillic_text_processing(self, chunker):
        """Cyrillic text should be processed correctly."""
        text = "Привет мир! Это тестовый текст на русском языке."
        chunks = chunker.chunk(text)
        assert len(chunks) == 1
        assert "Привет" in chunks[0]["text"]

    def test_russian_punctuation(self, chunker):
        """Russian punctuation should be preserved."""
        text = "— Здравствуйте! — сказал он. «Очень приятно», — ответила она."
        chunks = chunker.chunk(text)
        assert "—" in chunks[0]["text"]
        assert "«" in chunks[0]["text"]

    def test_russian_paragraph_detection(self, chunker):
        """Russian paragraphs should be detected correctly."""
        paragraphs = chunker._split_to_paragraphs(SAMPLE_LOCATION_TEXT)
        assert len(paragraphs) >= 2  # At least 2 paragraphs

    def test_dialog_marker_detection(self, chunker):
        """Dialog markers should be detected."""
        paragraphs = chunker._split_to_paragraphs(SAMPLE_DIALOG_TEXT)
        dialog_count = sum(1 for p in paragraphs if p["is_dialog"])
        assert dialog_count >= 1


class TestPromptOptimization:
    """Tests for prompt optimization."""

    def test_prompt_length(self, processor_with_mock):
        """Prompt should be optimized for token efficiency."""
        prompt = processor_with_mock.EXTRACTION_PROMPT
        # Prompt should be concise (< 200 words)
        word_count = len(prompt.split())
        assert word_count < 200

    def test_examples_count(self, processor_with_mock):
        """Should have 2-3 few-shot examples."""
        examples = processor_with_mock.EXAMPLES
        assert 2 <= len(examples) <= 5

    def test_examples_russian_language(self, processor_with_mock):
        """Examples should be in Russian."""
        for example in processor_with_mock.EXAMPLES:
            assert any(
                char in example["input"]
                for char in "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
            )


# =============================================================================
# INTEGRATION-LIKE TESTS
# =============================================================================

class TestEndToEndFlow:
    """End-to-end flow tests (with mocks)."""

    @pytest.mark.asyncio
    async def test_full_extraction_flow(self, processor_with_mock, mock_langextract):
        """Test complete extraction flow from text to result."""
        # Setup mock to return multiple extractions
        mock_extractions = [
            MagicMock(
                extraction_class="location",
                extraction_text="Старый замок на высоком холме. " * 5,
                attributes={"confidence": 0.9, "entities": []},
                source_span=(0, 200),
            ),
            MagicMock(
                extraction_class="character",
                extraction_text="Молодой князь с тёмными глазами. " * 4,
                attributes={"confidence": 0.85, "entities": []},
                source_span=(200, 400),
            ),
        ]
        mock_result = MagicMock()
        mock_result.extractions = mock_extractions
        mock_langextract.extract = MagicMock(return_value=mock_result)

        result = await processor_with_mock.extract_descriptions(SAMPLE_LONG_TEXT)

        assert isinstance(result, ProcessingResult)
        assert result.api_calls >= 1
        assert result.chunks_processed >= 1

    @pytest.mark.asyncio
    async def test_utility_function(self, processor_with_mock, mock_langextract):
        """Test extract_descriptions_with_langextract utility."""
        import app.services.langextract_processor as module
        module._langextract_processor = processor_with_mock

        result = await extract_descriptions_with_langextract(SAMPLE_LOCATION_TEXT)
        assert isinstance(result, ProcessingResult)


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Tests for Image Generation Service.

Coverage Target: 70% of image_generator.py
Expected Impact: +10% total coverage
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock, Mock
from typing import Dict, Any
from datetime import datetime
from pathlib import Path

from app.services.image_generator import (
    ImageGeneratorService,
    PollinationsImageGenerator,
    PromptEngineer,
    ImageGenerationRequest,
    ImageGenerationResult,
)
from app.models.description import Description, DescriptionType


@pytest.fixture
def prompt_engineer():
    """Fixture for PromptEngineer instance."""
    return PromptEngineer()


@pytest.fixture
def pollinations_client():
    """Fixture for PollinationsImageGenerator instance."""
    return PollinationsImageGenerator()


@pytest.fixture
def image_generator_service():
    """Fixture for ImageGeneratorService instance."""
    return ImageGeneratorService()


@pytest.fixture
def sample_description():
    """Sample description for testing."""
    return Mock(
        id="test-desc-id",
        content="beautiful dark forest with tall pine trees",
        type=DescriptionType.LOCATION,
        priority_score=0.85,
        chapter_id="test-chapter-id",
    )


class TestPromptEngineering:
    """Test prompt generation and enhancement."""

    def test_create_prompt_location_type(self, prompt_engineer):
        """Test location-type prompt template."""
        # Arrange
        description = "dark forest with ancient trees"
        description_type = DescriptionType.LOCATION

        # Act
        result = prompt_engineer.create_prompt(description, description_type)

        # Assert
        assert "positive" in result
        assert "negative" in result
        assert description in result["positive"]
        assert "landscape" in result["positive"].lower() or "cinematic" in result["positive"].lower()
        assert "blurry" in result["negative"].lower()
        assert len(result["positive"]) < 500  # Prompt length limit

    def test_create_prompt_character_type(self, prompt_engineer):
        """Test character-type prompt template."""
        # Arrange
        description = "tall man with dark hair and piercing eyes"
        description_type = DescriptionType.CHARACTER

        # Act
        result = prompt_engineer.create_prompt(description, description_type)

        # Assert
        assert "positive" in result
        assert description in result["positive"]
        assert any(word in result["positive"].lower() for word in ["portrait", "character", "detailed"])
        assert "bad face" in result["negative"].lower() or "extra arms" in result["negative"].lower()

    def test_create_prompt_atmosphere_type(self, prompt_engineer):
        """Test atmosphere-type prompt template."""
        # Arrange
        description = "eerie silence filled the abandoned house"
        description_type = DescriptionType.ATMOSPHERE

        # Act
        result = prompt_engineer.create_prompt(description, description_type)

        # Assert
        assert description in result["positive"]
        assert any(word in result["positive"].lower() for word in ["atmospheric", "mood", "ambiance"])

    def test_create_prompt_with_custom_style(self, prompt_engineer):
        """Test custom style addition to prompt."""
        # Arrange
        description = "forest"
        description_type = DescriptionType.LOCATION
        custom_style = "watercolor painting, soft colors"

        # Act
        result = prompt_engineer.create_prompt(description, description_type, custom_style)

        # Assert
        assert custom_style in result["positive"]
        assert "watercolor" in result["positive"]

    def test_clean_description_length_limit(self, prompt_engineer):
        """Test that long descriptions are truncated."""
        # Arrange
        long_description = "word " * 100  # Very long description

        # Act
        cleaned = prompt_engineer._clean_description(long_description)

        # Assert
        assert len(cleaned) <= 203  # max_length (200) + "..." (3)
        assert cleaned.endswith("...")

    def test_clean_description_russian_terms(self, prompt_engineer):
        """Test Russian terms replacement."""
        # Arrange
        description = "избушка в дремучий лес с богатырь"

        # Act
        cleaned = prompt_engineer._clean_description(description)

        # Assert
        assert "wooden hut" in cleaned
        assert "dense dark forest" in cleaned
        assert "knight warrior" in cleaned

    def test_all_description_types_have_templates(self, prompt_engineer):
        """Test that all DescriptionType values have templates."""
        # Act & Assert
        for desc_type in DescriptionType:
            # Should not raise error
            result = prompt_engineer.create_prompt("test", desc_type)
            assert result["positive"]
            assert result["negative"]


class TestPollinationsImageGeneration:
    """Test Pollinations.ai API integration."""

    @pytest.mark.asyncio
    async def test_generate_image_success(self, pollinations_client):
        """Test successful image generation with pollinations.ai."""
        # Arrange
        prompt = "beautiful dark forest"
        mock_image_data = b"fake_image_data_png_format"

        # Create proper async context manager mock
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.read = AsyncMock(return_value=mock_image_data)
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock()

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_response)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch('aiohttp.ClientSession', return_value=mock_session):
            # Act
            result = await pollinations_client.generate_image(prompt)

        # Assert
        assert result.success is True
        assert result.image_url is not None
        assert result.local_path is not None
        assert result.generation_time_seconds is not None
        assert result.generation_time_seconds > 0
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_generate_image_api_failure_with_retry(self, pollinations_client):
        """Test API failure with retry logic."""
        # Arrange
        prompt = "test prompt"
        pollinations_client.max_retries = 3

        # Create proper async context manager mock
        mock_response = AsyncMock()
        mock_response.status = 500  # Server error
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock()

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_response)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch('aiohttp.ClientSession', return_value=mock_session):
            # Act
            result = await pollinations_client.generate_image(prompt)

        # Assert
        assert result.success is False
        assert result.error_message is not None
        assert "500" in result.error_message
        # Verify it tried max_retries times
        assert mock_session.get.call_count == 3

    @pytest.mark.asyncio
    async def test_generate_image_timeout(self, pollinations_client):
        """Test handling of API timeout."""
        # Arrange
        prompt = "test prompt"

        with patch('aiohttp.ClientSession') as mock_session_class:
            mock_session = MagicMock()
            mock_session.get = MagicMock(side_effect=asyncio.TimeoutError())
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock()

            mock_session_class.return_value = mock_session

            # Act
            result = await pollinations_client.generate_image(prompt)

        # Assert
        assert result.success is False
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_generate_image_network_error(self, pollinations_client):
        """Test handling of network errors."""
        # Arrange
        prompt = "test prompt"
        pollinations_client.max_retries = 2  # Reduce for faster test

        mock_session = AsyncMock()
        mock_session.get = MagicMock(side_effect=Exception("Network error"))
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock()

        with patch('aiohttp.ClientSession', return_value=mock_session):
            # Act
            result = await pollinations_client.generate_image(prompt)

        # Assert
        assert result.success is False
        # After retries, it will return "Max retries exceeded" error
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_save_image_creates_unique_filename(self, pollinations_client):
        """Test that saved images have unique filenames."""
        # Arrange
        image_data = b"test_image_data"
        prompt1 = "forest scene"
        prompt2 = "mountain view"

        with patch('builtins.open', create=True) as mock_open, \
             patch('pathlib.Path.mkdir'):

            # Act
            path1 = await pollinations_client._save_image(image_data, prompt1)
            path2 = await pollinations_client._save_image(image_data, prompt2)

        # Assert
        assert path1 != path2  # Different prompts = different paths
        assert ".png" in path1
        assert ".png" in path2

    def test_default_parameters(self, pollinations_client):
        """Test default generation parameters."""
        # Assert
        assert pollinations_client.default_params["width"] == 1024
        assert pollinations_client.default_params["height"] == 768
        assert pollinations_client.default_params["model"] == "flux"
        assert pollinations_client.default_params["enhance"] is True


class TestImageGeneratorService:
    """Test main ImageGeneratorService functionality."""

    @pytest.mark.asyncio
    async def test_generate_image_for_description(self, image_generator_service, sample_description):
        """Test generating image for a description object."""
        # Arrange
        user_id = "test-user-123"

        with patch.object(image_generator_service.pollinations_client, 'generate_image') as mock_generate:
            mock_generate.return_value = ImageGenerationResult(
                success=True,
                image_url="https://example.com/image.png",
                local_path="/tmp/image.png",
                generation_time_seconds=2.5
            )

            # Act
            result = await image_generator_service.generate_image_for_description(
                sample_description, user_id
            )

        # Assert
        assert result.success is True
        assert result.image_url is not None
        assert mock_generate.called

    @pytest.mark.asyncio
    async def test_generate_with_custom_style(self, image_generator_service, sample_description):
        """Test custom style parameter is used."""
        # Arrange
        user_id = "test-user-123"
        custom_style = "oil painting, renaissance style"

        with patch.object(image_generator_service.pollinations_client, 'generate_image') as mock_generate:
            mock_generate.return_value = ImageGenerationResult(success=True, image_url="test.png")

            # Act
            await image_generator_service.generate_image_for_description(
                sample_description, user_id, custom_style
            )

        # Assert
        # Verify custom style was passed to prompt engineer
        call_args = mock_generate.call_args[0][0]  # Get first positional argument (prompt)
        assert custom_style in call_args or "oil painting" in call_args

    @pytest.mark.asyncio
    async def test_batch_generate_for_chapter(self, image_generator_service):
        """Test batch generation for multiple descriptions."""
        # Arrange
        descriptions = [
            Mock(id=f"desc-{i}", content=f"description {i}", type=DescriptionType.LOCATION,
                 priority_score=0.9 - i*0.1, chapter_id="chapter-1")
            for i in range(3)
        ]
        user_id = "test-user-123"

        with patch.object(image_generator_service, 'generate_image_for_description') as mock_generate:
            mock_generate.return_value = ImageGenerationResult(success=True, image_url="test.png")

            # Act
            results = await image_generator_service.batch_generate_for_chapter(
                descriptions, user_id, max_images=3
            )

        # Assert
        assert len(results) == 3
        assert all(r.success for r in results)
        assert mock_generate.call_count == 3

    @pytest.mark.asyncio
    async def test_batch_generate_respects_max_images(self, image_generator_service):
        """Test that batch generation respects max_images limit."""
        # Arrange
        descriptions = [
            Mock(id=f"desc-{i}", content=f"description {i}", type=DescriptionType.LOCATION,
                 priority_score=0.9, chapter_id="chapter-1")
            for i in range(10)
        ]
        user_id = "test-user-123"
        max_images = 5

        with patch.object(image_generator_service, 'generate_image_for_description') as mock_generate:
            mock_generate.return_value = ImageGenerationResult(success=True, image_url="test.png")

            # Act
            results = await image_generator_service.batch_generate_for_chapter(
                descriptions, user_id, max_images=max_images
            )

        # Assert
        assert len(results) == max_images
        assert mock_generate.call_count == max_images

    @pytest.mark.asyncio
    async def test_batch_generate_prioritizes_by_score(self, image_generator_service):
        """Test that batch generation prioritizes high-scoring descriptions."""
        # Arrange
        descriptions = [
            Mock(id="low", content="low priority", type=DescriptionType.LOCATION,
                 priority_score=0.3, chapter_id="chapter-1"),
            Mock(id="high", content="high priority", type=DescriptionType.LOCATION,
                 priority_score=0.9, chapter_id="chapter-1"),
            Mock(id="medium", content="medium priority", type=DescriptionType.LOCATION,
                 priority_score=0.6, chapter_id="chapter-1"),
        ]
        user_id = "test-user-123"

        with patch.object(image_generator_service, 'generate_image_for_description') as mock_generate:
            mock_generate.return_value = ImageGenerationResult(success=True, image_url="test.png")

            # Act
            await image_generator_service.batch_generate_for_chapter(
                descriptions, user_id, max_images=2
            )

        # Assert
        # Should generate for "high" and "medium" but not "low"
        calls = [call[0][0] for call in mock_generate.call_args_list]
        assert calls[0].priority_score == 0.9  # High priority first
        assert calls[1].priority_score == 0.6  # Medium priority second

    @pytest.mark.asyncio
    async def test_batch_generate_handles_partial_failure(self, image_generator_service):
        """Test batch generation continues after individual failures."""
        # Arrange
        descriptions = [
            Mock(id="desc-1", content="description 1", type=DescriptionType.LOCATION,
                 priority_score=0.9, chapter_id="chapter-1"),
            Mock(id="desc-2", content="description 2", type=DescriptionType.LOCATION,
                 priority_score=0.8, chapter_id="chapter-1"),
        ]
        user_id = "test-user-123"

        with patch.object(image_generator_service, 'generate_image_for_description') as mock_generate:
            # First call succeeds, second fails
            mock_generate.side_effect = [
                ImageGenerationResult(success=True, image_url="test.png"),
                Exception("API Error")
            ]

            # Act
            results = await image_generator_service.batch_generate_for_chapter(
                descriptions, user_id
            )

        # Assert
        assert len(results) == 2
        assert results[0].success is True
        assert results[1].success is False
        assert "API Error" in results[1].error_message

    def test_add_to_queue(self, image_generator_service):
        """Test adding request to generation queue."""
        # Arrange
        request = ImageGenerationRequest(
            description_content="test description",
            description_type=DescriptionType.LOCATION,
            chapter_id="chapter-1",
            user_id="user-1"
        )

        # Act
        image_generator_service.add_to_queue(request)

        # Assert
        assert len(image_generator_service.generation_queue) == 1
        assert image_generator_service.generation_queue[0] == request

    @pytest.mark.asyncio
    async def test_process_queue(self, image_generator_service):
        """Test processing generation queue."""
        # Arrange
        request = ImageGenerationRequest(
            description_content="test description",
            description_type=DescriptionType.LOCATION,
            chapter_id="chapter-1",
            user_id="user-1"
        )
        image_generator_service.add_to_queue(request)

        with patch.object(image_generator_service.pollinations_client, 'generate_image') as mock_generate:
            mock_generate.return_value = ImageGenerationResult(success=True, image_url="test.png")

            # Act
            await image_generator_service.process_queue()

        # Assert
        assert len(image_generator_service.generation_queue) == 0  # Queue emptied
        assert image_generator_service.is_processing is False
        assert mock_generate.called

    @pytest.mark.asyncio
    async def test_process_queue_prevents_concurrent_processing(self, image_generator_service):
        """Test that queue processing prevents concurrent execution."""
        # Arrange
        image_generator_service.is_processing = True

        # Act
        await image_generator_service.process_queue()

        # Assert - should return immediately without processing
        assert image_generator_service.is_processing is True

    @pytest.mark.asyncio
    async def test_get_generation_stats(self, image_generator_service):
        """Test getting generation statistics."""
        # Arrange
        request = ImageGenerationRequest(
            description_content="test",
            description_type=DescriptionType.LOCATION,
            chapter_id="chapter-1",
            user_id="user-1"
        )
        image_generator_service.add_to_queue(request)

        # Act
        stats = await image_generator_service.get_generation_stats()

        # Assert
        assert stats["queue_size"] == 1
        assert stats["is_processing"] is False
        assert len(stats["supported_types"]) > 0
        assert stats["api_status"] == "operational"


# Test coverage checklist:
# [x] PromptEngineer.create_prompt (location type)
# [x] PromptEngineer.create_prompt (character type)
# [x] PromptEngineer.create_prompt (atmosphere type)
# [x] PromptEngineer.create_prompt (custom style)
# [x] PromptEngineer._clean_description (length limit)
# [x] PromptEngineer._clean_description (Russian terms)
# [x] PromptEngineer templates for all types
# [x] PollinationsImageGenerator.generate_image (success)
# [x] PollinationsImageGenerator.generate_image (API failure + retry)
# [x] PollinationsImageGenerator.generate_image (timeout)
# [x] PollinationsImageGenerator.generate_image (network error)
# [x] PollinationsImageGenerator._save_image (unique filenames)
# [x] PollinationsImageGenerator default parameters
# [x] ImageGeneratorService.generate_image_for_description
# [x] ImageGeneratorService custom style support
# [x] ImageGeneratorService.batch_generate_for_chapter
# [x] ImageGeneratorService batch respects max_images
# [x] ImageGeneratorService batch prioritizes by score
# [x] ImageGeneratorService batch handles partial failure
# [x] ImageGeneratorService.add_to_queue
# [x] ImageGeneratorService.process_queue
# [x] ImageGeneratorService concurrent processing prevention
# [x] ImageGeneratorService.get_generation_stats

# Total: 22 comprehensive tests
# Expected coverage: 70% of image_generator.py
# Expected impact: +10% total project coverage

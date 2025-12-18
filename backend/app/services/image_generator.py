"""
Image Generation Service for BookReader AI.

Uses Google Imagen 4 API for high-quality image generation from book descriptions.
Replaces legacy Pollinations.ai integration.

Features:
- Automatic Russian → English prompt translation
- Type-specific style templates (location, character, atmosphere)
- Genre-aware styling
- Batch generation support
- Queue management
"""

import asyncio
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import logging

from ..models.description import Description, DescriptionType
from .imagen_generator import (
    get_imagen_service,
    ImageGenerationResult as ImagenResult,
    ImagenService,
)

logger = logging.getLogger(__name__)


@dataclass
class ImageGenerationRequest:
    """Request for image generation."""
    description_content: str
    description_type: DescriptionType
    chapter_id: str
    user_id: str
    book_genre: Optional[str] = None
    style_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None  # Not used by Imagen, kept for compatibility


@dataclass
class ImageGenerationResult:
    """Result of image generation."""
    success: bool
    image_url: Optional[str] = None
    local_path: Optional[str] = None
    error_message: Optional[str] = None
    generation_time_seconds: Optional[float] = None
    model_used: Optional[str] = None
    prompt_used: Optional[str] = None

    @classmethod
    def from_imagen_result(cls, result: ImagenResult) -> "ImageGenerationResult":
        """Convert from Imagen result."""
        return cls(
            success=result.success,
            image_url=result.image_url,
            local_path=result.local_path,
            error_message=result.error_message,
            generation_time_seconds=result.generation_time_seconds,
            model_used=result.model_used,
            prompt_used=result.prompt_used,
        )


class ImageGeneratorService:
    """
    Main service for generating images from book descriptions.

    Uses Google Imagen 4 for high-quality image generation.
    """

    def __init__(self):
        self.imagen_service: ImagenService = get_imagen_service()
        self.generation_queue: List[ImageGenerationRequest] = []
        self.is_processing = False

        if self.imagen_service.is_available():
            logger.info("ImageGeneratorService initialized with Google Imagen")
        else:
            logger.warning("ImageGeneratorService: Imagen not available")

    async def generate_image_for_description(
        self,
        description: Description,
        user_id: str,
        book_genre: Optional[str] = None,
        custom_style: Optional[str] = None
    ) -> ImageGenerationResult:
        """
        Generate image for a description from the database.

        Args:
            description: Description model from database
            user_id: ID of requesting user
            book_genre: Genre for style adaptation
            custom_style: Additional style instructions

        Returns:
            ImageGenerationResult with image URL or error
        """
        if not self.imagen_service.is_available():
            return ImageGenerationResult(
                success=False,
                error_message="Image generation service not available. Check GOOGLE_API_KEY."
            )

        # Generate using Imagen
        result = await self.imagen_service.generate_image(
            description=description.content,
            description_type=description.type.value if hasattr(description.type, 'value') else str(description.type),
            genre=book_genre,
            custom_style=custom_style,
        )

        logger.info(
            f"Image generation for description {description.id}: success={result.success}"
        )

        return ImageGenerationResult.from_imagen_result(result)

    async def generate_image_from_text(
        self,
        text: str,
        description_type: str = "location",
        genre: Optional[str] = None,
        custom_style: Optional[str] = None
    ) -> ImageGenerationResult:
        """
        Generate image from raw text (for direct API calls).

        Args:
            text: Russian description text
            description_type: Type of description
            genre: Book genre
            custom_style: Additional style

        Returns:
            ImageGenerationResult
        """
        if not self.imagen_service.is_available():
            return ImageGenerationResult(
                success=False,
                error_message="Image generation service not available"
            )

        result = await self.imagen_service.generate_image(
            description=text,
            description_type=description_type,
            genre=genre,
            custom_style=custom_style,
        )

        return ImageGenerationResult.from_imagen_result(result)

    async def batch_generate_for_chapter(
        self,
        descriptions: List[Dict[str, Any]],
        user_id: str,
        book_genre: Optional[str] = None,
        max_images: int = 5
    ) -> List[ImageGenerationResult]:
        """
        Generate images for a list of descriptions from a chapter.

        Args:
            descriptions: List of description dicts to generate images for
            user_id: ID of requesting user
            book_genre: Genre for style adaptation
            max_images: Maximum number of images to generate

        Returns:
            List of ImageGenerationResult
        """
        # Sort by priority and take top N
        sorted_descriptions = sorted(
            descriptions,
            key=lambda d: d.get('priority_score', 0),
            reverse=True
        )[:max_images]

        results = []

        for desc in sorted_descriptions:
            try:
                result = await self.generate_image_for_description(
                    desc, user_id, book_genre
                )
                results.append(result)

                # Small delay between requests to avoid rate limiting
                if len(results) < len(sorted_descriptions):
                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error generating image for description: {e}")
                results.append(ImageGenerationResult(
                    success=False,
                    error_message=f"Generation error: {str(e)}"
                ))

        return results

    def add_to_queue(self, request: ImageGenerationRequest):
        """Add request to generation queue."""
        self.generation_queue.append(request)
        logger.info(f"Added to queue. Size: {len(self.generation_queue)}")

    async def process_queue(self):
        """Process queued generation requests."""
        if self.is_processing:
            logger.info("Queue already being processed")
            return

        self.is_processing = True

        try:
            while self.generation_queue:
                request = self.generation_queue.pop(0)

                logger.info(f"Processing request for user {request.user_id}")

                result = await self.imagen_service.generate_image(
                    description=request.description_content,
                    description_type=request.description_type.value,
                    genre=request.book_genre,
                    custom_style=request.style_prompt,
                )

                if result.success:
                    logger.info(f"Generated image: {result.local_path}")
                else:
                    logger.error(f"Failed: {result.error_message}")

                # Delay between requests
                await asyncio.sleep(2)

        except Exception as e:
            logger.error(f"Error processing queue: {e}")
        finally:
            self.is_processing = False

    async def preview_prompt(
        self,
        description: str,
        description_type: str = "location",
        genre: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Preview English prompt without generating image.

        Useful for debugging and testing.
        """
        if not self.imagen_service.is_available():
            return {"error": "Service not available"}

        return await self.imagen_service.preview_prompt(
            description=description,
            description_type=description_type,
            genre=genre
        )

    async def get_generation_stats(self) -> Dict[str, Any]:
        """
        Get generation service statistics.

        Returns:
            Dictionary with service status and statistics
        """
        status = self.imagen_service.get_status() if self.imagen_service else {}

        return {
            "queue_size": len(self.generation_queue),
            "is_processing": self.is_processing,
            "supported_types": [t.value for t in DescriptionType],
            "service_status": status,
            "api_status": "operational" if self.imagen_service.is_available() else "unavailable",
        }


# Global service instance
image_generator_service = ImageGeneratorService()

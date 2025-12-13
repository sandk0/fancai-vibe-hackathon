# Plan: Migrate from Pollinations.ai to Google Imagen

## Executive Summary

**Goal:** Replace pollinations.ai with Google Imagen 3/4 for image generation
**API Key:** Reuse existing `LANGEXTRACT_API_KEY` (same Google API key)
**Cost:** ~$0.03/image (Imagen 3) vs free (Pollinations)
**Quality:** Significantly higher quality, better prompt following

---

## Current State Analysis

### Pollinations.ai Implementation (`image_generator.py`)
```
Current Architecture:
├── PromptEngineer - Creates prompts with prefix/suffix templates
├── PollinationsImageGenerator - HTTP client for pollinations.ai
└── ImageGeneratorService - Main service orchestrator

Key Limitations:
- Free tier → unreliable availability
- Quality inconsistent
- No aspect ratio control
- Russian prompts partially supported
```

### Google Imagen API (Target)

**Available via Gemini API (`google-genai` package)**

| Model | Quality | Speed | Price |
|-------|---------|-------|-------|
| `imagen-3.0-generate-002` | High | Standard | $0.03/img |
| `imagen-4.0-generate-001` | Very High | Standard | $0.04/img |
| `imagen-4.0-fast-generate-001` | High | Fast | $0.02/img |

**Parameters:**
- `numberOfImages`: 1-4 (we'll use 1)
- `aspectRatio`: `1:1`, `3:4`, `4:3`, `9:16`, `16:9`
- `personGeneration`: `allow_adult` (default)
- `safetyFilterLevel`: configurable

**Constraints:**
- **English-only prompts** (must translate Russian descriptions)
- Max prompt length: 480 tokens
- SynthID watermark on all images (non-removable)

---

## Migration Plan

### Phase 1: Configuration Updates

**File: `backend/app/core/config.py`**

```python
# Google Imagen Configuration (replaces Pollinations)
GOOGLE_API_KEY: Optional[str] = None  # Reuse LANGEXTRACT_API_KEY
IMAGEN_ENABLED: bool = True
IMAGEN_MODEL: str = "imagen-3.0-generate-002"  # or imagen-4.0-generate-001
IMAGEN_ASPECT_RATIO: str = "4:3"  # Good for book illustrations
IMAGEN_SAFETY_LEVEL: str = "block_some"  # block_none, block_few, block_some, block_most
```

**Remove:**
```python
POLLINATIONS_ENABLED: bool = True  # Remove
POLLINATIONS_BASE_URL: str = "..."  # Remove
```

---

### Phase 2: New Prompt Engineering

**Critical Change:** Imagen requires **English prompts only**

**New PromptEngineer for Imagen:**

```python
class ImagenPromptEngineer:
    """Optimized prompts for Google Imagen 3/4."""

    # Imagen-specific style templates (English)
    STYLE_TEMPLATES = {
        DescriptionType.LOCATION: {
            "prefix": "Detailed illustration of",
            "style": "fantasy book illustration style, atmospheric lighting, rich colors",
            "suffix": "highly detailed, professional artwork, suitable for book cover"
        },
        DescriptionType.CHARACTER: {
            "prefix": "Character portrait of",
            "style": "fantasy illustration style, detailed facial features, expressive eyes",
            "suffix": "professional character design, book illustration quality"
        },
        DescriptionType.ATMOSPHERE: {
            "prefix": "Atmospheric scene depicting",
            "style": "moody lighting, emotional ambiance, cinematic composition",
            "suffix": "evocative artwork, book illustration style"
        }
    }

    # Russian → English translation for common terms
    TERM_TRANSLATIONS = {
        "замок": "castle",
        "лес": "forest",
        "изба": "wooden cottage",
        "терем": "wooden tower house",
        "богатырь": "knight warrior",
        "царевна": "princess",
        "купец": "merchant",
        "дремучий": "dense dark",
        "светлица": "bright chamber",
        "горница": "upper room",
    }
```

**Prompt Construction Algorithm:**

```python
def create_imagen_prompt(
    russian_description: str,
    description_type: DescriptionType,
    genre: Optional[str] = None
) -> str:
    """
    Create optimized English prompt for Imagen.

    1. Translate Russian description to English
    2. Extract key visual elements
    3. Apply type-specific style template
    4. Limit to 480 tokens
    """
    # Step 1: Translate using Gemini
    english_description = await translate_to_english(russian_description)

    # Step 2: Get template
    template = STYLE_TEMPLATES[description_type]

    # Step 3: Build prompt
    prompt = f"{template['prefix']} {english_description}, {template['style']}, {template['suffix']}"

    # Step 4: Add genre-specific modifiers
    if genre:
        genre_styles = {
            "fantasy": "fantasy art, magical atmosphere",
            "detective": "noir style, dramatic shadows",
            "romance": "soft lighting, romantic mood",
            "sci-fi": "futuristic, sci-fi aesthetic",
        }
        prompt += f", {genre_styles.get(genre, '')}"

    # Step 5: Truncate to 480 tokens (~1800 chars)
    return prompt[:1800]
```

---

### Phase 3: GoogleImagenGenerator Implementation

**File: `backend/app/services/imagen_generator.py`**

```python
"""
Google Imagen Image Generator.

Replaces Pollinations.ai with Google Imagen 3/4 API.
Uses same API key as Gemini (LANGEXTRACT_API_KEY).
"""

from google import genai
from google.genai import types
import asyncio
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class ImagenConfig:
    """Configuration for Imagen generator."""
    api_key: str
    model: str = "imagen-3.0-generate-002"
    aspect_ratio: str = "4:3"  # 1:1, 3:4, 4:3, 9:16, 16:9
    person_generation: str = "allow_adult"
    safety_filter_level: str = "block_some"
    timeout_seconds: int = 60


class GoogleImagenGenerator:
    """
    Google Imagen API client for image generation.

    Usage:
        generator = GoogleImagenGenerator(config)
        result = await generator.generate("A castle on a hill")
    """

    def __init__(self, config: ImagenConfig):
        self.config = config
        self._client = None
        self._initialize()

    def _initialize(self):
        """Initialize Google GenAI client."""
        try:
            self._client = genai.Client(api_key=self.config.api_key)
            logger.info(f"Imagen generator initialized (model: {self.config.model})")
        except Exception as e:
            logger.error(f"Failed to initialize Imagen: {e}")
            raise

    async def generate(
        self,
        prompt: str,
        aspect_ratio: Optional[str] = None
    ) -> ImageGenerationResult:
        """
        Generate image using Google Imagen.

        Args:
            prompt: English text prompt (max 480 tokens)
            aspect_ratio: Override default aspect ratio

        Returns:
            ImageGenerationResult with image data or error
        """
        start_time = time.time()

        try:
            # Build config
            gen_config = types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio=aspect_ratio or self.config.aspect_ratio,
                person_generation=self.config.person_generation,
                safety_filter_level=self.config.safety_filter_level,
            )

            # Generate (sync call wrapped in executor)
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._client.models.generate_images(
                    model=self.config.model,
                    prompt=prompt,
                    config=gen_config
                )
            )

            # Extract image
            if response.generated_images:
                image = response.generated_images[0]
                image_bytes = image.image.image_bytes

                # Save locally
                local_path = await self._save_image(image_bytes, prompt)

                generation_time = time.time() - start_time

                return ImageGenerationResult(
                    success=True,
                    image_data=image_bytes,
                    local_path=local_path,
                    generation_time_seconds=generation_time,
                    model_used=self.config.model,
                )
            else:
                return ImageGenerationResult(
                    success=False,
                    error_message="No images generated"
                )

        except Exception as e:
            logger.error(f"Imagen generation failed: {e}")
            return ImageGenerationResult(
                success=False,
                error_message=str(e)
            )
```

---

### Phase 4: Translation Service

**File: `backend/app/services/prompt_translator.py`**

```python
"""
Russian → English prompt translation using Gemini.

Optimized for visual descriptions and book illustration prompts.
"""

import google.generativeai as genai

TRANSLATION_PROMPT = """Translate this Russian visual description to English for image generation.

RULES:
1. Focus on VISUAL elements only
2. Use descriptive adjectives
3. Preserve atmosphere and mood
4. Use common English art terms
5. Keep under 200 words

Russian text:
{text}

English translation (visual elements only):"""


async def translate_for_imagen(russian_text: str, api_key: str) -> str:
    """
    Translate Russian description to English for Imagen.

    Uses Gemini for accurate literary translation.
    """
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    prompt = TRANSLATION_PROMPT.format(text=russian_text)
    response = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: model.generate_content(prompt)
    )

    return response.text.strip()
```

---

### Phase 5: Integration

**Update `ImageGeneratorService`:**

```python
class ImageGeneratorService:
    """Main image generation service."""

    def __init__(self):
        self.prompt_engineer = ImagenPromptEngineer()

        # Initialize Imagen instead of Pollinations
        api_key = os.getenv("LANGEXTRACT_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            self.imagen_client = GoogleImagenGenerator(
                ImagenConfig(api_key=api_key)
            )
        else:
            logger.warning("No Google API key - image generation disabled")
            self.imagen_client = None

    async def generate_image_for_description(
        self,
        description: Description,
        user_id: str,
        book_genre: Optional[str] = None
    ) -> ImageGenerationResult:
        """Generate image using Imagen."""

        if not self.imagen_client:
            return ImageGenerationResult(
                success=False,
                error_message="Image generation not configured"
            )

        # Create optimized English prompt
        prompt = await self.prompt_engineer.create_prompt(
            description.content,
            description.type,
            book_genre
        )

        # Generate with Imagen
        return await self.imagen_client.generate(prompt)
```

---

### Phase 6: API Router Updates

**File: `backend/app/routers/images.py`**

No major changes needed - just ensure the service is injected correctly.

**Add new admin endpoint for translation preview:**

```python
@router.post("/preview-prompt")
async def preview_imagen_prompt(
    description_content: str,
    description_type: str,
    genre: Optional[str] = None
):
    """Preview the English prompt that will be sent to Imagen."""
    prompt = await prompt_engineer.create_prompt(
        description_content,
        DescriptionType(description_type),
        genre
    )
    return {"english_prompt": prompt, "char_count": len(prompt)}
```

---

## Prompt Optimization for Imagen

### Best Practices (from Google docs)

1. **Be Specific:** "A Victorian-era castle with Gothic spires" > "A castle"
2. **Include Style:** "oil painting style", "book illustration", "fantasy art"
3. **Specify Lighting:** "golden hour lighting", "dramatic shadows", "soft diffused light"
4. **Camera/Perspective:** "wide angle view", "close-up portrait", "aerial view"

### Optimized Templates by Description Type

**Location:**
```
Detailed illustration of [description], fantasy book illustration style,
atmospheric lighting, rich vibrant colors, highly detailed architecture
and environment, professional artwork quality, suitable for book illustration
```

**Character:**
```
Character portrait of [description], fantasy illustration style,
detailed facial features, expressive eyes, period-appropriate clothing,
professional character design, book illustration quality, soft lighting
```

**Atmosphere:**
```
Atmospheric scene depicting [description], moody cinematic lighting,
emotional ambiance, dramatic composition, evocative artwork,
impressionistic style, book illustration quality
```

---

## Cost Analysis

| Metric | Pollinations | Imagen 3 | Imagen 4 Fast |
|--------|-------------|----------|---------------|
| Cost/image | Free | $0.03 | $0.02 |
| Monthly (1000 imgs) | $0 | $30 | $20 |
| Quality | Medium | High | High |
| Reliability | Low | High | High |
| Speed | ~10s | ~5s | ~3s |

**Recommendation:** Start with `imagen-3.0-generate-002`, upgrade to `imagen-4.0-fast-generate-001` if budget allows.

---

## Environment Variables

```bash
# Required (same key for parsing and images)
GOOGLE_API_KEY=your-google-api-key
# OR
LANGEXTRACT_API_KEY=your-google-api-key

# Optional (defaults shown)
IMAGEN_MODEL=imagen-3.0-generate-002
IMAGEN_ASPECT_RATIO=4:3
IMAGEN_SAFETY_LEVEL=block_some
```

---

## Implementation Checklist

- [ ] Add Imagen settings to `config.py`
- [ ] Create `imagen_generator.py` with GoogleImagenGenerator
- [ ] Create `prompt_translator.py` for Russian→English
- [ ] Update `ImagenPromptEngineer` with English templates
- [ ] Update `ImageGeneratorService` to use Imagen
- [ ] Add translation caching (Redis) to reduce API calls
- [ ] Update admin endpoints for prompt preview
- [ ] Remove Pollinations code (or keep as fallback)
- [ ] Update frontend if needed (image URLs)
- [ ] Add monitoring for Imagen costs
- [ ] Deploy and test

---

## Rollback Plan

Keep `PollinationsImageGenerator` as fallback:

```python
class ImageGeneratorService:
    def __init__(self):
        # Primary: Imagen
        self.imagen_client = GoogleImagenGenerator(...)
        # Fallback: Pollinations
        self.pollinations_client = PollinationsImageGenerator()

    async def generate(self, ...):
        try:
            return await self.imagen_client.generate(...)
        except Exception:
            logger.warning("Imagen failed, falling back to Pollinations")
            return await self.pollinations_client.generate_image(...)
```

---

## Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Configuration + Imagen client | 1 hour |
| 2 | Prompt translator | 1 hour |
| 3 | PromptEngineer optimization | 2 hours |
| 4 | Integration + testing | 2 hours |
| 5 | Deploy + monitor | 1 hour |

**Total estimated time: ~7 hours**

---

## Sources

- [Gemini API Imagen Docs](https://ai.google.dev/gemini-api/docs/imagen)
- [Vertex AI Image Generation API](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api)
- [DataCamp Imagen 3 Guide](https://www.datacamp.com/tutorial/imagen-3)
- [Google Developers Blog - Imagen 3 in Gemini API](https://developers.googleblog.com/en/imagen-3-arrives-in-the-gemini-api/)

# План Действий для Тестирования (Testing Action Plan)

**Дата:** 2025-11-18
**Версия:** 1.0
**Статус:** ACTIVE

---

## QUICK START: Первый день разработки

### Шаг 1: Установка зависимостей (30 минут)

```bash
# Backend
cd backend
pip install pytest-benchmark pytest-factoryboy pytest-mock hypothesis --upgrade

# Frontend
cd frontend
npm install -D msw @testing-library/jest-dom jest-axe

# Verify
pytest --version
npx vitest --version
```

### Шаг 2: Создание test utilities (1 час)

**Backend (`backend/tests/utils.py`):**

```python
"""Test utilities and factories for pytest."""

import uuid
from typing import TypeVar, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models.book import Book, ReadingProgress
from app.models.chapter import Chapter
from app.models.user import User
from app.models.description import Description
from app.services.nlp.components.processor_registry import ProcessorConfig

T = TypeVar('T')


class TestDataFactory:
    """Factory for creating test data."""

    @staticmethod
    async def create_test_user(
        db_session: AsyncSession,
        email: str = "test@example.com",
        username: str = "testuser",
        **kwargs
    ) -> User:
        """Create a test user."""
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            hashed_password="hashed_password",
            **kwargs
        )
        db_session.add(user)
        await db_session.commit()
        return user

    @staticmethod
    async def create_test_book(
        db_session: AsyncSession,
        user_id: uuid.UUID,
        title: str = "Test Book",
        author: str = "Test Author",
        **kwargs
    ) -> Book:
        """Create a test book."""
        book = Book(
            id=uuid.uuid4(),
            user_id=user_id,
            title=title,
            author=author,
            genre="fiction",
            language="ru",
            file_format="epub",
            file_size=1024,
            file_path="/test/path.epub",
            **kwargs
        )
        db_session.add(book)
        await db_session.commit()
        await db_session.refresh(book)
        return book

    @staticmethod
    async def create_test_chapter(
        db_session: AsyncSession,
        book_id: uuid.UUID,
        chapter_number: int = 1,
        title: str = "Chapter 1",
        **kwargs
    ) -> Chapter:
        """Create a test chapter."""
        chapter = Chapter(
            id=uuid.uuid4(),
            book_id=book_id,
            chapter_number=chapter_number,
            title=title,
            content="Test chapter content with descriptions.",
            html_content="<p>Test chapter content</p>",
            **kwargs
        )
        db_session.add(chapter)
        await db_session.commit()
        await db_session.refresh(chapter)
        return chapter

    @staticmethod
    async def create_test_descriptions(
        db_session: AsyncSession,
        chapter_id: uuid.UUID,
        count: int = 3
    ) -> list[Description]:
        """Create test descriptions."""
        descriptions = []
        for i in range(count):
            desc = Description(
                id=uuid.uuid4(),
                chapter_id=chapter_id,
                text=f"Description {i+1}",
                description_type="location" if i % 2 == 0 else "character",
                quality_score=0.8,
                context="Test context",
                priority_score=0.85,
                chapter_position=100 * (i + 1)
            )
            descriptions.append(desc)

        db_session.add_all(descriptions)
        await db_session.commit()
        return descriptions


def create_mock_processor_config(
    enabled: bool = True,
    weight: float = 1.0,
    confidence_threshold: float = 0.3,
    **kwargs
) -> ProcessorConfig:
    """Create a mock processor configuration."""
    return ProcessorConfig(
        enabled=enabled,
        weight=weight,
        confidence_threshold=confidence_threshold,
        **kwargs
    )


# Sample texts for testing
SAMPLE_RUSSIAN_TEXT = """
В глубоком темном лесу стояла старая избушка на курьих ножках.
Вокруг нее росли высокие сосны и ели, их ветви касались крыши.
Иван Петрович медленно приближался к избушке, внимательно осматривая окрестности.
Тишина была такая, что слышно было, как падают с деревьев шишки.
Красивое закатное небо окрашивало лес в золотисто-красные тона.
"""

COMPLEX_TEXT = """
Князь Андрей Болконский и Пьер Безухов встретились в Москве на балу у графа Ростова.
Великолепный зал был украшен хрустальными люстрами и позолоченными зеркалами.
Петербургское высшее общество собралось в особняке на Тверской улице.
Анна Павловна Шерер устраивала вечер, где присутствовали все знатные особы столицы.
"""

SHORT_TEXT = "Beautiful forest with old trees."
EMPTY_TEXT = ""
VERY_LONG_TEXT = SAMPLE_RUSSIAN_TEXT * 100  # For stress testing
```

**Frontend (`frontend/src/test/utils.tsx`):**

```typescript
/**
 * Test utilities and helpers for vitest + React Testing Library.
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useBooksStore } from '@/stores/books';
import type { Book, BookDetail } from '@/types/api';

/**
 * Custom render function with all providers.
 */
export function renderWithProviders(
  component: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  return render(component, { wrapper: Wrapper, ...options });
}

/**
 * Create a mock book for testing.
 */
export function createMockBook(overrides?: Partial<Book>): Book {
  return {
    id: '1',
    title: 'Test Book',
    author: 'Test Author',
    genre: 'fiction',
    language: 'ru',
    total_pages: 200,
    estimated_reading_time_hours: 5,
    chapters_count: 10,
    reading_progress_percent: 0,
    has_cover: false,
    is_parsed: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock book detail for testing.
 */
export function createMockBookDetail(overrides?: Partial<BookDetail>): BookDetail {
  return {
    ...createMockBook(),
    description: 'Test book description',
    publisher: 'Test Publisher',
    publication_year: 2023,
    isbn: '123-456-789',
    cover_image: '/test-cover.jpg',
    total_pages: 300,
    is_parsed: true,
    parsing_progress_percent: 100,
    parsing_status: 'completed',
    ...overrides,
  };
}

/**
 * Mock auth store for testing.
 */
export function mockAuthStore(overrides?: any) {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    ...overrides,
  });
}

/**
 * Mock books store for testing.
 */
export function mockBooksStore(overrides?: any) {
  useBooksStore.setState({
    books: [],
    currentBook: null,
    currentChapter: null,
    isLoading: false,
    error: null,
    totalBooks: 0,
    currentPage: 1,
    booksPerPage: 12,
    hasMore: true,
    ...overrides,
  });
}

/**
 * Wait for a condition to be true.
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 3000
) {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition not met within timeout');
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

/**
 * Sample books for testing.
 */
export const MOCK_BOOKS = [
  createMockBook({ id: '1', title: 'Book 1' }),
  createMockBook({ id: '2', title: 'Book 2' }),
  createMockBook({ id: '3', title: 'Book 3' }),
];
```

### Шаг 3: Setup MSW (Mock Service Worker) для Frontend (30 минут)

**Frontend (`frontend/src/test/mocks.ts`):**

```typescript
/**
 * Mock Service Worker setup for API testing.
 */

import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { createMockBook, createMockBookDetail } from './utils';

export const server = setupServer(
  // Books endpoints
  rest.get('/api/v1/books', (req, res, ctx) => {
    return res(
      ctx.json({
        items: [
          createMockBook({ id: '1' }),
          createMockBook({ id: '2' }),
        ],
        total: 2,
        page: 1,
        page_size: 10,
      })
    );
  }),

  rest.get('/api/v1/books/:bookId', (req, res, ctx) => {
    return res(ctx.json(createMockBookDetail({ id: req.params.bookId })));
  }),

  rest.post('/api/v1/books', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json(createMockBook({ id: 'new-book' }))
    );
  }),

  rest.delete('/api/v1/books/:bookId', (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  // Auth endpoints
  rest.post('/api/v1/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        access_token: 'test-token',
        token_type: 'bearer',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
        },
      })
    );
  }),

  rest.post('/api/v1/auth/logout', (req, res, ctx) => {
    return res(ctx.status(200));
  }),

  // Chapters endpoint
  rest.get('/api/v1/books/:bookId/chapters/:chapterNum', (req, res, ctx) => {
    return res(
      ctx.json({
        chapter_number: parseInt(req.params.chapterNum),
        title: `Chapter ${req.params.chapterNum}`,
        content: 'Chapter content here...',
        cfi: '/6/4[chap01]!/4/2/16,/1:0,/1:10',
      })
    );
  }),
);

// Enable request interception in test environment
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Update `frontend/src/test/setup.ts`:**

```typescript
import '@testing-library/jest-dom';
import { server } from './mocks';

// Start MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## PHASE 1: MULTI-NLP COMPONENTS (3-4 Days)

### Day 1: ProcessorRegistry Tests

**File:** `backend/tests/services/nlp/components/test_processor_registry.py`

```python
"""
Tests for ProcessorRegistry component.
Target: 80%+ coverage
Tests: 18-20
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.nlp.components.processor_registry import (
    ProcessorRegistry,
    ProcessorConfig,
)
from app.services.nlp.components.config_loader import ConfigLoader
from app.services.enhanced_nlp_system import EnhancedSpacyProcessor
from tests.utils import create_mock_processor_config, SAMPLE_RUSSIAN_TEXT


@pytest.fixture
def processor_registry():
    """Create a ProcessorRegistry instance."""
    return ProcessorRegistry()


@pytest.fixture
def mock_config_loader():
    """Mock ConfigLoader."""
    loader = AsyncMock(spec=ConfigLoader)
    loader.load_processor_configs.return_value = {
        "spacy": create_mock_processor_config(),
        "natasha": create_mock_processor_config(weight=1.2),
        "stanza": create_mock_processor_config(weight=0.8),
    }
    return loader


class TestProcessorRegistryInitialization:
    """Test registry initialization."""

    @pytest.mark.asyncio
    async def test_registry_initializes_with_configs(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Registry should load and apply configurations."""
        # Arrange
        assert processor_registry._initialized is False

        # Act
        await processor_registry.initialize(mock_config_loader)

        # Assert
        assert processor_registry._initialized is True
        assert len(processor_registry.processor_configs) == 3
        assert "spacy" in processor_registry.processor_configs
        assert "natasha" in processor_registry.processor_configs
        assert "stanza" in processor_registry.processor_configs

    @pytest.mark.asyncio
    async def test_registry_already_initialized(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Registry should not reinitialize if already done."""
        # Arrange
        await processor_registry.initialize(mock_config_loader)
        mock_config_loader.reset_mock()

        # Act
        await processor_registry.initialize(mock_config_loader)

        # Assert - should not call loader again
        mock_config_loader.load_processor_configs.assert_not_called()

    @pytest.mark.asyncio
    async def test_registry_loads_processor_configs(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Registry should load processor-specific configs."""
        # Act
        await processor_registry.initialize(mock_config_loader)

        # Assert
        assert processor_registry.processor_configs["spacy"].weight == 1.0
        assert processor_registry.processor_configs["natasha"].weight == 1.2
        assert processor_registry.processor_configs["stanza"].weight == 0.8


class TestProcessorRegistryAccess:
    """Test accessing processors from registry."""

    @pytest.mark.asyncio
    async def test_get_processor_by_name(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Should retrieve processor by name."""
        # Arrange
        await processor_registry.initialize(mock_config_loader)

        # Act
        processor = processor_registry.get_processor("spacy")

        # Assert
        assert processor is not None

    @pytest.mark.asyncio
    async def test_get_nonexistent_processor_returns_none(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Should return None for non-existent processor."""
        # Arrange
        await processor_registry.initialize(mock_config_loader)

        # Act
        processor = processor_registry.get_processor("nonexistent")

        # Assert
        assert processor is None

    @pytest.mark.asyncio
    async def test_get_all_enabled_processors(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Should list all enabled processors."""
        # Arrange
        await processor_registry.initialize(mock_config_loader)

        # Act
        enabled = processor_registry.get_enabled_processors()

        # Assert
        assert len(enabled) >= 1  # At least one should be enabled

    @pytest.mark.asyncio
    async def test_processor_status_report(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Should generate processor status report."""
        # Arrange
        await processor_registry.initialize(mock_config_loader)

        # Act
        status = processor_registry.get_status()

        # Assert
        assert status is not None
        assert "spacy" in status
        assert all(
            "available" in processor_status
            for processor_status in status.values()
        )


class TestProcessorConfigUpdate:
    """Test updating processor configurations."""

    @pytest.mark.asyncio
    async def test_update_processor_config(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Should update processor configuration."""
        # Arrange
        await processor_registry.initialize(mock_config_loader)
        new_config = create_mock_processor_config(weight=2.0)

        # Act
        processor_registry.update_processor_config("spacy", new_config)

        # Assert
        updated = processor_registry.processor_configs["spacy"]
        assert updated.weight == 2.0

    @pytest.mark.asyncio
    async def test_update_config_affects_processor(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Config update should affect processor behavior."""
        # Arrange
        await processor_registry.initialize(mock_config_loader)
        new_config = create_mock_processor_config(confidence_threshold=0.5)

        # Act
        processor_registry.update_processor_config("spacy", new_config)

        # Assert
        processor = processor_registry.get_processor("spacy")
        if processor:
            # Verify processor got updated config
            assert processor.config.confidence_threshold == 0.5


class TestProcessorRegistryHealthCheck:
    """Test registry health checking."""

    @pytest.mark.asyncio
    async def test_health_check_all_processors(
        self,
        processor_registry: ProcessorRegistry,
        mock_config_loader,
    ):
        """Should perform health check on all processors."""
        # Arrange
        await processor_registry.initialize(mock_config_loader)

        # Act
        health = await processor_registry.health_check()

        # Assert
        assert health is not None
        assert isinstance(health, dict)

    @pytest.mark.asyncio
    async def test_health_check_disabled_processors(
        self,
        processor_registry: ProcessorRegistry,
    ):
        """Health check should skip disabled processors."""
        # Arrange
        mock_loader = AsyncMock()
        mock_loader.load_processor_configs.return_value = {
            "spacy": create_mock_processor_config(enabled=True),
            "disabled": create_mock_processor_config(enabled=False),
        }
        await processor_registry.initialize(mock_loader)

        # Act
        health = await processor_registry.health_check()

        # Assert
        # Should only check enabled processor
        assert len(health) >= 1


# ... Continue with more test classes ...
```

### Day 2: EnsembleVoter Tests

**File:** `backend/tests/services/nlp/components/test_ensemble_voter.py`

```python
"""
Tests for EnsembleVoter component.
Target: 80%+ coverage
Tests: 15-18
"""

import pytest
from unittest.mock import MagicMock
from app.services.nlp.components.ensemble_voter import EnsembleVoter
from tests.utils import SAMPLE_RUSSIAN_TEXT


@pytest.fixture
def ensemble_voter():
    """Create an EnsembleVoter instance."""
    return EnsembleVoter()


class TestWeightedConsensusVoting:
    """Test weighted consensus voting mechanism."""

    def test_weighted_vote_calculation(self, ensemble_voter):
        """Should calculate weighted votes correctly."""
        # Arrange
        descriptions = [
            {
                "text": "Dark forest",
                "source": "spacy",
                "confidence": 0.9,
            },
            {
                "text": "Dark forest",
                "source": "natasha",
                "confidence": 0.85,
            },
            {
                "text": "Dark forest",
                "source": "stanza",
                "confidence": 0.8,
            },
        ]
        weights = {"spacy": 1.0, "natasha": 1.2, "stanza": 0.8}

        # Act
        result = ensemble_voter.weighted_consensus(descriptions, weights)

        # Assert
        assert result["consensus_score"] >= 0.75  # Above threshold
        assert result["winning_text"] == "Dark forest"
        assert len(result["contributing_sources"]) == 3

    def test_voting_with_disagreement(self, ensemble_voter):
        """Should handle disagreement between processors."""
        # Arrange
        descriptions = [
            {"text": "Dark forest", "source": "spacy", "confidence": 0.9},
            {"text": "Light meadow", "source": "natasha", "confidence": 0.7},
            {"text": "Dark forest", "source": "stanza", "confidence": 0.8},
        ]
        weights = {"spacy": 1.0, "natasha": 1.2, "stanza": 0.8}

        # Act
        result = ensemble_voter.weighted_consensus(descriptions, weights)

        # Assert
        assert result["winning_text"] == "Dark forest"  # Majority wins

    def test_voting_threshold_below_minimum(self, ensemble_voter):
        """Should reject consensus below threshold."""
        # Arrange
        descriptions = [
            {"text": "Description A", "source": "spacy", "confidence": 0.3},
            {"text": "Description B", "source": "natasha", "confidence": 0.2},
        ]
        weights = {"spacy": 1.0, "natasha": 1.0}
        threshold = 0.6

        # Act
        result = ensemble_voter.weighted_consensus(
            descriptions, weights, threshold
        )

        # Assert
        assert result["consensus_score"] < threshold
        assert result["status"] == "below_threshold"


class TestContextEnrichment:
    """Test context enrichment in voting."""

    def test_context_enrichment_from_agreement(self, ensemble_voter):
        """Should enrich context from high agreement."""
        # Arrange
        descriptions = [
            {
                "text": "Dark forest",
                "source": "spacy",
                "context": "Context A",
                "confidence": 0.9,
            },
            {
                "text": "Dark forest",
                "source": "natasha",
                "context": "Context A",
                "confidence": 0.85,
            },
        ]

        # Act
        result = ensemble_voter.enrich_context(descriptions)

        # Assert
        assert result["confidence"] >= 0.8
        assert result["context_quality"] == "high"


class TestDescriptionDeduplication:
    """Test deduplication of descriptions."""

    def test_similar_descriptions_deduplicated(self, ensemble_voter):
        """Should identify and deduplicate similar descriptions."""
        # Arrange
        descriptions = [
            {"text": "Dark forest with tall trees"},
            {"text": "Dark forest with tall trees"},  # Duplicate
            {"text": "Deep dark forest"},  # Similar
        ]

        # Act
        dedup = ensemble_voter.deduplicate_descriptions(descriptions)

        # Assert
        assert len(dedup) == 2  # Removed one duplicate
        assert dedup[0]["text"] == "Dark forest with tall trees"

    def test_deduplication_with_weighted_scoring(self, ensemble_voter):
        """Should keep higher-weighted duplicates."""
        # Arrange
        descriptions = [
            {"text": "Description", "weight": 0.7, "source": "spacy"},
            {"text": "Description", "weight": 0.95, "source": "natasha"},
        ]

        # Act
        dedup = ensemble_voter.deduplicate_descriptions(descriptions)

        # Assert
        assert len(dedup) == 1
        assert dedup[0]["weight"] == 0.95  # Kept the higher weighted


class TestQualityIndicators:
    """Test quality indicator calculation."""

    def test_quality_score_calculation(self, ensemble_voter):
        """Should calculate quality score from consensus."""
        # Arrange
        consensus_data = {
            "consensus_score": 0.85,
            "contributing_sources": 3,
            "confidence_average": 0.87,
        }

        # Act
        quality = ensemble_voter.calculate_quality_indicator(consensus_data)

        # Assert
        assert 0 <= quality <= 1
        assert quality >= 0.8

    def test_low_quality_detection(self, ensemble_voter):
        """Should flag low quality descriptions."""
        # Arrange
        consensus_data = {
            "consensus_score": 0.45,
            "contributing_sources": 1,
            "confidence_average": 0.5,
        }

        # Act
        quality = ensemble_voter.calculate_quality_indicator(consensus_data)

        # Assert
        assert quality < 0.6
        assert ensemble_voter.is_quality_sufficient(quality) is False


# ... Continue with more test classes ...
```

### Day 3: ConfigLoader Tests

**File:** `backend/tests/services/nlp/components/test_config_loader.py`

```python
"""
Tests for ConfigLoader component.
Target: 80%+ coverage
Tests: 12-15
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.nlp.components.config_loader import ConfigLoader
from app.services.nlp.components.processor_registry import ProcessorConfig


@pytest.fixture
def config_loader():
    """Create a ConfigLoader instance."""
    return ConfigLoader()


@pytest.fixture
def sample_config_dict():
    """Sample processor configuration."""
    return {
        "spacy": {
            "enabled": True,
            "weight": 1.0,
            "confidence_threshold": 0.3,
            "min_description_length": 50,
            "max_description_length": 1000,
        },
        "natasha": {
            "enabled": True,
            "weight": 1.2,
            "confidence_threshold": 0.35,
            "min_description_length": 50,
        },
        "stanza": {
            "enabled": True,
            "weight": 0.8,
            "confidence_threshold": 0.4,
        },
    }


class TestConfigLoading:
    """Test loading configurations."""

    @pytest.mark.asyncio
    async def test_load_processor_configs(
        self,
        config_loader: ConfigLoader,
        sample_config_dict,
    ):
        """Should load processor configurations."""
        # Arrange
        with patch.object(
            config_loader,
            "_load_from_file",
            return_value=sample_config_dict,
        ):
            # Act
            configs = await config_loader.load_processor_configs()

            # Assert
            assert len(configs) == 3
            assert "spacy" in configs
            assert isinstance(configs["spacy"], ProcessorConfig)

    @pytest.mark.asyncio
    async def test_load_config_applies_defaults(
        self,
        config_loader: ConfigLoader,
    ):
        """Should apply default values for missing config keys."""
        # Arrange
        minimal_config = {
            "spacy": {"enabled": True},
        }

        with patch.object(
            config_loader,
            "_load_from_file",
            return_value=minimal_config,
        ):
            # Act
            configs = await config_loader.load_processor_configs()

            # Assert
            config = configs["spacy"]
            assert config.enabled is True
            assert config.weight == 1.0  # Default
            assert config.confidence_threshold == 0.3  # Default

    @pytest.mark.asyncio
    async def test_load_nonexistent_config_raises_error(
        self,
        config_loader: ConfigLoader,
    ):
        """Should raise error if config file doesn't exist."""
        # Arrange
        with patch.object(
            config_loader,
            "_load_from_file",
            side_effect=FileNotFoundError("Config not found"),
        ):
            # Act & Assert
            with pytest.raises(FileNotFoundError):
                await config_loader.load_processor_configs()


class TestConfigValidation:
    """Test configuration validation."""

    def test_validate_valid_config(
        self,
        config_loader: ConfigLoader,
        sample_config_dict,
    ):
        """Should validate correct configuration."""
        # Act
        is_valid = config_loader.validate_config(sample_config_dict)

        # Assert
        assert is_valid is True

    def test_validate_invalid_weight(
        self,
        config_loader: ConfigLoader,
        sample_config_dict,
    ):
        """Should reject invalid weight values."""
        # Arrange
        sample_config_dict["spacy"]["weight"] = -1.0

        # Act
        is_valid = config_loader.validate_config(sample_config_dict)

        # Assert
        assert is_valid is False

    def test_validate_missing_required_field(
        self,
        config_loader: ConfigLoader,
        sample_config_dict,
    ):
        """Should require enabled field."""
        # Arrange
        del sample_config_dict["spacy"]["enabled"]

        # Act
        is_valid = config_loader.validate_config(sample_config_dict)

        # Assert
        assert is_valid is False


class TestConfigMerging:
    """Test configuration merging."""

    def test_merge_configs(self, config_loader: ConfigLoader):
        """Should merge default and override configs."""
        # Arrange
        defaults = {
            "spacy": {"weight": 1.0, "confidence_threshold": 0.3},
        }
        overrides = {
            "spacy": {"weight": 2.0},
        }

        # Act
        merged = config_loader.merge_configs(defaults, overrides)

        # Assert
        assert merged["spacy"]["weight"] == 2.0
        assert merged["spacy"]["confidence_threshold"] == 0.3

    def test_merge_preserves_unoverridden(
        self,
        config_loader: ConfigLoader,
    ):
        """Should preserve non-overridden values."""
        # Arrange
        defaults = {
            "spacy": {"a": 1, "b": 2, "c": 3},
        }
        overrides = {
            "spacy": {"b": 20},
        }

        # Act
        merged = config_loader.merge_configs(defaults, overrides)

        # Assert
        assert merged["spacy"]["a"] == 1
        assert merged["spacy"]["b"] == 20
        assert merged["spacy"]["c"] == 3


class TestDefaultSettings:
    """Test default settings fallback."""

    @pytest.mark.asyncio
    async def test_default_settings_fallback(
        self,
        config_loader: ConfigLoader,
    ):
        """Should use defaults when config unavailable."""
        # Arrange
        with patch.object(
            config_loader,
            "_load_from_file",
            side_effect=FileNotFoundError(),
        ):
            # Act
            configs = await config_loader.load_processor_configs(
                use_defaults=True
            )

            # Assert
            assert len(configs) > 0
            assert all(
                isinstance(cfg, ProcessorConfig)
                for cfg in configs.values()
            )

    @pytest.mark.asyncio
    async def test_environment_override(
        self,
        config_loader: ConfigLoader,
    ):
        """Should allow environment variable overrides."""
        # Arrange
        with patch.dict(
            "os.environ",
            {"SPACY_WEIGHT": "1.5"},
        ):
            # Act
            config = await config_loader.load_processor_config_for(
                "spacy"
            )

            # Assert
            assert config.weight == 1.5


# ... Continue with more test classes ...
```

---

## Frontend Hooks Testing Example

**File:** `frontend/src/hooks/__tests__/useChapterLoader.test.ts`

```typescript
/**
 * Tests for useChapterLoader hook.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChapterLoader } from '../useChapterLoader';
import { booksAPI } from '@/api/books';

// Mock the API
vi.mock('@/api/books');

describe('useChapterLoader', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should load chapter content', async () => {
    // Arrange
    const mockChapter = {
      chapter_number: 1,
      title: 'Chapter 1',
      content: 'Chapter content here...',
      cfi: '/6/4[chap01]!/4/2/16',
    };

    vi.mocked(booksAPI.getChapter).mockResolvedValue(mockChapter);

    // Act
    const { result } = renderHook(
      () => useChapterLoader('book-1', 1),
      { wrapper }
    );

    // Assert - loading state
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert - data loaded
    expect(result.current.chapter).toEqual(mockChapter);
    expect(result.current.error).toBeNull();
    expect(booksAPI.getChapter).toHaveBeenCalledWith('book-1', 1);
  });

  it('should handle loading error', async () => {
    // Arrange
    const error = new Error('Failed to load chapter');
    vi.mocked(booksAPI.getChapter).mockRejectedValue(error);

    // Act
    const { result } = renderHook(
      () => useChapterLoader('book-1', 1),
      { wrapper }
    );

    // Wait for error
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.error).toBeTruthy();
    expect(result.current.chapter).toBeNull();
  });

  it('should refetch when chapter ID changes', async () => {
    // Arrange
    const chapter1 = {
      chapter_number: 1,
      title: 'Chapter 1',
      content: 'Content 1',
      cfi: '/6/4[chap01]!/4/2/16',
    };
    const chapter2 = {
      chapter_number: 2,
      title: 'Chapter 2',
      content: 'Content 2',
      cfi: '/6/4[chap02]!/4/2/16',
    };

    vi.mocked(booksAPI.getChapter)
      .mockResolvedValueOnce(chapter1)
      .mockResolvedValueOnce(chapter2);

    // Act
    const { result, rerender } = renderHook(
      ({ chapterNum }) => useChapterLoader('book-1', chapterNum),
      { wrapper, initialProps: { chapterNum: 1 } }
    );

    // Wait for first chapter
    await waitFor(() => {
      expect(result.current.chapter?.chapter_number).toBe(1);
    });

    // Change chapter
    rerender({ chapterNum: 2 });

    // Assert - new chapter loaded
    await waitFor(() => {
      expect(result.current.chapter?.chapter_number).toBe(2);
    });
  });

  it('should handle empty chapter content', async () => {
    // Arrange
    const emptyChapter = {
      chapter_number: 1,
      title: 'Empty Chapter',
      content: '',
      cfi: '',
    };

    vi.mocked(booksAPI.getChapter).mockResolvedValue(emptyChapter);

    // Act
    const { result } = renderHook(
      () => useChapterLoader('book-1', 1),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.chapter?.content).toBe('');
    expect(result.current.isEmpty).toBe(true);
  });
});
```

---

## Running Your First Tests

```bash
# Backend
cd backend

# Run all tests
pytest tests/services/nlp/components/ -v

# Run specific test
pytest tests/services/nlp/components/test_processor_registry.py::TestProcessorRegistryInitialization::test_registry_initializes_with_configs -v

# Run with coverage
pytest tests/services/nlp/components/ --cov=app.services.nlp.components --cov-report=html

# Frontend
cd frontend

# Run all tests
npm test

# Run specific test file
npm test useChapterLoader

# Run with coverage
npm test -- --coverage

# Watch mode for development
npm run test:watch
```

---

## Success Metrics for Day 1

```
✅ Dependencies installed
✅ Test utilities created and working
✅ ProcessorRegistry: 10+ tests passing
✅ ConfigLoader: 5+ tests passing
✅ Frontend hooks: 3+ tests passing
✅ MSW setup for API mocking
✅ CI/CD updated to run tests
✅ Coverage reports generating

Coverage targets:
- Backend: 30%+ (up from 2.9%)
- Frontend: 20%+ (up from 0%)
```

---

## Notes

- All test files should follow naming: `test_*.py` (backend) or `*.test.ts(x)` (frontend)
- Use AAA pattern (Arrange-Act-Assert) consistently
- Add docstrings explaining what each test validates
- Mock external dependencies (APIs, databases)
- Test both happy path and error scenarios
- Run tests frequently (before every commit)

---

**Report Generated:** 2025-11-18
**Status:** READY FOR IMPLEMENTATION

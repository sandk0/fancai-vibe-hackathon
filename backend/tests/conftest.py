import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import AsyncMock

from app.main import app
from app.core.database import get_database
from app.models import Base
from app.core.config import get_settings


# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_bookreader.db"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL, 
    echo=False,
    future=True
)

# Test session factory
TestSessionLocal = sessionmaker(
    test_engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)


@pytest_asyncio.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_db():
    """Create test database tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def db_session(test_db):
    """Create a test database session."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def override_get_database(db_session):
    """Override the get_database dependency."""
    def _override_get_database():
        yield db_session
    
    app.dependency_overrides[get_database] = _override_get_database
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def client(override_get_database):
    """Create test HTTP client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_nlp_processor():
    """Mock NLP processor for testing."""
    mock = AsyncMock()
    mock.extract_descriptions.return_value = [
        {
            "text": "Test description",
            "description_type": "location",
            "priority_score": 0.8,
            "chapter_position": 100,
            "context": "Test context"
        }
    ]
    return mock


@pytest.fixture
def mock_image_generator():
    """Mock image generator for testing."""
    mock = AsyncMock()
    mock.generate_image.return_value = {
        "image_url": "https://example.com/test-image.jpg",
        "generation_time": 5.0
    }
    return mock


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "email": "test@example.com",
        "password": "testpassword123",
        "full_name": "Test User"
    }


@pytest.fixture
def sample_book_data():
    """Sample book data for testing."""
    return {
        "title": "Test Book",
        "author": "Test Author",
        "genre": "Fiction",
        "description": "A test book for testing purposes",
        "language": "en",
        "file_format": "epub",
        "file_size": 1024000,
        "total_chapters": 5
    }


@pytest.fixture
def sample_chapter_data():
    """Sample chapter data for testing."""
    return {
        "chapter_number": 1,
        "title": "Chapter 1: The Beginning",
        "content": "This is the content of the first chapter. It contains a beautiful forest with tall trees.",
        "word_count": 15,
        "estimated_reading_time": 1
    }


@pytest.fixture
def sample_description_data():
    """Sample description data for testing."""
    return {
        "text": "beautiful forest with tall trees",
        "description_type": "location",
        "priority_score": 0.8,
        "chapter_position": 50,
        "context": "This is the content of the first chapter."
    }


@pytest.fixture
def authenticated_headers(client, sample_user_data):
    """Get authenticated headers for testing."""
    async def _get_headers():
        # Register user
        await client.post("/api/v1/auth/register", json=sample_user_data)
        
        # Login
        response = await client.post("/api/v1/auth/login", json={
            "email": sample_user_data["email"],
            "password": sample_user_data["password"]
        })
        
        tokens = response.json()["tokens"]
        return {"Authorization": f"Bearer {tokens['access_token']}"}
    
    return _get_headers


# Test settings override
@pytest.fixture(autouse=True)
def override_settings():
    """Override settings for testing."""
    settings = get_settings()
    settings.database_url = TEST_DATABASE_URL
    settings.environment = "test"
    settings.secret_key = "test-secret-key"
    settings.jwt_secret_key = "test-jwt-secret"
    yield settings
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import AsyncMock

from app.main import app
from app.core.database import get_database_session, Base
from app.core.config import settings
from app.models import User, Book, Chapter, Description, GeneratedImage


# Test database URL - using PostgreSQL since models use UUID type
# This connects to the same postgres container but with a test database
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres123@postgres:5432/bookreader_test"

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
    """Override the get_database_session dependency."""
    def _override_get_database():
        yield db_session

    app.dependency_overrides[get_database_session] = _override_get_database
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


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, sample_user_data):
    """Create a test user in database."""
    from app.models.user import User
    from app.services.auth_service import AuthService

    auth_service = AuthService()
    user = User(
        email=sample_user_data["email"],
        full_name=sample_user_data["full_name"],
        password_hash=auth_service.get_password_hash(sample_user_data["password"])
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_book(db_session: AsyncSession, test_user: User):
    """Create a test book in database."""
    from app.models.book import Book, BookGenre

    book = Book(
        user_id=test_user.id,
        title="Test Book",
        author="Test Author",
        genre=BookGenre.FANTASY.value,  # Use .value for string column
        language="ru",
        file_path="/tmp/test.epub",
        file_format="epub",
        file_size=1024000,
        total_pages=100,
        estimated_reading_time=50,
        is_parsed=True
    )
    db_session.add(book)
    await db_session.commit()
    await db_session.refresh(book)
    return book


@pytest_asyncio.fixture
async def test_chapter(db_session: AsyncSession, test_book: Book):
    """Create a test chapter in database."""
    from app.models.chapter import Chapter

    chapter = Chapter(
        book_id=test_book.id,
        chapter_number=1,
        title="Chapter 1",
        content="This is a test chapter content with a beautiful forest and tall trees.",
        html_content="<p>This is a test chapter content with a beautiful forest and tall trees.</p>",
        word_count=15
    )
    db_session.add(chapter)
    await db_session.commit()
    await db_session.refresh(chapter)
    return chapter


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
# Note: Settings object is a Pydantic BaseSettings which is immutable
# Tests use TEST_DATABASE_URL configured in test engine above
@pytest.fixture(autouse=False)
def override_settings():
    """Override settings for testing (disabled - Pydantic settings are immutable)."""
    yield settings
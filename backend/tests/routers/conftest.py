"""
Pytest fixtures для тестов routers.

Инициализирует feature flags и другие данные для API тестов.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession


@pytest_asyncio.fixture
async def setup_feature_flags(db_session: AsyncSession):
    """Инициализирует feature flags перед каждым тестом."""
    from app.services.feature_flag_manager import FeatureFlagManager

    manager = FeatureFlagManager(db_session)
    await manager.initialize()
    yield
    # Cleanup is handled by test_db fixture from parent conftest


@pytest.fixture(autouse=True)
def auto_initialize_feature_flags(setup_feature_flags):
    """Автоматически инициализирует feature flags для каждого теста."""
    # The async fixture is called automatically
    pass

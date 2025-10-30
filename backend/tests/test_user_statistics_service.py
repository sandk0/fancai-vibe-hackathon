"""
Unit тесты для UserStatisticsService.

Тестирует методы:
- get_weekly_activity
- get_reading_streak
- get_books_count_by_status
- get_favorite_genres
"""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.services.user_statistics_service import UserStatisticsService
from app.models.reading_session import ReadingSession
from app.models.book import Book, ReadingProgress
from app.models.user import User, Subscription


@pytest.mark.asyncio
async def test_weekly_activity_empty(db_session):
    """Тест weekly_activity для пользователя без сессий."""
    user_id = uuid4()

    # Получаем weekly activity
    weekly_activity = await UserStatisticsService.get_weekly_activity(
        db_session, user_id, days=7
    )

    # Должно быть 7 дней с нулями
    assert len(weekly_activity) == 7

    # Все значения должны быть нулевые
    for day_stats in weekly_activity:
        assert day_stats["minutes"] == 0
        assert day_stats["sessions"] == 0
        assert day_stats["progress"] == 0
        assert "date" in day_stats
        assert "day" in day_stats


@pytest.mark.asyncio
async def test_reading_streak_empty(db_session):
    """Тест reading_streak для пользователя без сессий."""
    user_id = uuid4()

    # Получаем streak
    streak = await UserStatisticsService.get_reading_streak(db_session, user_id)

    # Streak должен быть 0
    assert streak == 0


@pytest.mark.asyncio
async def test_books_count_empty(db_session):
    """Тест подсчета книг для нового пользователя."""
    # Создаем пользователя (но без книг)
    user = User(
        email=f"test_{uuid4()}@example.com",
        password_hash="hashed",
        full_name="Test User",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Получаем статистику
    books_stats = await UserStatisticsService.get_books_count_by_status(
        db_session, user.id
    )

    # Все счетчики должны быть 0
    assert books_stats["total"] == 0
    assert books_stats["in_progress"] == 0
    assert books_stats["completed"] == 0


@pytest.mark.asyncio
async def test_favorite_genres_empty(db_session):
    """Тест любимых жанров для пользователя без книг."""
    user_id = uuid4()

    # Получаем любимые жанры
    favorite_genres = await UserStatisticsService.get_favorite_genres(
        db_session, user_id, limit=5
    )

    # Список должен быть пустым
    assert len(favorite_genres) == 0


@pytest.mark.asyncio
async def test_weekday_names():
    """Тест правильности названий дней недели."""
    weekdays = UserStatisticsService.WEEKDAY_NAMES_RU

    # Проверяем все дни недели
    assert weekdays[0] == "Пн"  # Понедельник
    assert weekdays[1] == "Вт"  # Вторник
    assert weekdays[2] == "Ср"  # Среда
    assert weekdays[3] == "Чт"  # Четверг
    assert weekdays[4] == "Пт"  # Пятница
    assert weekdays[5] == "Сб"  # Суббота
    assert weekdays[6] == "Вс"  # Воскресенье


@pytest.mark.asyncio
async def test_total_reading_time_empty(db_session):
    """Тест общего времени чтения для пользователя без сессий."""
    user_id = uuid4()

    # Получаем общее время
    total_time = await UserStatisticsService.get_total_reading_time(db_session, user_id)

    # Должно быть 0
    assert total_time == 0


@pytest.mark.asyncio
async def test_average_reading_speed_empty(db_session):
    """Тест средней скорости чтения для пользователя без данных."""
    user_id = uuid4()

    # Получаем среднюю скорость
    avg_speed = await UserStatisticsService.get_average_reading_speed(
        db_session, user_id
    )

    # Должно быть 0.0
    assert avg_speed == 0.0

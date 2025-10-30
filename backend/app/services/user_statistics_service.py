"""
Сервис для подсчета детальной статистики чтения пользователей.

Содержит методы для расчета:
- Weekly activity (активность по дням недели)
- Reading streak (непрерывная серия дней чтения)
- Общие метрики чтения
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from uuid import UUID
import calendar

from ..models.reading_session import ReadingSession
from ..models.book import Book, ReadingProgress


class UserStatisticsService:
    """Сервис для подсчета детальной статистики чтения пользователей."""

    # Русские названия дней недели (короткие)
    WEEKDAY_NAMES_RU = {
        0: "Пн",  # Monday
        1: "Вт",  # Tuesday
        2: "Ср",  # Wednesday
        3: "Чт",  # Thursday
        4: "Пт",  # Friday
        5: "Сб",  # Saturday
        6: "Вс",  # Sunday
    }

    @staticmethod
    async def get_weekly_activity(
        db: AsyncSession, user_id: UUID, days: int = 7
    ) -> List[Dict]:
        """
        Возвращает активность по дням за последние N дней.

        SQL запрос:
        SELECT
            DATE(started_at) as reading_date,
            SUM(duration_minutes) as total_minutes,
            COUNT(*) as sessions_count,
            SUM(end_position - start_position) as total_progress
        FROM reading_sessions
        WHERE user_id = :user_id
            AND started_at >= NOW() - INTERVAL 'N days'
            AND is_active = false
        GROUP BY DATE(started_at)
        ORDER BY reading_date DESC;

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя
            days: Количество дней для анализа (по умолчанию 7)

        Returns:
            Список с активностью по дням:
            [
                {
                    "date": "2025-10-26",
                    "day": "Вс",
                    "minutes": 45,
                    "sessions": 2,
                    "progress": 12
                },
                ...
            ]

            ВАЖНО: Массив ВСЕГДА содержит ровно `days` элементов.
            Дни без активности заполняются нулями.
        """
        # Расчет временного диапазона
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # SQL запрос для агрегации сессий по дням
        query = (
            select(
                cast(ReadingSession.started_at, Date).label("reading_date"),
                func.sum(ReadingSession.duration_minutes).label("total_minutes"),
                func.count(ReadingSession.id).label("sessions_count"),
                func.sum(
                    ReadingSession.end_position - ReadingSession.start_position
                ).label("total_progress"),
            )
            .where(ReadingSession.user_id == user_id)
            .where(ReadingSession.started_at >= start_date)
            .where(ReadingSession.is_active == False)  # noqa: E712
            .group_by(cast(ReadingSession.started_at, Date))
            .order_by(cast(ReadingSession.started_at, Date).desc())
        )

        result = await db.execute(query)
        rows = result.fetchall()

        # Создаем словарь для быстрого доступа к данным по датам
        activity_by_date = {}
        for row in rows:
            reading_date = row.reading_date
            activity_by_date[reading_date] = {
                "date": reading_date.isoformat(),
                "day": UserStatisticsService.WEEKDAY_NAMES_RU[
                    reading_date.weekday()
                ],
                "minutes": int(row.total_minutes or 0),
                "sessions": int(row.sessions_count or 0),
                "progress": int(row.total_progress or 0),
            }

        # Заполняем массив за последние N дней (включая дни без активности)
        weekly_activity = []
        for i in range(days):
            # Считаем дни в обратном порядке от сегодня
            current_date = (now - timedelta(days=i)).date()

            if current_date in activity_by_date:
                # Есть активность за этот день
                weekly_activity.append(activity_by_date[current_date])
            else:
                # Нет активности - заполняем нулями
                weekly_activity.append(
                    {
                        "date": current_date.isoformat(),
                        "day": UserStatisticsService.WEEKDAY_NAMES_RU[
                            current_date.weekday()
                        ],
                        "minutes": 0,
                        "sessions": 0,
                        "progress": 0,
                    }
                )

        return weekly_activity

    @staticmethod
    async def get_reading_streak(db: AsyncSession, user_id: UUID) -> int:
        """
        Подсчитывает reading streak (сколько дней подряд читал).

        Алгоритм:
        1. Получить все уникальные даты чтения (DATE(started_at))
        2. Отсортировать по убыванию от сегодня
        3. Считать подряд идущие дни начиная с сегодня
        4. Вернуть количество дней

        Пример:
        - Если читал 26, 25, 24 октября → streak = 3
        - Если НЕ читал сегодня, но читал вчера → streak = 0
        - Если читал сегодня, но не читал вчера → streak = 1

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя

        Returns:
            Количество дней подряд чтения (начиная с сегодня)
        """
        # Получаем все уникальные даты чтения пользователя
        query = (
            select(cast(ReadingSession.started_at, Date).label("reading_date"))
            .where(ReadingSession.user_id == user_id)
            .where(ReadingSession.is_active == False)  # noqa: E712
            .distinct()
            .order_by(cast(ReadingSession.started_at, Date).desc())
        )

        result = await db.execute(query)
        reading_dates = [row.reading_date for row in result.fetchall()]

        if not reading_dates:
            # Нет завершенных сессий
            return 0

        # Получаем сегодняшнюю дату (без времени)
        today = datetime.now(timezone.utc).date()

        # Streak считается ТОЛЬКО если читал сегодня
        # Если не читал сегодня - streak = 0
        if reading_dates[0] != today:
            return 0

        # Считаем последовательные дни
        streak = 1  # Сегодня читал
        expected_date = today - timedelta(days=1)

        for reading_date in reading_dates[1:]:
            if reading_date == expected_date:
                # Читал в ожидаемый день
                streak += 1
                expected_date -= timedelta(days=1)
            else:
                # Пропуск - streak прерван
                break

        return streak

    @staticmethod
    async def get_total_reading_time(db: AsyncSession, user_id: UUID) -> int:
        """
        Возвращает общее время чтения в минутах.

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя

        Returns:
            Общее количество минут чтения
        """
        query = select(func.sum(ReadingSession.duration_minutes)).where(
            ReadingSession.user_id == user_id,
            ReadingSession.is_active == False,  # noqa: E712
        )

        result = await db.execute(query)
        total_minutes = result.scalar()

        return int(total_minutes or 0)

    @staticmethod
    async def get_average_reading_speed(db: AsyncSession, user_id: UUID) -> float:
        """
        Вычисляет среднюю скорость чтения в WPM (words per minute).

        Используется reading_speed_wpm из таблицы reading_progress
        и усредняется по всем книгам с данными о скорости.

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя

        Returns:
            Средняя скорость в WPM (слов в минуту)
            0.0 если данных нет
        """
        query = select(func.avg(ReadingProgress.reading_speed_wpm)).where(
            ReadingProgress.user_id == user_id,
            ReadingProgress.reading_speed_wpm > 0,  # Только валидные значения
        )

        result = await db.execute(query)
        avg_speed = result.scalar()

        return round(float(avg_speed or 0.0), 1)

    @staticmethod
    async def get_books_count_by_status(
        db: AsyncSession, user_id: UUID
    ) -> Dict[str, int]:
        """
        Возвращает количество книг по статусам:
        - total: Все книги
        - in_progress: Книги в процессе чтения
        - completed: Прочитанные книги

        Логика:
        - completed: Если reading_progress.current_position >= 95
        - in_progress: Если есть reading_progress и current_position < 95
        - total: Общее количество книг

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя

        Returns:
            Словарь с количествами книг по статусам
        """
        # Общее количество книг
        total_query = select(func.count(Book.id)).where(Book.user_id == user_id)
        total_result = await db.execute(total_query)
        total_books = total_result.scalar() or 0

        # Прочитанные книги (прогресс >= 95%)
        completed_query = (
            select(func.count(ReadingProgress.book_id.distinct()))
            .where(ReadingProgress.user_id == user_id)
            .where(ReadingProgress.current_position >= 95)
        )
        completed_result = await db.execute(completed_query)
        completed_books = completed_result.scalar() or 0

        # Книги в процессе чтения (есть прогресс и < 95%)
        in_progress_query = (
            select(func.count(ReadingProgress.book_id.distinct()))
            .where(ReadingProgress.user_id == user_id)
            .where(ReadingProgress.current_position < 95)
            .where(ReadingProgress.current_position > 0)
        )
        in_progress_result = await db.execute(in_progress_query)
        in_progress_books = in_progress_result.scalar() or 0

        return {
            "total": total_books,
            "in_progress": in_progress_books,
            "completed": completed_books,
        }

    @staticmethod
    async def get_favorite_genres(
        db: AsyncSession, user_id: UUID, limit: int = 5
    ) -> List[Dict]:
        """
        Возвращает любимые жанры пользователя на основе количества книг.

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя
            limit: Максимальное количество жанров (по умолчанию 5)

        Returns:
            Список жанров с количеством:
            [
                {"genre": "fantasy", "count": 6},
                {"genre": "sci-fi", "count": 4},
                ...
            ]
        """
        query = (
            select(Book.genre, func.count(Book.id).label("count"))
            .where(Book.user_id == user_id)
            .group_by(Book.genre)
            .order_by(func.count(Book.id).desc())
            .limit(limit)
        )

        result = await db.execute(query)
        rows = result.fetchall()

        return [{"genre": row.genre, "count": row.count} for row in rows]

    @staticmethod
    async def get_total_pages_read(db: AsyncSession, user_id: UUID) -> int:
        """
        Возвращает общее количество прочитанных страниц.

        Расчет: Сумма (total_pages * progress_percent / 100) для всех книг
        с reading_progress.

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя

        Returns:
            Общее количество прочитанных страниц
        """
        from ..models.book import Book, ReadingProgress

        # JOIN книг с прогрессом и суммируем прочитанные страницы
        query = select(
            func.sum(Book.total_pages * ReadingProgress.current_position / 100.0)
        ).select_from(ReadingProgress).join(Book, ReadingProgress.book_id == Book.id).where(
            ReadingProgress.user_id == user_id
        )

        result = await db.execute(query)
        total_pages = result.scalar()

        return int(total_pages or 0)

    @staticmethod
    async def get_total_chapters_read(db: AsyncSession, user_id: UUID) -> int:
        """
        Возвращает общее количество прочитанных глав.

        Расчет: Сумма current_chapter для всех книг с reading_progress.

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя

        Returns:
            Общее количество прочитанных глав
        """
        query = select(func.sum(ReadingProgress.current_chapter)).where(
            ReadingProgress.user_id == user_id
        )

        result = await db.execute(query)
        total_chapters = result.scalar()

        return int(total_chapters or 0)

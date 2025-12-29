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
from typing import List, Dict
from uuid import UUID

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
                "day": UserStatisticsService.WEEKDAY_NAMES_RU[reading_date.weekday()],
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
        2. Отсортировать по убыванию от последнего дня
        3. Проверить: streak активен (последний день = сегодня ИЛИ вчера)?
        4. Если НЕТ - streak = 0 (прерван)
        5. Если ДА - считать последовательные дни назад от последнего дня

        Примеры:
        - Читал [1,2,3,4,5,6,7], сегодня день 8 (не читал) → streak = 7 дней
        - Читал [1,2,3,5,6,7], сегодня день 8 (не читал) → streak = 3 дня
        - Читал [1,2,3,4,5], сегодня день 8 (не читал 3 дня) → streak = 0
        - Читал сегодня, но не читал вчера → streak = 1
        - Читал вчера, но не сегодня → streak сохраняется

        ИСПРАВЛЕНО P1-4: Streak НЕ сбрасывается в 0, если пользователь не читал
        только сегодня, но читал вчера. Streak сбрасывается только если
        последний день чтения был > 1 дня назад.

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя

        Returns:
            Количество последовательных дней чтения (активный streak)
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

        # Получаем сегодняшнюю дату и вчера (без времени)
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        last_reading_date = reading_dates[0]

        # Streak активен, если последний день чтения = сегодня ИЛИ вчера
        # Если не читал 2+ дней - streak прерван
        if last_reading_date not in [today, yesterday]:
            return 0

        # Считаем последовательные дни от последнего дня чтения
        streak = 1  # Последний день считается
        expected_date = last_reading_date - timedelta(days=1)

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
        - completed: Если Book.get_reading_progress_percent() >= 95 (CFI-aware расчет)
        - in_progress: Если есть reading_progress и прогресс < 95%
        - total: Общее количество книг

        ИСПРАВЛЕНО P0-3: Используется метод Book.get_reading_progress_percent(),
        который правильно обрабатывает CFI (EPUB) и legacy форматы.
        Старая логика `current_position >= 95` некорректна, так как для legacy формата
        current_position - это % в ГЛАВЕ, а не общий прогресс по книге.

        Args:
            db: Асинхронная сессия БД
            user_id: UUID пользователя

        Returns:
            Словарь с количествами книг по статусам
        """
        from sqlalchemy.orm import selectinload

        # Общее количество книг
        total_query = select(func.count(Book.id)).where(Book.user_id == user_id)
        total_result = await db.execute(total_query)
        total_books = total_result.scalar() or 0

        # Получаем все книги с reading_progress и chapters для точного расчета
        # Book.chapters нужен для calculate_progress_percent() в legacy режиме
        books_query = (
            select(Book)
            .options(selectinload(Book.reading_progress))
            .options(selectinload(Book.chapters))
            .join(ReadingProgress, ReadingProgress.book_id == Book.id)
            .where(Book.user_id == user_id)
            .where(ReadingProgress.user_id == user_id)
        )
        books_result = await db.execute(books_query)
        books_with_progress = books_result.scalars().unique().all()

        # Считаем прочитанные и в процессе книги используя CFI-aware метод
        completed_books = 0
        in_progress_books = 0

        for book in books_with_progress:
            # Используем метод Book.get_reading_progress_percent() для точного расчета
            progress_percent = await book.get_reading_progress_percent(db, user_id)

            if progress_percent >= 95.0:
                completed_books += 1
            elif progress_percent > 0.0:
                in_progress_books += 1

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
        query = (
            select(
                func.sum(Book.total_pages * ReadingProgress.current_position / 100.0)
            )
            .select_from(ReadingProgress)
            .join(Book, ReadingProgress.book_id == Book.id)
            .where(ReadingProgress.user_id == user_id)
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

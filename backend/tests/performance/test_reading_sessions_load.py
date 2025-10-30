"""
Performance & Load Tests для Reading Sessions API.

Тесты производительности с использованием Locust для симуляции
100+ concurrent users.

Metrics:
- Throughput (requests/sec)
- Latency (p50, p95, p99)
- Error rate
- Connection pool usage
- Redis cache hit rate

Run:
    locust -f tests/performance/test_reading_sessions_load.py --host=http://localhost:8000
"""

import random
import logging
from uuid import uuid4
from typing import Optional

import pytest

try:
    from locust import HttpUser, task, between, events
    from locust.env import Environment
    LOCUST_AVAILABLE = True
except ImportError:
    LOCUST_AVAILABLE = False
    # Если locust не установлен, пропускаем все тесты в этом модуле
    pytestmark = pytest.mark.skip(reason="Locust не установлен. Установите: pip install locust")

    # Заглушки для классов Locust, чтобы избежать NameError при импорте модуля
    class HttpUser:
        """Заглушка для Locust HttpUser."""
        pass

    def task(weight=1):
        """Заглушка для Locust task decorator."""
        def decorator(func):
            return func
        return decorator

    def between(min_wait, max_wait):
        """Заглушка для Locust between."""
        return None

    class events:
        """Заглушка для Locust events."""
        class test_start:
            @staticmethod
            def add_listener(func):
                pass

        class test_stop:
            @staticmethod
            def add_listener(func):
                pass

    class Environment:
        """Заглушка для Locust Environment."""
        pass

logger = logging.getLogger(__name__)


# ============================================================================
# Test Configuration
# ============================================================================

# Test user credentials (нужно создать в БД заранее)
TEST_USERS = [
    {"email": f"test_user_{i}@example.com", "password": "test_password_123"}
    for i in range(10)
]

# Test books (нужно загрузить заранее)
TEST_BOOK_IDS = []  # Заполняется при setUp


# ============================================================================
# Locust User Classes
# ============================================================================


class ReadingSessionUser(HttpUser):
    """
    Симуляция пользователя, который читает книги.

    Behavior:
    1. Логинится (получает JWT token)
    2. Стартует сессию чтения (30% weight)
    3. Обновляет позицию каждые 5-10 секунд (50% weight)
    4. Завершает сессию (10% weight)
    5. Просматривает историю (10% weight)
    """

    wait_time = between(5, 10)  # Ждет 5-10 секунд между запросами
    weight = 3  # 75% пользователей - читатели

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.token: Optional[str] = None
        self.session_id: Optional[str] = None
        self.current_position: int = 0

    def on_start(self):
        """
        Вызывается при старте user instance.

        Логинит пользователя и получает JWT token.
        """
        # Выбираем случайного пользователя
        user_creds = random.choice(TEST_USERS)

        # Login
        with self.client.post(
            "/api/v1/auth/login",
            json={
                "username": user_creds["email"],
                "password": user_creds["password"],
            },
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                self.token = response.json().get("access_token")
                response.success()
            else:
                response.failure(f"Login failed: {response.text}")

    @property
    def headers(self):
        """Возвращает headers с JWT token."""
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}

    @task(3)
    def start_reading_session(self):
        """
        Стартует новую сессию чтения.

        Weighted: 30% requests
        """
        if not TEST_BOOK_IDS:
            return

        book_id = random.choice(TEST_BOOK_IDS)

        with self.client.post(
            "/api/v1/reading-sessions/start",
            json={
                "book_id": book_id,
                "start_position": 0,
                "device_type": random.choice(["mobile", "tablet", "desktop"]),
            },
            headers=self.headers,
            catch_response=True,
            name="/api/v1/reading-sessions/start",
        ) as response:
            if response.status_code == 201:
                data = response.json()
                self.session_id = data.get("id")
                self.current_position = data.get("start_position", 0)
                response.success()
            else:
                response.failure(f"Start session failed: {response.text}")

    @task(5)
    def update_reading_position(self):
        """
        Обновляет позицию в активной сессии.

        Weighted: 50% requests (most frequent operation)
        """
        if not self.session_id:
            # Сначала нужно стартовать сессию
            self.start_reading_session()
            return

        # Симулируем прогресс чтения (увеличиваем позицию на 1-5%)
        self.current_position = min(100, self.current_position + random.randint(1, 5))

        with self.client.put(
            f"/api/v1/reading-sessions/{self.session_id}/update",
            json={"current_position": self.current_position},
            headers=self.headers,
            catch_response=True,
            name="/api/v1/reading-sessions/{id}/update",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Update position failed: {response.text}")

    @task(1)
    def end_reading_session(self):
        """
        Завершает активную сессию чтения.

        Weighted: 10% requests
        """
        if not self.session_id:
            return

        with self.client.put(
            f"/api/v1/reading-sessions/{self.session_id}/end",
            json={"end_position": self.current_position},
            headers=self.headers,
            catch_response=True,
            name="/api/v1/reading-sessions/{id}/end",
        ) as response:
            if response.status_code == 200:
                # Сбрасываем session_id
                self.session_id = None
                self.current_position = 0
                response.success()
            else:
                response.failure(f"End session failed: {response.text}")

    @task(1)
    def get_reading_history(self):
        """
        Получает историю сессий чтения.

        Weighted: 10% requests
        """
        with self.client.get(
            "/api/v1/reading-sessions/history",
            params={"limit": 20},  # Cursor-based pagination
            headers=self.headers,
            catch_response=True,
            name="/api/v1/reading-sessions/history",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Get history failed: {response.text}")


class BurstUser(HttpUser):
    """
    Симуляция burst traffic - пользователь делает много запросов быстро.

    Используется для тестирования rate limiting и connection pool.
    """

    wait_time = between(1, 2)  # Очень короткие интервалы
    weight = 1  # 25% пользователей - burst users

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.token: Optional[str] = None

    def on_start(self):
        """Login и получение token."""
        user_creds = random.choice(TEST_USERS)

        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "username": user_creds["email"],
                "password": user_creds["password"],
            },
        )

        if response.status_code == 200:
            self.token = response.json().get("access_token")

    @property
    def headers(self):
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}

    @task
    def rapid_fire_requests(self):
        """
        Делает быстрые последовательные запросы для тестирования rate limiting.
        """
        # Проверяем активную сессию 5 раз подряд
        for _ in range(5):
            self.client.get(
                "/api/v1/reading-sessions/active",
                headers=self.headers,
                name="/api/v1/reading-sessions/active (burst)",
            )


# ============================================================================
# Event Listeners для метрик
# ============================================================================


@events.test_start.add_listener
def on_test_start(environment: Environment, **kwargs):
    """
    Вызывается при старте load test.

    Выводит конфигурацию теста.
    """
    print("\n" + "=" * 80)
    print("🚀 READING SESSIONS LOAD TEST STARTED")
    print("=" * 80)
    print(f"Target: {environment.host}")
    print(f"Users: {environment.runner.user_count if hasattr(environment.runner, 'user_count') else 'N/A'}")
    print("=" * 80 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment: Environment, **kwargs):
    """
    Вызывается при остановке load test.

    Выводит финальную статистику.
    """
    print("\n" + "=" * 80)
    print("🏁 READING SESSIONS LOAD TEST COMPLETED")
    print("=" * 80)

    # Получаем статистику из Locust stats
    stats = environment.stats

    print(f"\nTotal Requests: {stats.total.num_requests}")
    print(f"Total Failures: {stats.total.num_failures}")
    print(f"Failure Rate: {stats.total.fail_ratio * 100:.2f}%")
    print(f"\nAverage Response Time: {stats.total.avg_response_time:.2f}ms")
    print(f"Median Response Time (p50): {stats.total.get_response_time_percentile(0.5):.2f}ms")
    print(f"95th Percentile (p95): {stats.total.get_response_time_percentile(0.95):.2f}ms")
    print(f"99th Percentile (p99): {stats.total.get_response_time_percentile(0.99):.2f}ms")
    print(f"\nRequests/sec: {stats.total.total_rps:.2f}")

    print("=" * 80 + "\n")

    # Success criteria (можно использовать для CI/CD)
    success_criteria = [
        ("Error Rate < 1%", stats.total.fail_ratio < 0.01),
        ("p95 Latency < 100ms", stats.total.get_response_time_percentile(0.95) < 100),
        ("p99 Latency < 200ms", stats.total.get_response_time_percentile(0.99) < 200),
        ("RPS > 50", stats.total.total_rps > 50),
    ]

    print("📊 SUCCESS CRITERIA:")
    all_passed = True
    for criteria, passed in success_criteria:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {criteria}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n🎉 All performance criteria met!")
    else:
        print("\n⚠️  Some performance criteria not met. Review optimization.")

    print("=" * 80 + "\n")


# ============================================================================
# CLI Instructions
# ============================================================================

if __name__ == "__main__":
    print("""
    ╔═══════════════════════════════════════════════════════════════════════════╗
    ║                   Reading Sessions Performance Tests                      ║
    ╚═══════════════════════════════════════════════════════════════════════════╝

    Для запуска load tests:

    1. Убедитесь что backend запущен:
       docker-compose up backend redis postgres

    2. Создайте test users и test books:
       python scripts/setup_load_test_data.py

    3. Запустите Locust:
       locust -f tests/performance/test_reading_sessions_load.py --host=http://localhost:8000

    4. Откройте Locust web UI:
       http://localhost:8089

    5. Настройте параметры:
       - Number of users: 100 (concurrent users)
       - Spawn rate: 10 (users/sec)
       - Host: http://localhost:8000

    6. Запустите тест и наблюдайте метрики в real-time

    ═══════════════════════════════════════════════════════════════════════════

    Альтернативно - headless режим (CI/CD):

    locust -f tests/performance/test_reading_sessions_load.py \\
           --host=http://localhost:8000 \\
           --users 100 \\
           --spawn-rate 10 \\
           --run-time 5m \\
           --headless

    ═══════════════════════════════════════════════════════════════════════════
    """)

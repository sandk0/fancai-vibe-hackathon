# 🔧 Integration Guide: Monitoring для Reading Sessions

Пошаговое руководство по интеграции системы мониторинга в существующий BookReader AI backend.

---

## Шаг 1: Установка зависимостей

```bash
cd backend
pip install -r requirements.txt

# Проверить установку
python -c "import prometheus_client; print('OK')"
```

---

## Шаг 2: Интеграция в main.py

### Добавить Health Router

```python
# backend/main.py

from fastapi import FastAPI
from app.routers import health  # NEW

app = FastAPI(
    title="BookReader AI",
    version="2.0.0"
)

# Добавить health router (ВАЖНО: до других роутеров)
app.include_router(
    health.router,
    prefix="/api/v1",
    tags=["health", "monitoring"]
)

# Остальные роутеры
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(books.router, prefix="/api/v1", tags=["books"])
app.include_router(reading_sessions.router, prefix="/api/v1", tags=["reading-sessions"])
```

### Добавить Middleware (опционально, для автоматического сбора метрик)

```python
# backend/main.py

from app.monitoring.middleware import ReadingSessionsMetricsMiddleware

# После создания app
app = FastAPI(...)

# Добавить middleware
app.add_middleware(ReadingSessionsMetricsMiddleware)
```

### Добавить Background Task для Gauges

```python
# backend/main.py

import asyncio
from app.monitoring.middleware import update_gauges_periodically
from app.core.database import get_database_session

@app.on_event("startup")
async def startup_event():
    """Startup event для запуска background tasks."""

    # Запустить периодическое обновление Prometheus gauges
    asyncio.create_task(
        update_gauges_periodically(
            get_database_session,
            interval_seconds=30  # Обновлять каждые 30 секунд
        )
    )

    print("✅ Monitoring background tasks started")
```

---

## Шаг 3: Интеграция метрик в Reading Sessions endpoints

### В файле `app/routers/reading_sessions.py`

```python
# Добавить импорты
from app.monitoring import (
    MetricsCollector,
    record_session_started,
    record_session_ended,
    record_session_updated,
    record_session_error,
)

# В endpoint start_reading_session()
@router.post("/reading-sessions/start", ...)
async def start_reading_session(
    request: StartSessionRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> ReadingSessionResponse:
    """Начинает новую сессию чтения."""

    # Обернуть в MetricsCollector для измерения latency
    with MetricsCollector.measure_duration("start_session", "POST") as collector:
        try:
            # ... существующая логика ...
            book_uuid = UUID(request.book_id)
            book = await db.execute(select(Book).where(...))

            if not book:
                record_session_error("start", "not_found")
                collector.set_status(404)
                raise BookNotFoundException(book_uuid)

            # Создаём новую сессию
            new_session = ReadingSession(...)
            db.add(new_session)
            await db.commit()
            await db.refresh(new_session)

            # Записываем метрику старта
            record_session_started(
                device_type=request.device_type,
                book_genre=book.genre if hasattr(book, 'genre') else None
            )

            collector.set_status(201)
            return session_to_response(new_session)

        except ValueError as e:
            record_session_error("start", "validation")
            collector.set_status(400)
            raise HTTPException(status_code=400, detail=str(e))

        except Exception as e:
            record_session_error("start", "unknown")
            collector.set_status(500)
            await db.rollback()
            raise


# В endpoint end_reading_session()
@router.put("/reading-sessions/{session_id}/end", ...)
async def end_reading_session(
    session_id: UUID,
    request: EndSessionRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> ReadingSessionResponse:
    """Завершает активную сессию чтения."""

    with MetricsCollector.measure_duration("end_session", "PUT") as collector:
        try:
            # ... существующая логика ...
            session = await db.execute(select(ReadingSession).where(...))

            if not session:
                record_session_error("end", "not_found")
                collector.set_status(404)
                raise HTTPException(status_code=404, detail="Session not found")

            if not session.is_active:
                record_session_error("end", "already_ended")
                collector.set_status(400)
                raise HTTPException(status_code=400, detail="Session already ended")

            # Завершаем сессию
            session.end_session(
                end_position=request.end_position,
                ended_at=datetime.now(timezone.utc)
            )
            await db.commit()
            await db.refresh(session)

            # Записываем метрики завершения
            record_session_ended(
                duration_seconds=session.duration_minutes * 60,
                pages_read=session.pages_read,
                progress_delta=session.get_progress_delta(),
                device_type=session.device_type,
                completion_status="completed"  # или "abandoned" для Celery task
            )

            collector.set_status(200)
            return session_to_response(session)

        except HTTPException:
            raise
        except Exception as e:
            record_session_error("end", "unknown")
            collector.set_status(500)
            await db.rollback()
            raise


# В endpoint update_reading_session()
@router.put("/reading-sessions/{session_id}/update", ...)
async def update_reading_session(
    session_id: UUID,
    request: UpdateSessionRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_active_user),
) -> ReadingSessionResponse:
    """Обновляет позицию в активной сессии чтения."""

    with MetricsCollector.measure_duration("update_session", "PUT") as collector:
        try:
            # ... существующая логика ...
            session = await db.execute(select(ReadingSession).where(...))

            if not session:
                record_session_error("update", "not_found")
                collector.set_status(404)
                raise HTTPException(status_code=404, detail="Session not found")

            # Обновляем позицию
            session.end_position = request.current_position
            await db.commit()
            await db.refresh(session)

            # Записываем метрику обновления
            record_session_updated(device_type=session.device_type)

            collector.set_status(200)
            return session_to_response(session)

        except HTTPException:
            raise
        except Exception as e:
            record_session_error("update", "unknown")
            collector.set_status(500)
            await db.rollback()
            raise
```

---

## Шаг 4: Интеграция в Celery Tasks

### В файле `app/tasks/reading_sessions_tasks.py`

```python
from app.monitoring import record_session_ended

@celery_app.task(name="close_abandoned_sessions")
def close_abandoned_sessions():
    """Периодически закрывает заброшенные сессии (>24 часа)."""

    db = SessionLocal()
    try:
        threshold = datetime.now(timezone.utc) - timedelta(hours=24)

        # Находим заброшенные сессии
        abandoned_sessions = db.query(ReadingSession).filter(
            ReadingSession.is_active == True,
            ReadingSession.started_at < threshold
        ).all()

        closed_count = 0
        for session in abandoned_sessions:
            # Закрываем сессию
            session.end_session(
                end_position=session.end_position,  # Текущая позиция
                ended_at=datetime.now(timezone.utc)
            )

            # Записываем метрику с completion_status="auto_closed"
            record_session_ended(
                duration_seconds=session.duration_minutes * 60,
                pages_read=session.pages_read,
                progress_delta=session.get_progress_delta(),
                device_type=session.device_type,
                completion_status="auto_closed"  # Автоматически закрыта
            )

            closed_count += 1

        db.commit()
        print(f"✅ Closed {closed_count} abandoned sessions")

    except Exception as e:
        db.rollback()
        print(f"❌ Error closing abandoned sessions: {str(e)}")
        raise
    finally:
        db.close()
```

---

## Шаг 5: Запуск мониторинга

### Запустить мониторинг stack

```bash
# Из корня проекта
docker-compose -f docker-compose.monitoring.yml up -d

# Проверить статус
docker-compose -f docker-compose.monitoring.yml ps

# Проверить логи
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
docker-compose -f docker-compose.monitoring.yml logs -f grafana
```

### Проверить health endpoints

```bash
# Basic health check
curl http://localhost:8000/api/v1/health

# Reading sessions health check
curl http://localhost:8000/api/v1/health/reading-sessions | jq

# Prometheus metrics
curl http://localhost:8000/api/v1/metrics | grep reading_sessions
```

---

## Шаг 6: Настройка Grafana

### Автоматический импорт (рекомендуется)

Dashboard автоматически импортируется при старте Grafana через provisioning.

1. Открыть http://localhost:3000
2. Login: `admin` / Password: `admin` (или из .env)
3. Перейти в **Dashboards** → найти **"BookReader AI - Reading Sessions Monitoring"**

### Ручной импорт (если нужно)

1. Открыть Grafana → **Dashboards** → **Import**
2. Загрузить файл `monitoring/grafana/dashboards/reading-sessions.json`
3. Выбрать datasource: **Prometheus**
4. Нажать **Import**

---

## Шаг 7: Проверка работы системы

### 1. Создать тестовую сессию

```bash
# Получить JWT token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}' | jq -r '.access_token')

# Стартовать сессию
curl -X POST http://localhost:8000/api/v1/reading-sessions/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "book_id": "123e4567-e89b-12d3-a456-426614174000",
    "start_position": 0,
    "device_type": "mobile"
  }'
```

### 2. Проверить метрики в Prometheus

```bash
# Открыть Prometheus UI
open http://localhost:9090

# Выполнить query:
reading_sessions_started_total
```

Должно появиться:
```
reading_sessions_started_total{device_type="mobile", book_genre="unknown"} 1
```

### 3. Проверить Grafana Dashboard

```bash
# Открыть Grafana
open http://localhost:3000

# Перейти в Dashboard → BookReader AI - Reading Sessions Monitoring
# Должны появиться данные на панелях
```

### 4. Проверить Health Check

```bash
curl http://localhost:8000/api/v1/health/reading-sessions | jq

# Должно вернуть:
{
  "status": "healthy",
  "checks": {
    "database": {"status": "ok", "latency_ms": 15.2},
    ...
  },
  "metrics": {
    "active_sessions_total": 1,  # Наша тестовая сессия
    ...
  }
}
```

---

## Шаг 8: Troubleshooting

### Метрики не появляются

**Проблема:** Prometheus не scraping backend

```bash
# Проверить Prometheus targets
open http://localhost:9090/targets

# Должно быть:
# Job: bookreader-backend
# State: UP
# Endpoint: http://backend:8000/api/v1/metrics
```

**Решение:**
```bash
# Проверить, что backend экспортирует метрики
curl http://localhost:8000/api/v1/metrics

# Если 404, значит health router не добавлен в main.py
# Проверить, что в main.py есть:
app.include_router(health.router, prefix="/api/v1", tags=["health"])
```

### Dashboard пустой

**Проблема:** Grafana не подключена к Prometheus

```bash
# Проверить datasource в Grafana
# Configuration → Data Sources → Prometheus → Test

# Если ошибка "Connection refused", проверить Docker network
docker network inspect bookreader_network

# Backend и Prometheus должны быть в одной сети
```

**Решение:**
```bash
# Убедиться, что Prometheus доступен из Grafana
docker exec -it bookreader_grafana ping prometheus

# Если не доступен, пересоздать network:
docker network create bookreader_network
docker-compose -f docker-compose.monitoring.yml up -d
```

### Alerts не срабатывают

**Проблема:** Alert rules не загружены

```bash
# Проверить alerts в Prometheus
open http://localhost:9090/alerts

# Если пусто, проверить:
docker logs bookreader_prometheus | grep -i alert
```

**Решение:**
```bash
# Проверить синтаксис alert rules
promtool check rules monitoring/prometheus/alerts/reading-sessions.yml

# Если есть ошибки, исправить и перезагрузить Prometheus
curl -X POST http://localhost:9090/-/reload
```

---

## Полный пример integration в main.py

```python
# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from app.core.config import settings
from app.core.database import get_database_session
from app.routers import users, books, reading_sessions, health
from app.monitoring.middleware import (
    ReadingSessionsMetricsMiddleware,
    update_gauges_periodically
)

# Создание приложения
app = FastAPI(
    title="BookReader AI",
    version="2.0.0",
    description="AI-powered book reading platform with automatic image generation"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Metrics Middleware (NEW)
app.add_middleware(ReadingSessionsMetricsMiddleware)

# Routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])  # NEW
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(books.router, prefix="/api/v1", tags=["books"])
app.include_router(reading_sessions.router, prefix="/api/v1", tags=["reading-sessions"])

# Startup Event
@app.on_event("startup")
async def startup_event():
    """Startup tasks."""
    print("🚀 Starting BookReader AI...")

    # Запустить background task для обновления Prometheus gauges (NEW)
    asyncio.create_task(
        update_gauges_periodically(
            get_database_session,
            interval_seconds=30
        )
    )

    print("✅ Monitoring background tasks started")
    print("✅ BookReader AI is ready!")

# Shutdown Event
@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown tasks."""
    print("👋 Shutting down BookReader AI...")

# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "message": "BookReader AI - Reading Sessions API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
        "metrics": "/api/v1/metrics"
    }
```

---

## ✅ Checklist интеграции

- [ ] Установлены зависимости (`pip install -r requirements.txt`)
- [ ] Добавлен `health.router` в `main.py`
- [ ] Добавлен `ReadingSessionsMetricsMiddleware` в `main.py`
- [ ] Добавлен `startup_event` с `update_gauges_periodically()` в `main.py`
- [ ] Интегрированы метрики в `reading_sessions.py` endpoints
- [ ] Интегрированы метрики в Celery tasks
- [ ] Запущен мониторинг stack (`docker-compose.monitoring.yml up -d`)
- [ ] Проверен Prometheus scraping (`http://localhost:9090/targets`)
- [ ] Проверен Grafana dashboard (`http://localhost:3000`)
- [ ] Проверен health endpoint (`curl /api/v1/health`)
- [ ] Создана тестовая сессия для проверки метрик

---

**Интеграция завершена! 🎉**

Теперь система мониторинга полностью работает и собирает метрики reading sessions.

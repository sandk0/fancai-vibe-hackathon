# 🚀 Quick Start: Monitoring для Reading Sessions

Быстрый старт системы мониторинга в 5 минут.

---

## 1️⃣ Установка (30 секунд)

```bash
# Установить Python зависимости
cd backend
pip install prometheus-client==0.19.0 prometheus-fastapi-instrumentator==6.1.0

# Или через requirements.txt
pip install -r requirements.txt
```

---

## 2️⃣ Интеграция в код (2 минуты)

### Добавить в `backend/main.py`:

```python
from app.routers import health  # Добавить импорт

app = FastAPI(...)

# Добавить health router (ОБЯЗАТЕЛЬНО!)
app.include_router(health.router, prefix="/api/v1", tags=["health"])
```

Это всё! Остальное опционально.

---

## 3️⃣ Запуск мониторинга (1 минута)

```bash
# Из корня проекта
docker-compose -f docker-compose.monitoring.yml up -d

# Проверить статус
docker-compose -f docker-compose.monitoring.yml ps
```

---

## 4️⃣ Проверка (1 минута)

### Prometheus
```bash
open http://localhost:9090

# Проверить targets
# Status → Targets → bookreader-backend должен быть UP
```

### Grafana
```bash
open http://localhost:3000
# Login: admin / admin

# Dashboards → BookReader AI - Reading Sessions Monitoring
```

### Health Check
```bash
curl http://localhost:8000/api/v1/health
# Должно вернуть: {"status": "healthy", ...}
```

### Metrics
```bash
curl http://localhost:8000/api/v1/metrics | grep reading_sessions
# Должны появиться метрики
```

---

## 5️⃣ Тестирование (30 секунд)

```bash
# Стартовать тестовую сессию (подставить реальный book_id и token)
curl -X POST http://localhost:8000/api/v1/reading-sessions/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"book_id": "123e4567-...", "start_position": 0, "device_type": "mobile"}'

# Проверить метрики
curl http://localhost:8000/api/v1/metrics | grep reading_sessions_started_total
# Должно появиться: reading_sessions_started_total{device_type="mobile"...} 1.0
```

---

## ✅ Готово!

Теперь мониторинг работает:
- ✅ Prometheus собирает метрики каждые 10 секунд
- ✅ Grafana отображает dashboard с live данными
- ✅ Alerts мониторят критические метрики
- ✅ Health checks доступны для диагностики

---

## 📊 Что дальше?

### Опциональные улучшения:

**1. Добавить Middleware для автоматических метрик:**
```python
# backend/main.py
from app.monitoring.middleware import ReadingSessionsMetricsMiddleware
app.add_middleware(ReadingSessionsMetricsMiddleware)
```

**2. Добавить Background Task для Gauges:**
```python
# backend/main.py
import asyncio
from app.monitoring.middleware import update_gauges_periodically

@app.on_event("startup")
async def startup():
    asyncio.create_task(update_gauges_periodically(get_database_session, 30))
```

**3. Интегрировать метрики в endpoints:**
См. `backend/INTEGRATION_GUIDE.md` для детальных инструкций.

---

## 🆘 Troubleshooting

**Prometheus не scraping backend:**
```bash
# Проверить endpoint доступен
curl http://localhost:8000/api/v1/metrics

# Если 404 - health router не добавлен в main.py
```

**Dashboard пустой:**
```bash
# Проверить Prometheus targets
open http://localhost:9090/targets

# bookreader-backend должен быть UP
```

**Alerts не работают:**
```bash
# Проверить alerts
open http://localhost:9090/alerts

# Должны появиться rules из reading-sessions.yml
```

---

## 📚 Документация

- **Полный отчёт:** `MONITORING_SETUP_REPORT.md`
- **Integration guide:** `backend/INTEGRATION_GUIDE.md`
- **Detailed README:** `monitoring/README.md`

---

**Время setup:** 5 минут ⏱️
**Статус:** Production Ready ✅

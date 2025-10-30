# BookReader AI - Мониторинг Reading Sessions

Полноценная система мониторинга и метрик для Reading Sessions в BookReader AI с использованием Prometheus и Grafana.

## 📊 Компоненты

### Backend Metrics (`backend/app/monitoring/`)

- **`metrics.py`** - Определения метрик Prometheus
  - Counters: sessions_started, sessions_ended, errors
  - Histograms: duration, pages_read, API latency
  - Gauges: active_sessions, abandoned_sessions, concurrent_users

- **`/api/v1/metrics`** - Endpoint для экспорта метрик в Prometheus

### Prometheus Configuration (`monitoring/prometheus/`)

- **`prometheus.yml`** - Конфигурация Prometheus
  - Scrape interval: 15 секунд
  - Retention: 200 часов
  - Targets: backend, node-exporter, cAdvisor

- **`alerts/reading-sessions.yml`** - Alert rules
  - Critical: TooManyActiveSessions, HighErrorRate
  - Warning: AbandonedSessions, HighLatency
  - Info: SessionDurationAnomaly

### Grafana Dashboard (`monitoring/grafana/`)

- **`dashboards/reading-sessions.json`** - Reading Sessions dashboard
  - 13 панелей с метриками
  - Device breakdown
  - Error tracking
  - Performance metrics

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd backend
pip install -r requirements.txt
```

Зависимости для мониторинга:
- `prometheus-client==0.19.0` - Prometheus метрики
- `prometheus-fastapi-instrumentator==6.1.0` - Автоматическая инструментация FastAPI

### 2. Запуск мониторинга

```bash
# Из корня проекта
docker-compose -f docker-compose.monitoring.yml up -d
```

Это запустит:
- **Prometheus** на `http://localhost:9090`
- **Grafana** на `http://localhost:3000`
- **Node Exporter** на `http://localhost:9100`
- **cAdvisor** на `http://localhost:8080`

### 3. Доступ к Grafana

```bash
# URL: http://localhost:3000
# Login: admin (настраивается через GRAFANA_USER)
# Password: admin (настраивается через GRAFANA_PASSWORD)
```

**Dashboard автоматически импортируется** через provisioning:
- Перейти в Dashboards → BookReader AI - Reading Sessions Monitoring

### 4. Настройка Backend для экспорта метрик

В `backend/main.py` добавить health router:

```python
from app.routers import health

app.include_router(health.router, prefix="/api/v1", tags=["health"])
```

Проверить метрики:
```bash
curl http://localhost:8000/api/v1/metrics
```

## 📈 Метрики

### Counters (монотонно растущие)

```promql
# Сессий стартовано (всего)
reading_sessions_started_total{device_type="mobile", book_genre="fiction"}

# Сессий завершено (всего)
reading_sessions_ended_total{completion_status="completed", device_type="desktop"}

# Обновлений позиции (всего)
reading_sessions_updated_total{device_type="tablet"}

# Ошибок (всего)
reading_sessions_errors_total{operation="start", error_type="validation"}
```

### Histograms (распределения)

```promql
# Длительность сессий (секунды)
reading_session_duration_seconds_bucket{device_type="mobile", le="3600"}

# Прочитано страниц
reading_session_pages_read_bucket{device_type="desktop", le="100"}

# Прогресс за сессию (%)
reading_session_progress_delta_percent_bucket{device_type="tablet", le="20"}

# Latency API (секунды)
reading_session_api_latency_seconds_bucket{endpoint="start", status_code="201", le="0.5"}
```

### Gauges (текущие значения)

```promql
# Активные сессии (текущее количество)
reading_sessions_active_count{device_type="mobile"}

# Заброшенные сессии (активные > 24 часа)
reading_sessions_abandoned_count

# Одновременные пользователи
reading_sessions_concurrent_users
```

## 📊 Примеры запросов Prometheus

### 1. Rate of sessions started per minute

```promql
rate(reading_sessions_started_total[5m]) * 60
```

### 2. Average session duration (last hour)

```promql
rate(reading_session_duration_seconds_sum[1h]) /
rate(reading_session_duration_seconds_count[1h])
```

### 3. P95 latency по endpoints

```promql
histogram_quantile(0.95,
  rate(reading_session_api_latency_seconds_bucket[5m])
)
```

### 4. Error rate (percentage)

```promql
(
  rate(reading_sessions_errors_total[5m]) /
  rate(reading_sessions_started_total[5m])
) * 100
```

### 5. Top device types by sessions

```promql
topk(3,
  sum by(device_type) (reading_sessions_started_total)
)
```

## 🚨 Alert Rules

### Critical Alerts (требуют немедленного реагирования)

**TooManyActiveSessions**
```yaml
expr: reading_sessions_active_count > 1000
for: 5m
```
→ Слишком много активных сессий, возможна проблема с capacity

**HighReadingSessionErrorRate**
```yaml
expr: rate(reading_sessions_errors_total[5m]) > 0.05
for: 2m
```
→ Высокий процент ошибок в API

### Warning Alerts (требуют внимания)

**TooManyAbandonedSessions**
```yaml
expr: reading_sessions_abandoned_count > 100
for: 10m
```
→ Много заброшенных сессий, возможно Celery task не работает

**HighReadingSessionAPILatency**
```yaml
expr: histogram_quantile(0.95, rate(reading_session_api_latency_seconds_bucket[5m])) > 1.0
for: 5m
```
→ Высокая латентность API (p95 > 1 секунда)

## 🔧 Интеграция в код

### В endpoints (reading_sessions.py)

```python
from app.monitoring import (
    MetricsCollector,
    record_session_started,
    record_session_ended,
    record_session_error
)

@router.post("/reading-sessions/start")
async def start_reading_session(...):
    with MetricsCollector.measure_duration("start_session", "POST") as collector:
        try:
            # ... бизнес-логика ...

            # Записываем метрику старта
            record_session_started(
                device_type=request.device_type,
                book_genre=book.genre
            )

            collector.set_status(201)
            return session_to_response(new_session)

        except ValidationError as e:
            record_session_error("start", "validation")
            collector.set_status(400)
            raise
```

### В Celery tasks

```python
from app.monitoring import record_session_ended

@celery_app.task
def close_abandoned_sessions():
    for session in abandoned_sessions:
        # Закрываем сессию
        session.end_session(...)

        # Записываем метрику
        record_session_ended(
            duration_seconds=session.duration_minutes * 60,
            pages_read=session.pages_read,
            progress_delta=session.get_progress_delta(),
            device_type=session.device_type,
            completion_status="auto_closed"
        )
```

## 📱 Grafana Dashboard

### Панели dashboard

1. **Active Sessions** (Stat) - текущее количество активных сессий
2. **Concurrent Users** (Stat) - одновременные пользователи
3. **Abandoned Sessions** (Stat) - заброшенные сессии
4. **Error Rate** (Stat) - процент ошибок за 5 минут
5. **Sessions Started vs Ended** (Graph) - динамика старта/завершения
6. **Active Sessions Over Time** (Graph) - активные сессии по времени
7. **Session Duration** (Graph) - p50, p95, p99 длительности
8. **Average Pages Read** (Graph) - среднее количество страниц
9. **Device Type Distribution** (Pie Chart) - распределение по устройствам
10. **Session Completion Status** (Donut Chart) - статусы завершения
11. **API Latency p95** (Stat) - латентность API
12. **Error Breakdown** (Table) - детализация ошибок
13. **Session Updates** (Graph) - частота обновлений позиции

### Импорт dashboard вручную

1. Открыть Grafana → Dashboards → Import
2. Загрузить файл `monitoring/grafana/dashboards/reading-sessions.json`
3. Выбрать Prometheus datasource
4. Нажать Import

## 🔍 Health Checks

### Basic Health Check

```bash
curl http://localhost:8000/api/v1/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-10-28T10:30:00Z",
  "version": "2.0.0",
  "uptime_seconds": 3600.5
}
```

### Reading Sessions Health Check

```bash
curl http://localhost:8000/api/v1/health/reading-sessions

# Response:
{
  "status": "healthy",
  "timestamp": "2025-10-28T10:30:00Z",
  "checks": {
    "database": {"status": "ok", "latency_ms": 15.2},
    "redis": {"status": "ok", "latency_ms": 5.1},
    "celery": {"status": "ok", "details": {"active_workers": 2}}
  },
  "metrics": {
    "active_sessions_total": 45,
    "concurrent_users": 38,
    "abandoned_sessions": 3
  }
}
```

### Deep Health Check

```bash
curl http://localhost:8000/api/v1/health/deep
```

## 🛠️ Troubleshooting

### Метрики не отображаются в Grafana

1. Проверить, что Prometheus scraping работает:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. Проверить, что backend экспортирует метрики:
   ```bash
   curl http://localhost:8000/api/v1/metrics | grep reading_sessions
   ```

3. Проверить логи Prometheus:
   ```bash
   docker logs bookreader_prometheus
   ```

### Alerts не срабатывают

1. Проверить правила в Prometheus UI:
   ```
   http://localhost:9090/alerts
   ```

2. Проверить синтаксис alert rules:
   ```bash
   promtool check rules monitoring/prometheus/alerts/reading-sessions.yml
   ```

### Grafana не подключается к Prometheus

1. Проверить datasource в Grafana:
   ```
   Configuration → Data Sources → Prometheus
   ```

2. Проверить, что Prometheus доступен из Grafana container:
   ```bash
   docker exec -it bookreader_grafana ping prometheus
   ```

## 📚 Дополнительные ресурсы

- [Prometheus Query Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Alert Rule Best Practices](https://prometheus.io/docs/practices/alerting/)

## 📝 Changelog

### v1.0.0 (2025-10-28)

- ✅ Создан модуль `backend/app/monitoring/metrics.py` с метриками
- ✅ Добавлен `/api/v1/metrics` endpoint для Prometheus
- ✅ Настроен Prometheus configuration с alert rules
- ✅ Создан Grafana dashboard с 13 панелями
- ✅ Добавлены health check endpoints
- ✅ Документация по использованию

---

**Автор:** DevOps Engineer Agent
**Дата:** 2025-10-28
**Версия:** 1.0.0

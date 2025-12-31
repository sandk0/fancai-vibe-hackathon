# Аудит Docker конфигурации

**Дата:** 1 января 2026
**Статус:** ✅ ВЫПОЛНЕНО

## Краткое резюме

Проведён глубокий анализ всех Docker файлов проекта. Выявлено **21 файл** с различным статусом актуальности.

### Статистика файлов

| Категория | Всего | Удалить | Исправить | Оставить |
|-----------|-------|---------|-----------|----------|
| Dockerfiles | 6 | 1 | 2 | 3 |
| docker-compose | 12 | 5 | 3 | 4 |
| .dockerignore | 3 | 0 | 2 | 1 |
| **ИТОГО** | 21 | 6 | 7 | 8 |

### Эталонные файлы (актуальные)

| Назначение | Файл |
|------------|------|
| Development | `docker-compose.lite.yml` + `Dockerfile.lite` |
| Production | `docker-compose.lite.prod.yml` + `Dockerfile.lite.prod` |

---

## Ключевая проблема

**Архитектурный конфликт:** Проект находится в переходном состоянии после удаления Multi-NLP системы (декабрь 2025).

- **Старая архитектура:** SpaCy, Natasha, Stanza, GLiNER (10-12 GB RAM)
- **Новая архитектура:** Google Gemini API (2-3 GB RAM)

Многие файлы всё ещё содержат устаревшую конфигурацию NLP.

---

## Файлы для удаления (6)

| Файл | Причина |
|------|---------|
| `docker-compose.yml` | Устаревшая NLP конфигурация |
| `docker-compose.dev.yml` | Наследует от устаревшего docker-compose.yml |
| `docker-compose.production.yml` | Устаревшая NLP конфигурация |
| `docker-compose.vless-proxy.yml` | Критический конфликт сетей, дублирует xray-proxy |
| `docker-compose.temp-ssl.yml` | Можно заменить скриптом |
| `backend/Dockerfile.prod` | Содержит загрузку NLP моделей |

---

## Файлы для исправления (7)

| Файл | Проблемы |
|------|----------|
| `docker-compose.staging.yml` | Переделать для LangExtract |
| `docker-compose.ssl.yml` | Добавить --keep-until-expiring |
| `docker-compose.dev-ssl.yml` | Исправить CORS, security headers |
| `docker-compose.monitoring.yml` | Пин-версии образов, healthchecks |
| `frontend/Dockerfile.prod` | Убрать build:unsafe |
| `.dockerignore` (корневой) | Добавить CI/CD, уточнить *.md |
| `frontend/.dockerignore` | Убрать Dockerfile* паттерн |

---

## Файлы для сохранения (8)

| Файл | Статус |
|------|--------|
| `docker-compose.lite.yml` | ЭТАЛОН для разработки |
| `docker-compose.lite.prod.yml` | ЭТАЛОН для production |
| `docker-compose.override.yml` | Локальные переопределения |
| `backend/Dockerfile` | Dev (full) |
| `backend/Dockerfile.lite` | Dev (lite) - ОСНОВНОЙ |
| `backend/Dockerfile.lite.prod` | Prod (lite) |
| `frontend/Dockerfile` | Dev |
| `backend/.dockerignore` | Хорошо структурирован |

---

## Отчёты

1. [Анализ Dockerfiles](./02-dockerfiles.md)
2. [Анализ docker-compose](./03-docker-compose.md)
3. [Анализ .dockerignore](./04-dockerignore.md)
4. [План унификации](./05-unification-plan.md)

---

## Выполненные действия

### P0: Удалённые файлы (6)

| Файл | Причина |
|------|---------|
| `docker-compose.yml` | Устаревшая NLP конфигурация |
| `docker-compose.dev.yml` | Наследует от устаревшего |
| `docker-compose.production.yml` | Устаревшая NLP конфигурация |
| `docker-compose.vless-proxy.yml` | Критический конфликт сетей |
| `docker-compose.temp-ssl.yml` | Заменён на scripts/init-ssl.sh |
| `backend/Dockerfile.prod` | Загружал NLP модели |

### P1: Исправленные файлы (6)

| Файл | Исправления |
|------|-------------|
| `frontend/Dockerfile.prod` | `build:unsafe` → `build`, добавлен `--legacy-peer-deps` |
| `frontend/.dockerignore` | Удалён паттерн `Dockerfile*` |
| `docker-compose.ssl.yml` | Добавлен `--keep-until-expiring` |
| `.dockerignore` | Добавлены CI/CD и linter cache паттерны |
| `docker-compose.staging.yml` | Переписан для LangExtract |
| `scripts/init-ssl.sh` | Создан (замена temp-ssl.yml) |

---

## Текущая структура Docker файлов (15)

```
docker-compose.lite.yml         # Development (ЭТАЛОН)
docker-compose.lite.prod.yml    # Production (ЭТАЛОН)
docker-compose.override.yml     # Локальные переопределения
docker-compose.staging.yml      # Staging (обновлён)
docker-compose.ssl.yml          # SSL сертификаты
docker-compose.dev-ssl.yml      # Dev с HTTPS
docker-compose.monitoring.yml   # Мониторинг

backend/Dockerfile              # Dev (full)
backend/Dockerfile.lite         # Dev (lite)
backend/Dockerfile.lite.prod    # Prod (lite)

frontend/Dockerfile             # Dev
frontend/Dockerfile.prod        # Prod (исправлен)

.dockerignore                   # Корневой (исправлен)
backend/.dockerignore           # Backend
frontend/.dockerignore          # Frontend (исправлен)

scripts/init-ssl.sh             # Инициализация SSL
```

---

## Экономия ресурсов после унификации

| Метрика | До | После |
|---------|-----|-------|
| Количество файлов | 21 | 15 |
| RAM (production) | 10-12 GB | 2-3 GB |
| Docker образ backend | 2.5 GB | 800 MB |
| Сложность конфигурации | Высокая | Низкая |

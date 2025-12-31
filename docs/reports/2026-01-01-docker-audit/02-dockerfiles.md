# Анализ Dockerfiles

**Дата:** 1 января 2026

## Обзор

Найдено **6 Dockerfile** файлов:
- Backend: 4 файла
- Frontend: 2 файла

---

## Backend Dockerfiles

### 1. Dockerfile (Development - Full)

**Путь:** `backend/Dockerfile`
**Назначение:** Разработка с полными зависимостями
**Базовый образ:** `python:3.11-slim`

**Характеристики:**
- BuildKit cache mount для pip
- Режим `--reload` для hot reload
- Непривилегированный пользователь `appuser`
- Использует `requirements.txt`

**Статус:** ОСТАВИТЬ

---

### 2. Dockerfile.lite (Development - Lite)

**Путь:** `backend/Dockerfile.lite`
**Назначение:** Разработка для серверов с ограниченной памятью (8GB)
**Базовый образ:** `python:3.11-slim`

**Характеристики:**
- Использует `requirements.lite.txt` (без NLP)
- Явно отключает NLP через env vars
- Размер образа: ~800 MB
- Режим `--reload` для hot reload

**Флаги окружения:**
```
USE_LANGEXTRACT_PRIMARY=true
USE_ADVANCED_PARSER=false
USE_NLP_PROCESSORS=false
```

**Статус:** ОСТАВИТЬ (ЭТАЛОН для разработки)

---

### 3. Dockerfile.prod (Production - Full)

**Путь:** `backend/Dockerfile.prod`
**Назначение:** Production с NLP моделями
**Базовый образ:** `python:3.11-slim` (multi-stage)

**КРИТИЧЕСКИЕ ПРОБЛЕМЫ:**
1. Загружает УСТАРЕВШИЕ NLP модели (SpaCy, NLTK, Stanza)
2. Размер образа: ~2.5 GB
3. Не соответствует текущей архитектуре (Gemini API)

**Содержит устаревший код:**
```dockerfile
# Строки 25-29: Загрузка NLP моделей
RUN python -m spacy download ru_core_news_lg
RUN python -m nltk.downloader punkt averaged_perceptron_tagger
RUN python -c "import stanza; stanza.download('ru')"
```

**Статус:** УДАЛИТЬ

---

### 4. Dockerfile.lite.prod (Production - Lite)

**Путь:** `backend/Dockerfile.lite.prod`
**Назначение:** Production для LangExtract (Gemini API)
**Базовый образ:** `python:3.11-slim` (multi-stage)

**Характеристики:**
- Использует `requirements.lite.txt`
- Gunicorn с 2 workers
- Timeout: 120 секунд
- Размер образа: ~600 MB
- Явно отключает NLP

**Статус:** ОСТАВИТЬ (ЭТАЛОН для production)

---

## Frontend Dockerfiles

### 5. Dockerfile (Development)

**Путь:** `frontend/Dockerfile`
**Назначение:** Разработка с Vite dev server
**Базовый образ:** `node:20-alpine`

**Характеристики:**
- Hot reload через Vite (port 5173)
- npm ci с `--legacy-peer-deps`
- Непривилегированный пользователь

**Проблемы:**
- Имя пользователя `nextjs` (проект использует Vite, не Next.js)

**Статус:** ОСТАВИТЬ (исправить имя пользователя)

---

### 6. Dockerfile.prod (Production)

**Путь:** `frontend/Dockerfile.prod`
**Назначение:** Production с Nginx
**Базовый образ:** `node:20-alpine` (builder) + `nginx:1.25-alpine` (prod)

**КРИТИЧЕСКИЕ ПРОБЛЕМЫ:**
1. Использует `npm run build:unsafe` - пропускает TypeScript checking
2. Несинхронизированные npm flags между dev и prod

**Статус:** ИСПРАВИТЬ

**Рекомендуемые изменения:**
```diff
- RUN npm run build:unsafe
+ RUN npm run build
```

---

## Сравнительная таблица

| Файл | Назначение | NLP | Размер | Статус |
|------|-----------|-----|--------|--------|
| `Dockerfile` | Dev (full) | ? | ~2.5GB | ОСТАВИТЬ |
| `Dockerfile.lite` | Dev (lite) | Нет | ~800MB | ЭТАЛОН |
| `Dockerfile.prod` | Prod (full) | Да | ~2.5GB | УДАЛИТЬ |
| `Dockerfile.lite.prod` | Prod (lite) | Нет | ~600MB | ЭТАЛОН |
| `frontend/Dockerfile` | Dev | - | ~500MB | ОСТАВИТЬ |
| `frontend/Dockerfile.prod` | Prod | - | ~100MB | ИСПРАВИТЬ |

---

## Рекомендуемая структура

```
backend/
├── Dockerfile           # Dev (для локальной разработки)
├── Dockerfile.lite      # Dev lite (ЭТАЛОН)
└── Dockerfile.lite.prod # Prod lite (ЭТАЛОН)

frontend/
├── Dockerfile           # Dev (Vite)
└── Dockerfile.prod      # Prod (Nginx) - ИСПРАВИТЬ
```

**Удалить:** `backend/Dockerfile.prod`

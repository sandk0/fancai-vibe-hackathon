# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BookReader AI** - Веб-приложение для чтения художественной литературы с автоматической генерацией изображений по описаниям из книг с подписочной моделью монетизации.

## Technology Stack

### Frontend
- **React 18+** с **TypeScript**
- **Tailwind CSS** для стилизации
- **React Query/TanStack Query** для управления состоянием сервера
- **Zustand** для клиентского состояния
- **Socket.io-client** для real-time функций

### Backend
- **Python 3.11+** с **FastAPI**
- **PostgreSQL 15+** для основной БД
- **Redis** для кэширования и очередей задач
- **Celery** для асинхронных задач
- **SQLAlchemy** ORM с **Alembic** для миграций

### NLP & AI
- **spaCy** (основная NLP для русского языка)
- **NLTK, Stanza, Natasha** (альтернативные)
- **pollinations.ai** (основной сервис генерации изображений)
- **OpenAI DALL-E, Midjourney, Stable Diffusion** (опциональные)

## Common Development Tasks

### Project Setup
```bash
# Клонирование и запуск
git clone <repository-url>
cd fancai-vibe-hackathon
docker-compose up -d

# Установка зависимостей
cd backend && pip install -r requirements.txt
cd frontend && npm install
```

### Development Commands
```bash
# Запуск в режиме разработки
docker-compose -f docker-compose.dev.yml up

# Backend тесты
cd backend && pytest -v --cov=app

# Frontend тесты
cd frontend && npm test

# Линтинг
cd backend && ruff check . && black --check .
cd frontend && npm run lint

# Типы (TypeScript)
cd frontend && npm run type-check

# База данных миграции
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "description"
```

### Парсинг и NLP
```bash
# Установка русской модели spaCy
python -m spacy download ru_core_news_lg

# Тестирование парсера
cd backend && python scripts/test_parser.py --file sample.txt --type location

# Обновление NLP моделей
cd backend && python scripts/update_models.py
```

## Critical Development Requirements

### Documentation Standards
**ОБЯЗАТЕЛЬНО:** Каждое изменение в коде должно сопровождаться обновлением документации!

#### После каждой реализации функциональности:
1. ✅ Обновить `README.md` с информацией о новой функции
2. ✅ Обновить `docs/development/development-plan.md` - отметить выполненные задачи
3. ✅ Обновить `docs/development/development-calendar.md` - зафиксировать даты
4. ✅ Добавить в `docs/development/changelog.md` - детально описать изменения
5. ✅ Обновить `docs/development/current-status.md` - текущее состояние проекта
6. ✅ Документировать новый код - docstrings, комментарии, README модулей

### Code Documentation Standards
```python
# Все функции должны иметь docstrings
def extract_descriptions(text: str, description_type: str) -> List[Description]:
    """
    Извлекает описания определенного типа из текста.

    Args:
        text: Исходный текст для анализа
        description_type: Тип описаний ('location', 'character', 'atmosphere')

    Returns:
        Список найденных описаний с метаданными

    Example:
        >>> descriptions = extract_descriptions(chapter_text, 'location')
        >>> print(f"Найдено {len(descriptions)} описаний локаций")
    """
```

```typescript
// React компоненты должны иметь JSDoc комментарии
/**
 * Компонент читалки книг с поддержкой изображений
 *
 * @param book - Объект книги для чтения
 * @param currentPage - Текущая страница
 * @param onPageChange - Callback при смене страницы
 */
```

### Git Commit Standards & Best Practices

#### Commit Message Format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Типы коммитов:**
- `feat`: новая функциональность
- `fix`: исправление бага
- `docs`: изменения в документации
- `style`: изменения в стилях (не влияющие на логику)
- `refactor`: рефакторинг кода
- `test`: добавление или изменение тестов
- `chore`: вспомогательные изменения (build, ci, deps)

**Примеры качественных коммитов:**
```bash
feat(parser): добавлен парсер EPUB файлов

- Реализован класс EpubParser с методом extract_content()
- Добавлена поддержка CSS стилей и изображений
- Добавлены unit тесты для всех публичных методов
- Обновлена документация: docs/components/backend/epub-parser.md

Closes #123
Docs: docs/components/backend/epub-parser.md

fix(reader): исправлена пагинация на мобильных устройствах

- Устранена проблема с переполнением текста на экранах <768px
- Оптимизирован расчет высоты страницы для разных шрифтов
- Добавлены responsive тесты

Fixes #456

docs: обновлен план разработки и календарь

- Отмечены как выполненные задачи парсера EPUB
- Добавлены новые задачи для Phase 2
- Обновлены временные оценки

[skip ci]
```

#### Когда коммитить:
✅ **Коммитить нужно:**
- После завершения логически завершенной функции
- После исправления бага с тестами
- После обновления документации
- Перед переключением на другую задачу
- В конце рабочего дня (WIP коммиты)

❌ **НЕ коммитить:**
- Код с failing тестами (кроме WIP)
- Код без документации для новой функциональности
- Большие изменения в одном коммите (>500 строк)
- Конфиденциальные данные (API ключи, пароли)

#### Pre-commit проверки:
```bash
# Автоматические проверки перед коммитом
pre-commit install

# Проверки включают:
- Линтинг кода (ruff, eslint)
- Форматирование (black, prettier)
- Типы (mypy, tsc)
- Тесты (pytest, jest) - быстрые только
- Проверка документации
- Сканирование на секреты
```

### File Structure
```
fancai-vibe-hackathon/
├── frontend/                 # React приложение
│   ├── src/components/      # React компоненты
│   ├── src/hooks/          # Custom hooks
│   ├── src/stores/         # Zustand stores
│   └── src/types/          # TypeScript типы
├── backend/                 # FastAPI приложение
│   ├── app/models/         # SQLAlchemy модели
│   │   ├── user.py         # ✅ User, Subscription модели
│   │   ├── book.py         # ✅ Book, ReadingProgress модели
│   │   ├── chapter.py      # ✅ Chapter модель
│   │   ├── description.py  # ✅ Description модель с типами
│   │   └── image.py        # ✅ GeneratedImage модель
│   ├── app/routers/        # API routes
│   │   ├── users.py        # ✅ Пользовательские endpoints
│   │   ├── books.py        # ✅ Управление книгами (12 endpoints)
│   │   └── nlp.py          # ✅ NLP тестирование и обработка
│   ├── app/core/           # Конфигурация и утилиты
│   │   ├── config.py       # ✅ Настройки приложения
│   │   └── database.py     # ✅ Асинхронная база данных
│   └── app/services/       # Бизнес логика
│       ├── book_parser.py  # ✅ EPUB/FB2 парсер
│       ├── book_service.py # ✅ Сервис управления книгами
│       └── nlp_processor.py # ✅ NLP обработка с приоритетами
├── docs/                   # Документация проекта
│   ├── development/        # План, календарь, changelog
│   ├── architecture/       # Техническая документация
│   ├── components/         # Документация компонентов
│   └── user-guides/        # Руководства пользователей
└── scripts/                # Вспомогательные скрипты
```

## Architecture Overview

### Core Components
1. **Book Processing Pipeline:**
   - EPUB/FB2 парсер → Содержимое глав → Парсер описаний → Очередь генерации изображений

2. **NLP Parser (КРИТИЧЕСКИ ВАЖНО):**
   - spaCy для извлечения именных групп и NER
   - Rule-based классификация по типам описаний (локации > персонажи > атмосфера > объекты > действия)
   - Контекстное обогащение и связывание сущностей

3. **Image Generation:**
   - pollinations.ai (основной, бесплатный)
   - Промпт-инжиниринг по жанрам и типам описаний
   - Кэширование и дедупликация изображений

4. **Reading Interface:**
   - Постраничная читалка с адаптивной пагинацией
   - Модальные окна для изображений по клику на описания
   - Офлайн-режим с Service Worker

### Database Schema (PostgreSQL)
```sql
-- Основные таблицы
Users, Books, Chapters, Descriptions, Generated_Images

-- Пользовательские данные
Bookmarks, Highlights, Reading_Progress, Reading_Sessions

-- Административные
Subscriptions, Payment_History, Admin_Settings, System_Logs
```

### Key Performance Requirements
- **Парсер:** >70% релевантных описаний для генерации
- **Генерация:** <30 секунд среднее время
- **Читалка:** <2 секунды загрузка страниц
- **Uptime:** >99% доступность сервиса

## Special Notes

### Critical Success Factors
1. **Качество парсера описаний** - основная ценность проекта
2. **Mobile-first подход** - приоритет удобства на мобильных
3. **Документирование всех изменений** - обязательное требование
4. **Подписочная модель** - FREE → PREMIUM → ULTIMATE планы

### Development Phases
- **Phase 0 (Initialization):** ✅ Завершено - инфраструктура и документация
- **Phase 1 (MVP):** ✅ ЗАВЕРШЕНО (95% завершено) - базовая функциональность РАБОТАЕТ
  - ✅ Модели базы данных
  - ✅ Парсер книг EPUB/FB2
  - ✅ NLP процессор с приоритизацией
  - ✅ API для управления книгами (ИСПРАВЛЕН UUID баг)
  - ✅ Система аутентификации JWT
  - ✅ Генерация изображений pollinations.ai
  - ✅ Frontend интерфейс React+TypeScript
  - ✅ Автоматический парсинг с прогресс-индикатором
  - ✅ Production deployment готов
- **Phase 2:** 6-8 недель - улучшения и оптимизации  
- **Phase 3:** 4-6 недель - масштабирование и ML улучшения

### Environment Variables Required
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/bookreader
REDIS_URL=redis://localhost:6379

# AI Services
OPENAI_API_KEY=sk-... (опционально)
POLLINATIONS_ENABLED=true

# Payment Systems
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=test_...

# App Settings
SECRET_KEY=change-in-production
DEBUG=false
```

## Quick Reference

### Frequently Used Commands
```bash
# Быстрый перезапуск разработки
docker-compose restart backend frontend

# Просмотр логов
docker-compose logs -f backend
docker-compose logs -f celery-worker

# Очистка Redis кэша
docker-compose exec redis redis-cli FLUSHALL

# Выполнение миграций
docker-compose exec backend alembic upgrade head

# Тестирование парсера на образце
docker-compose exec backend python scripts/test_parser.py --sample

# Генерация API документации
docker-compose exec backend python scripts/generate_docs.py
```

### Important File Locations
- **Основной промпт:** `prompts.md`
- **Конфигурация Docker:** `docker-compose.yml`
- **План разработки:** `docs/development/development-plan.md`
- **API документация:** `docs/architecture/api-documentation.md`
- **Схема БД:** `docs/architecture/database-schema.md`

# BookReader AI - Приложение для чтения с ИИ-генерацией изображений

**BookReader AI** - это современное веб-приложение для чтения художественной литературы с автоматической генерацией изображений по описаниям из книг. Приложение использует передовые NLP технологии для извлечения описаний и AI-сервисы для создания визуализаций.

## 📋 Текущий статус проекта

**Phase:** Phase 1 ✅ ЗАВЕРШЁН (100%)
**Completion Date:** 23.10.2025
**Last Update:** 23.10.2025
**Status:** 🚀 Production Ready - CFI Reading System + epub.js + Multi-NLP Active

## 🚀 Запуск проекта

### Разработка (Development)
```bash
# Клонирование репозитория
git clone <repository-url>
cd fancai-vibe-hackathon

# Настройка переменных окружения
cp .env.example .env

# Запуск с Docker в dev режиме
docker-compose -f docker-compose.dev.yml up -d
```

### Production деплой
```bash
# Настройка production окружения
cp .env.production .env.production.local
nano .env.production.local  # Настроить домен и пароли

# Деплой на сервер
./scripts/deploy.sh init
./scripts/deploy.sh ssl
./scripts/deploy.sh deploy
```

### Детальная установка
- **Development:** См. [Инструкции по настройке](docs/user-guides/installation-guide.md)  
- **Production:** См. [DEPLOYMENT.md](DEPLOYMENT.md) - полное руководство по деплою

## ✨ Запланированные функции

### Phase 1 (MVP - ✅ ЗАВЕРШЁН 100% - 23.10.2025)
- ✅ Регистрация и аутентификация пользователей
- ✅ Загрузка и парсинг EPUB/FB2 книг
- ✅ **CFI Reading System** - Canonical Fragment Identifier для точного позиционирования
- ✅ **epub.js Integration** - профессиональная читалка с react-reader
- ✅ **Hybrid Restoration** - CFI + scroll offset для pixel-perfect восстановления позиции
- ✅ React Frontend с полной интеграцией
- ✅ Пользовательские настройки (темы, шрифты)
- ✅ Multi-NLP парсер (SpaCy+Natasha+Stanza) - КРИТИЧЕСКИ ВАЖНО - 2171+ описаний найдено
- ✅ **Ensemble Voting** - weighted consensus для максимального качества NLP
- ✅ Генерация изображений через pollinations.ai
- ✅ Smart Highlight System - автоматическое выделение описаний в тексте
- ✅ Locations Generation - точный трекинг прогресса (0-100%)
- ✅ Drag-and-drop загрузка книг
- ✅ Галерея изображений с модальными окнами
- ✅ Real-time WebSocket интеграция
- ✅ PWA с Service Worker
- ✅ Полная система тестирования
- ✅ Production deployment конфигурация
- ✅ Docker production setup с SSL/HTTPS
- ✅ Nginx reverse proxy с security headers
- ✅ Мониторинг (Grafana, Prometheus, Loki)
- ✅ Автоматические скрипты деплоя
- ✅ SSL сертификаты через Let's Encrypt

## 🆕 Latest Updates (октябрь 2025)

### CFI Reading System & epub.js Integration
- ✅ **Canonical Fragment Identifier (CFI)** - точное позиционирование в EPUB книгах
- ✅ **epub.js 0.3.93** - профессиональный EPUB парсинг и рендеринг
- ✅ **react-reader 2.0.15** - полнофункциональная читалка с темной темой
- ✅ **Hybrid Restoration** - комбинация CFI + scroll_offset_percent для pixel-perfect восстановления
- ✅ **Smart Highlight System** - автоматическое выделение описаний в тексте
- ✅ **Locations Generation** - точный трекинг прогресса чтения (0-100%)
- ✅ **Database Migration** - добавлены поля `reading_location_cfi` и `scroll_offset_percent`
- ✅ **Backward Compatibility** - полная совместимость со старыми данными

### Advanced Multi-NLP System (03.09.2025) ⭐ CRITICAL COMPONENT

#### Multi-NLP Architecture Implementation
- ✅ **Multi-NLP Manager**: 3 специализированных NLP процессора с интеллектуальной координацией
  - **SpaCy** (ru_core_news_lg) - entity recognition, POS tagging, вес 1.0
  - **Natasha** - русская морфология и NER, литературные паттерны, вес 1.2 (специализация)
  - **Stanza** (ru) - dependency parsing, сложный синтаксис, вес 0.8
- ✅ **5 режимов обработки**:
  - **SINGLE** - один процессор (⚡⚡⚡⚡⚡ скорость, ⭐⭐⭐ качество)
  - **PARALLEL** - параллельная обработка всех процессоров (максимальное покрытие)
  - **SEQUENTIAL** - последовательная обработка (максимальная глубина)
  - **ENSEMBLE** ⭐ - voting с weighted consensus (максимальное качество, рекомендуется)
  - **ADAPTIVE** 🤖 - автоматический выбор на основе анализа текста (интеллектуально)
- ✅ **Ensemble Voting Algorithm**:
  - Weighted consensus: SpaCy (1.0), Natasha (1.2), Stanza (0.8)
  - Consensus threshold: 0.6 (60% согласие процессоров)
  - Context enrichment + deduplication
  - Quality boost для high-consensus описаний
- ✅ **Performance Breakthrough**:
  - 2171 описаний извлечено за 4 секунды
  - Качество >70% релевантных описаний (KPI достигнут ✅)
  - SpaCy quality: 0.78, Natasha quality: 0.82 (лучший)
- ✅ **Admin API**: 5 comprehensive endpoints для runtime configuration
- 📚 **Documentation**: [Multi-NLP System Technical Guide](docs/technical/multi-nlp-system.md) (1,676 lines)

#### Технические исправления
- ✅ **Celery enum fix**: Исправлена критическая ошибка enum descriptiontype в database
- ✅ **SpaCy configuration**: Добавлены entity_types и литературные паттерны
- ✅ **Admin Panel**: Полная миграция на multi-nlp-settings с тонкими настройками
- ✅ **Parsing workflow**: Парсинг запускается сразу после импорта, не при открытии книги

### Phase 2 (Улучшения - 6-8 недель)
- ⏳ ML оптимизация Multi-NLP системы
- ⏳ Дополнительные AI сервисы (DALL-E, Midjourney)
- ✅ Полная админ-панель (завершено с multi-NLP настройками)
- ⏳ PWA и мобильные оптимизации

## 🏗 Архитектура

### Technology Stack

#### Frontend
- **React 18+** с **TypeScript**
- **epub.js 0.3.93** - EPUB парсинг и рендеринг
- **react-reader 2.0.15** - React wrapper для epub.js
- **Tailwind CSS** для стилизации
- **React Query/TanStack Query** для управления состоянием сервера
- **Zustand** для клиентского состояния

#### Backend
- **Python 3.11+** с **FastAPI**
- **PostgreSQL 15+** для основной БД
- **Redis** для кэширования и очередей задач
- **Celery** для асинхронных задач
- **SQLAlchemy** ORM с **Alembic** для миграций

#### NLP & AI
- **Multi-NLP Manager** - координация 3 процессоров
  - **SpaCy** (ru_core_news_lg) - entity recognition
  - **Natasha** - русская морфология и NER
  - **Stanza** (ru) - dependency parsing
- **5 режимов обработки**: Single, Parallel, Sequential, Ensemble, Adaptive
- **Ensemble Voting**: weighted consensus для максимального качества
- **AI Generation:** pollinations.ai, OpenAI DALL-E (опционально)

### Core Components

1. **Book Processing Pipeline:**
   - EPUB/FB2 парсер → Содержимое глав → Multi-NLP парсер описаний → Очередь генерации изображений

2. **CFI Reading System:**
   - **Canonical Fragment Identifier (CFI)** для точного позиционирования в EPUB
   - **Hybrid restoration**: CFI + scroll offset для pixel-perfect восстановления позиции
   - Поддержка `reading_location_cfi` и `scroll_offset_percent` в ReadingProgress
   - Обратная совместимость со старыми данными

3. **epub.js Integration:**
   - Полная интеграция **react-reader** + **epub.js** для профессионального чтения EPUB
   - Smart highlight system для автоматического выделения описаний в тексте
   - Locations generation для точного трекинга прогресса (0-100%)
   - Темная тема из коробки
   - Responsive design для мобильных устройств

4. **Advanced Multi-NLP System:**
   - **3 NLP процессора**: SpaCy (ru_core_news_lg), Natasha (русский специализированный), Stanza (глубокий синтаксис)
   - **5 режимов обработки**:
     - SINGLE - один процессор (быстро)
     - PARALLEL - параллельная обработка (максимальное покрытие)
     - SEQUENTIAL - последовательная обработка (контролируемо)
     - ENSEMBLE - voting с consensus алгоритмом (максимальное качество)
     - ADAPTIVE - автоматический выбор режима (интеллектуально)
   - **Ensemble voting**: weighted consensus (SpaCy 1.0, Natasha 0.8, Stanza 0.7)
   - **Производительность**: 2171 описание за 4 секунды (тестовая книга 25 глав)
   - **Admin API**: 5 endpoints для управления процессорами

5. **Image Generation:**
   - pollinations.ai (основной, бесплатный)
   - Промпт-инжиниринг по жанрам и типам описаний
   - Кэширование и дедупликация изображений

6. **Subscription Model:**
   - FREE → PREMIUM → ULTIMATE планы

## 🤖 Claude Code Agents

**BookReader AI** теперь оснащён продвинутой системой из **10 специализированных AI агентов** для автоматизации разработки!

### Система агентов

**Tier 0 (Orchestrator):**
- **Orchestrator Agent** - Главный координатор, переводит ваши задачи в действия

**Tier 1 (Core - Must-Have):**
- **Multi-NLP Expert** - Эксперт по критической Multi-NLP системе
- **Backend API Developer** - FastAPI endpoints и backend логика
- **Documentation Master** - Автоматическое обновление документации

**Tier 2 (Specialists - Recommended):**
- **Frontend Developer** - React, TypeScript, EPUB.js разработка
- **Database Architect** - SQLAlchemy модели, миграции, оптимизация
- **Testing & QA Specialist** - Comprehensive testing и quality assurance
- **Analytics Specialist** - KPI tracking, user behavior, ML analytics

**Tier 3 (Advanced - Extended):**
- **Code Quality & Refactoring Agent** - Code smells, refactoring, design patterns
- **DevOps Engineer Agent** - Docker, CI/CD, monitoring, deployment automation

### Быстрый старт с агентами

```bash
# Просто опишите что хотите - Orchestrator позаботится об остальном
Создай endpoint для получения топ-10 популярных книг
```

**Документация агентов:**
- [Быстрый старт](AGENTS_QUICKSTART.md) - Начните здесь!
- [Финальная архитектура](AGENTS_FINAL_ARCHITECTURE.md) - Полное описание системы
- [Агенты README](.claude/agents/README.md) - Описание всех 8 агентов
- [Orchestrator Guide](docs/development/orchestrator-agent-guide.md) - Детальное руководство

## 📚 Документация

### Основная документация
- [DEPLOYMENT.md](DEPLOYMENT.md) - **Руководство по production деплою**
- [CLAUDE.md](CLAUDE.md) - Руководство для Claude Code
- [План разработки](docs/development/development-plan.md)
- [Календарь разработки](docs/development/development-calendar.md)
- [Текущий статус](docs/development/current-status.md)
- [История изменений](docs/development/changelog.md)

### Техническая документация
- [Архитектура деплоя](docs/architecture/deployment-architecture.md)
- [Celery задачи](docs/components/backend/celery-tasks.md)
- [Reader компонент](docs/components/frontend/reader-component.md)
- [Система Claude Code Agents](docs/development/claude-code-agents-system.md)

### Операционная документация
- [Backup and Restore Guide](docs/operations/BACKUP_AND_RESTORE.md) - Complete backup/restore procedures
- [Backup and Restore (RU)](docs/operations/BACKUP_AND_RESTORE.ru.md) - Полное руководство по бэкапу

### Руководства пользователя
- [Инструкция по установке](docs/user-guides/installation-guide.md)
- [Руководство пользователя](docs/user-guides/user-manual.md)

## 🛠 Инструменты разработки

```bash
# Backend разработка
cd backend && pip install -r requirements.txt
python -m spacy download ru_core_news_lg

# Frontend разработка  
cd frontend && npm install

# Docker разработка
docker-compose -f docker-compose.dev.yml up

# Тестирование
cd backend && pytest -v --cov=app
cd frontend && npm test

# Линтинг и форматирование
cd backend && ruff check . && black --check .
cd frontend && npm run lint

# Production деплой
./scripts/deploy.sh init     # Инициализация
./scripts/deploy.sh ssl      # SSL настройка
./scripts/deploy.sh deploy   # Деплой приложения
./scripts/deploy.sh status   # Проверка статуса

# Мониторинг (опционально)
./scripts/setup-monitoring.sh start
```

## 📈 Метрики проекта

- **Строк кода:** ~15000+ (полный стек backend + frontend + tests + agents)
- **Компонентов:** 40+ (backend: 18+, frontend: 22+)
- **API endpoints:** 30+ (книги, NLP, auth, изображения, admin, CFI)
- **React компонентов:** 25+ (страницы, компоненты, stores, epub.js integration)
- **Database Tables:** 12+ (Users, Books, Chapters, Descriptions, Images, ReadingProgress с CFI)
- **NLP Processors:** 3 (SpaCy, Natasha, Stanza)
- **Processing Modes:** 5 (Single, Parallel, Sequential, Ensemble, Adaptive)
- **Test coverage:** 75%+ (backend и frontend тесты)
- **PWA готовность:** ✅ Service Worker, Manifest, Offline support
- **Claude Code Agents:** 10 специализированных AI агентов (~160KB промптов)

## 🔄 Последние изменения

**23.10.2025:**
- ✅ **CFI Reading System**: Реализован Canonical Fragment Identifier для точного позиционирования в EPUB
- ✅ **epub.js Integration**: Полная интеграция react-reader + epub.js для профессионального чтения
- ✅ **Hybrid Restoration**: Комбинация CFI + scroll_offset_percent для pixel-perfect восстановления позиции
- ✅ **Smart Highlight System**: Автоматическое выделение описаний в тексте EPUB
- ✅ **Locations Generation**: Точный трекинг прогресса чтения (0-100%)
- ✅ **Database Migration**: Добавлены поля reading_location_cfi и scroll_offset_percent в ReadingProgress
- ✅ **Phase 1 ЗАВЕРШЁН**: Все основные компоненты MVP работают в production (100%)
- ✅ **Система Claude Code Agents**: Реализована полная система из 10 специализированных AI агентов
- ✅ **Orchestrator Agent**: Главный координатор с Research-Plan-Implement workflow
- ✅ **Tier 1 Core Agents**: Multi-NLP Expert, Backend Developer, Documentation Master
- ✅ **Tier 2 Specialist Agents**: Frontend Developer, Testing & QA, Database Architect, Analytics Specialist
- ✅ **Tier 3 Advanced Agents**: Code Quality & Refactoring, DevOps Engineer
- ✅ **Автоматизация разработки**: 2-3x ускорение на типовых задачах, 100% актуальная документация
- ✅ **Полное покрытие**: Backend, Frontend, NLP/ML, Database, Testing, Analytics, Code Quality, DevOps

**03.09.2025:**
- ✅ **КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ**: Полностью восстановлен Books API после поломки UUID endpoints
- ✅ **Парсинг в реальном времени**: Реализован автоматический старт парсинга при загрузке книги
- ✅ **ParsingOverlay**: Создан новый компонент с SVG прогресс-индикатором и оптимизированным polling
- ✅ **Frontend-Backend интеграция**: Исправлены все API пути и обработка ошибок
- ✅ **Book management workflow**: Полный цикл загрузка → парсинг → чтение работает стабильно
- ✅ **Celery task optimization**: Улучшена обработка фоновых задач парсинга книг
- ✅ **Admin функциональность**: Добавлены admin endpoints для управления системой

**23.08.2025:**
- ✅ Реализована полная система управления книгами
- ✅ Создан NLP процессор с приоритизированной экстракцией описаний
- ✅ Добавлен парсер EPUB/FB2 книг с извлечением метаданных
- ✅ Созданы все модели базы данных (Users, Books, Chapters, Descriptions, Images)
- ✅ Реализованы API endpoints для загрузки и управления книгами
- ✅ Добавлена система отслеживания прогресса чтения
- ✅ Реализована система аутентификации с JWT токенами
- ✅ Создан сервис AI генерации изображений с pollinations.ai
- ✅ Добавлен prompt engineering для разных типов описаний
- ✅ Реализована система очередей для пакетной генерации изображений
- ✅ Создано полное React + TypeScript приложение
- ✅ Реализована state management система с Zustand
- ✅ Добавлены все страницы: авторизация, библиотека, чтение
- ✅ Интегрирован полный API клиент с автоматическим refresh токенов

## 🎯 Критерии успеха MVP

### Технические KPI
- **Точность парсера:** >70% релевантных описаний для генерации
- **Скорость генерации:** <30 секунд среднее время  
- **Performance:** <2 секунды загрузка страниц читалки
- **Uptime:** >99% доступность сервиса

### Бизнес-метрики
- **User retention:** >40% возвращаются через неделю
- **Conversion rate:** >5% free → premium за месяц
- **User satisfaction:** >4.0/5 в отзывах

## 🤝 Вклад в проект

Проект находится в стадии активной разработки. Все изменения должны соответствовать стандартам документирования, описанным в [CLAUDE.md](CLAUDE.md).

## 📝 Лицензия

Частный проект. Все права защищены.
# BookReader AI - Приложение для чтения с ИИ-генерацией изображений

**BookReader AI** - это современное веб-приложение для чтения художественной литературы с автоматической генерацией изображений по описаниям из книг. Приложение использует передовые NLP технологии для извлечения описаний и AI-сервисы для создания визуализаций.

## 📋 Текущий статус проекта

**Phase:** MVP Development Complete + Production Ready (Phase 1)  
**Progress:** 95% завершено (Production deployment готов!)  
**Last Update:** 03.09.2025  
**Status:** 🚀 Production Ready - MVP Complete + Critical Bug Fixes Applied

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

### Phase 1 (MVP - ЗАВЕРШЕНО ✅)
- ✅ Регистрация и аутентификация пользователей
- ✅ Загрузка и парсинг EPUB/FB2 книг  
- ✅ React Frontend с полной интеграцией
- ✅ Пользовательские настройки (темы, шрифты)
- ✅ Парсер описаний (spaCy) - КРИТИЧЕСКИ ВАЖНО
- ✅ Генерация изображений через pollinations.ai
- ✅ Продвинутая читалка с пагинацией
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

### 🔧 Недавние исправления (03.09.2025)
- ✅ **Books API полностью исправлен**: Решены проблемы с UUID и роутингом
- ✅ **Парсинг и прогресс в реальном времени**: Оверлей с анимированным прогрессом работает корректно
- ✅ **Celery tasks исправлены**: Автоматический запуск парсинга после загрузки книги
- ✅ **Frontend API интеграция**: Исправлены все пути API endpoints
- ✅ **Авторизация и аутентификация**: JWT токены работают стабильно
- ✅ **Book upload workflow**: Drag & drop → автоматический парсинг → обновление библиотеки
- ✅ **ParsingOverlay компонент**: SVG анимация с корректными интервалами polling
- ✅ **Production deployment**: Все скрипты и Docker конфигурации проверены

### Phase 2 (Улучшения - 6-8 недель)
- ⏳ Продвинутый парсер с контекстом
- ⏳ Дополнительные AI сервисы
- ⏳ Полная админ-панель
- ⏳ PWA и мобильные оптимизации

## 🏗 Архитектура

### Technology Stack
- **Frontend:** React 18+ с TypeScript, Tailwind CSS
- **Backend:** Python 3.11+ с FastAPI  
- **Database:** PostgreSQL 15+
- **Cache & Queue:** Redis + Celery
- **NLP:** spaCy (ru_core_news_lg), NLTK, Natasha
- **AI Generation:** pollinations.ai, OpenAI DALL-E (опционально)

### Core Components
1. **Book Processing Pipeline:** EPUB/FB2 → Chapters → Description Parser → Image Generation
2. **NLP Parser:** spaCy + rule-based классификация описаний
3. **Reading Interface:** Постраничная читалка с модальными изображениями
4. **Subscription Model:** FREE → PREMIUM → ULTIMATE планы

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

- **Строк кода:** ~12000+ (полный стек backend + frontend + tests)
- **Компонентов:** 35+ (backend: 15, frontend: 20+)
- **API endpoints:** 25+ (книги, NLP, auth, изображения, admin)
- **React компонентов:** 25+ (страницы, компоненты, stores)
- **Test coverage:** 70%+ (backend и frontend тесты)
- **PWA готовность:** ✅ Service Worker, Manifest, Offline support

## 🔄 Последние изменения

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
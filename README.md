# BookReader AI - Приложение для чтения с ИИ-генерацией изображений

**BookReader AI** - это современное веб-приложение для чтения художественной литературы с автоматической генерацией изображений по описаниям из книг. Приложение использует передовые NLP технологии для извлечения описаний и AI-сервисы для создания визуализаций.

## 📋 Текущий статус проекта

**Phase:** MVP Development (Phase 1)  
**Progress:** 85% завершено  
**Last Update:** 23.08.2025  
**Next Milestone:** Production Deployment (30.08.2025)

## 🚀 Запуск проекта

### Быстрый старт
```bash
# Клонирование репозитория
git clone <repository-url>
cd fancai-vibe-hackathon

# Настройка переменных окружения
cp .env.example .env

# Запуск с Docker
docker-compose up -d
```

### Детальная установка
См. [Инструкции по настройке](docs/technical/setup-instructions.md)

## ✨ Запланированные функции

### Phase 1 (MVP - 8-10 недель)
- ✅ Регистрация и аутентификация пользователей
- ✅ Загрузка и парсинг EPUB/FB2 книг  
- ✅ React Frontend с полной интеграцией
- ⏳ Пользовательские настройки (темы, шрифты)
- ✅ Парсер описаний (spaCy) - КРИТИЧЕСКИ ВАЖНО
- ✅ Генерация изображений через pollinations.ai

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

- [План разработки](docs/development/development-plan.md)
- [Календарь разработки](docs/development/development-calendar.md)
- [Техническая архитектура](docs/architecture/system-overview.md)
- [Инструкции по настройке](docs/technical/setup-instructions.md)
- [CLAUDE.md](CLAUDE.md) - Руководство для Claude Code

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
```

## 📈 Метрики проекта

- **Строк кода:** ~8000 (полный стек backend + frontend)
- **Компонентов:** 25 (backend: 12, frontend: 13)
- **API endpoints:** 20 (книги, NLP, auth, изображения, admin)
- **React компонентов:** 15 (страницы, компоненты, stores)
- **Test coverage:** 0% (тесты в разработке)

## 🔄 Последние изменения

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
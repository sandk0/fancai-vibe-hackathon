# Changelog - BookReader AI

Все важные изменения в проекте документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Семантическому версионированию](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Планируется добавить
- Система аутентификации с JWT токенами
- Frontend интерфейс на React
- Интеграция с pollinations.ai для генерации изображений
- Система очередей Celery для обработки задач

---

## [0.2.0] - 2025-08-23

### Added
- **Система управления книгами**: Полный сервис `BookService` для работы с книгами в базе данных
- **NLP процессор**: Приоритизированная экстракция описаний из текста книг
  - Поддержка 5 типов описаний: LOCATION (75%), CHARACTER (60%), ATMOSPHERE (45%), OBJECT (40%), ACTION (30%)
  - Интеграция с spaCy, NLTK, Natasha для русского языка
  - Автоматический расчет приоритетных очков для генерации изображений
- **Парсер книг**: Полная поддержка EPUB и FB2 форматов
  - Извлечение метаданных (название, автор, жанр, описание, обложка)
  - Парсинг глав с сохранением HTML форматирования
  - Автоматический подсчет слов и времени чтения
- **Модели базы данных**: Полные SQLAlchemy модели
  - `User`, `Subscription` - пользователи и подписки
  - `Book`, `Chapter`, `ReadingProgress` - книги и прогресс чтения  
  - `Description`, `GeneratedImage` - описания и сгенерированные изображения
  - Все relationships и cascade операции настроены
- **API endpoints для управления книгами**:
  - `POST /api/v1/books/upload` - Загрузка и обработка книг
  - `GET /api/v1/books` - Список книг пользователя с пагинацией
  - `GET /api/v1/books/{id}` - Детальная информация о книге
  - `GET /api/v1/books/{id}/chapters/{num}` - Содержимое главы с автоматической экстракцией описаний
  - `POST /api/v1/books/{id}/progress` - Обновление прогресса чтения
  - `GET /api/v1/books/statistics` - Статистика чтения пользователя
- **Расширенные NLP endpoints**:
  - `POST /api/v1/nlp/extract-descriptions` - Извлечение описаний из произвольного текста
  - `GET /api/v1/nlp/test-book-sample` - Демонстрация работы на примере текста

### Changed
- Обновлен `requirements.txt`: удален `psycopg2-binary` для исправления конфликта async драйверов
- Расширен `main.py`: добавлены новые роутеры и endpoints
- Обновлены существующие NLP endpoints с улучшенной обработкой ошибок

### Fixed
- Исправлен конфликт между `psycopg2` и `asyncpg` в асинхронном движке SQLAlchemy
- Улучшена обработка ошибок в парсере книг
- Фиксация проблем с кодировкой в FB2 парсере

### Infrastructure
- Создан полный сервисный слой для работы с базой данных
- Настроена асинхронная архитектура с SQLAlchemy и asyncpg
- Подготовлена система для интеграции с AI сервисами

### Technical Information
- **Новых файлов**: 8 (сервисы, модели, роутеры)
- **Строк кода**: ~2000+ новых строк
- **Компоненты**: 8 новых компонентов
- **API endpoints**: 12 новых/обновленных endpoints

### Infrastructure
- Docker Compose с сервисами postgres, redis, backend, frontend, celery-worker, celery-beat
- Отдельный docker-compose.dev.yml для разработки с PgAdmin и Redis CLI
- Dockerfile для backend (Python 3.11 + spaCy ru_core_news_lg)
- Dockerfile для frontend (Node 18 + React + Vite)

### Documentation
- README.md с описанием проекта, статусом и инструкциями
- development-plan.md с детальным планом на 20 недель разработки
- development-calendar.md с календарем разработки по дням
- current-status.md для ежедневного отслеживания прогресса
- changelog.md (этот файл) для документирования изменений
- CLAUDE.md с требованиями к разработке и стандартами

### Configuration
- requirements.txt с NLP библиотеками (spaCy, NLTK, Natasha, ebooklib)
- package.json с React 18+, TypeScript, Tailwind CSS, Zustand
- .env.example с переменными окружения для всех сервисов
- .gitignore для Python + Node.js проектов

---

## [0.1.0] - 2024-08-23

### Added
- Первая инициализация проекта
- Создание репозитория fancai-vibe-hackathon
- Анализ технических требований из prompts.md
- Обновление CLAUDE.md с требованиями к разработке

### Project Structure
```
fancai-vibe-hackathon/
├── frontend/               # React приложение
├── backend/               # FastAPI приложение
├── docs/                  # Документация проекта
├── scripts/               # Вспомогательные скрипты
├── docker-compose.yml     # Production Docker конфигурация
├── docker-compose.dev.yml # Development Docker конфигурация
└── README.md             # Главный файл проекта
```

### Technical Stack Defined
- **Frontend:** React 18+ с TypeScript, Tailwind CSS, Zustand, React Query
- **Backend:** Python 3.11+ с FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL 15+ 
- **Cache & Queue:** Redis + Celery
- **NLP:** spaCy (ru_core_news_lg), NLTK, Stanza, Natasha
- **AI Generation:** pollinations.ai (основной), OpenAI DALL-E (опциональный)

### Development Process
- Настроены стандарты Git коммитов согласно Conventional Commits
- Определены требования к документированию каждого изменения
- Созданы процедуры ежедневного обновления статуса и календаря
- Установлены критерии качества для каждого компонента системы

---

## Легенда типов изменений

- **Added** - новые функции
- **Changed** - изменения в существующей функциональности
- **Deprecated** - функциональность, которая будет удалена в будущих версиях
- **Removed** - удаленная функциональность
- **Fixed** - исправления багов
- **Security** - изменения, связанные с безопасностью
- **Infrastructure** - изменения в инфраструктуре и DevOps
- **Documentation** - изменения только в документации
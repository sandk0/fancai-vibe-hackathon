# Руководство по внесению вклада в BookReader AI

Благодарим вас за интерес к проекту BookReader AI! Этот документ содержит рекомендации и инструкции по внесению вклада в проект.

## Содержание

- [Кодекс поведения](#кодекс-поведения)
- [Начало работы](#начало-работы)
- [Процесс разработки](#процесс-разработки)
- [Стандарты кодирования](#стандарты-кодирования)
- [Рекомендации по коммитам](#рекомендации-по-коммитам)
- [Процесс Pull Request](#процесс-pull-request)
- [Требования к документации](#требования-к-документации)
- [Требования к тестированию](#требования-к-тестированию)
- [Сообщество](#сообщество)

## Кодекс поведения

Участвуя в этом проекте, вы соглашаетесь поддерживать уважительную и инклюзивную среду для всех участников.

## Начало работы

### Требования

Перед началом работы убедитесь, что у вас установлено:
- Python 3.11+
- Node.js 18+
- Docker и Docker Compose
- Git

### Настройка окружения разработки

1. **Форк и клонирование**
   ```bash
   git fork <repository-url>
   git clone https://github.com/YOUR_USERNAME/fancai-vibe-hackathon.git
   cd fancai-vibe-hackathon
   ```

2. **Настройка окружения**
   ```bash
   # Копирование шаблона окружения
   cp .env.example .env

   # Установка зависимостей
   cd backend && pip install -r requirements.txt
   cd ../frontend && npm install
   ```

3. **Запуск окружения разработки**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Проверка установки**
   ```bash
   # Проверка работоспособности backend
   curl http://localhost:8000/health

   # Frontend должен быть доступен по адресу http://localhost:5173
   ```

Подробные инструкции по установке см. в [Руководстве по установке](docs/guides/getting-started/installation.md).

## Процесс разработки

### 1. Создайте ветку для функциональности

```bash
git checkout -b feature/your-feature-name
# или
git checkout -b fix/bug-description
```

### 2. Внесите изменения

Следуйте этим рекомендациям:
- Пишите чистый, читаемый код
- Следуйте существующему стилю кода
- Добавляйте тесты для новых функций
- Обновляйте документацию
- Делайте коммиты атомарными и сфокусированными

### 3. Запустите тесты

```bash
# Тесты backend
cd backend && pytest -v --cov=app

# Тесты frontend
cd frontend && npm test

# E2E тесты
cd frontend && npm run test:e2e
```

### 4. Проверка стиля и форматирование

```bash
# Backend
cd backend
ruff check .
black .
mypy app/ --strict

# Frontend
cd frontend
npm run lint
npm run type-check
```

### 5. Pre-commit хуки

Мы используем pre-commit хуки для обеспечения качества кода:

```bash
# Установка хуков
pre-commit install

# Запуск всех проверок
pre-commit run --all-files
```

## Стандарты кодирования

### Python (Backend)

**Руководство по стилю:** PEP 8 с форматированием Black

**Аннотации типов:** Обязательны для всех функций
```python
def extract_descriptions(text: str, description_type: str) -> List[Description]:
    """
    Извлекает описания из текста.

    Args:
        text: Исходный текст для анализа
        description_type: Тип извлекаемых описаний

    Returns:
        Список найденных описаний с метаданными

    Example:
        >>> descriptions = extract_descriptions(chapter_text, 'location')
        >>> print(f"Найдено {len(descriptions)} описаний локаций")
    """
    pass
```

**Docstrings:** Обязателен Google style
- Все публичные функции должны иметь docstrings
- Включайте разделы Args, Returns, Raises, Example
- Описания должны быть четкими и краткими

**Организация кода:**
- Следуйте принципу единственной ответственности (SRP)
- Максимальный размер файла: ~500 строк
- Используйте пользовательские исключения из `app/core/exceptions.py`
- Используйте переиспользуемые зависимости из `app/core/dependencies.py`

### TypeScript (Frontend)

**Руководство по стилю:** ESLint + Prettier

**Безопасность типов:** Включен строгий режим
```typescript
/**
 * Компонент читалки книг с поддержкой изображений
 *
 * @param book - Объект книги для чтения
 * @param currentPage - Номер текущей страницы
 * @param onPageChange - Callback при смене страницы
 */
interface BookReaderProps {
  book: Book;
  currentPage: number;
  onPageChange: (page: number) => void;
}
```

**Компоненты:**
- Используйте функциональные компоненты с хуками
- Props должны быть типизированы с помощью интерфейсов
- Используйте React.memo для критичных по производительности компонентов
- Следуйте лучшим практикам React

### Миграции базы данных

**Соглашения Alembic:**
```bash
# Создание миграции
cd backend
alembic revision --autogenerate -m "descriptive_migration_name"

# Внимательно проверьте сгенерированную миграцию!
# При необходимости отредактируйте перед применением

# Применение миграции
alembic upgrade head
```

**Рекомендации по миграциям:**
- Всегда проверяйте автоматически сгенерированные миграции
- Используйте `op.batch_alter_table()` для совместимости с SQLite
- Включайте как `upgrade()`, так и `downgrade()`
- Тестируйте миграции на чистой базе данных
- Документируйте breaking changes

## Рекомендации по коммитам

### Формат сообщения коммита

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Типы

- **feat**: Новая функциональность
- **fix**: Исправление бага
- **docs**: Изменения в документации
- **style**: Изменения стиля кода (форматирование, без изменения логики)
- **refactor**: Рефакторинг кода
- **test**: Добавление или обновление тестов
- **chore**: Сборка, CI, зависимости, инструменты

### Примеры

**Хорошие коммиты:**
```bash
feat(parser): добавлен парсер EPUB файлов

- Реализован класс EpubParser с методом extract_content()
- Добавлена поддержка CSS стилей и изображений
- Добавлены unit тесты для всех публичных методов
- Обновлена документация: docs/components/backend/epub-parser.md

Closes #123

fix(reader): исправлена пагинация на мобильных устройствах

- Исправлено переполнение текста на экранах <768px
- Оптимизирован расчет высоты страницы для разных шрифтов
- Добавлены responsive тесты

Fixes #456

docs: обновлен план разработки и календарь

- Отмечены задачи парсера EPUB как выполненные
- Добавлены новые задачи для Phase 2
- Обновлены временные оценки

[skip ci]
```

**Плохие коммиты:**
```bash
# Слишком расплывчато
fix: исправление бага

# Нет контекста
обновление файлов

# Несколько несвязанных изменений
feat: добавлен парсер, исправлена auth, обновлена документация
```

### Правила для коммитов

- Коммиты должны быть атомарными (одно логическое изменение)
- Пишите четкие, описательные сообщения коммитов
- Ссылайтесь на issues когда применимо (`Closes #123`, `Fixes #456`)
- Используйте настоящее время ("добавить функцию", а не "добавлена функция")
- Начинайте subject с заглавной буквы
- Не ставьте точку в конце subject
- Отделяйте subject от body пустой строкой
- Переносите body на 72 символах

## Процесс Pull Request

### Перед отправкой

1. **Убедитесь, что все тесты проходят**
   ```bash
   # Запуск полного набора тестов
   cd backend && pytest -v --cov=app
   cd frontend && npm test && npm run test:e2e
   ```

2. **Проверьте качество кода**
   ```bash
   # Backend
   cd backend && ruff check . && black --check . && mypy app/ --strict

   # Frontend
   cd frontend && npm run lint && npm run type-check
   ```

3. **Обновите документацию**
   - Обновите соответствующие файлы документации
   - Добавьте docstrings к новым функциям
   - Обновите changelog при необходимости

4. **Проверьте прохождение pre-commit хуков**
   ```bash
   pre-commit run --all-files
   ```

### Шаблон PR

При создании PR включите:

```markdown
## Описание
Краткое описание изменений

## Тип изменения
- [ ] Исправление бага (non-breaking change, которое исправляет проблему)
- [ ] Новая функциональность (non-breaking change, которое добавляет функциональность)
- [ ] Breaking change (исправление или функция, которая приведет к тому, что существующая функциональность не будет работать как ожидается)
- [ ] Обновление документации

## Тестирование
- [ ] Backend тесты пройдены
- [ ] Frontend тесты пройдены
- [ ] E2E тесты пройдены
- [ ] Ручное тестирование завершено

## Документация
- [ ] Код включает docstrings
- [ ] README обновлен (если необходимо)
- [ ] API документация обновлена (если необходимо)
- [ ] Changelog обновлен

## Связанные Issues
Closes #<issue_number>

## Скриншоты (если применимо)
Добавьте скриншоты для изменений UI
```

### Процесс проверки

1. **Автоматические проверки**
   - CI/CD pipeline должен пройти
   - Все тесты должны пройти
   - Покрытие кода не должно уменьшаться
   - Проверка типов должна пройти

2. **Code Review**
   - Требуется минимум одобрение одного рецензента
   - Ответьте на все комментарии к ревью
   - Поддерживайте конструктивные обсуждения

3. **Слияние**
   - Squash коммитов для более чистой истории (опционально)
   - Удалите ветку после слияния
   - Отслеживайте CI/CD после слияния

## Требования к документации

**КРИТИЧЕСКИ ВАЖНО:** Каждое изменение кода ДОЛЖНО сопровождаться обновлением документации!

### Обязательные обновления документации

После реализации функциональности обновите:

1. **README.md** - Если добавляется новая функциональность
2. **docs/development/planning/development-plan.md** - Отметьте выполненные задачи
3. **docs/development/planning/development-calendar.md** - Зафиксируйте даты
4. **docs/development/changelog/2025.md** - Детальное описание изменений
5. **docs/development/status/current-status.md** - Текущее состояние проекта
6. **Документация кода** - Docstrings, комментарии, README модулей

### Стандарты документации

**Python Docstrings:**
```python
def function_name(param1: Type1, param2: Type2) -> ReturnType:
    """
    Краткое описание в одно предложение.

    Более детальное описание при необходимости.
    Может занимать несколько параграфов.

    Args:
        param1: Описание param1
        param2: Описание param2

    Returns:
        Описание возвращаемого значения

    Raises:
        ValueError: Когда выбрасывается
        HTTPException: Когда выбрасывается

    Example:
        >>> result = function_name("test", 42)
        >>> print(result)
        expected_output

    Note:
        Важные замечания об использовании
    """
```

**TypeScript JSDoc:**
```typescript
/**
 * Краткое описание компонента/функции
 *
 * @param {Type} paramName - Описание параметра
 * @returns {ReturnType} Описание возвращаемого значения
 *
 * @example
 * const result = functionName(param);
 *
 * @throws {Error} Когда выбрасывается ошибка
 */
```

Подробные рекомендации по документации см. в [CLAUDE.md](CLAUDE.md).

## Требования к тестированию

### Требования к покрытию тестами

- **Минимальное покрытие:** 70% в целом
- **Основные модули:** Требуется 100% покрытие
- **Новые функции:** Должны включать тесты
- **Исправления багов:** Должны включать регрессионные тесты

### Пирамида тестирования

1. **Unit тесты** (Backend)
   ```bash
   cd backend
   pytest tests/unit/ -v
   ```

2. **Интеграционные тесты** (Backend)
   ```bash
   cd backend
   pytest tests/integration/ -v
   ```

3. **Компонентные тесты** (Frontend)
   ```bash
   cd frontend
   npm test
   ```

4. **E2E тесты** (Full stack)
   ```bash
   cd frontend
   npm run test:e2e
   ```

### Написание тестов

**Backend (pytest):**
```python
import pytest
from app.services.book_parser import BookParser

def test_parse_epub_valid_file():
    """Тест парсинга валидного EPUB файла."""
    parser = BookParser()
    result = parser.parse_epub("tests/fixtures/sample.epub")

    assert result is not None
    assert len(result.chapters) > 0
    assert result.metadata["title"] == "Sample Book"

@pytest.mark.asyncio
async def test_async_function():
    """Тест асинхронной функции."""
    result = await some_async_function()
    assert result == expected_value
```

**Frontend (Vitest):**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookReader } from './BookReader';

describe('BookReader', () => {
  it('отображает контент книги', () => {
    const book = { title: 'Тестовая книга', content: 'Контент' };
    render(<BookReader book={book} />);
    expect(screen.getByText('Тестовая книга')).toBeInTheDocument();
  });
});
```

Подробные рекомендации по тестированию см. в [Руководстве по тестированию](docs/guides/testing/testing-guide.md).

## Сообщество

### Получение помощи

- **Документация:** Сначала проверьте [docs/](docs/)
- **Issues:** Поищите существующие issues перед созданием новых
- **Обсуждения:** Используйте GitHub Discussions для вопросов
- **Discord/Slack:** (Добавьте, если доступно)

### Сообщение об ошибках

Используйте шаблон отчета об ошибке:

```markdown
**Описание ошибки**
Четкое описание ошибки

**Как воспроизвести**
Шаги для воспроизведения:
1. Перейдите в '...'
2. Нажмите на '...'
3. Увидите ошибку

**Ожидаемое поведение**
Что должно произойти

**Скриншоты**
Если применимо

**Окружение**
- ОС: [например macOS 14.0]
- Браузер: [например Chrome 120]
- Версия: [например 1.0.0]

**Дополнительный контекст**
Любая другая информация
```

### Запросы функциональности

Используйте шаблон запроса функциональности:

```markdown
**Описание функции**
Четкое описание функции

**Сценарий использования**
Зачем нужна эта функция?

**Предлагаемое решение**
Как это должно работать?

**Рассмотренные альтернативы**
Другие рассмотренные подходы

**Дополнительный контекст**
Любая другая информация
```

## Краткая справка

### Часто используемые команды

```bash
# Разработка
docker-compose -f docker-compose.dev.yml up -d

# Тесты
cd backend && pytest -v --cov=app
cd frontend && npm test

# Линтинг
cd backend && ruff check . && black .
cd frontend && npm run lint

# Проверка типов
cd backend && mypy app/ --strict
cd frontend && npm run type-check

# Миграции базы данных
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "описание"

# Pre-commit хуки
pre-commit install
pre-commit run --all-files
```

### Структура файлов

```
fancai-vibe-hackathon/
├── frontend/           # React приложение
├── backend/            # FastAPI приложение
│   ├── app/
│   │   ├── core/      # Основные утилиты (config, db, exceptions, dependencies)
│   │   ├── models/    # SQLAlchemy модели
│   │   ├── routers/   # API роуты (модульные)
│   │   ├── services/  # Бизнес-логика (модульная)
│   │   └── schemas/   # Pydantic схемы
│   └── tests/         # Тесты
├── docs/              # Документация
│   ├── guides/        # Руководства и how-to guides
│   ├── reference/     # Техническая документация
│   ├── explanations/  # Концепции и архитектура
│   └── operations/    # Деплоймент и обслуживание
└── scripts/           # Вспомогательные скрипты
```

## Лицензия

Внося вклад, вы соглашаетесь, что ваш вклад будет лицензирован под той же лицензией, что и проект.

---

**Спасибо за ваш вклад в BookReader AI!**

По вопросам обращайтесь к [FAQ.md](FAQ.md) или создайте issue.

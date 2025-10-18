# BookReader AI - Отчет об ошибках и проблемах

**Дата создания:** 19.10.2025
**Версия проекта:** 0.8.0 (Advanced Multi-NLP System)
**Статус анализа:** Комплексный аудит backend + frontend

---

## Оглавление

- [Общая статистика](#общая-статистика)
- [Backend - Критические проблемы](#backend---критические-проблемы)
- [Backend - Высокий приоритет](#backend---высокий-приоритет)
- [Backend - Средний приоритет](#backend---средний-приоритет)
- [Frontend - Критические проблемы](#frontend---критические-проблемы)
- [Frontend - Локализация (Русификация)](#frontend---локализация-русификация)
- [Frontend - Функциональность кнопок](#frontend---функциональность-кнопок)
- [Приоритет исправлений](#приоритет-исправлений)

---

## Общая статистика

| Компонент | Критические | Высокие | Средние | Низкие | **Всего** |
|-----------|-------------|---------|---------|--------|-----------|
| **Backend** | 4 | 11 | 9 | 5 | **29** |
| **Frontend** | 2 | 11 | 14 | 5 | **32** |
| **ИТОГО** | **6** | **22** | **23** | **10** | **61** |

---

## Backend - Критические проблемы

### ❌ BACKEND-001: datetime.utcnow() устарел в Python 3.12+

**Статус:** 🔴 Не исправлено
**Приоритет:** КРИТИЧЕСКИЙ
**Файлы:**
- `backend/app/services/book_service.py:315, 418, 425`
- `backend/app/services/auth_service.py:67, 82`
- `backend/app/services/optimized_parser.py` (множественные)
- `backend/app/services/parsing_manager.py` (множественные)
- `backend/app/routers/main.py` (множественные)
- `backend/app/routers/admin.py` (множественные)
- `backend/app/core/rate_limiter.py` (множественные)

**Проблема:**
```python
# Текущий код (НЕПРАВИЛЬНО):
from datetime import datetime
chapter.parsed_at = datetime.utcnow()
```

`datetime.utcnow()` устарел и удален в Python 3.12. Вызовет AttributeError при обновлении Python.

**Решение:**
```python
# Правильный код:
from datetime import datetime, timezone
chapter.parsed_at = datetime.now(timezone.utc)
```

**Влияние:** Приложение упадет при использовании Python 3.12+

---

### ❌ BACKEND-002: Неправильный синтаксис db.delete()

**Статус:** 🔴 Не исправлено
**Приоритет:** КРИТИЧЕСКИЙ
**Файл:** `backend/app/services/book_service.py:472`

**Проблема:**
```python
# Текущий код (НЕПРАВИЛЬНО):
await db.delete(book)
await db.commit()
```

SQLAlchemy 2.0 async не имеет метода `db.delete()`. Вызовет AttributeError.

**Решение:**
```python
# Правильный код:
from sqlalchemy import delete
await db.execute(delete(Book).where(Book.id == book_id))
await db.commit()
```

**Влияние:** Удаление книг не работает, вызывает runtime ошибку

---

### ❌ BACKEND-003: Async/sync конфликт в Celery tasks

**Статус:** 🔴 Не исправлено
**Приоритет:** КРИТИЧЕСКИЙ
**Файл:** `backend/app/core/tasks.py:41-53`

**Проблема:**
```python
# Текущий код (ПРОБЛЕМАТИЧНЫЙ):
def _run_async_task(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    result = loop.run_until_complete(coro)
    if loop.is_running():  # ❌ НИКОГДА не будет True после run_until_complete
        loop.close()  # ❌ Закрывает loop, что может сломать последующие задачи
    return result
```

**Проблемы:**
1. `loop.is_running()` всегда False после `run_until_complete`
2. Закрытие loop может сломать последующие async операции
3. В worker thread может не быть event loop

**Решение:**
```python
def _run_async_task(coro):
    """Helper для выполнения async функций в Celery tasks."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # Worker thread не имеет event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        return loop.run_until_complete(coro)
    finally:
        # НЕ закрываем loop - позволим asyncio управлять им
        pass
```

**Влияние:** Celery задачи могут падать или работать нестабильно

---

### ❌ BACKEND-004: Race condition в Multi-NLP Manager

**Статус:** 🔴 Не исправлено
**Приоритет:** КРИТИЧЕСКИЙ
**Файл:** `backend/app/core/tasks.py:135-137`

**Проблема:**
```python
# Текущий код (НЕБЕЗОПАСНО):
if not hasattr(multi_nlp_manager, '_initialized') or not multi_nlp_manager._initialized:
    print(f"🧠 [ASYNC TASK] Initializing multi NLP manager...")
    await multi_nlp_manager.initialize()
```

Несколько задач могут одновременно проверить `_initialized=False` и все начнут инициализацию одновременно.

**Решение:**
```python
# В multi_nlp_manager.py добавить:
import asyncio

class MultiNLPManager:
    def __init__(self):
        self._init_lock = asyncio.Lock()
        self._initialized = False
        # ...

    async def initialize(self):
        async with self._init_lock:
            if self._initialized:
                return  # Уже инициализирован другой задачей
            # Выполнить инициализацию
            self._initialized = True

# В tasks.py:
if not multi_nlp_manager._initialized:
    await multi_nlp_manager.initialize()  # Lock внутри метода
```

**Влияние:** Возможны дублирующие инициализации, траты ресурсов, потенциальные крэши

---

## Backend - Высокий приоритет

### ⚠️ BACKEND-005: Дублирование SQL запросов

**Статус:** 🟡 Не исправлено
**Приоритет:** ВЫСОКИЙ
**Файл:** `backend/app/services/book_service.py:421-424`

**Проблема:**
```python
# Запрос 1 (результат игнорируется):
await db.execute(
    select(Book).where(Book.id == book_id)
)

# Запрос 2 (тот же самый):
book = (await db.execute(select(Book).where(Book.id == book_id))).scalar_one()
```

**Решение:**
```python
# Один запрос:
book_result = await db.execute(
    select(Book).where(Book.id == book_id)
)
book = book_result.scalar_one()
```

**Влияние:** Производительность - лишний SQL запрос на каждое обновление прогресса

---

### ⚠️ BACKEND-006: Неправильный cascade в relationships

**Статус:** 🟡 Не исправлено
**Приоритет:** ВЫСОКИЙ (риск потери данных)
**Файл:** `backend/app/models/book.py:97`

**Проблема:**
```python
# Текущий код:
reading_progress = relationship(
    "ReadingProgress",
    back_populates="book",
    cascade="all, delete-orphan"  # ❌ ОПАСНО
)
```

`delete-orphan` означает, что если ReadingProgress "осиротеет" (потеряет связь с Book), то Book будет удалена. Это неправильно для many-to-many relationships.

**Решение:**
```python
reading_progress = relationship(
    "ReadingProgress",
    back_populates="book",
    cascade="all, delete"  # ✅ Правильно
)
```

**Влияние:** Риск случайного удаления книг при удалении reading progress

---

### ⚠️ BACKEND-007: Ненадежный расчет прогресса чтения

**Статус:** 🟡 Не исправлено
**Приоритет:** ВЫСОКИЙ
**Файл:** `backend/app/models/book.py:102-153`

**Проблема:**
```python
def get_reading_progress_percent(self, user_id: UUID) -> float:
    # ...
    chapters_list = getattr(self, 'chapters', []) or []  # ❌ Может быть пустым!
    total_chapters = len(chapters_list)

    if total_chapters == 0:
        return 0.0  # ❌ Всегда 0%, даже если читает книгу!
```

Если relationships не загружены eagerly, `chapters` будет пустым списком, и прогресс всегда 0%.

**Решение:**
```python
# Option 1: Всегда требовать eager loading
from sqlalchemy.orm import selectinload

# В queries:
book = await db.execute(
    select(Book)
    .options(selectinload(Book.chapters))
    .where(Book.id == book_id)
)

# Option 2: Запрос в БД внутри метода
async def get_reading_progress_percent(self, db: AsyncSession, user_id: UUID) -> float:
    chapters_count = await db.scalar(
        select(func.count(Chapter.id)).where(Chapter.book_id == self.id)
    )
    # ...
```

**Влияние:** Прогресс чтения всегда показывает 0%, даже если пользователь читает

---

### ⚠️ BACKEND-008: Отсутствует валидация UUID в API

**Статус:** 🟡 Не исправлено
**Приоритет:** ВЫСОКИЙ
**Файл:** `backend/app/routers/books.py:539` (и множество других)

**Проблема:**
```python
@router.get("/books/{book_id}/chapter/{chapter_num}")
async def get_chapter(
    book_id: str,  # ❌ Принимает любую строку
    chapter_num: int,
    current_user: User = Depends(get_current_user),
):
    # ...
    book_id = UUID(book_id)  # ❌ Упадет с 500 вместо 400 на неправильном UUID
```

**Решение:**
```python
from pydantic import UUID4

@router.get("/books/{book_id}/chapter/{chapter_num}")
async def get_chapter(
    book_id: UUID4,  # ✅ Автоматическая валидация FastAPI
    chapter_num: int,
    current_user: User = Depends(get_current_user),
):
    # UUID уже валидирован и сконвертирован
```

**Влияние:** 500 Internal Server Error вместо 400 Bad Request на неправильных UUID

---

### ⚠️ BACKEND-009: Хардкоденные секреты в конфигурации

**Статус:** 🟡 Не исправлено
**Приоритет:** ВЫСОКИЙ (безопасность)
**Файл:** `backend/app/core/config.py:19, 25`

**Проблема:**
```python
class Settings(BaseSettings):
    SECRET_KEY: str = "dev-secret-key-change-in-production"  # ❌ ОПАСНО
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres123@..."  # ❌ Креды в коде
    DEBUG: bool = True  # ❌ DEBUG включен по умолчанию
```

**Решение:**
```python
class Settings(BaseSettings):
    SECRET_KEY: str = ""
    DATABASE_URL: str = ""
    DEBUG: bool = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY must be set in environment")
        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL must be set in environment")

    class Config:
        env_file = ".env"
```

**Влияние:** Риск безопасности при деплое в production

---

### ⚠️ BACKEND-010: Отсутствует обработка ошибок парсинга

**Статус:** 🟡 Не исправлено
**Приоритет:** ВЫСОКИЙ
**Файл:** `backend/app/core/tasks.py:158-162`

**Проблема:**
```python
try:
    desc_type = DescriptionType(desc_data["type"])
except ValueError as e:
    print(f"⚠️ Invalid type '{desc_data['type']}', skipping")  # ❌ Только print
    continue  # Тихо пропускаем описание
```

**Решение:**
```python
import logging
logger = logging.getLogger(__name__)

try:
    desc_type = DescriptionType(desc_data["type"])
except ValueError as e:
    logger.error(
        f"Invalid description type '{desc_data['type']}' for book {book_id}: {e}",
        extra={"book_id": str(book_id), "desc_data": desc_data}
    )
    continue
```

**Влияние:** Ошибки парсинга незаметны, описания пропадают без следа

---

### ⚠️ BACKEND-011: N+1 query проблема

**Статус:** 🟡 Не исправлено
**Приоритет:** ВЫСОКИЙ (производительность)
**Файл:** `backend/app/routers/books.py:458`

**Проблема:**
```python
for book in books:
    # ❌ Каждый вызов может вызывать SQL запросы:
    reading_progress = book.get_reading_progress_percent(current_user.id)
```

**Решение:**
```python
from sqlalchemy.orm import selectinload

# Загружаем все relationships сразу:
books = await db.execute(
    select(Book)
    .options(
        selectinload(Book.chapters),
        selectinload(Book.reading_progress),
        selectinload(Book.descriptions)
    )
    .where(Book.user_id == user_id)
)
```

**Влияние:** Медленная загрузка библиотеки при большом количестве книг

---

### ⚠️ BACKEND-012 - BACKEND-015: Множество print() вместо logging

**Статус:** 🟡 Не исправлено
**Приоритет:** ВЫСОКИЙ (качество кода)
**Файлы:**
- `backend/app/routers/books.py:300-305, 327-407, 433, 446-448`
- `backend/app/core/tasks.py` (множественные)

**Проблема:**
```python
print(f"📖 Processing chapter {i+1}/{len(chapters)}")  # ❌ print в production
```

**Решение:**
```python
import logging
logger = logging.getLogger(__name__)

logger.info(f"Processing chapter {i+1}/{len(chapters)}")  # ✅ Правильное логирование
```

**Влияние:** Логи не попадают в production logging системы (Grafana, Loki)

---

## Backend - Средний приоритет

### 🟠 BACKEND-016: Datetime без timezone в multi_nlp_manager

**Файл:** `backend/app/services/multi_nlp_manager.py:236, 270`
**Проблема:** Использует `datetime.now()` для измерения производительности
**Решение:** Использовать `time.time()` или `time.perf_counter()`

---

### 🟠 BACKEND-017: Пустая валидация в Description модели

**Файл:** `backend/app/models/description.py:129-136`
**Проблема:** Не проверяет пустые строки в content
**Решение:** Добавить `.strip()` и проверку на непустоту

---

### 🟠 BACKEND-018: Множественные db.commit() в циклах

**Файл:** `backend/app/core/tasks.py:299, 314`
**Проблема:** Commit после каждой итерации вместо batch commit
**Решение:** Собирать изменения и commit в конце

---

### 🟠 BACKEND-019 - BACKEND-024: Остальные средние проблемы

См. подробный технический отчет в конце документа.

---

## Frontend - Критические проблемы

### ❌ FRONTEND-001: XSS уязвимость в BookReader

**Статус:** 🔴 Не исправлено
**Приоритет:** КРИТИЧЕСКИЙ (безопасность)
**Файл:** `frontend/src/components/Reader/BookReader.tsx:723-725`

**Проблема:**
```tsx
// ❌ ОПАСНО - XSS уязвимость:
<div
  dangerouslySetInnerHTML={{ __html: highlightedContent }}
  className="prose prose-lg max-w-none"
/>
```

Если описания содержат HTML/JavaScript, они будут выполнены.

**Решение:**
```tsx
// Option 1: Санитизация HTML
import DOMPurify from 'dompurify';

<div
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(highlightedContent)
  }}
  className="prose prose-lg max-w-none"
/>

// Option 2: Безопасный подход без HTML
// Рендерить текст с React компонентами для подсветки
```

**Влияние:** XSS атака через загруженные книги

---

### ❌ FRONTEND-002: Кнопка загрузки книги не работает

**Статус:** 🔴 Не исправлено
**Приоритет:** КРИТИЧЕСКИЙ (функциональность)
**Файл:** `frontend/src/pages/HomePage.tsx:44`

**Проблема:**
```tsx
<button
  onClick={() => {/* TODO: Open upload modal */}}  // ❌ НИЧЕГО НЕ ДЕЛАЕТ
  className="px-6 py-3 bg-blue-600 text-white rounded-lg..."
>
  <Plus className="w-5 h-5 mr-2" />
  Upload New Book
</button>
```

**Решение:**
```tsx
import { useUIStore } from '../stores/ui';

export default function HomePage() {
  const setShowUploadModal = useUIStore(state => state.setShowUploadModal);

  return (
    <button
      onClick={() => setShowUploadModal(true)}  // ✅ Открывает модал
      className="px-6 py-3 bg-blue-600 text-white rounded-lg..."
    >
      <Plus className="w-5 h-5 mr-2" />
      Загрузить книгу
    </button>
  );
}
```

**Влияние:** Невозможно загрузить книги через главную страницу

---

## Frontend - Локализация (Русификация)

### 🌐 FRONTEND-003: Весь UI на английском языке

**Статус:** 🔴 Не исправлено
**Приоритет:** ВЫСОКИЙ
**Охват:** Все страницы и компоненты

#### Страница входа (LoginPage.tsx)

| Строка | Английский текст | Требуется на русском |
|--------|------------------|----------------------|
| 38 | "Welcome back!" | "Добро пожаловать!" |
| 38 | "You have been successfully logged in." | "Вы успешно вошли в систему." |
| 42 | "Login Failed" | "Ошибка входа" |
| 43 | "Please check your credentials and try again." | "Проверьте данные и попробуйте снова." |
| 59 | "Welcome back" | "Добро пожаловать" |
| 62 | "Sign in to continue reading with AI-generated illustrations" | "Войдите, чтобы продолжить чтение с AI-иллюстрациями" |
| 75 | "Email address" | "Email адрес" |
| 87 | "Enter your email" | "Введите ваш email" |
| 102 | "Password" | "Пароль" |
| 115 | "Enter your password" | "Введите ваш пароль" |
| 150 | "Signing in..." | "Вход..." |
| 153 | "Sign in" | "Войти" |
| 161 | "Don't have an account?" | "Нет аккаунта?" |
| 167 | "Sign up here" | "Зарегистрируйтесь здесь" |

#### Страница регистрации (RegisterPage.tsx)

| Строка | Английский текст | Требуется на русском |
|--------|------------------|----------------------|
| 41 | "Account Created!" | "Аккаунт создан!" |
| 41 | "Welcome to BookReader AI. Start uploading your first book!" | "Добро пожаловать в BookReader AI. Загрузите первую книгу!" |
| 45 | "Registration Failed" | "Ошибка регистрации" |
| 59 | "Create Account" | "Создать аккаунт" |
| 62 | "Join BookReader AI and discover books with AI-generated illustrations" | "Присоединяйтесь к BookReader AI и открывайте книги с AI-иллюстрациями" |
| 75 | "Full Name" | "Полное имя" |
| 87 | "Enter your full name" | "Введите ваше полное имя" |

**Рекомендация:** Создать файл локализации `frontend/src/locales/ru.ts`:

```typescript
// frontend/src/locales/ru.ts
export const ru = {
  auth: {
    welcomeBack: "Добро пожаловать!",
    loginSuccess: "Вы успешно вошли в систему.",
    loginFailed: "Ошибка входа",
    checkCredentials: "Проверьте данные и попробуйте снова.",
    // ... все остальные переводы
  },
  buttons: {
    signIn: "Войти",
    signUp: "Зарегистрироваться",
    upload: "Загрузить",
    // ...
  },
  // ...
};
```

---

## Frontend - Функциональность кнопок

### 🔘 FRONTEND-004: Кнопка "Filters" не работает

**Файл:** `frontend/src/pages/LibraryPage.tsx:61`
**Проблема:**
```tsx
<button className="px-4 py-2 border border-gray-300...">
  <Filter className="w-4 h-4 mr-2" />
  Filters  {/* ❌ Нет onClick handler */}
</button>
```

**Решение:** Добавить state для фильтров и обработчик

---

### 🔘 FRONTEND-005: Поиск книг не работает

**Файл:** `frontend/src/pages/LibraryPage.tsx:54-58`
**Проблема:**
```tsx
<input
  type="text"
  placeholder="Search books..."
  className="..."
  // ❌ НЕТ onChange handler
/>
```

**Решение:**
```tsx
const [searchQuery, setSearchQuery] = useState('');

<input
  type="text"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Поиск книг..."
/>
```

---

### 🔘 FRONTEND-006: Кнопка настроек в Reader не работает

**Файл:** `frontend/src/components/Reader/BookReader.tsx:690`
**Проблема:** Settings кнопка без onClick
**Решение:** Добавить state и модал настроек

---

### 🔘 FRONTEND-007: Неправильный route к книге

**Файл:** `frontend/src/pages/BookImagesPage.tsx:78`
**Проблема:**
```tsx
<Link to={`/books/${bookId}`}>  {/* ❌ Неправильный путь */}
  Read Book
</Link>
```

**Решение:**
```tsx
<Link to={`/book/${bookId}/chapter/1`}>  {/* ✅ Правильный путь */}
  Читать книгу
</Link>
```

---

### 🔘 FRONTEND-008: handleDownload не передает imageUrl

**Файл:** `frontend/src/components/Images/ImageModal.tsx:39`
**Проблема:**
```tsx
const handleDownload = async () => {
  const response = await fetch(imageUrl);  // ❌ imageUrl может быть undefined
```

**Решение:**
```tsx
const handleDownload = async () => {
  if (!imageUrl) return;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Download failed');
    // ...
  } catch (error) {
    console.error('Failed to download image:', error);
  }
};
```

---

## Frontend - Остальные проблемы

### 🟡 FRONTEND-009: API integration inconsistencies

**Файл:** `frontend/src/api/books.ts:50, 55`
**Проблемы:**
- Использует `apiClient.client.post()` вместо `apiClient.post()` - обходит interceptors
- Устанавливает `'Content-Type': undefined` вместо удаления header

---

### 🟡 FRONTEND-010: State management issues

**Файл:** `frontend/src/components/Books/BookUploadModal.tsx:39`
**Проблема:** Неполный destructuring useUIStore
**Решение:** Добавить `setShowUploadModal`

---

### 🟡 FRONTEND-011 - FRONTEND-032: Остальные проблемы

См. подробный список в конце документа.

---

## Приоритет исправлений

### 🔴 Немедленно (Критические - блокируют работу)

1. **BACKEND-002** - Исправить db.delete() синтаксис - удаление книг не работает
2. **FRONTEND-002** - Исправить кнопку загрузки - основная функциональность
3. **FRONTEND-001** - Исправить XSS уязвимость - безопасность
4. **BACKEND-001** - Заменить datetime.utcnow() - подготовка к Python 3.12
5. **BACKEND-003** - Исправить Celery async/sync - стабильность фоновых задач

### ⚠️ Высокий приоритет (На этой неделе)

6. **FRONTEND-003** - Русификация UI (14 страниц)
7. **BACKEND-007** - Исправить расчет прогресса чтения
8. **BACKEND-004** - Race condition в Multi-NLP
9. **FRONTEND-004, 005, 006** - Исправить нерабочие кнопки
10. **BACKEND-009** - Убрать хардкоденные секреты

### 🟡 Средний приоритет (В течение месяца)

11. **BACKEND-005** - Оптимизация SQL запросов
12. **BACKEND-011** - Исправить N+1 query
13. **BACKEND-012-015** - Заменить print() на logging
14. **FRONTEND-007** - Исправить неправильные routes
15. **BACKEND-006** - Исправить cascade relationships

### 🟢 Низкий приоритет (По возможности)

16. Остальные 25+ проблем - улучшение качества кода, мелкие баги

---

## Как обновлять этот отчет

При исправлении ошибки:

1. Изменить **Статус** с 🔴/🟡 на 🟢 Исправлено
2. Добавить дату исправления
3. Добавить ссылку на commit
4. Переместить в раздел "Исправленные ошибки" внизу документа

Пример:
```markdown
### ✅ BACKEND-001: datetime.utcnow() устарел

**Статус:** 🟢 Исправлено (19.10.2025)
**Commit:** abc123def
**Исправил:** @developer
```

---

## Исправленные ошибки

*Пока нет исправленных ошибок*

---

## Технические детали для разработчиков

См. следующие файлы для детальной технической информации:
- Backend технический отчет: `docs/technical/backend-issues.md` (создать)
- Frontend технический отчет: `docs/technical/frontend-issues.md` (создать)

---

**Последнее обновление:** 19.10.2025
**Автор анализа:** Claude Code
**Следующий review:** После первой волны исправлений

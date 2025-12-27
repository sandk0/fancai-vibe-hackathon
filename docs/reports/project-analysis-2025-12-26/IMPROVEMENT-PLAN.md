# План Доработок BookReader AI

**Дата создания:** 26 декабря 2025
**Основан на:** Комплексном анализе проекта (6 агентов)
**Общая оценка усилий:** 760-1,070 часов

---

## Принципы Приоритизации

### Матрица Приоритетов

```
                    ВЛИЯНИЕ
                Низкое    Высокое
           ┌──────────┬──────────┐
    Низкая │    P4    │    P2    │
  УСИЛИЯ   ├──────────┼──────────┤
   Высокая │    P3    │    P1    │
           └──────────┴──────────┘
```

### Критерии Очередности

1. **Безопасность** > Всё остальное (компрометация = потеря бизнеса)
2. **Блокирующие проблемы** > Улучшения (sync I/O может крашить production)
3. **Архитектура** > Тесты (сначала сделать код тестируемым)
4. **Логирование** > Тесты (нужно для отладки тестов)
5. **Критичные сервисы** > Вспомогательные (LLM/Imagen = core business)

---

## Обзор Фаз

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TIMELINE                                     │
├─────────┬─────────┬─────────────────┬───────────────────────────────┤
│ ФАЗА 0  │ ФАЗА 1  │     ФАЗА 2      │           ФАЗА 3              │
│ 1-2 дня │ 1 неделя│    1 месяц      │         2-3 месяца            │
│         │         │                 │                               │
│ HOTFIX  │ SECURITY│   FOUNDATION    │        COMPREHENSIVE          │
│         │         │                 │                               │
│ Секреты │ JWT     │ Архитектура     │ Тестирование                  │
│         │ IDOR    │ Логирование     │ Оптимизация                   │
│         │         │ Async I/O       │ Документация                  │
└─────────┴─────────┴─────────────────┴───────────────────────────────┘
```

---

## ФАЗА 0: HOTFIX (1-2 дня)

### Цель
Устранить критические уязвимости безопасности, которые могут привести к немедленной компрометации системы.

### Задачи

#### 0.1 Ротация всех скомпрометированных секретов
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🔴 P0 - КРИТИЧЕСКИЙ |
| **Усилия** | 2-4 часа |
| **Зависимости** | Нет |
| **Блокирует** | Всё остальное |

**Действия:**
```bash
# 1. Сгенерировать новые секреты
openssl rand -hex 32  # SECRET_KEY
openssl rand -hex 32  # JWT_SECRET_KEY
openssl rand -hex 16  # DB_PASSWORD
openssl rand -hex 16  # REDIS_PASSWORD

# 2. Обновить на production сервере
ssh production "vim /app/.env"

# 3. Перезапустить сервисы
ssh production "docker-compose restart"

# 4. Создать новый Google API Key
# https://console.cloud.google.com/apis/credentials

# 5. Обновить ADMIN_PASSWORD, GRAFANA_ADMIN_PASSWORD
```

**Чеклист:**
- [ ] SECRET_KEY ротирован
- [ ] JWT_SECRET_KEY ротирован
- [ ] DB_PASSWORD ротирован
- [ ] REDIS_PASSWORD ротирован
- [ ] GOOGLE_API_KEY (Gemini) ротирован
- [ ] ADMIN_PASSWORD ротирован
- [ ] GRAFANA_ADMIN_PASSWORD ротирован
- [ ] Все сервисы перезапущены и работают

---

#### 0.2 Удаление секретов из git истории
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🔴 P0 - КРИТИЧЕСКИЙ |
| **Усилия** | 2-4 часа |
| **Зависимости** | 0.1 |
| **Блокирует** | Нет |

**Действия:**
```bash
# 1. Установить git-filter-repo (более современный чем BFG)
pip install git-filter-repo

# 2. Создать backup репозитория
git clone --mirror https://github.com/user/repo.git repo-backup.git

# 3. Удалить файлы из истории
git filter-repo --path .env --invert-paths
git filter-repo --path backend/.env.production --invert-paths
git filter-repo --path backend/.env.example --invert-paths

# 4. Force push (ОПАСНО - координировать с командой!)
git push origin --force --all
git push origin --force --tags

# 5. Уведомить всех разработчиков о re-clone
```

**Чеклист:**
- [ ] Backup репозитория создан
- [ ] .env удалён из истории
- [ ] backend/.env.production удалён из истории
- [ ] Force push выполнен
- [ ] Все разработчики уведомлены
- [ ] Проверено, что файлы не восстанавливаются при checkout старых коммитов

---

#### 0.3 Обновление .gitignore
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🔴 P0 - КРИТИЧЕСКИЙ |
| **Усилия** | 15 минут |
| **Зависимости** | 0.2 |
| **Блокирует** | Нет |

**Файл:** `.gitignore`
```gitignore
# Environment files (NEVER commit!)
.env
.env.*
!.env.example
*.env

# Secrets
secrets/
credentials/
*.pem
*.key

# Backup files
*.bak
*.backup
*.old
```

**Чеклист:**
- [ ] .gitignore обновлён
- [ ] Проверено git status - нет .env файлов

---

### Результат Фазы 0
- ✅ Все секреты ротированы
- ✅ История git очищена
- ✅ Защита от повторной утечки

---

## ФАЗА 1: SECURITY (1 неделя)

### Цель
Устранить все критические и высокие уязвимости безопасности.

### Задачи

#### 1.1 Реализация JWT Token Blacklist
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🔴 P1 - КРИТИЧЕСКИЙ |
| **Усилия** | 8-12 часов |
| **Зависимости** | Фаза 0 |
| **Блокирует** | Нет |
| **Файлы** | `backend/app/services/auth_service.py`, `backend/app/core/auth.py` |

**Реализация:**

```python
# backend/app/services/token_blacklist.py (НОВЫЙ ФАЙЛ)
"""
Redis-based JWT token blacklist for secure logout.
"""
from datetime import datetime, timezone
from typing import Optional
from redis.asyncio import Redis

from app.core.cache import cache_manager


class TokenBlacklist:
    """Manages blacklisted JWT tokens in Redis."""

    PREFIX = "token_blacklist:"

    async def add(self, token: str, expires_at: datetime) -> bool:
        """
        Add token to blacklist.

        Args:
            token: JWT token to blacklist
            expires_at: When the token naturally expires

        Returns:
            True if added successfully
        """
        # Calculate TTL (only keep until natural expiration)
        now = datetime.now(timezone.utc)
        ttl_seconds = int((expires_at - now).total_seconds())

        if ttl_seconds <= 0:
            return True  # Already expired, no need to blacklist

        key = f"{self.PREFIX}{token}"
        await cache_manager.set(key, "1", ttl=ttl_seconds)
        return True

    async def is_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted."""
        key = f"{self.PREFIX}{token}"
        result = await cache_manager.get(key)
        return result is not None

    async def remove(self, token: str) -> bool:
        """Remove token from blacklist (for testing)."""
        key = f"{self.PREFIX}{token}"
        await cache_manager.delete(key)
        return True


token_blacklist = TokenBlacklist()
```

```python
# backend/app/core/auth.py - ИЗМЕНЕНИЯ
from app.services.token_blacklist import token_blacklist

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_database_session),
) -> User:
    token = credentials.credentials

    # CHECK BLACKLIST FIRST
    if await token_blacklist.is_blacklisted(token):
        raise HTTPException(
            status_code=401,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ... rest of validation
```

```python
# backend/app/routers/auth.py - ИЗМЕНЕНИЯ
from app.services.token_blacklist import token_blacklist

@router.post("/auth/logout", response_model=LogoutResponse)
async def logout_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> LogoutResponse:
    token = credentials.credentials

    # Decode token to get expiration
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

        # Add to blacklist
        await token_blacklist.add(token, exp)

    except JWTError:
        pass  # Token invalid anyway, no need to blacklist

    return LogoutResponse(message="Successfully logged out")
```

**Тесты:**
```python
# backend/tests/test_token_blacklist.py
import pytest
from app.services.token_blacklist import token_blacklist

class TestTokenBlacklist:
    @pytest.mark.asyncio
    async def test_add_and_check_blacklisted(self):
        token = "test_token_123"
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        await token_blacklist.add(token, expires_at)

        assert await token_blacklist.is_blacklisted(token) is True

    @pytest.mark.asyncio
    async def test_not_blacklisted(self):
        assert await token_blacklist.is_blacklisted("unknown_token") is False

    @pytest.mark.asyncio
    async def test_logout_invalidates_token(self, client, authenticated_user):
        # Login
        response = await client.post("/api/v1/auth/login", ...)
        token = response.json()["access_token"]

        # Logout
        await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {token}"}
        )

        # Try to use token
        response = await client.get(
            "/api/v1/books",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 401
        assert "revoked" in response.json()["detail"]
```

**Чеклист:**
- [ ] TokenBlacklist сервис создан
- [ ] get_current_user проверяет blacklist
- [ ] /auth/logout добавляет токен в blacklist
- [ ] Тесты написаны и проходят
- [ ] Документация обновлена

---

#### 1.2 Уменьшение срока жизни Access Token
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P1 - ВЫСОКИЙ |
| **Усилия** | 2 часа |
| **Зависимости** | 1.1 |
| **Блокирует** | Нет |
| **Файлы** | `backend/app/core/config.py`, `frontend/src/api/auth.ts` |

**Backend изменения:**
```python
# backend/app/core/config.py
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Было 720 (12 часов)
REFRESH_TOKEN_EXPIRE_DAYS: int = 7     # Добавить refresh token
```

**Frontend изменения:**
```typescript
// frontend/src/api/auth.ts
// Добавить автоматическое обновление токена

let refreshPromise: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
  // Предотвращаем параллельные refresh запросы
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const { access_token } = await response.json();
      localStorage.setItem('access_token', access_token);
      return access_token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Interceptor для автоматического refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(error.config);
    }
    return Promise.reject(error);
  }
);
```

**Чеклист:**
- [ ] ACCESS_TOKEN_EXPIRE_MINUTES = 30
- [ ] Refresh token endpoint создан
- [ ] Frontend interceptor добавлен
- [ ] Тестирование token refresh flow

---

#### 1.3 Исправление IDOR уязвимостей
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P1 - ВЫСОКИЙ |
| **Усилия** | 4 часа |
| **Зависимости** | Нет |
| **Блокирует** | Нет |
| **Файлы** | `backend/app/routers/books/crud.py`, `backend/app/routers/images.py` |

**Исправление /books/{book_id}/cover:**
```python
# backend/app/routers/books/crud.py

# БЫЛО:
@router.get("/{book_id}/cover")
async def get_book_cover(
    book: Book = Depends(get_any_book),  # НЕ проверяет владельца!
):

# СТАЛО:
@router.get("/{book_id}/cover")
async def get_book_cover(
    book: Book = Depends(get_user_book),  # Проверяет владельца
    current_user: User = Depends(get_current_active_user),
):
```

**Исправление /images/file/{filename}:**
```python
# backend/app/routers/images.py

# Вариант 1: Добавить аутентификацию
@router.get("/images/file/{filename}")
async def get_generated_image_file(
    filename: str,
    current_user: User = Depends(get_current_active_user),  # Добавить
    db: AsyncSession = Depends(get_database_session),
):
    # Проверить, что изображение принадлежит книге пользователя
    image = await db.execute(
        select(GeneratedImage)
        .join(Description)
        .join(Chapter)
        .join(Book)
        .where(
            GeneratedImage.image_url.contains(filename),
            Book.user_id == current_user.id
        )
    )
    if not image.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Image not found")

    # ... return file

# Вариант 2: Signed URLs (лучше для производительности)
@router.get("/images/file/{filename}")
async def get_generated_image_file(
    filename: str,
    signature: str = Query(...),  # Подпись URL
    expires: int = Query(...),    # Время истечения
):
    # Проверить подпись
    expected_sig = hmac.new(
        settings.IMAGE_URL_SECRET.encode(),
        f"{filename}:{expires}".encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(status_code=403, detail="Invalid signature")

    if time.time() > expires:
        raise HTTPException(status_code=403, detail="URL expired")

    # ... return file
```

**Чеклист:**
- [ ] /books/{book_id}/cover использует get_user_book
- [ ] /images/file/{filename} защищён (выбрать вариант)
- [ ] Тесты для проверки доступа

---

#### 1.4 Аудит и исправление других endpoints
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P1 - ВЫСОКИЙ |
| **Усилия** | 4 часа |
| **Зависимости** | 1.3 |
| **Блокирует** | Нет |

**Проверить все endpoints:**
```bash
# Найти все endpoints без проверки владельца
grep -r "get_any_book\|get_any_chapter\|get_any_image" backend/app/routers/
```

**Чеклист endpoints:**
- [ ] GET /books/{id} - проверяет владельца
- [ ] GET /books/{id}/chapters - проверяет владельца
- [ ] GET /chapters/{id} - проверяет владельца
- [ ] GET /descriptions/{chapter_id} - проверяет владельца
- [ ] POST /images/generate/{desc_id} - проверяет владельца
- [ ] GET /reading-sessions/* - проверяет владельца

---

### Результат Фазы 1
- ✅ JWT logout работает корректно
- ✅ Токены живут 30 минут вместо 12 часов
- ✅ Все IDOR уязвимости устранены
- ✅ Безопасность: 6.0 → 8.0/10

---

## ФАЗА 2: FOUNDATION (1 месяц)

### Цель
Создать прочную основу для дальнейшего развития: исправить архитектурные проблемы, добавить логирование, сделать код тестируемым.

### Спринт 2.1: Логирование (3-5 дней)

#### 2.1.1 Замена print() на structured logging
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P2 - ВЫСОКИЙ |
| **Усилия** | 16-24 часа |
| **Зависимости** | Фаза 1 |
| **Блокирует** | Тестирование (нужно для отладки) |
| **Файлы** | Весь backend (453 вызова print) |

**Установка:**
```bash
pip install loguru
```

**Конфигурация:**
```python
# backend/app/core/logging.py (НОВЫЙ ФАЙЛ)
"""
Structured logging configuration using loguru.
"""
import sys
from loguru import logger
from app.core.config import settings


def setup_logging():
    """Configure application logging."""

    # Remove default handler
    logger.remove()

    # Console output (development)
    if settings.DEBUG:
        logger.add(
            sys.stderr,
            format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            level="DEBUG",
            colorize=True,
        )
    else:
        # JSON output (production)
        logger.add(
            sys.stderr,
            format="{message}",
            level="INFO",
            serialize=True,  # JSON format
        )

    # File rotation (production)
    if not settings.DEBUG:
        logger.add(
            "/var/log/bookreader/app.log",
            rotation="100 MB",
            retention="7 days",
            compression="gz",
            level="INFO",
            serialize=True,
        )

        # Error file
        logger.add(
            "/var/log/bookreader/error.log",
            rotation="50 MB",
            retention="30 days",
            level="ERROR",
            serialize=True,
        )

    return logger


# Export configured logger
app_logger = setup_logging()
```

**Миграция print → logger:**
```python
# БЫЛО:
print(f"[UPLOAD] Request received from user: {current_user.email}")
print(f"[ERROR] Failed to parse book: {e}")

# СТАЛО:
from app.core.logging import app_logger as logger

logger.info("Upload request received", user_email=current_user.email, book_title=title)
logger.error("Failed to parse book", book_id=str(book_id), error=str(e), exc_info=True)
```

**Скрипт автоматической замены:**
```python
# scripts/migrate_print_to_logger.py
import re
import os

def migrate_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Add import if not present
    if 'from app.core.logging import' not in content:
        # Add after other imports
        content = re.sub(
            r'(from app\.[^\n]+\n)(?!from app\.core\.logging)',
            r'\1from app.core.logging import app_logger as logger\n',
            content,
            count=1
        )

    # Replace print statements
    patterns = [
        (r'print\(f"\[(\w+)\] ([^"]+)"\)', r'logger.info("\2", context="\1")'),
        (r'print\(f"(\w+): \{([^}]+)\}"\)', r'logger.info("\1", \2=\2)'),
        (r'print\(f"([^"]+)"\)', r'logger.debug("\1")'),
    ]

    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)

    with open(filepath, 'w') as f:
        f.write(content)

# Run on all Python files
for root, dirs, files in os.walk('backend/app'):
    for file in files:
        if file.endswith('.py'):
            migrate_file(os.path.join(root, file))
```

**Чеклист:**
- [ ] loguru установлен
- [ ] logging.py создан с конфигурацией
- [ ] Все print() заменены на logger.*
- [ ] Проверено в dev и production режимах
- [ ] Log rotation работает

---

#### 2.1.2 Замена console.log на условное логирование (Frontend)
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟡 P3 - СРЕДНИЙ |
| **Усилия** | 8 часов |
| **Зависимости** | Нет |
| **Блокирует** | Нет |
| **Файлы** | Весь frontend (281 вызов) |

**Создание logger:**
```typescript
// frontend/src/utils/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env.DEV;

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export const logger: Logger = {
  debug: (...args) => isDev && console.debug('[DEBUG]', ...args),
  info: (...args) => isDev && console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),  // Always show warnings
  error: (...args) => console.error('[ERROR]', ...args), // Always show errors
};

// Usage:
// import { logger } from '@/utils/logger';
// logger.debug('Loading book', { bookId });
// logger.error('Failed to load', error);
```

**Массовая замена:**
```bash
# Заменить console.log на logger.debug
find frontend/src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/console.log(/logger.debug(/g'

# Заменить console.warn на logger.warn
find frontend/src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/console.warn(/logger.warn(/g'

# Добавить импорт (вручную или скриптом)
```

**Чеклист:**
- [ ] logger.ts создан
- [ ] Все console.log заменены
- [ ] Проверено в production build (нет debug логов)

---

### Спринт 2.2: Async I/O (3-5 дней)

#### 2.2.1 Миграция на aiofiles
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🔴 P1 - КРИТИЧЕСКИЙ |
| **Усилия** | 8-12 часов |
| **Зависимости** | Нет |
| **Блокирует** | Производительность |
| **Файлы** | `backend/app/services/book/book_service.py`, `backend/app/services/book_parser.py` |

**Установка:**
```bash
pip install aiofiles
```

**Миграция:**
```python
# БЫЛО (blocking):
with open(cover_path, "wb") as f:
    f.write(image_data)

os.remove(file_path)
os.makedirs(dir_path)

# СТАЛО (non-blocking):
import aiofiles
import aiofiles.os

async with aiofiles.open(cover_path, "wb") as f:
    await f.write(image_data)

await aiofiles.os.remove(file_path)
await aiofiles.os.makedirs(dir_path, exist_ok=True)
```

**Файлы для миграции:**
1. `backend/app/services/book/book_service.py`:
   - `_save_book_cover()` - запись обложки
   - `delete_book()` - удаление файла книги

2. `backend/app/services/book_parser.py`:
   - Все операции чтения/записи временных файлов

3. `backend/app/routers/books/crud.py`:
   - `upload_book()` - сохранение загруженного файла

**Чеклист:**
- [ ] aiofiles установлен
- [ ] book_service.py мигрирован
- [ ] book_parser.py мигрирован
- [ ] Тесты проходят
- [ ] Нет sync file I/O в async функциях (grep проверка)

---

### Спринт 2.3: Dependency Injection (5-7 дней)

#### 2.3.1 Рефакторинг глобальных синглтонов
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P2 - ВЫСОКИЙ |
| **Усилия** | 24-32 часа |
| **Зависимости** | 2.1 (логирование) |
| **Блокирует** | Тестирование (нужно для mock) |
| **Файлы** | Все сервисы (12 файлов) |

**Создание DI контейнера:**
```python
# backend/app/core/container.py (НОВЫЙ ФАЙЛ)
"""
Dependency injection container for services.
"""
from functools import lru_cache
from typing import Generator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_database_session
from app.services.auth_service import AuthService
from app.services.book.book_service import BookService
from app.services.book.book_progress_service import BookProgressService
from app.services.book.book_parsing_service import BookParsingService
from app.services.book_parser import BookParser
from app.services.gemini_extractor import GeminiExtractor
from app.services.imagen_generator import ImagenGenerator


# Service factories (cached per request)

@lru_cache()
def get_auth_service() -> AuthService:
    """Get AuthService instance."""
    return AuthService()


@lru_cache()
def get_book_service() -> BookService:
    """Get BookService instance."""
    return BookService()


@lru_cache()
def get_book_progress_service() -> BookProgressService:
    """Get BookProgressService instance."""
    return BookProgressService()


@lru_cache()
def get_book_parser() -> BookParser:
    """Get BookParser instance."""
    return BookParser()


def get_gemini_extractor() -> GeminiExtractor:
    """Get GeminiExtractor instance (not cached - has state)."""
    return GeminiExtractor()


def get_imagen_generator() -> ImagenGenerator:
    """Get ImagenGenerator instance (not cached - has state)."""
    return ImagenGenerator()
```

**Миграция роутеров:**
```python
# БЫЛО:
from app.services.book import book_service

@router.get("/books")
async def get_books(...):
    return await book_service.get_books(db, user_id)

# СТАЛО:
from app.core.container import get_book_service

@router.get("/books")
async def get_books(
    ...,
    book_service: BookService = Depends(get_book_service),
):
    return await book_service.get_books(db, user_id)
```

**Порядок миграции (по зависимостям):**
1. `auth_service.py` → нет зависимостей
2. `book_parser.py` → нет зависимостей
3. `book_service.py` → зависит от book_parser
4. `gemini_extractor.py` → нет зависимостей
5. `imagen_generator.py` → нет зависимостей
6. `image_generator.py` → зависит от imagen_generator
7. Остальные сервисы

**Чеклист:**
- [ ] container.py создан
- [ ] auth_service мигрирован
- [ ] book_service мигрирован
- [ ] Все роутеры обновлены
- [ ] Глобальные синглтоны удалены
- [ ] Тесты работают с mock

---

### Спринт 2.4: Рефакторинг моделей (3-5 дней)

#### 2.4.1 Вынос бизнес-логики из ORM моделей
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P2 - ВЫСОКИЙ |
| **Усилия** | 16-20 часов |
| **Зависимости** | 2.3 (DI) |
| **Блокирует** | Нет |
| **Файлы** | `backend/app/models/book.py`, `backend/app/models/chapter.py` |

**Book.get_user_progress → BookProgressService:**
```python
# БЫЛО (в модели):
class Book(Base):
    def get_user_progress(self, user_id: UUID) -> "ReadingProgress | None":
        for progress in self.reading_progress:
            if progress.user_id == user_id:
                return progress
        return None

# СТАЛО (в сервисе):
class BookProgressService:
    async def get_user_progress(
        self, db: AsyncSession, book_id: UUID, user_id: UUID
    ) -> ReadingProgress | None:
        result = await db.execute(
            select(ReadingProgress)
            .where(
                ReadingProgress.book_id == book_id,
                ReadingProgress.user_id == user_id
            )
        )
        return result.scalar_one_or_none()
```

**Book.calculate_progress_percent → BookProgressService:**
```python
# Перенести ~40 строк логики в BookProgressService.calculate_progress_percent()
```

**Chapter.check_is_service_page → ChapterClassificationService:**
```python
# backend/app/services/chapter_classification_service.py (НОВЫЙ ФАЙЛ)
class ChapterClassificationService:
    SERVICE_PAGE_KEYWORDS = ["содержание", "оглавление", ...]

    def is_service_page(self, chapter: Chapter) -> bool:
        # Логика проверки
        pass
```

**Чеклист:**
- [ ] get_user_progress перенесён в сервис
- [ ] calculate_progress_percent перенесён в сервис
- [ ] check_is_service_page перенесён в сервис
- [ ] Модели содержат только данные
- [ ] Все вызовы обновлены

---

### Спринт 2.5: База данных (3-5 дней)

#### 2.5.1 Исправление проблем БД
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟡 P2 - СРЕДНИЙ |
| **Усилия** | 8-12 часов |
| **Зависимости** | Нет |
| **Блокирует** | Нет |

**Миграция:**
```python
# alembic/versions/2025_12_27_fix_db_issues.py
"""Fix database issues from code review."""

def upgrade():
    # 1. Add unique constraint on reading_progress
    op.create_unique_constraint(
        'uq_reading_progress_user_book',
        'reading_progress',
        ['user_id', 'book_id']
    )

    # 2. Add unique constraint on chapters
    op.create_unique_constraint(
        'uq_chapters_book_number',
        'chapters',
        ['book_id', 'chapter_number']
    )

    # 3. Add cascade delete
    op.drop_constraint('books_user_id_fkey', 'books', type_='foreignkey')
    op.create_foreign_key(
        'books_user_id_fkey',
        'books', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )

    # 4. Convert entities_mentioned to JSONB
    op.alter_column(
        'descriptions',
        'entities_mentioned',
        type_=postgresql.JSONB,
        postgresql_using='entities_mentioned::jsonb'
    )

def downgrade():
    # Reverse operations
    pass
```

**Чеклист:**
- [ ] UniqueConstraint на reading_progress добавлен
- [ ] UniqueConstraint на chapters добавлен
- [ ] CASCADE DELETE на books.user_id
- [ ] entities_mentioned конвертирован в JSONB
- [ ] Миграция протестирована на staging

---

### Результат Фазы 2
- ✅ Structured logging везде
- ✅ Async I/O для файловых операций
- ✅ Dependency Injection вместо синглтонов
- ✅ Чистые ORM модели (только данные)
- ✅ БД constraints исправлены
- ✅ Код готов к тестированию

---

## ФАЗА 3: COMPREHENSIVE (2-3 месяца)

### Цель
Достичь production-ready качества: полное тестовое покрытие, оптимизация производительности, документация.

### Спринт 3.1: Критические тесты Backend (2-3 недели)

#### 3.1.1 Тесты для LLM сервисов
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🔴 P1 - КРИТИЧЕСКИЙ |
| **Усилия** | 60-80 часов |
| **Зависимости** | Фаза 2 (DI для mock) |
| **Блокирует** | Релиз новых LLM фич |

**Файлы тестов:**
1. `tests/services/test_gemini_extractor.py` (~800 строк, 50 тестов)
2. `tests/services/test_imagen_generator.py` (~900 строк, 60 тестов)
3. `tests/services/test_langextract_processor.py` (~600 строк, 40 тестов)
4. `tests/services/test_llm_description_enricher.py` (~500 строк, 35 тестов)

**Категории тестов:**
- Basic functionality (happy path)
- Error handling (API errors, timeouts, rate limits)
- Edge cases (empty input, malformed responses)
- Cost optimization (caching, token limits)
- Retry logic (exponential backoff)

**Пример структуры:**
```python
# tests/services/test_gemini_extractor.py
class TestGeminiExtractorBasic:
    """Базовый функционал."""
    async def test_extract_descriptions_success(self): ...
    async def test_extract_empty_text(self): ...
    async def test_extract_russian_text(self): ...

class TestGeminiExtractorErrors:
    """Обработка ошибок."""
    async def test_rate_limit_429(self): ...
    async def test_quota_exceeded_503(self): ...
    async def test_timeout_handling(self): ...
    async def test_malformed_json_response(self): ...

class TestGeminiExtractorRetry:
    """Retry логика."""
    async def test_retry_on_transient_error(self): ...
    async def test_exponential_backoff(self): ...
    async def test_max_retries_exceeded(self): ...

class TestGeminiExtractorCaching:
    """Кэширование."""
    async def test_cache_hit(self): ...
    async def test_cache_invalidation(self): ...

class TestGeminiExtractorTranslation:
    """Перевод RU→EN."""
    async def test_russian_to_english(self): ...
    async def test_preserves_meaning(self): ...
```

**Чеклист:**
- [ ] test_gemini_extractor.py: 50+ тестов
- [ ] test_imagen_generator.py: 60+ тестов
- [ ] test_langextract_processor.py: 40+ тестов
- [ ] test_llm_description_enricher.py: 35+ тестов
- [ ] Coverage LLM сервисов: 70%+

---

#### 3.1.2 Тесты для Cache сервисов
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P2 - ВЫСОКИЙ |
| **Усилия** | 20-30 часов |
| **Зависимости** | 3.1.1 |
| **Блокирует** | Нет |

**Файлы:**
1. `tests/services/test_reading_session_cache.py` (~500 строк)
2. `tests/services/test_settings_manager.py` (~400 строк)

---

### Спринт 3.2: Frontend тесты (2-3 недели)

#### 3.2.1 Тесты для Custom Hooks
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🔴 P1 - КРИТИЧЕСКИЙ |
| **Усилия** | 60-80 часов |
| **Зависимости** | Нет |
| **Блокирует** | Рефакторинг hooks |

**Приоритетные hooks (по критичности):**
1. `useDescriptionHighlighting.test.ts` (~400 строк, 25 тестов)
2. `useEpubLoader.test.ts` (~500 строк, 30 тестов)
3. `useCFITracking.test.ts` (~600 строк, 35 тестов)
4. `useChapterManagement.test.ts` (~400 строк, 25 тестов)
5. `useImageModal.test.ts` (~350 строк, 20 тестов)

**Категории тестов:**
- Rendering states (loading, error, success)
- User interactions (clicks, navigation)
- Edge cases (empty data, large data)
- Memory management (cleanup on unmount)
- Performance (debouncing, memoization)

---

#### 3.2.2 Тесты для компонентов
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P2 - ВЫСОКИЙ |
| **Усилия** | 40-50 часов |
| **Зависимости** | 3.2.1 |

**Компоненты:**
1. `ImageModal.test.tsx` (~300 строк)
2. `BookUploadModal.test.tsx` (~250 строк)
3. `ReaderControls.test.tsx` (~200 строк)
4. `Admin/*.test.tsx` (~500 строк total)

---

### Спринт 3.3: Integration тесты (2 недели)

#### 3.3.1 End-to-end тесты Backend
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟠 P2 - ВЫСОКИЙ |
| **Усилия** | 30-40 часов |

**Flows:**
1. Upload → Parse → Extract → Generate Image
2. Concurrent users reading same book
3. Offline → Online sync
4. Rate limiting validation

---

#### 3.3.2 E2E тесты Frontend
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟡 P3 - СРЕДНИЙ |
| **Усилия** | 20-30 часов |

**Использовать Playwright или Cypress:**
```typescript
// e2e/reading-flow.spec.ts
test('complete reading flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Upload book
  await page.click('text=Загрузить книгу');
  await page.setInputFiles('input[type="file"]', 'test-book.epub');
  await page.click('text=Загрузить');

  // Wait for parsing
  await expect(page.locator('text=Книга загружена')).toBeVisible({ timeout: 30000 });

  // Open and read
  await page.click('text=test-book');
  await expect(page.locator('[data-testid="epub-viewer"]')).toBeVisible();

  // Check highlights
  await expect(page.locator('.description-highlight')).toHaveCount({ min: 1 });
});
```

---

### Спринт 3.4: Оптимизация (1-2 недели)

#### 3.4.1 Frontend мемоизация
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟡 P3 - СРЕДНИЙ |
| **Усилия** | 8-12 часов |

**Компоненты для React.memo:**
- BookCard
- LibraryStats
- ChapterList
- DescriptionItem

**Функции для useMemo/useCallback:**
- getBackgroundColor в EpubReader
- Theme-related calculations
- Filter/sort functions

---

#### 3.4.2 Очистка мёртвого кода
| Параметр | Значение |
|----------|----------|
| **Приоритет** | 🟢 P4 - НИЗКИЙ |
| **Усилия** | 4-6 часов |

**Удалить:**
- 109 файлов .bak
- 5 файлов *Old.tsx
- Закомментированный код
- Устаревшие NLP конфиги

```bash
# Удалить .bak файлы
find frontend/src -name "*.bak" -delete

# Удалить *Old.tsx
rm frontend/src/pages/*Old.tsx
```

---

### Результат Фазы 3
- ✅ Backend coverage: 70%+
- ✅ Frontend coverage: 50%+
- ✅ E2E тесты для основных flows
- ✅ Оптимизированная производительность
- ✅ Чистый код без мёртвых участков

---

## Сводная Таблица Задач

### По Приоритету

| ID | Задача | Приоритет | Усилия | Фаза |
|----|--------|-----------|--------|------|
| 0.1 | Ротация секретов | 🔴 P0 | 2-4ч | 0 |
| 0.2 | Очистка git истории | 🔴 P0 | 2-4ч | 0 |
| 1.1 | JWT blacklist | 🔴 P1 | 8-12ч | 1 |
| 2.2.1 | Async I/O (aiofiles) | 🔴 P1 | 8-12ч | 2 |
| 3.1.1 | Тесты LLM сервисов | 🔴 P1 | 60-80ч | 3 |
| 3.2.1 | Тесты hooks | 🔴 P1 | 60-80ч | 3 |
| 1.2 | Уменьшить token TTL | 🟠 P1 | 2ч | 1 |
| 1.3 | Исправить IDOR | 🟠 P1 | 4ч | 1 |
| 2.1.1 | Logging (print→loguru) | 🟠 P2 | 16-24ч | 2 |
| 2.3.1 | Dependency Injection | 🟠 P2 | 24-32ч | 2 |
| 2.4.1 | Рефакторинг моделей | 🟠 P2 | 16-20ч | 2 |
| 3.1.2 | Тесты Cache | 🟠 P2 | 20-30ч | 3 |
| 3.2.2 | Тесты компонентов | 🟠 P2 | 40-50ч | 3 |
| 3.3.1 | Integration тесты | 🟠 P2 | 30-40ч | 3 |
| 2.1.2 | Frontend logging | 🟡 P3 | 8ч | 2 |
| 2.5.1 | БД constraints | 🟡 P3 | 8-12ч | 2 |
| 3.3.2 | E2E тесты | 🟡 P3 | 20-30ч | 3 |
| 3.4.1 | Мемоизация | 🟡 P3 | 8-12ч | 3 |
| 3.4.2 | Очистка кода | 🟢 P4 | 4-6ч | 3 |

### Диаграмма Зависимостей

```
ФАЗА 0: HOTFIX
┌─────────────────────┐
│ 0.1 Ротация секретов│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 0.2 Очистка git     │
└──────────┬──────────┘
           │
           ▼
ФАЗА 1: SECURITY
┌─────────────────────┐     ┌─────────────────────┐
│ 1.1 JWT blacklist   │────▶│ 1.2 Token TTL       │
└─────────────────────┘     └─────────────────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ 1.3 IDOR fix        │────▶│ 1.4 Audit endpoints │
└─────────────────────┘     └─────────────────────┘
           │
           ▼
ФАЗА 2: FOUNDATION
┌─────────────────────┐
│ 2.1.1 Logging       │
└──────────┬──────────┘
           │
           ├─────────────────────────┐
           ▼                         ▼
┌─────────────────────┐     ┌─────────────────────┐
│ 2.2.1 Async I/O     │     │ 2.1.2 Frontend log  │
└──────────┬──────────┘     └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│ 2.3.1 DI Container  │
└──────────┬──────────┘
           │
           ├─────────────────────────┐
           ▼                         ▼
┌─────────────────────┐     ┌─────────────────────┐
│ 2.4.1 Model refactor│     │ 2.5.1 DB constraints│
└──────────┬──────────┘     └─────────────────────┘
           │
           ▼
ФАЗА 3: COMPREHENSIVE
┌─────────────────────┐     ┌─────────────────────┐
│ 3.1.1 LLM tests     │     │ 3.2.1 Hooks tests   │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ 3.1.2 Cache tests   │     │ 3.2.2 Component test│
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
           ┌─────────────────────┐
           │ 3.3 Integration     │
           └──────────┬──────────┘
                      │
                      ▼
           ┌─────────────────────┐
           │ 3.4 Optimization    │
           └─────────────────────┘
```

---

## Метрики Успеха

### После Фазы 0 (1-2 дня)
- [ ] Все секреты ротированы
- [ ] .env файлы удалены из git истории
- [ ] Защита от повторной утечки

### После Фазы 1 (1 неделя)
- [ ] Безопасность: 6.0 → 8.0/10
- [ ] JWT logout работает
- [ ] IDOR уязвимости устранены

### После Фазы 2 (1 месяц)
- [ ] Нет sync I/O в async функциях
- [ ] Нет глобальных синглтонов
- [ ] Structured logging везде
- [ ] Код готов к тестированию

### После Фазы 3 (3 месяца)
- [ ] Backend coverage: 70%+
- [ ] Frontend coverage: 50%+
- [ ] E2E тесты: 10+ основных flows
- [ ] Общая оценка: 6.5 → 8.5/10

---

## Ресурсы

### Команда (рекомендуемая)
- 1 Senior Backend Developer (Python/FastAPI)
- 1 Senior Frontend Developer (React/TypeScript)
- 1 DevSecOps Engineer (часть времени)
- 1 QA Engineer

### Бюджет
| Фаза | Часы | Стоимость ($100/час) |
|------|------|----------------------|
| 0 | 4-8 | $400-800 |
| 1 | 20-30 | $2,000-3,000 |
| 2 | 80-120 | $8,000-12,000 |
| 3 | 250-350 | $25,000-35,000 |
| **Итого** | **354-508** | **$35,400-50,800** |

---

**Подготовлено:** Claude Opus 4.5
**Дата:** 26 декабря 2025
**Версия:** 1.0

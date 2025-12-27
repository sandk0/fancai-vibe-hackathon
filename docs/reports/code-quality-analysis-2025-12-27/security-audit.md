# Security Аудит: JWT, CORS, Уязвимости

**Дата:** 27 декабря 2025
**Оценка:** 7.5/10

---

## Резюме

Безопасность проекта на хорошем уровне: используется bcrypt, rate limiting, security headers. Однако есть проблемы с длинным TTL токенов, отсутствием JWT blacklist и слишком открытыми CORS настройками.

---

## Проблемы Средней Важности

### MEDIUM-001: Длинный TTL access token

**Файл:** `backend/app/core/config.py`

**Текущее значение:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 720  # 12 часов
```

**Проблема:** При компрометации токена злоумышленник имеет 12 часов доступа.

**Рекомендация:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30    # 30 минут
REFRESH_TOKEN_EXPIRE_DAYS: int = 7       # Оставить
```

---

### MEDIUM-002: Logout не инвалидирует токен

**Файл:** `frontend/src/stores/auth.ts`

**Текущее поведение:**
```typescript
logout: async () => {
  localStorage.removeItem('access_token');  // Только локально
  // Токен всё ещё валиден на сервере до истечения TTL!
}
```

**Решение (Redis blacklist):**
```python
# backend/app/services/auth_service.py
class AuthService:
    async def logout(self, token: str):
        # Добавить токен в Redis blacklist
        ttl = get_token_remaining_ttl(token)
        await redis.setex(f"blacklist:{token}", ttl, "1")

    async def verify_token(self, token: str):
        if await redis.get(f"blacklist:{token}"):
            raise HTTPException(401, "Token revoked")
        # ... остальная валидация
```

---

### MEDIUM-003: CORS allow_headers=["*"]

**Файл:** `backend/app/main.py`

**Текущая конфигурация:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_headers=["*"],  # Слишком открыто
)
```

**Рекомендация:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)
```

---

## Положительные Аспекты ✅

### 1. Password Hashing

```python
# Используется bcrypt
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
```

### 2. Rate Limiting

```python
# SlowAPI для защиты от брутфорса
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@limiter.limit("5/minute")
async def login():
    pass
```

### 3. Security Headers

```python
# В продакшене
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

### 4. Input Validation

```python
# Pydantic схемы для всех входных данных
class BookUpload(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    author: str = Field(..., min_length=1, max_length=100)
```

### 5. SQL Injection Protection

```python
# SQLAlchemy ORM предотвращает SQL injection
query = select(Book).where(Book.id == book_id)  # Параметризированный
```

---

## OWASP Top 10 Checklist

| Уязвимость | Статус | Комментарий |
|------------|--------|-------------|
| A01: Broken Access Control | ⚠️ | JWT blacklist отсутствует |
| A02: Cryptographic Failures | ✅ | bcrypt, HTTPS |
| A03: Injection | ✅ | SQLAlchemy ORM |
| A04: Insecure Design | ✅ | Separation of concerns |
| A05: Security Misconfiguration | ⚠️ | CORS allow_headers=* |
| A06: Vulnerable Components | ✅ | Зависимости актуальны |
| A07: Auth Failures | ⚠️ | Длинный TTL токена |
| A08: Data Integrity Failures | ✅ | HTTPS, JWT signed |
| A09: Logging Failures | ⚠️ | print() вместо logging |
| A10: SSRF | ✅ | URL валидация |

---

## Рекомендации по Исправлению

### Фаза 1: Важные (2-3 дня)

| Задача | Файлы | Часы |
|--------|-------|------|
| Уменьшить TTL access token до 30 мин | config.py | 1 |
| Реализовать JWT blacklist в Redis | auth_service.py | 8 |
| Ограничить CORS headers | main.py | 1 |

### Фаза 2: Рекомендуемые (3-5 дней)

| Задача | Файлы | Часы |
|--------|-------|------|
| Заменить print на structured logging | main.py, tasks.py | 8 |
| Добавить audit logging | auth_service.py | 8 |
| Content Security Policy headers | main.py | 4 |

---

## Файлы для Изменения

| Приоритет | Файл | Изменение |
|-----------|------|-----------|
| P1 | `app/core/config.py` | ACCESS_TOKEN_EXPIRE_MINUTES=30 |
| P1 | `app/services/auth_service.py` | JWT blacklist в Redis |
| P1 | `app/main.py` | Ограничить CORS headers |
| P2 | `app/main.py` | Structured logging |

---

## Инструменты для Аудита

```bash
# Проверка зависимостей на уязвимости
pip-audit

# Статический анализ безопасности
bandit -r app/

# OWASP ZAP для динамического тестирования
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:8000
```

---

*Анализ выполнен агентом Security Auditor (Claude Opus 4.5)*

# Анализ системы авторизации

**Дата:** 29 декабря 2025

---

## 1. Текущая конфигурация

**Файл:** `backend/app/core/config.py:41-44`

```python
# Безопасность (SEC-002: Token TTL reduced from 12h to 30min, 27 Dec 2025)
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # 30 minutes
REFRESH_TOKEN_EXPIRE_DAYS: int = 7     # 7 days
ALGORITHM: str = "HS256"
```

| Параметр | Текущее значение | Описание |
|----------|------------------|----------|
| ACCESS_TOKEN_EXPIRE_MINUTES | 30 минут | Время жизни access токена |
| REFRESH_TOKEN_EXPIRE_DAYS | 7 дней | Время жизни refresh токена |

---

## 2. Рекомендуемые изменения

### Вариант A: Минимальные изменения
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30   # Без изменений
REFRESH_TOKEN_EXPIRE_DAYS: int = 30     # 7 -> 30 дней
```

### Вариант B: Оптимальный баланс (рекомендуется)
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60   # 30 -> 60 минут
REFRESH_TOKEN_EXPIRE_DAYS: int = 30     # 7 -> 30 дней
```

---

## 3. Security Implications

### При увеличении REFRESH_TOKEN до 30 дней:

| Риск | Уровень | Митигация |
|------|---------|-----------|
| Persistent Access | Низкий | Access tokens короткоживущие |
| Token Storage Security | Средний | HttpOnly cookies (уже реализовано) |
| Token Hijacking | Низкий | Короткий access token ограничивает окно атаки |

### Преимущества:
- Пользователь остаётся залогиненным месяц
- Автоматическое обновление access token через refresh
- Существующий Token Blacklist защищает при logout

---

## 4. План реализации

**Изменение в `backend/app/core/config.py`:**

```python
# Безопасность (оптимальный баланс UX и Security)
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60   # 1 час для улучшения UX
REFRESH_TOKEN_EXPIRE_DAYS: int = 30     # 1 месяц для долгих сессий
ALGORITHM: str = "HS256"
```

**Время реализации:** 30 минут (включая тестирование)

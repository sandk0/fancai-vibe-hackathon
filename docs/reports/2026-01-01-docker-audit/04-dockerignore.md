# Анализ .dockerignore файлов

**Дата:** 1 января 2026

## Обзор

Найдено **3 .dockerignore файла**:
- Корневой: `.dockerignore`
- Backend: `backend/.dockerignore`
- Frontend: `frontend/.dockerignore`

---

## 1. Корневой .dockerignore

**Путь:** `/.dockerignore`
**Строк:** 56
**Оценка:** 7/10

### Включённые паттерны

| Категория | Паттерны |
|-----------|----------|
| Git | `.git`, `.gitignore` |
| Документация | `*.md`, `docs/` |
| Зависимости | `node_modules/`, `__pycache__/`, `.venv/` |
| IDE | `.vscode/`, `.idea/` |
| Артефакты | `dist/`, `build/` |
| Хранилище | `backend/storage/`, `frontend/public/uploads/` |
| Мониторинг | `monitoring/*/data/` |

### Отсутствующие паттерны

```
# CI/CD файлы (КРИТИЧНО)
.github/
.gitlab-ci.yml
.travis.yml

# Кэши инструментов
.mypy_cache/
.ruff_cache/
.eslintcache

# Логи npm
npm-debug.log*
yarn-debug.log*
```

### Проблемы

1. **`*.md` исключает ВСЕ markdown** - может сломать Dockerfile, если он копирует README.md
2. Нет CI/CD файлов в исключениях
3. Недостаточно специфичные паттерны для вложенных директорий

**Статус:** ИСПРАВИТЬ

---

## 2. Backend .dockerignore

**Путь:** `backend/.dockerignore`
**Строк:** 81
**Оценка:** 9/10

### Сильные стороны

- Полное покрытие Python артефактов
- Включены CI/CD файлы
- Хорошо структурирован по категориям
- **ВАЖНО:** Содержит комментарий о `alembic.ini`:

```
# alembic.ini - CRITICAL: Required for migrations in production!
```

### Включённые паттерны

| Категория | Паттерны |
|-----------|----------|
| Python | `__pycache__`, `*.py[cod]`, `.Python`, `*.so` |
| Виртуальные окружения | `venv/`, `env/`, `.venv` |
| Тестирование | `.pytest_cache`, `.coverage`, `htmlcov/` |
| Линтинг | `.mypy_cache/`, `.ruff_cache/` |
| CI/CD | `.github/`, `.gitlab-ci.yml` |
| Распространение | `dist/`, `build/`, `*.egg-info/` |

**Статус:** ОСТАВИТЬ

---

## 3. Frontend .dockerignore

**Путь:** `frontend/.dockerignore`
**Строк:** 86
**Оценка:** 6/10

### Сильные стороны

- Хорошее покрытие Node.js артефактов
- Включены расширенные OS файлы (macOS, Windows)
- TypeScript build info

### КРИТИЧЕСКАЯ ПРОБЛЕМА

```dockerignore
# НЕПРАВИЛЬНО - исключает Dockerfile из контекста сборки!
Dockerfile*
docker-compose*
```

Это нарушит мультиступенчатые сборки и скрипты, которые копируют Dockerfile.

### Отсутствующие паттерны

```
# Turbo/Vercel кэши
.turbo/
.vercel/

# Pre-commit hooks
.husky/
```

**Статус:** ИСПРАВИТЬ

---

## Сравнительная таблица

| Категория | Корневой | Backend | Frontend |
|-----------|----------|---------|----------|
| Git-файлы | ✅ | ✅ | ✅ |
| CI/CD | ❌ | ✅ | ✅ |
| IDE | ✅ | ✅ | ✅ |
| Зависимости | ✅ | ✅ | ✅ |
| Кэш инструментов | ⚠️ | ✅ | ✅ |
| macOS расширенные | ⚠️ | ⚠️ | ✅ |
| **Dockerfile паттерн** | ✅ | ✅ | ❌ ПРОБЛЕМА |

---

## Рекомендации

### Для корневого .dockerignore

Добавить:
```dockerignore
# CI/CD
.github/
.gitlab-ci.yml
.travis.yml
.circleci/

# Pre-commit
.husky/
.pre-commit-config.yaml

# Кэши
.mypy_cache/
.ruff_cache/
.eslintcache
```

Изменить:
```diff
- *.md
+ # Исключить только docs/, не все *.md
+ docs/
+ CHANGELOG.md
+ CONTRIBUTING.md
```

### Для frontend/.dockerignore

Удалить:
```diff
- Dockerfile*
- docker-compose*
```

Эти файлы НЕ должны исключаться из контекста сборки.

---

## Лучшие практики

### 1. Порядок приоритета

```
1. VCS файлы (.git) - минимизация контекста
2. Зависимости (node_modules/) - огромный размер
3. Артефакты сборки (dist/) - не нужны
4. Файлы разработки (.env, IDE) - безопасность
5. Документация (docs/) - зависит от использования
```

### 2. Критичные файлы НЕ исключать

```
✅ alembic.ini           # Нужен для миграций
✅ requirements.txt      # Нужен для pip install
✅ package.json          # Нужен для npm install
✅ pyproject.toml        # Нужен для Python проектов
✅ tsconfig.json         # Нужен для TypeScript
```

### 3. Защита от утечек секретов

```
.env
.env.local
.env.*.local
credentials.json
*.pem
*.key
```

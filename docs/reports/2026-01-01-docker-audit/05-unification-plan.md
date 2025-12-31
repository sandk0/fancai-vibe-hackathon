# План унификации Docker конфигурации

**Дата:** 1 января 2026
**Приоритет:** P0 (критично) → P1 (важно) → P2 (желательно)

---

## Сводка действий

| Приоритет | Действий | Описание |
|-----------|----------|----------|
| P0 | 6 | Удаление устаревших файлов |
| P1 | 7 | Исправление критических проблем |
| P2 | 5 | Улучшения и оптимизация |

---

## P0: Удаление устаревших файлов

### P0-1: Удалить docker-compose.yml

**Причина:** Содержит устаревшую NLP конфигурацию
**Замена:** `docker-compose.lite.yml`

```bash
rm docker-compose.yml
```

---

### P0-2: Удалить docker-compose.dev.yml

**Причина:** Наследует от устаревшего docker-compose.yml
**Альтернатива:** Использовать docker-compose.override.yml

```bash
rm docker-compose.dev.yml
```

---

### P0-3: Удалить docker-compose.production.yml

**Причина:** Содержит устаревшую NLP конфигурацию
**Замена:** `docker-compose.lite.prod.yml`

```bash
rm docker-compose.production.yml
```

---

### P0-4: Удалить docker-compose.vless-proxy.yml

**Причина:**
- Критический конфликт сетей
- Дублирует xray-proxy из основного compose
- Неофициальный образ

```bash
rm docker-compose.vless-proxy.yml
```

---

### P0-5: Удалить docker-compose.temp-ssl.yml

**Причина:** Можно заменить скриптом инициализации

```bash
rm docker-compose.temp-ssl.yml
```

**Создать скрипт замены:**

```bash
# scripts/init-ssl.sh
#!/bin/bash
set -e

echo "Starting temporary nginx for ACME challenge..."
docker run -d --name nginx-temp \
  -p 80:80 \
  -v ./nginx/certbot-www:/var/www/certbot:ro \
  -v ./nginx/nginx.http-only.conf:/etc/nginx/nginx.conf:ro \
  nginx:1.25-alpine

echo "Running certbot..."
docker-compose -f docker-compose.ssl.yml --profile ssl-init up certbot

echo "Stopping temporary nginx..."
docker stop nginx-temp && docker rm nginx-temp

echo "SSL certificates initialized successfully!"
```

---

### P0-6: Удалить backend/Dockerfile.prod

**Причина:** Содержит загрузку устаревших NLP моделей
**Замена:** `backend/Dockerfile.lite.prod`

```bash
rm backend/Dockerfile.prod
```

---

## P1: Исправление критических проблем

### P1-1: Исправить frontend/Dockerfile.prod

**Проблема:** Использует `npm run build:unsafe`
**Файл:** `frontend/Dockerfile.prod`

```diff
- RUN npm run build:unsafe
+ RUN npm run build
```

---

### P1-2: Исправить frontend/.dockerignore

**Проблема:** Исключает Dockerfile* из контекста
**Файл:** `frontend/.dockerignore`

```diff
- Dockerfile*
- docker-compose*
```

---

### P1-3: Переделать docker-compose.staging.yml

**Проблема:** Использует NLP конфигурацию
**Решение:** Переписать на основе docker-compose.lite.prod.yml

Ключевые изменения:
1. Удалить NLP volumes
2. Добавить GOOGLE_API_KEY
3. Использовать Dockerfile.lite.prod
4. Установить USE_LANGEXTRACT_PRIMARY=true

---

### P1-4: Исправить docker-compose.ssl.yml

**Проблема:** Риск rate limit от Let's Encrypt
**Файл:** `docker-compose.ssl.yml`

```diff
- certbot certonly --webroot ...
+ certbot certonly --webroot --keep-until-expiring ...

- certbot renew
+ certbot renew --keep-until-expiring
```

---

### P1-5: Исправить docker-compose.dev-ssl.yml

**Проблемы:**
1. CORS слишком открыт
2. Слабые SSL ciphers
3. Нет HSTS

**Файл:** `nginx/nginx.dev-ssl.conf`

```diff
- add_header 'Access-Control-Allow-Origin' '*' always;
+ add_header 'Access-Control-Allow-Origin' 'https://localhost' always;

+ add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

### P1-6: Исправить корневой .dockerignore

**Проблема:** Отсутствуют CI/CD файлы
**Файл:** `.dockerignore`

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

# Кэши линтеров
.mypy_cache/
.ruff_cache/
.eslintcache
```

---

### P1-7: Исправить имя пользователя в frontend/Dockerfile

**Проблема:** Пользователь называется `nextjs`, но проект использует Vite
**Файл:** `frontend/Dockerfile`

```diff
- adduser -S nextjs -u 1001
+ adduser -S appuser -u 1001
```

---

## P2: Улучшения и оптимизация

### P2-1: Исправить docker-compose.monitoring.yml

**Проблемы:**
1. Плавающие версии образов
2. Нет healthchecks
3. Нет resource limits

**Изменения:**
```yaml
prometheus:
  image: prom/prometheus:v2.48.0  # Пин версии
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost:9090/-/healthy"]
  deploy:
    resources:
      limits:
        memory: 512M
```

---

### P2-2: Переименовать docker-compose.lite.yml

После удаления устаревших файлов, переименовать для ясности:

```bash
# Вариант 1: Сделать основным
mv docker-compose.lite.yml docker-compose.yml

# Вариант 2: Оставить как есть для явности
# docker-compose.lite.yml остаётся
```

**Рекомендация:** Вариант 2 - оставить `.lite.` для явности различия от production.

---

### P2-3: Обновить CLAUDE.md

Добавить секцию Docker:

```markdown
## Docker Configuration

**Development:**
\`\`\`bash
docker-compose -f docker-compose.lite.yml up -d
\`\`\`

**Production:**
\`\`\`bash
docker-compose -f docker-compose.lite.prod.yml up -d
\`\`\`

**SSL Initialization:**
\`\`\`bash
./scripts/init-ssl.sh
\`\`\`

**Monitoring:**
\`\`\`bash
docker-compose -f docker-compose.lite.yml -f docker-compose.monitoring.yml up -d
\`\`\`
```

---

### P2-4: Создать docker/README.md

Документация по Docker конфигурации:

```markdown
# Docker Configuration

## Available Configurations

| File | Purpose |
|------|---------|
| docker-compose.lite.yml | Development (LangExtract) |
| docker-compose.lite.prod.yml | Production (LangExtract) |
| docker-compose.override.yml | Local overrides (macOS) |
| docker-compose.ssl.yml | SSL certificate management |
| docker-compose.monitoring.yml | Grafana/Prometheus stack |

## Quick Start

### Development
\`\`\`bash
docker-compose -f docker-compose.lite.yml up -d
\`\`\`

### Production
\`\`\`bash
docker-compose -f docker-compose.lite.prod.yml up -d
\`\`\`
```

---

### P2-5: Унифицировать network subnets

Текущее состояние:
- lite.yml: `bookreader_lite_network`
- lite.prod.yml: `172.22.0.0/16`
- staging.yml: `172.21.0.0/16`

**Рекомендация:** Использовать единое имя сети `bookreader_network` везде.

---

## Порядок выполнения

```
Phase 1 (P0) - Удаление:
├── P0-1: rm docker-compose.yml
├── P0-2: rm docker-compose.dev.yml
├── P0-3: rm docker-compose.production.yml
├── P0-4: rm docker-compose.vless-proxy.yml
├── P0-5: rm docker-compose.temp-ssl.yml + создать init-ssl.sh
└── P0-6: rm backend/Dockerfile.prod

Phase 2 (P1) - Критические исправления:
├── P1-1: frontend/Dockerfile.prod (build:unsafe)
├── P1-2: frontend/.dockerignore (Dockerfile*)
├── P1-3: docker-compose.staging.yml (переделать)
├── P1-4: docker-compose.ssl.yml (--keep-until-expiring)
├── P1-5: nginx.dev-ssl.conf (CORS, HSTS)
├── P1-6: .dockerignore (CI/CD)
└── P1-7: frontend/Dockerfile (user name)

Phase 3 (P2) - Улучшения:
├── P2-1: docker-compose.monitoring.yml
├── P2-2: Решение о переименовании
├── P2-3: CLAUDE.md обновление
├── P2-4: docker/README.md
└── P2-5: Унификация сетей
```

---

## Результат после унификации

### Структура файлов (было → стало)

```
# БЫЛО (21 файл)
docker-compose.yml              # УДАЛИТЬ
docker-compose.dev.yml          # УДАЛИТЬ
docker-compose.lite.yml
docker-compose.lite.prod.yml
docker-compose.override.yml
docker-compose.production.yml   # УДАЛИТЬ
docker-compose.staging.yml      # ПЕРЕДЕЛАТЬ
docker-compose.ssl.yml          # ИСПРАВИТЬ
docker-compose.dev-ssl.yml      # ИСПРАВИТЬ
docker-compose.temp-ssl.yml     # УДАЛИТЬ
docker-compose.monitoring.yml   # ИСПРАВИТЬ
docker-compose.vless-proxy.yml  # УДАЛИТЬ
backend/Dockerfile
backend/Dockerfile.lite
backend/Dockerfile.prod         # УДАЛИТЬ
backend/Dockerfile.lite.prod
frontend/Dockerfile             # ИСПРАВИТЬ
frontend/Dockerfile.prod        # ИСПРАВИТЬ

# СТАЛО (15 файлов)
docker-compose.lite.yml         # Основной dev
docker-compose.lite.prod.yml    # Основной prod
docker-compose.override.yml     # Локальные переопределения
docker-compose.staging.yml      # Staging (переделанный)
docker-compose.ssl.yml          # SSL
docker-compose.dev-ssl.yml      # Dev с SSL
docker-compose.monitoring.yml   # Мониторинг
backend/Dockerfile              # Dev full
backend/Dockerfile.lite         # Dev lite
backend/Dockerfile.lite.prod    # Prod lite
frontend/Dockerfile             # Dev
frontend/Dockerfile.prod        # Prod
.dockerignore                   # Исправленный
backend/.dockerignore
frontend/.dockerignore          # Исправленный
scripts/init-ssl.sh             # Новый
```

### Экономия

| Метрика | До | После |
|---------|-----|-------|
| Docker файлы | 21 | 15 |
| Устаревшие файлы | 7 | 0 |
| RAM production | 10-12 GB | 2-3 GB |
| Docker образ backend | 2.5 GB | 800 MB |

# BookReader AI - Production Deployment Guide

## 🚀 Быстрый старт

### 1. Подготовка сервера

**Требования:**
- Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- Docker 20.10+ и Docker Compose 2.0+
- Минимум 4GB RAM, 20GB диск
- Домен с настроенными DNS записями

```bash
# Установка Docker (Ubuntu)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Перезагрузка для применения изменений
sudo reboot
```

### 2. Настройка переменных окружения

```bash
# Клонируем репозиторий
git clone <your-repo-url>
cd fancai-vibe-hackathon

# Копируем и настраиваем переменные окружения
cp .env.production .env.production.local
nano .env.production.local
```

**ОБЯЗАТЕЛЬНО измените:**
```env
DOMAIN_NAME=yourdomain.com
DOMAIN_URL=https://yourdomain.com
DB_PASSWORD=your-secure-password
REDIS_PASSWORD=another-secure-password
SECRET_KEY=very-long-secret-key-64-chars-minimum
JWT_SECRET_KEY=another-long-jwt-secret
SSL_EMAIL=admin@yourdomain.com
```

### 3. Деплой

```bash
# Сделать скрипт исполняемым
chmod +x scripts/deploy.sh

# Инициализация
./scripts/deploy.sh init

# Настройка SSL
./scripts/deploy.sh ssl

# Деплой приложения
./scripts/deploy.sh deploy
```

### 4. Проверка

```bash
# Статус сервисов
./scripts/deploy.sh status

# Проверка доступности
curl -I https://yourdomain.com/health
```

## 📋 Команды управления

```bash
# Основные команды
./scripts/deploy.sh init      # Первичная инициализация
./scripts/deploy.sh deploy    # Деплой/переделой
./scripts/deploy.sh status    # Статус сервисов
./scripts/deploy.sh logs      # Просмотр логов

# Управление сервисами
./scripts/deploy.sh restart   # Перезапуск
./scripts/deploy.sh stop      # Остановка
./scripts/deploy.sh start     # Запуск
```

## 🔧 Структура production

- **Nginx** - Reverse proxy с SSL
- **Frontend** - React приложение (с epub.js 0.3.93 + react-reader 2.0.15)
- **Backend** - FastAPI с Gunicorn + Multi-NLP система
- **PostgreSQL** - База данных (с CFI tracking)
- **Redis** - Кеш и очереди
- **Celery** - Обработка задач (с NLP моделями)

## 🛡️ Безопасность

1. Смените все пароли в `.env.production.local`
2. Настройте firewall:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  
sudo ufw allow 22/tcp
sudo ufw enable
```

## 🔍 Решение проблем

### Проблемы с SSL
```bash
# Принудительное обновление
docker-compose -f docker-compose.ssl.yml run --rm certbot renew --force-renewal
```

### Проблемы с сервисами
```bash
# Перезапуск конкретного сервиса
docker-compose -f docker-compose.production.yml restart backend

# Логи сервиса
./scripts/deploy.sh logs backend
```

---

## 📦 Особенности October 2025 Deployment

### Frontend (epub.js Integration)

**Сборка с epub.js зависимостями:**
```bash
cd frontend
npm install epubjs@0.3.93 react-reader@2.0.15
npm run build

# Проверка bundle size
ls -lh dist/assets/*.js
# Ожидается: ~2.5MB общий размер (800KB gzipped)
```

**Nginx конфигурация для EPUB файлов:**
```nginx
# Добавить в nginx.conf
location /api/v1/books/ {
    proxy_pass http://backend:8000;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Real-IP $remote_addr;

    # Увеличенный размер для EPUB файлов
    client_max_body_size 50M;

    # Таймауты для больших файлов
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
}

# CORS для epub.js
location ~* \.(epub)$ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
}
```

### Backend (Multi-NLP System)

**Установка NLP моделей (требуется ~2GB дискового пространства):**
```bash
# После запуска контейнера
docker-compose exec backend bash

# SpaCy модель (500MB)
python -m spacy download ru_core_news_lg

# Natasha (автоматически устанавливается с pip)
pip install natasha

# Stanza модель (800MB)
pip install stanza
python -c "import stanza; stanza.download('ru')"

# Проверка установки
python -c "from app.services.multi_nlp_manager import multi_nlp_manager; import asyncio; asyncio.run(multi_nlp_manager.initialize())"
```

**Environment переменные для Multi-NLP:**
```bash
# Добавить в .env.production
MULTI_NLP_MODE=ensemble           # или adaptive
MULTI_NLP_PROCESSORS=spacy,natasha,stanza
CONSENSUS_THRESHOLD=0.6
SPACY_WEIGHT=1.0
NATASHA_WEIGHT=1.2
STANZA_WEIGHT=0.8
```

### Database (CFI Migrations)

**Применить миграции для CFI tracking:**
```bash
# Проверка текущей версии
docker-compose exec backend alembic current

# Применить миграции
docker-compose exec backend alembic upgrade head

# Должны быть применены:
# - 8ca7de033db9: add_reading_location_cfi_to_reading_progress
# - e94cab18247f: add_scroll_offset_percent_to_reading_progress

# Проверка структуры таблицы
docker-compose exec postgres psql -U $DB_USER -d $DB_NAME -c "\d reading_progress"
# Должны быть поля:
# - reading_location_cfi VARCHAR(500)
# - scroll_offset_percent FLOAT
```

### Resource Requirements (Обновлено October 2025)

**Минимальные требования:**
- **CPU:** 4+ cores (Multi-NLP benefit от multi-core)
- **RAM:** 8GB минимум (NLP модели: ~2GB + application: ~4GB + buffers: ~2GB)
- **Disk:** 100GB+ (EPUB файлы, generated images, NLP models)
- **Network:** 100Mbps (рекомендуется 1Gbps)

**Рекомендуемые для production:**
- **CPU:** 8+ cores
- **RAM:** 16GB (оптимально для 5-10 одновременных парсингов)
- **Disk:** 250GB+ NVMe SSD
- **Network:** 1Gbps

### Performance Testing

**Проверка Multi-NLP системы:**
```bash
# API статус процессоров
curl http://localhost:8000/api/v1/admin/multi-nlp-settings/status

# Ожидаемый ответ:
{
  "spacy": {"loaded": true, "weight": 1.0},
  "natasha": {"loaded": true, "weight": 1.2},
  "stanza": {"loaded": true, "weight": 0.8},
  "mode": "ensemble"
}
```

**Проверка CFI tracking:**
```bash
# Загрузить тестовую книгу EPUB
curl -X POST http://localhost:8000/api/v1/books/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.epub"

# Получить progress с CFI
curl http://localhost:8000/api/v1/books/{book_id}/progress \
  -H "Authorization: Bearer $TOKEN"

# Ожидаемый ответ должен содержать:
{
  "reading_location_cfi": "epubcfi(/6/4[chap01]!/4/2/1:0)",
  "scroll_offset_percent": 23.5,
  "progress_percentage": 23.5
}
```

**Проверка epub.js рендеринга:**
```bash
# Открыть frontend
open http://localhost:3000

# В DevTools Console проверить:
# 1. epub.js загружена
window.ePub !== undefined

# 2. Rendition работает
# Должен быть виден текст книги

# 3. CFI генерируется
# При прокрутке в Network tab должны быть PUT запросы к /progress
```

---

После успешного деплоя ваш BookReader AI будет доступен по адресу: `https://yourdomain.com` 🎉
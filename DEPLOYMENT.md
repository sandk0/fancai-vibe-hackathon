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
- **Frontend** - React приложение
- **Backend** - FastAPI с Gunicorn  
- **PostgreSQL** - База данных
- **Redis** - Кеш и очереди
- **Celery** - Обработка задач

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

После успешного деплоя ваш BookReader AI будет доступен по адресу: `https://yourdomain.com` 🎉
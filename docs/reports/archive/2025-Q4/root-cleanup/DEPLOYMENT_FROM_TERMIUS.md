# Deployment Instructions - Run from Termius

**Дата:** 15 ноября 2025
**Сервер:** 88.210.35.41 (fancai.ru)
**Ваше подключение:** Termius с настроенным SSH

---

## 📋 Инструкции для Deployment из Termius

Так как у вас уже есть SSH доступ через Termius, выполняйте команды напрямую на сервере.

---

## Шаг 1: Подключение к серверу

В Termius откройте подключение к серверу `88.210.35.41` как root.

---

## Шаг 2: Подготовка сервера (10-15 минут)

### Скачать и запустить preparation script

```bash
# Скачать script с GitHub (или скопировать содержимое вручную)
curl -fsSL https://raw.githubusercontent.com/your-username/fancai-vibe-hackathon/main/scripts/prepare-server.sh -o prepare-server.sh

# ИЛИ создать файл вручную:
cat > prepare-server.sh << 'EOF'
# [Вставьте содержимое scripts/prepare-server.sh]
EOF

# Сделать исполняемым
chmod +x prepare-server.sh

# Запустить (займет 5-10 минут)
./prepare-server.sh
```

**Что делает этот script:**
- ✅ Обновляет систему
- ✅ Устанавливает Docker и Docker Compose
- ✅ Настраивает firewall (UFW)
- ✅ Создает 2GB swap для 4GB RAM сервера
- ✅ Создает deployer пользователя
- ✅ Настраивает fail2ban и автообновления
- ✅ Создает `/opt/bookreader` директорию

**Ожидаемый результат:**
```
✅ Server preparation complete!
Docker: Docker version 24.x.x
Memory: 4GB RAM + 2GB Swap
Disk: >50GB free
```

---

## Шаг 3: Клонирование проекта (5 минут)

```bash
# Перейти в директорию приложения
cd /opt/bookreader

# Клонировать репозиторий
git clone https://github.com/your-username/fancai-vibe-hackathon.git .

# Проверка
ls -la
# Должны увидеть: docker-compose.staging.yml, backend/, frontend/, etc.

# Проверить текущую ветку
git branch
git log --oneline -5
```

---

## Шаг 4: Настройка Environment Variables (10 минут)

```bash
cd /opt/bookreader

# Скопировать staging template
cp .env.staging.example .env.staging

# Редактировать конфигурацию
vim .env.staging
# ИЛИ
nano .env.staging
```

### Обязательные переменные для изменения:

```bash
# ============================================
# DOMAIN CONFIGURATION
# ============================================
DOMAIN_NAME=fancai.ru
DOMAIN_URL=https://fancai.ru

# ============================================
# DATABASE CONFIGURATION
# ============================================
DB_NAME=bookreader
DB_USER=postgres
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_MIN_16_CHARS

# ============================================
# REDIS CONFIGURATION
# ============================================
REDIS_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_MIN_16_CHARS

# ============================================
# SECURITY SECRETS
# ============================================
SECRET_KEY=CHANGE_THIS_SECRET_KEY_32_PLUS_CHARS
JWT_SECRET_KEY=CHANGE_THIS_JWT_SECRET_32_PLUS_CHARS

# ============================================
# ADMIN USER
# ============================================
ADMIN_EMAIL=admin@fancai.ru
ADMIN_PASSWORD=CHANGE_THIS_ADMIN_PASSWORD_MIN_12_CHARS
```

### Генерация безопасных паролей:

```bash
# Генерировать все секреты одной командой
cat << 'EOF'
Сгенерированные секреты (сохраните в безопасное место):

DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
REDIS_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
ADMIN_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")

Используйте команды выше для генерации, затем скопируйте в .env.staging
EOF

# Или запустить для генерации:
echo "DB_PASSWORD: $(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
echo "REDIS_PASSWORD: $(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
echo "SECRET_KEY: $(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
echo "JWT_SECRET_KEY: $(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
echo "ADMIN_PASSWORD: $(python3 -c 'import secrets; print(secrets.token_urlsafe(16))')"
```

**ВАЖНО:** Сохраните сгенерированные пароли в безопасное место (password manager)!

---

## Шаг 5: Проверка DNS (КРИТИЧНО)

```bash
# Проверить что DNS A-запись настроена
dig +short fancai.ru

# Должен вернуть: 88.210.35.41
# Если возвращает что-то другое или пусто - настройте DNS!
```

**Если DNS не настроен:**
1. Войти в панель управления доменом (Cloudflare/Namecheap/etc.)
2. Добавить A-запись:
   - Type: A
   - Name: @ (или fancai.ru)
   - Value: 88.210.35.41
   - TTL: 300 (5 минут)
3. Ждать propagation (5-30 минут)
4. Повторить `dig +short fancai.ru`

---

## Шаг 6: SSL Сертификаты (5-10 минут)

### Вариант A: Let's Encrypt (РЕКОМЕНДУЕТСЯ)

**Только если DNS настроен и отвечает!**

```bash
cd /opt/bookreader

# Проверка DNS еще раз
dig +short fancai.ru
# ДОЛЖЕН вернуть: 88.210.35.41

# Создать директорию для SSL
mkdir -p nginx/ssl

# Запустить Certbot для получения сертификата
docker compose -f docker-compose.ssl.yml --profile ssl-init run --rm certbot

# Certbot спросит:
# 1. Email: ваш email для уведомлений (например: admin@fancai.ru)
# 2. Agree to Terms of Service: Y (Yes)
# 3. Share email with EFF: N (No, опционально)
# 4. Domain names: fancai.ru (уже настроено в DOMAIN_NAME)

# Если успешно - сертификаты будут в nginx/ssl/
ls -la nginx/ssl/
# Должно быть: fullchain.pem, privkey.pem

# Запустить auto-renewal (обновление каждые 12 часов)
docker compose -f docker-compose.ssl.yml --profile ssl-renew up -d

# Проверка
docker compose -f docker-compose.ssl.yml ps
```

### Вариант B: Self-Signed (ДЛЯ ТЕСТИРОВАНИЯ)

Если DNS еще не готов или хотите быстро протестировать:

```bash
cd /opt/bookreader
mkdir -p nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=fancai.ru"

echo "⚠️  Self-signed сертификат создан"
echo "Браузеры будут показывать предупреждение безопасности!"
```

---

## Шаг 7: Deployment (15-20 минут)

### Pre-deployment Checks

```bash
cd /opt/bookreader

# Проверка docker-compose конфигурации
docker compose -f docker-compose.staging.yml config

# Проверка свободных портов
netstat -tuln | grep -E ':(80|443|5432|6379|5173)'
# Должно быть пусто (порты свободны)

# Проверка памяти
free -h
# Должно быть ~3.5GB свободно (плюс 2GB swap)

# Проверка disk space
df -h /
# Должно быть >50GB свободно
```

### Build и Start Services

```bash
cd /opt/bookreader

# Pull base images
echo "📥 Pulling base images..."
docker compose -f docker-compose.staging.yml pull postgres redis

# Build custom images (backend, frontend)
echo "🔨 Building custom images (это займет 5-10 минут)..."
docker compose -f docker-compose.staging.yml build --no-cache

# Запустить все сервисы
echo "🚀 Starting services..."
docker compose -f docker-compose.staging.yml up -d

# Проверка статуса
docker compose -f docker-compose.staging.yml ps

# Ждать 30-60 секунд для полного запуска
echo "⏳ Waiting for services to start..."
sleep 60

# Проверка логов
docker compose -f docker-compose.staging.yml logs --tail=50
```

**Ожидаемый результат:**
```
NAME                          STATUS          PORTS
bookreader_postgres           Up (healthy)    5432/tcp
bookreader_redis              Up (healthy)    6379/tcp
bookreader_backend            Up (healthy)    0.0.0.0:8000->8000/tcp
bookreader_celery-worker      Up
bookreader_celery-beat        Up
bookreader_frontend           Up (healthy)    0.0.0.0:80->80/tcp
bookreader_nginx              Up              0.0.0.0:443->443/tcp
```

---

## Шаг 8: Database Initialization (5 минут)

```bash
cd /opt/bookreader

# Ждать пока PostgreSQL будет ready
echo "⏳ Waiting for PostgreSQL..."
docker compose -f docker-compose.staging.yml exec backend \
  python -c "from app.core.database import engine; engine.connect()" || sleep 10

# Выполнить migrations
echo "🗄️  Running database migrations..."
docker compose -f docker-compose.staging.yml exec backend \
  alembic upgrade head

# Проверка текущей миграции
docker compose -f docker-compose.staging.yml exec backend \
  alembic current

# Должно показать: latest migration ID

# Verify database configuration
echo "🔍 Verifying database configuration..."
cd /opt/bookreader
chmod +x scripts/verify-database-config.sh
./scripts/verify-database-config.sh

# Создать admin пользователя
echo "👤 Creating admin user..."
docker compose -f docker-compose.staging.yml exec backend \
  python -c "
from app.models.user import User
from app.core.database import SessionLocal
from passlib.context import CryptContext
import os

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
db = SessionLocal()

try:
    admin = User(
        email=os.getenv('ADMIN_EMAIL', 'admin@fancai.ru'),
        username='admin',
        hashed_password=pwd_context.hash(os.getenv('ADMIN_PASSWORD')),
        is_active=True,
        is_superuser=True
    )
    db.add(admin)
    db.commit()
    print(f'✅ Admin user created: {admin.email}')
except Exception as e:
    print(f'ℹ️  Admin user may already exist or error: {e}')
finally:
    db.close()
"
```

---

## Шаг 9: Verification (5 минут)

### Проверка Resource Usage

```bash
# Проверка памяти (должно быть <3.5GB)
docker stats --no-stream

# Ожидаемое использование:
# postgres:    400-600MB
# redis:       200-300MB
# backend:     800MB-1.2GB
# celery:      600-900MB
# frontend:    150-250MB
# nginx:       80-150MB
# TOTAL:       ~3.0-3.5GB ✅
```

### Проверка Health Endpoints

```bash
# Backend health
curl -f http://localhost:8000/health && echo "✅ Backend OK" || echo "❌ Backend FAIL"

# Frontend health
curl -f http://localhost:80/health && echo "✅ Frontend OK" || echo "❌ Frontend FAIL"

# Проверка через внешний IP
curl -f http://88.210.35.41/health && echo "✅ Public HTTP OK" || echo "❌ Public HTTP FAIL"

# Проверка HTTPS (если DNS настроен и Let's Encrypt работает)
curl -f https://fancai.ru/health && echo "✅ HTTPS OK" || echo "❌ HTTPS FAIL"
```

### Проверка NLP Models

```bash
# Проверка что NLP models загружены
docker compose -f docker-compose.staging.yml exec backend \
  python -c "
import spacy

try:
    nlp = spacy.load('ru_core_news_lg')
    print('✅ SpaCy model (ru_core_news_lg) loaded successfully')
except Exception as e:
    print(f'❌ SpaCy model error: {e}')
"
```

### Проверка в браузере

Откройте в браузере:
- **HTTP:** http://88.210.35.41
- **HTTPS (если DNS настроен):** https://fancai.ru

Должны увидеть главную страницу BookReader AI.

**Попробуйте залогиниться:**
- Email: значение из `ADMIN_EMAIL` (.env.staging)
- Password: значение из `ADMIN_PASSWORD` (.env.staging)

---

## Шаг 10: Post-Deployment Setup (5 минут)

### Automated Backups

```bash
cd /opt/bookreader

# Сделать scripts исполняемыми
chmod +x scripts/backup-database.sh

# Тестовый backup
./scripts/backup-database.sh

# Проверка backup создан
ls -lh /backups/postgresql/

# Добавить в crontab (ежедневно в 2 AM)
crontab -e

# Добавить эту строку в конец файла:
0 2 * * * cd /opt/bookreader && ./scripts/backup-database.sh >> /var/log/bookreader-backup.log 2>&1

# Сохранить и выйти (в vim: Esc, затем :wq, в nano: Ctrl+X, Y, Enter)

# Проверка crontab
crontab -l
```

### Security Hardening (ОПЦИОНАЛЬНО)

```bash
# Отключить root SSH login (после проверки что deployer работает)
vim /etc/ssh/sshd_config

# Найти и изменить:
# PermitRootLogin no
# PasswordAuthentication no

# Перезапустить SSH
systemctl restart sshd

# ВАЖНО: Убедитесь что deployer пользователь работает перед этим!
# Тест: ssh deployer@88.210.35.41
```

---

## ✅ Deployment Complete!

### Проверочный список:

- [ ] Все Docker контейнеры running (`docker compose ps`)
- [ ] Memory usage <3.5GB (`docker stats`)
- [ ] Disk space >50GB free (`df -h`)
- [ ] Health endpoints отвечают
- [ ] SSL сертификат работает (если Let's Encrypt)
- [ ] Admin user может залогиниться
- [ ] Automated backups настроены

### Полезные команды:

```bash
# Просмотр логов
docker compose -f docker-compose.staging.yml logs -f

# Просмотр логов конкретного сервиса
docker compose -f docker-compose.staging.yml logs -f backend

# Перезапуск сервиса
docker compose -f docker-compose.staging.yml restart backend

# Остановить все
docker compose -f docker-compose.staging.yml down

# Запустить все
docker compose -f docker-compose.staging.yml up -d

# Проверка памяти
docker stats

# Проверка disk
df -h

# Backup database
cd /opt/bookreader && ./scripts/backup-database.sh
```

---

## 🆘 Troubleshooting

### Проблема: Контейнер не запускается

```bash
# Проверить логи
docker compose -f docker-compose.staging.yml logs <service_name>

# Проверить память
free -h
docker stats

# Перезапустить
docker compose -f docker-compose.staging.yml restart <service_name>
```

### Проблема: Out of Memory

```bash
# Проверить usage
docker stats
free -h

# Уменьшить workers в .env.staging
vim .env.staging
# WORKERS_COUNT=3 (вместо 4)
# CELERY_CONCURRENCY=1

# Restart
docker compose -f docker-compose.staging.yml restart
```

### Проблема: SSL не работает

```bash
# Проверить DNS
dig +short fancai.ru

# Проверить сертификаты
ls -la nginx/ssl/

# Повторить certbot
docker compose -f docker-compose.ssl.yml --profile ssl-init run --rm certbot --force-renewal
```

### Проблема: Database connection errors

```bash
# Проверить PostgreSQL
docker compose -f docker-compose.staging.yml logs postgres

# Проверить connections
docker exec bookreader_postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Restart database
docker compose -f docker-compose.staging.yml restart postgres
```

---

## 📊 Monitoring

### Проверка статуса в реальном времени:

```bash
# Memory и CPU
watch docker stats

# Disk usage
watch df -h

# Network connections
watch 'netstat -tuln | grep -E ":(80|443|8000)"'

# Container health
watch 'docker compose -f docker-compose.staging.yml ps'
```

### Optional: Grafana Monitoring

```bash
# Запустить monitoring stack (добавит ~300MB RAM usage)
docker compose -f docker-compose.monitoring.yml up -d

# Доступ к Grafana
# http://fancai.ru:3001
# Default: admin/admin (СМЕНИТЬ при первом входе!)
```

---

## 🎉 Готово!

Ваш staging стенд BookReader AI развернут и работает на https://fancai.ru!

**Next Steps:**
1. Протестировать critical user flows
2. Настроить CI/CD для automated deployments
3. Мониторить performance и optimize при необходимости

**Документация:**
- Полный deployment plan: `STAGING_DEPLOYMENT_PLAN.md`
- Production optimization: `PRODUCTION_DEPLOYMENT_READY_SUMMARY.md`
- Quick reference: `docs/operations/deployment/staging-quick-reference.md`

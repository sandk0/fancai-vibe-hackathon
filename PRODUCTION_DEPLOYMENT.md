# Production Deployment Guide - BookReader AI

Comprehensive guide for deploying BookReader AI to production environment.

## 🚀 Quick Production Deployment

### 1. Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose (v2)
sudo apt install docker-compose-plugin

# Logout and login to apply group changes
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.production.example .env.production

# Edit with your production values
nano .env.production
```

**⚠️ Critical Environment Variables:**
```bash
# Domain & SSL
DOMAIN_NAME=bookreader.yourdomain.com
DOMAIN_URL=https://bookreader.yourdomain.com

# Strong passwords (minimum 16+ characters)
DB_PASSWORD=your_super_secure_db_password_here
REDIS_PASSWORD=your_super_secure_redis_password_here

# Application secrets (minimum 32 characters)
SECRET_KEY=your_super_secret_key_for_app_here_min_32_chars
JWT_SECRET_KEY=your_jwt_secret_key_here_min_32_chars

# AI Services
OPENAI_API_KEY=sk-your-openai-api-key-here  # Optional
POLLINATIONS_ENABLED=true
```

### 3. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt install certbot

# Create SSL directory
mkdir -p nginx/ssl

# Obtain certificate
sudo certbot certonly --standalone -d bookreader.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/bookreader.yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/bookreader.yourdomain.com/privkey.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/bookreader.yourdomain.com/chain.pem nginx/ssl/
sudo chown -R $USER:$USER nginx/ssl/
```

#### Option B: Self-Signed (Development)
```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/privkey.pem \
    -out nginx/ssl/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=bookreader.yourdomain.com"
cp nginx/ssl/fullchain.pem nginx/ssl/chain.pem
```

### 4. Deploy Application

```bash
# Make script executable
chmod +x scripts/deploy-production.sh

# Standard deployment
./scripts/deploy-production.sh

# Deployment with monitoring (Prometheus, Grafana)
./scripts/deploy-production.sh --with-monitoring
```

### 5. Verify Deployment

```bash
# Check services status
docker compose -f docker-compose.production.yml ps

# Test endpoints
curl -k https://bookreader.yourdomain.com/health
curl -k https://bookreader.yourdomain.com/api/v1/health

# View logs
docker compose -f docker-compose.production.yml logs -f backend
```

---

## 🔧 Manual Deployment Steps

### 1. Build and Start Infrastructure

```bash
# Build images
docker compose -f docker-compose.production.yml build --no-cache

# Start database and Redis
docker compose -f docker-compose.production.yml up -d postgres redis

# Wait for services
sleep 30

# Run database migrations
docker compose -f docker-compose.production.yml run --rm backend alembic upgrade head
```

### 2. Start Application Services

```bash
# Start backend and workers
docker compose -f docker-compose.production.yml up -d backend celery-worker celery-beat

# Start frontend and nginx
docker compose -f docker-compose.production.yml up -d frontend nginx

# Start auxiliary services
docker compose -f docker-compose.production.yml up -d logrotate
```

### 3. Optional: Enable Monitoring

```bash
# Start monitoring stack
docker compose -f docker-compose.production.yml --profile monitoring up -d

# Access Grafana: https://yourdomain.com:3001
# Default login: admin / (GRAFANA_PASSWORD from env)
```

---

## 📊 Production Architecture

```
Internet
    ↓
Nginx (SSL termination, Load balancing)
    ↓
Frontend (React SPA) + Backend API (FastAPI)
    ↓
PostgreSQL (Database) + Redis (Cache/Queue)
    ↓
Celery (Background tasks) + Beat (Scheduler)
```

### Service Details:

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| Nginx | bookreader_nginx | 80, 443 | Reverse proxy, SSL termination |
| Frontend | bookreader_frontend | - | React production build |
| Backend | bookreader_backend | - | FastAPI with Gunicorn |
| PostgreSQL | bookreader_postgres | - | Primary database |
| Redis | bookreader_redis | - | Cache and message broker |
| Celery Worker | bookreader_celery | - | Background task processing |
| Celery Beat | bookreader_beat | - | Task scheduler |
| Logrotate | bookreader_logrotate | - | Log management |

### Optional Services:

| Service | Container | Port | Profile |
|---------|-----------|------|---------|
| Prometheus | bookreader-prometheus | 9090 | monitoring |
| Grafana | bookreader-grafana | 3001 | monitoring |
| Watchtower | bookreader_watchtower | - | watchtower |

---

## 🛠 Operations & Maintenance

### Service Management

```bash
# View all services
docker compose -f docker-compose.production.yml ps

# Start specific service
docker compose -f docker-compose.production.yml start backend

# Stop specific service
docker compose -f docker-compose.production.yml stop backend

# Restart service
docker compose -f docker-compose.production.yml restart backend

# View logs
docker compose -f docker-compose.production.yml logs -f backend

# Scale workers
docker compose -f docker-compose.production.yml up -d --scale celery-worker=4
```

### Database Operations

```bash
# Database backup
docker compose -f docker-compose.production.yml exec postgres pg_dump \
  -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Database restore
docker compose -f docker-compose.production.yml exec -T postgres psql \
  -U $DB_USER -d $DB_NAME < backup_file.sql

# Run migrations
docker compose -f docker-compose.production.yml exec backend alembic upgrade head

# Create new migration
docker compose -f docker-compose.production.yml exec backend alembic revision --autogenerate -m "description"
```

### SSL Certificate Renewal

```bash
# Auto-renewal (add to crontab)
0 0,12 * * * certbot renew --quiet && docker compose -f docker-compose.production.yml exec nginx nginx -s reload

# Manual renewal
sudo certbot renew
sudo cp /etc/letsencrypt/live/bookreader.yourdomain.com/* nginx/ssl/
docker compose -f docker-compose.production.yml exec nginx nginx -s reload
```

### Log Management

```bash
# View application logs
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f celery-worker

# Access log files
tail -f logs/backend/access.log
tail -f logs/nginx/access.log

# Clean old logs (logrotate handles this automatically)
docker compose -f docker-compose.production.yml exec logrotate logrotate -f /etc/logrotate.conf
```

### Monitoring

```bash
# System resources
docker stats

# Service health
docker compose -f docker-compose.production.yml ps

# Database connections
docker compose -f docker-compose.production.yml exec postgres psql -U $DB_USER -d $DB_NAME \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Redis info
docker compose -f docker-compose.production.yml exec redis redis-cli -a $REDIS_PASSWORD info
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. SSL Certificate Problems
```bash
# Check certificate
openssl x509 -in nginx/ssl/fullchain.pem -text -noout

# Test SSL configuration
openssl s_client -connect bookreader.yourdomain.com:443 -servername bookreader.yourdomain.com
```

#### 2. Database Connection Issues
```bash
# Check database logs
docker compose -f docker-compose.production.yml logs postgres

# Test database connection
docker compose -f docker-compose.production.yml exec postgres psql -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

#### 3. Backend API Issues
```bash
# Check backend logs
docker compose -f docker-compose.production.yml logs backend

# Test API directly
docker compose -f docker-compose.production.yml exec backend curl localhost:8000/health
```

#### 4. Celery Worker Issues
```bash
# Check worker logs
docker compose -f docker-compose.production.yml logs celery-worker

# Check queue status
docker compose -f docker-compose.production.yml exec redis redis-cli -a $REDIS_PASSWORD llen celery
```

### Performance Optimization

```bash
# Scale workers based on load
docker compose -f docker-compose.production.yml up -d --scale celery-worker=4

# Increase Gunicorn workers
# Edit WORKERS_COUNT in .env.production
WORKERS_COUNT=8
docker compose -f docker-compose.production.yml restart backend

# Monitor resource usage
docker stats --no-stream
```

### Emergency Procedures

#### Quick Rollback
```bash
# Stop current deployment
docker compose -f docker-compose.production.yml down

# Start previous version (if available)
docker compose -f docker-compose.production.yml up -d

# Check backup directory for database restore
ls -la /backups/
```

#### System Recovery
```bash
# Pull latest images and restart
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d --force-recreate

# Clean system resources
docker system prune -f --volumes
```

---

## 📋 Security Checklist

- [ ] Strong passwords for all services
- [ ] SSL certificate properly configured
- [ ] Firewall configured (ports 80, 443 only)
- [ ] Regular security updates enabled
- [ ] Log monitoring configured
- [ ] Backup strategy implemented
- [ ] Rate limiting configured in Nginx
- [ ] No default passwords in use
- [ ] Environment variables secured
- [ ] Database access restricted

---

## 🎯 Production Readiness

The deployment includes:

- ✅ Multi-stage Docker builds for optimization
- ✅ Production-optimized Nginx configuration
- ✅ PostgreSQL with performance tuning
- ✅ Redis with persistence and optimization
- ✅ Gunicorn with proper worker configuration
- ✅ Celery with memory limits and task management
- ✅ Comprehensive health checks
- ✅ Automatic log rotation
- ✅ Security headers and SSL
- ✅ Rate limiting and DoS protection
- ✅ Monitoring ready (Prometheus/Grafana)
- ✅ Backup and rollback procedures

Your BookReader AI application is now production-ready! 🚀
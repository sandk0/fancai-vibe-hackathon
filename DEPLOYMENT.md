# BookReader AI - Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- At least 4GB RAM and 20GB disk space
- Domain name configured (optional)

### 1. Environment Setup

```bash
# Copy production environment template
cp .env.prod.example .env.prod

# Edit environment variables
nano .env.prod
```

**Critical environment variables to configure:**
- `DATABASE_PASSWORD` - Strong database password
- `REDIS_PASSWORD` - Redis authentication password
- `SECRET_KEY` - Application secret (32+ characters)
- `JWT_SECRET_KEY` - JWT signing key (32+ characters)
- `ALLOWED_HOSTS` - Your domain names
- `CORS_ORIGINS` - Your frontend URLs

### 2. SSL Certificates (Optional)

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Add your SSL certificates
cp your-cert.pem nginx/ssl/cert.pem
cp your-key.pem nginx/ssl/key.pem

# Update nginx configuration
nano nginx/prod.conf
# Uncomment HTTPS server block
```

### 3. Deploy

```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh

# With monitoring (optional)
./scripts/deploy.sh --with-monitoring
```

### 4. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Test the application
curl -f http://localhost/health
```

## 📋 Production Checklist

### Before Deployment
- [ ] Environment variables configured
- [ ] Database password changed from default
- [ ] Redis password set
- [ ] SSL certificates in place (if using HTTPS)
- [ ] Domain DNS configured
- [ ] Backup strategy planned

### After Deployment
- [ ] All services running (7 containers)
- [ ] Application accessible at domain
- [ ] API endpoints responding
- [ ] Database migrations completed
- [ ] SSL certificates working (if configured)
- [ ] Monitoring setup (if enabled)

## 🛠 Services Overview

| Service | Purpose | Port | Health Check |
|---------|---------|------|--------------|
| **nginx** | Reverse proxy & load balancer | 80, 443 | `curl localhost/health` |
| **frontend** | React application | Internal | Via nginx |
| **backend** | FastAPI application | Internal | `curl localhost/api/health` |
| **postgres** | Database | Internal | `docker exec ... pg_isready` |
| **redis** | Cache & message broker | Internal | `docker exec ... redis-cli ping` |
| **celery-worker** | Background tasks | Internal | `docker logs ...` |
| **celery-beat** | Task scheduler | Internal | `docker logs ...` |

## 🔧 Management Commands

### Service Management
```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# View service logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Scale workers
docker-compose -f docker-compose.prod.yml up -d --scale celery-worker=4
```

### Database Operations
```bash
# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Create backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres bookreader > backup.sql

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres bookreader < backup.sql

# Access database shell
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres bookreader
```

### Application Management
```bash
# Clear Redis cache
docker-compose -f docker-compose.prod.yml exec redis redis-cli FLUSHALL

# View Celery tasks
docker-compose -f docker-compose.prod.yml exec celery-worker celery -A app.core.celery inspect active

# Restart background workers
docker-compose -f docker-compose.prod.yml restart celery-worker celery-beat
```

## 📊 Monitoring

### Built-in Monitoring (Optional)
```bash
# Start monitoring services
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Access dashboards
open http://localhost:3001  # Grafana
open http://localhost:9090  # Prometheus
```

### Log Monitoring
```bash
# Application logs
tail -f logs/access.log
tail -f logs/error.log

# Nginx logs
docker-compose -f docker-compose.prod.yml logs nginx

# Database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

### Performance Monitoring
```bash
# System resources
docker stats

# Service health
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml top
```

## 🔒 Security

### SSL/TLS Configuration
```bash
# Generate self-signed certificate (development only)
openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes

# Let's Encrypt (recommended for production)
# Use certbot or similar tool
```

### Security Headers
The nginx configuration includes:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy
- Referrer-Policy

### Rate Limiting
Configured in nginx for:
- API endpoints: 10 requests/second
- Authentication: 5 requests/minute
- File uploads: 1 request/second

## 📈 Performance Optimization

### Backend Scaling
```bash
# Scale backend workers
WORKERS_COUNT=8 docker-compose -f docker-compose.prod.yml up -d backend

# Scale Celery workers
docker-compose -f docker-compose.prod.yml up -d --scale celery-worker=4
```

### Database Optimization
```bash
# Monitor slow queries
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres bookreader -c "
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

### Cache Optimization
```bash
# Monitor Redis memory
docker-compose -f docker-compose.prod.yml exec redis redis-cli INFO memory

# Configure Redis persistence
# Edit redis configuration in docker-compose.prod.yml
```

## 🔄 Updates and Maintenance

### Application Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and deploy
./scripts/deploy.sh
```

### Automated Backups
```bash
# Setup cron job for daily backups
crontab -e

# Add line:
# 0 2 * * * /path/to/project/scripts/backup.sh
```

### Log Rotation
```bash
# Setup logrotate for application logs
sudo nano /etc/logrotate.d/bookreader

# Add configuration:
/path/to/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    copytruncate
}
```

## 🆘 Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check disk space
df -h

# Check memory
free -m
```

**Database connection issues:**
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Test connection
docker-compose -f docker-compose.prod.yml exec backend python -c "
from app.core.database import engine
print('Database OK' if engine else 'Database Error')
"
```

**High memory usage:**
```bash
# Check container stats
docker stats

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

**SSL certificate issues:**
```bash
# Check certificate validity
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Test SSL configuration
openssl s_client -connect yourdomain.com:443
```

### Emergency Procedures

**Complete restart:**
```bash
docker-compose -f docker-compose.prod.yml down
docker system prune -f
./scripts/deploy.sh
```

**Rollback:**
```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore from backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres bookreader < backup.sql

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

## 📞 Support

For issues and questions:
1. Check logs first: `docker-compose -f docker-compose.prod.yml logs`
2. Review this documentation
3. Check GitHub issues
4. Create new issue with logs and environment details

## 🎯 Production KPIs

Monitor these metrics:
- Response time < 2 seconds
- Uptime > 99.5%
- Memory usage < 80%
- Disk usage < 85%
- Error rate < 0.1%
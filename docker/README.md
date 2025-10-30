# Docker Setup Guide
**BookReader AI Project**

## Quick Start

### Development Environment

1. **Generate Secrets**
```bash
# Generate all required secrets
python3 << 'EOF'
import secrets

print("# Copy these to .env.development")
print()
print(f"DB_PASSWORD={secrets.token_urlsafe(32)}")
print(f"REDIS_PASSWORD={secrets.token_urlsafe(32)}")
print(f"SECRET_KEY={secrets.token_urlsafe(64)}")
print(f"JWT_SECRET_KEY={secrets.token_urlsafe(64)}")
print(f"GRAFANA_PASSWORD={secrets.token_urlsafe(24)}")
print(f"PGADMIN_PASSWORD={secrets.token_urlsafe(24)}")
EOF
```

2. **Create Environment File**
```bash
cp .env.example .env.development
# Edit .env.development and paste the generated secrets
```

3. **Start Services**
```bash
# Load environment variables
export $(cat .env.development | xargs)

# Start all services
docker-compose up -d

# With development tools (PGAdmin, Redis CLI)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

4. **Verify**
```bash
# Check all services are healthy
docker-compose ps

# Test backend
curl http://localhost:8000/health

# Test frontend
curl http://localhost:3000
```

---

## Production Deployment

### Prerequisites
- Docker 24.0+ with Compose V2
- SSL certificates (via Let's Encrypt or custom)
- Strong secrets generated

### Step-by-Step Production Setup

#### 1. Prepare Secrets
```bash
# On production server
mkdir -p docker/secrets
chmod 700 docker/secrets

# Generate production secrets
python3 << 'EOF' > docker/secrets/.env.production
import secrets

print(f"DB_NAME=bookreader_prod")
print(f"DB_USER=bookreader_user")
print(f"DB_PASSWORD={secrets.token_urlsafe(32)}")
print(f"REDIS_PASSWORD={secrets.token_urlsafe(32)}")
print(f"SECRET_KEY={secrets.token_urlsafe(64)}")
print(f"JWT_SECRET_KEY={secrets.token_urlsafe(64)}")
print(f"GRAFANA_USER=admin")
print(f"GRAFANA_PASSWORD={secrets.token_urlsafe(24)}")

# Add other required variables from .env.production.example
EOF

chmod 600 docker/secrets/.env.production
```

#### 2. Configure Domain
```bash
# Edit docker/secrets/.env.production
DOMAIN_NAME=your-domain.com
DOMAIN_URL=https://your-domain.com
SSL_EMAIL=admin@your-domain.com
```

#### 3. Deploy
```bash
# Load environment
export $(cat docker/secrets/.env.production | xargs)

# Build images
docker-compose -f docker-compose.production.yml build

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check health
docker-compose -f docker-compose.production.yml ps
```

#### 4. Setup SSL (if needed)
```bash
# Initialize SSL certificates
docker-compose -f docker-compose.ssl.yml --profile ssl-init up certbot

# Start auto-renewal
docker-compose -f docker-compose.ssl.yml --profile ssl-renew up -d
```

---

## Service Architecture

### Core Services

**Backend (FastAPI)**
- Port: 8000
- Health: `/health`
- API: `/api/v1`
- Resource Limits: 4GB RAM

**Frontend (React + Nginx)**
- Port: 3000 (dev), 80 (prod)
- Health check enabled
- Resource Limits: 2GB RAM

**PostgreSQL 15**
- Internal port: 5432
- Volume: postgres_data
- Resource Limits: 1GB RAM

**Redis 7**
- Internal port: 6379
- Volume: redis_data
- Max memory: 512MB

**Celery Workers**
- Concurrency: 2 (configurable)
- Resource Limits: 2GB RAM
- Auto-restart on memory limit

**Celery Beat**
- Scheduler for periodic tasks
- Resource Limits: 512MB RAM

### Development Tools

**PGAdmin**
- Port: 5050
- URL: http://localhost:5050
- Default credentials: See .env.development

**Redis CLI**
- Access: `docker-compose exec redis-cli redis-cli -a $REDIS_PASSWORD`

### Monitoring Services

**Prometheus**
- Port: 9090
- Metrics collection
- Retention: 200h

**Grafana**
- Port: 3001
- Dashboards visualization
- Default credentials: See .env

**Loki + Promtail**
- Log aggregation
- Automatic log collection from all containers

**Node Exporter**
- System metrics
- CPU, memory, disk stats

**cAdvisor**
- Container metrics
- Resource usage tracking

---

## Common Operations

### Database Management

```bash
# Connect to database
docker-compose exec postgres psql -U $DB_USER -d $DB_NAME

# Backup database
docker-compose exec postgres pg_dump -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql

# Restore database
docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME < backup.sql

# Run migrations
docker-compose exec backend alembic upgrade head

# Create migration
docker-compose exec backend alembic revision --autogenerate -m "description"
```

### Redis Management

```bash
# Connect to Redis
docker-compose exec redis redis-cli -a $REDIS_PASSWORD

# Flush cache
docker-compose exec redis redis-cli -a $REDIS_PASSWORD FLUSHALL

# Check memory usage
docker-compose exec redis redis-cli -a $REDIS_PASSWORD INFO memory

# Monitor commands
docker-compose exec redis redis-cli -a $REDIS_PASSWORD MONITOR
```

### Log Management

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f celery-worker

# Save logs to file
docker-compose logs > logs_$(date +%Y%m%d_%H%M%S).log

# Clear logs
docker-compose down && docker-compose up -d
```

### Container Management

```bash
# Restart specific service
docker-compose restart backend

# Rebuild service
docker-compose up -d --build --no-deps backend

# Scale service
docker-compose up -d --scale celery-worker=3

# Remove all containers and volumes (DANGER!)
docker-compose down -v
```

---

## Monitoring & Health Checks

### Health Check Status

```bash
# Check all services
docker-compose ps

# Detailed health info
docker inspect bookreader_backend | jq '.[0].State.Health'

# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:3000
```

### Resource Monitoring

```bash
# Real-time stats
docker stats

# Specific service
docker stats bookreader_backend

# Historical data (Prometheus)
# Open http://localhost:9090
# Query: rate(container_cpu_usage_seconds_total[5m])
```

### Grafana Dashboards

Access: http://localhost:3001

**Pre-configured Dashboards:**
1. Docker Container Metrics (ID: 8321)
2. PostgreSQL Metrics (ID: 9628)
3. Redis Metrics (ID: 11835)
4. FastAPI Metrics (ID: 14282)

**Import Dashboard:**
1. Go to Dashboards > Import
2. Enter dashboard ID
3. Select Prometheus data source
4. Click Import

---

## Networking

### Network Topology

```
bookreader_network (bridge)
├── backend (bookreader_backend)
├── frontend (bookreader_frontend)
├── postgres (bookreader_postgres)
├── redis (bookreader_redis)
├── celery-worker (bookreader_celery)
├── celery-beat (bookreader_beat)
└── nginx (bookreader_nginx) [production only]
```

### Port Mappings

**Development:**
- Frontend: 3000 → 3000
- Backend: 8000 → 8000
- PGAdmin: 5050 → 80
- Grafana: 3001 → 3000
- Prometheus: 9090 → 9090

**Production:**
- Nginx: 80 → 80, 443 → 443
- All other services: Internal network only

### Internal DNS

Services can communicate using container names:
- `postgres:5432`
- `redis:6379`
- `backend:8000`
- `frontend:3000`

---

## Security Best Practices

### ✅ DO
- Use strong generated secrets (64+ characters)
- Keep .env.production in .gitignore
- Run containers as non-root users
- Use latest security updates
- Enable health checks
- Set resource limits
- Use private networks for databases
- Rotate secrets quarterly
- Backup regularly
- Monitor logs for suspicious activity

### ❌ DON'T
- Hardcode passwords in compose files
- Commit .env.production to git
- Expose database ports to host
- Run containers as root
- Use `latest` tags in production
- Disable health checks
- Skip security updates
- Use default/weak passwords

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs backend

# Check health
docker-compose ps

# Recreate container
docker-compose up -d --force-recreate backend

# Check disk space
df -h
```

### Permission Errors

```bash
# Fix ownership
docker-compose run --rm --user root backend chown -R appuser:appuser /app

# Check current user
docker-compose exec backend whoami
# Should output: appuser
```

### Database Connection Failed

```bash
# Verify database is healthy
docker-compose ps postgres

# Test connection
docker-compose exec postgres pg_isready -U $DB_USER -d $DB_NAME

# Check environment variables
docker-compose exec backend env | grep DATABASE_URL
```

### Out of Memory

```bash
# Check memory usage
docker stats --no-stream

# Increase limits in docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 4G  # Increase as needed

# Restart service
docker-compose up -d
```

### Slow Performance

```bash
# Check resource usage
docker stats

# Optimize Redis
docker-compose exec redis redis-cli -a $REDIS_PASSWORD CONFIG SET maxmemory-policy allkeys-lru

# Clear cache
docker-compose exec redis redis-cli -a $REDIS_PASSWORD FLUSHALL

# Restart services
docker-compose restart
```

---

## Maintenance

### Daily Tasks
- Check logs for errors: `docker-compose logs --tail=100 backend`
- Monitor resource usage: `docker stats --no-stream`
- Check health status: `docker-compose ps`

### Weekly Tasks
- Review monitoring dashboards
- Check for security updates
- Backup database
- Review disk space usage

### Monthly Tasks
- Update base images
- Rotate secrets
- Review security audit
- Test disaster recovery
- Update documentation

### Quarterly Tasks
- Full security audit
- Performance testing
- Capacity planning
- Update dependencies

---

## Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Backup database
docker-compose exec postgres pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup Redis
docker-compose exec redis redis-cli -a $REDIS_PASSWORD SAVE
docker cp bookreader_redis:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Backup volumes
docker run --rm -v fancai-vibe-hackathon_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/postgres_volume_$DATE.tar.gz -C /data .

# Remove old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Recovery

```bash
# Restore database
gunzip -c /backups/db_20250129.sql.gz | docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME

# Restore Redis
docker cp /backups/redis_20250129.rdb bookreader_redis:/data/dump.rdb
docker-compose restart redis

# Restore volumes
docker run --rm -v fancai-vibe-hackathon_postgres_data:/data -v /backups:/backup alpine tar xzf /backup/postgres_volume_20250129.tar.gz -C /data
```

---

## Performance Tuning

### PostgreSQL Optimization

```bash
# Edit docker-compose.production.yml postgres command:
command: >
  postgres
  -c shared_buffers=256MB
  -c effective_cache_size=1GB
  -c work_mem=4MB
  -c maintenance_work_mem=64MB
  -c max_connections=200
```

### Redis Optimization

```bash
# Edit docker-compose.yml redis command:
command: >
  redis-server
  --maxmemory 512mb
  --maxmemory-policy allkeys-lru
  --save 900 1 60 100 10 10000
```

### Backend Optimization

```bash
# Increase workers
export WORKERS_COUNT=8

# Enable HTTP/2
# Edit nginx config for production

# Use connection pooling
# Already configured in backend/app/core/database.py
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/docker.yml
name: Docker Build & Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Create env file
        run: |
          echo "DB_PASSWORD=${{ secrets.DB_PASSWORD }}" >> .env.development
          echo "REDIS_PASSWORD=${{ secrets.REDIS_PASSWORD }}" >> .env.development
          echo "SECRET_KEY=${{ secrets.SECRET_KEY }}" >> .env.development

      - name: Start services
        run: |
          export $(cat .env.development | xargs)
          docker-compose up -d

      - name: Wait for health
        run: |
          timeout 120 bash -c 'until curl -f http://localhost:8000/health; do sleep 2; done'

      - name: Run tests
        run: docker-compose exec -T backend pytest

      - name: Security scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: bookreader-backend:latest
```

---

## Additional Resources

- **Docker Compose Spec:** https://docs.docker.com/compose/compose-file/
- **Docker Security:** https://docs.docker.com/engine/security/
- **PostgreSQL Docker:** https://hub.docker.com/_/postgres
- **Redis Docker:** https://hub.docker.com/_/redis
- **Nginx Docker:** https://hub.docker.com/_/nginx

---

**Need Help?**
- Check logs: `docker-compose logs -f`
- Review audit: `DOCKER_SECURITY_AUDIT.md`
- Upgrade guide: `DOCKER_UPGRADE_GUIDE.md`
- Security issues: security@yourdomain.com

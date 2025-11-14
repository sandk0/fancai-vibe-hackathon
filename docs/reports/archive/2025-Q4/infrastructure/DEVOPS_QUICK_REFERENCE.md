# DevOps Quick Reference Guide
**BookReader AI - DevOps & Infrastructure Operations**

---

## QUICK START

### Local Development

```bash
# Clone and setup
git clone <repo>
cd fancai-vibe-hackathon

# Copy environment template
cp .env.example .env.development

# Generate secrets (update .env.development)
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down -v
```

### Production Deployment

```bash
# Create release tag
git tag -a v1.2.3 -m "Release 1.2.3"
git push origin v1.2.3

# This triggers GitHub Actions:
# 1. Tests run (CI pipeline)
# 2. Docker images build and push
# 3. Staging deployment
# 4. Production deployment (with approval)
```

---

## DOCKER COMMANDS

### Development

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d backend
docker-compose up -d postgres

# View logs (last 100 lines, follow)
docker-compose logs -f --tail=100 backend

# Execute command in container
docker-compose exec backend bash
docker-compose exec backend pytest -v

# List containers
docker-compose ps

# Check resource usage
docker stats

# Stop services (keeps data)
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# Restart service
docker-compose restart backend

# Remove unused images/volumes
docker system prune
docker volume prune
```

### Production

```bash
# Deploy production environment
docker-compose -f docker-compose.production.yml up -d

# View production logs
docker-compose -f docker-compose.production.yml logs -f backend

# Execute on production container
docker-compose -f docker-compose.production.yml exec backend bash

# Stop production environment
docker-compose -f docker-compose.production.yml down

# Monitor resource usage
docker-compose -f docker-compose.production.yml stats

# View specific container logs
docker logs bookreader_backend --tail=200 --follow
```

### Build & Push

```bash
# Build images locally
docker-compose build

# Build specific image
docker-compose build backend

# Build without cache
docker-compose build --no-cache backend

# Push to registry (manual, CI/CD does this)
docker tag bookreader-backend:latest ghcr.io/user/repo-backend:latest
docker push ghcr.io/user/repo-backend:latest

# View image size
docker images | grep bookreader
```

---

## DATABASE OPERATIONS

### Backup & Restore

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres bookreader_dev > backup-$(date +%Y%m%d-%H%M%S).sql

# Backup (production)
docker-compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U postgres bookreader_prod > backup-prod.sql

# Restore from backup
docker-compose exec postgres psql -U postgres bookreader_dev < backup.sql

# Backup with compression
docker-compose exec postgres pg_dump -U postgres bookreader_dev | gzip > backup.sql.gz

# Restore from compressed backup
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U postgres bookreader_dev

# Check backup size
ls -lh backup.sql
```

### Database Inspection

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d bookreader_dev

# In psql shell:
\dt                    # List tables
\d users              # Describe table structure
SELECT COUNT(*) FROM users;  # Count records
\l                    # List databases
\du                   # List users
\q                    # Quit

# Execute query from bash
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "SELECT COUNT(*) FROM users;"

# Export data to CSV
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "COPY users TO stdout WITH CSV HEADER" > users.csv
```

### Database Migrations

```bash
# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "add user table"

# View migration history
docker-compose exec backend alembic history

# Apply migrations
docker-compose exec backend alembic upgrade head

# Upgrade to specific revision
docker-compose exec backend alembic upgrade abc123

# Downgrade one step
docker-compose exec backend alembic downgrade -1

# Downgrade to specific revision
docker-compose exec backend alembic downgrade abc123

# Get current migration version
docker-compose exec backend alembic current

# Check pending migrations
docker-compose exec backend alembic current --verbose

# Generate migration without changes (test)
docker-compose exec backend alembic upgrade head --sql
```

---

## REDIS OPERATIONS

### Cache Management

```bash
# Connect to Redis
docker-compose exec redis redis-cli -a <REDIS_PASSWORD>

# In redis-cli:
PING                     # Test connection
INFO                     # Server info
DBSIZE                   # Key count
FLUSHALL                 # Clear all databases (DANGEROUS)
FLUSHDB                  # Clear current database
KEYS *                   # List all keys
GET key_name            # Get value
DEL key_name            # Delete key
EXPIRE key_name 3600    # Set expiration (3600s)
TTL key_name            # Time to live
MONITOR                 # Monitor commands in real-time
BGSAVE                   # Background save
LASTSAVE                 # Last save timestamp

# Exit redis-cli
exit
```

### Redis Monitoring

```bash
# Get Redis stats
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> INFO

# Monitor all commands
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> MONITOR

# Check memory usage
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> INFO memory

# Get database statistics
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> INFO stats

# Clear cache (be careful in production!)
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> FLUSHDB

# Check replication status
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> INFO replication
```

---

## CELERY OPERATIONS

### Task Management

```bash
# View celery worker logs
docker-compose logs -f celery-worker

# View celery beat logs
docker-compose logs -f celery-beat

# Connect to backend container
docker-compose exec backend bash

# In container, check Celery tasks:
celery -A app.core.celery_app inspect active     # Active tasks
celery -A app.core.celery_app inspect stats      # Worker stats
celery -A app.core.celery_app inspect query      # Queued tasks
celery -A app.core.celery_app purge              # Purge all tasks (DANGEROUS)

# Monitor tasks in real-time
celery -A app.core.celery_app events

# Get worker info
celery -A app.core.celery_app inspect active_queues

# Clear failed tasks
celery -A app.core.celery_app inspect revoked
```

### Debugging Tasks

```bash
# Check task result
docker-compose exec backend bash
python -c "from app.core.celery_app import app; print(app.backend.get('task-id'))"

# Restart celery worker
docker-compose restart celery-worker

# Restart celery beat
docker-compose restart celery-beat

# Check Celery logs
docker-compose logs --tail=100 celery-worker
docker-compose logs --tail=100 celery-beat

# View task queue depth
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> LLEN celery
```

---

## NETWORK & CONNECTIVITY

### Service Communication

```bash
# Test backend health
curl http://localhost:8000/health

# Test from another container
docker-compose exec frontend curl http://backend:8000/health

# Test database connectivity
docker-compose exec backend python -c "import psycopg2; print(psycopg2.__version__)"

# Test Redis connectivity
docker-compose exec backend python -c "import redis; r=redis.Redis(host='redis'); print(r.ping())"

# DNS resolution test
docker-compose exec frontend nslookup backend
docker-compose exec frontend nslookup postgres

# View network
docker network ls
docker network inspect bookreader_network
```

### Port Access

```bash
# Check if port is open
lsof -i :8000              # Backend
lsof -i :5173              # Frontend
lsof -i :5432              # PostgreSQL
lsof -i :6379              # Redis

# Check connection from container
docker-compose exec backend curl -v http://postgres:5432

# Test DNS resolution
docker-compose exec backend nslookup postgres
```

---

## LOGS & DEBUGGING

### View Logs

```bash
# Tail backend logs
docker-compose logs -f backend

# Last 50 lines of all services
docker-compose logs --tail=50

# Logs for specific time range
docker-compose logs --since 2025-11-03T10:00:00 backend

# Save logs to file
docker-compose logs backend > backend.log

# Logs with timestamps
docker-compose logs -t backend

# Follow and see newly added lines
docker-compose logs -f --tail=0 backend
```

### Debug Mode

```bash
# Execute with debug output
docker-compose exec backend python -m pdb app/main.py

# Run tests with verbose output
docker-compose exec backend pytest -vv --tb=short

# Run with print debugging
docker-compose exec backend python -c "import app; print(app.__version__)"

# Check environment variables in container
docker-compose exec backend env | grep -i database

# Interactive shell in container
docker-compose exec backend bash
docker-compose exec frontend sh
```

### Log Search

```bash
# Find errors in logs
docker-compose logs backend | grep ERROR

# Count errors
docker-compose logs backend | grep -c ERROR

# Show context around error
docker-compose logs backend | grep -A5 -B5 ERROR

# Monitor for specific pattern
docker-compose logs -f backend | grep "processing"

# Extract timestamps
docker-compose logs backend | awk '{print $1, $2}'
```

---

## PERFORMANCE & MONITORING

### Resource Usage

```bash
# Real-time stats
docker stats

# Per-container stats
docker stats --no-stream bookreader_backend

# Memory usage
docker stats --format "table {{.Container}}\t{{.MemUsage}}"

# CPU usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}"

# Check disk usage
du -sh ./postgres_data
du -sh ./redis_data

# View all volume sizes
docker volume ls
docker system df
```

### Health Checks

```bash
# Check service health
docker-compose ps

# Detailed health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check health history
docker inspect --format='{{json .State.Health}}' bookreader_backend | jq

# Manual health check
curl -f http://localhost:8000/health && echo "OK" || echo "FAILED"

# Database health
docker-compose exec postgres pg_isready -U postgres

# Redis health
docker-compose exec redis redis-cli ping

# Check all health endpoints
curl http://localhost:8000/health
curl http://localhost:5173
curl http://localhost:5432  # (won't respond, just TCP check)
```

### Performance Profiling

```bash
# Profile database queries
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check slow query log
docker-compose logs postgres | grep "duration:"

# Analyze query plan
docker-compose exec postgres psql -U postgres -d bookreader_dev
EXPLAIN ANALYZE SELECT * FROM books WHERE id = 1;

# Table sizes
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Index usage
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname='public';"
```

---

## DEPLOYMENT & ROLLBACK

### Manual Deployment (if CI/CD fails)

```bash
# Pull latest code
git pull origin main

# Build images
docker-compose build

# Pull pre-built images (if available)
docker-compose -f docker-compose.production.yml pull

# Start new version
docker-compose -f docker-compose.production.yml up -d

# Run migrations
docker-compose -f docker-compose.production.yml exec -T backend alembic upgrade head

# Check health
curl -f https://bookreader.example.com/api/health

# View logs
docker-compose -f docker-compose.production.yml logs -f backend
```

### Rollback Procedure

```bash
# Stop current version
docker-compose -f docker-compose.production.yml down

# Go back to previous commit
git checkout HEAD~1

# Restore backup
docker-compose -f docker-compose.production.yml exec postgres psql -U postgres < backup-prod.sql

# Start previous version
docker-compose -f docker-compose.production.yml up -d

# Run migrations for previous version
docker-compose -f docker-compose.production.yml exec -T backend alembic downgrade -1

# Verify
curl -f https://bookreader.example.com/api/health
```

### Blue-Green Deployment (Manual)

```bash
# 1. Backup database
docker-compose exec postgres pg_dump -U postgres bookreader_prod > backup-before-deploy.sql

# 2. Build and start new version (green)
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d --no-deps backend frontend

# 3. Wait for startup
sleep 60

# 4. Run migrations
docker-compose -f docker-compose.production.yml exec -T backend alembic upgrade head

# 5. Health check
curl -f http://localhost:8000/health

# 6. Reload Nginx (switch traffic)
docker-compose -f docker-compose.production.yml exec -T nginx nginx -s reload

# 7. Final health check
curl -f https://bookreader.example.com/api/health

# 8. If successful, no need to keep old containers
# If failed, run rollback steps above
```

---

## MAINTENANCE

### Cleanup Operations

```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything (be careful!)
docker system prune --all

# Clean Docker build cache
docker builder prune

# Remove specific image
docker image rm bookreader-backend:old

# Remove stopped containers
docker container prune --force
```

### Log Rotation

```bash
# Check logrotate configuration
cat /etc/logrotate.conf

# Manually rotate logs
logrotate -f /etc/logrotate.conf

# Test rotation config
logrotate -d /etc/logrotate.conf

# Check Docker logs location
docker inspect --format='{{.LogPath}}' bookreader_backend

# Check Docker log size
du -sh /var/lib/docker/containers/*/
```

### Database Maintenance

```bash
# Analyze and vacuum database
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "VACUUM ANALYZE;"

# Reindex tables
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "REINDEX DATABASE bookreader_dev;"

# Rebuild all indexes
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "REINDEX INDEX CONCURRENTLY idx_name;"

# Check database size
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Check table sizes
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

---

## TROUBLESHOOTING

### Common Issues

```bash
# Service won't start
docker-compose logs <service>           # Check logs
docker-compose exec <service> bash      # Debug interactively

# Port already in use
lsof -i :<port>                        # Find what's using port
kill -9 <PID>                          # Kill process

# Out of disk space
df -h                                  # Check disk usage
docker system prune                    # Clean up unused
docker image prune                     # Clean old images

# Connection refused
docker-compose exec backend curl http://postgres:5432  # Test connectivity
docker network inspect bookreader_network               # Check network

# Permission denied
sudo docker-compose ...                # Run with sudo if needed
chmod 777 ./volumes/...               # Fix volume permissions

# Memory leak / Out of memory
docker stats                           # Monitor memory usage
docker-compose restart <service>       # Restart service
# Check for infinite loops in code

# Database connection pool exhausted
docker-compose logs backend            # Check for errors
# Reduce WORKERS_COUNT or increase pool_size
```

### Health Check Debugging

```bash
# Check if service passes health check
docker inspect --format='{{json .State.Health}}' bookreader_backend

# View health check history
docker ps --format "table {{.Names}}\t{{.Status}}"

# Manually run health check
docker-compose exec backend curl -f http://localhost:8000/health

# Test from outside
curl -v http://localhost:8000/health

# Check network connectivity between services
docker-compose exec backend ping postgres
docker-compose exec backend curl http://redis:6379
```

### Performance Issues

```bash
# Slow queries
docker-compose logs postgres | grep "duration: [0-9]{4,}"

# Database locks
docker-compose exec postgres psql -U postgres -d bookreader_dev -c "SELECT * FROM pg_locks;"

# High CPU usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}"
top                                    # System level

# High memory usage
docker stats --format "table {{.Container}}\t{{.MemUsage}}"
free -h                                # System level

# Slow Redis
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> --latency
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> --latency-history
```

---

## CI/CD OPERATIONS

### GitHub Actions

```bash
# View workflow files
ls -la .github/workflows/

# Check syntax
yamllint .github/workflows/*.yml

# Manually trigger workflow (via GitHub CLI)
gh workflow run ci.yml
gh workflow run deploy.yml -f environment=staging

# View workflow status
gh workflow list
gh run list
gh run view <run_id>

# View logs for specific job
gh run view <run_id> --log

# Cancel running workflow
gh run cancel <run_id>

# Download artifacts
gh run download <run_id>
```

### Docker Registry (GHCR)

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u <USERNAME> --password-stdin

# Pull image from GHCR
docker pull ghcr.io/<USERNAME>/bookreader-backend:latest

# Tag image
docker tag bookreader-backend ghcr.io/<USERNAME>/bookreader-backend:v1.2.3

# Push to registry
docker push ghcr.io/<USERNAME>/bookreader-backend:v1.2.3

# List images in GHCR (via CLI)
gh api repos/<OWNER>/<REPO>/packages --paginate | jq '.[] | .name'

# Delete image from GHCR
gh api -X DELETE repos/<OWNER>/<REPO>/packages/<PACKAGE_NAME>
```

---

## SECURITY OPERATIONS

### Secret Management

```bash
# Generate strong secrets
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Update GitHub secrets
gh secret set SECRET_KEY --body "$(python -c 'import secrets; print(secrets.token_urlsafe(64))')"

# List secrets (names only)
gh secret list

# Delete secret
gh secret delete SECRET_KEY

# Scan for secrets in repo
git-secrets --scan
gitleaks detect --source git --verbose
```

### Container Security

```bash
# Scan image for vulnerabilities
trivy image bookreader-backend:latest

# Check for outdated dependencies
docker-compose exec backend pip list --outdated

# Scan source code
trivy fs . --severity CRITICAL,HIGH

# Check Docker config
docker-scout cves bookreader-backend:latest
```

---

## MONITORING SETUP (Optional)

### Enable Monitoring Stack

```bash
# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana
# URL: http://localhost:3000
# User: admin
# Password: <GRAFANA_PASSWORD from .env>

# Access Prometheus
# URL: http://localhost:9090

# View metrics
curl http://localhost:9090/api/v1/query?query=up

# Add Prometheus data source to Grafana
# URL: http://prometheus:9090
```

---

## USEFUL ALIASES

```bash
# Add to ~/.bashrc or ~/.zshrc
alias dc='docker-compose'
alias dce='docker-compose exec'
alias dcl='docker-compose logs -f'
alias dcs='docker-compose ps'
alias dcup='docker-compose up -d'
alias dcdn='docker-compose down'
alias dcr='docker-compose restart'
alias dcpull='docker-compose pull'

# Quick shortcuts
alias br-logs='docker-compose logs -f backend'
alias br-bash='docker-compose exec backend bash'
alias br-tests='docker-compose exec backend pytest -v'
alias br-db='docker-compose exec postgres psql -U postgres -d bookreader_dev'

# Production (requires -f flag)
alias dcprod='docker-compose -f docker-compose.production.yml'
```

---

## RESOURCES

- **Docker Docs:** https://docs.docker.com/
- **Docker Compose Docs:** https://docs.docker.com/compose/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Redis Docs:** https://redis.io/documentation
- **GitHub Actions:** https://docs.github.com/en/actions
- **Nginx Docs:** https://nginx.org/en/docs/

---

**Last Updated:** November 3, 2025
**Infrastructure Version:** Production-Ready ✅

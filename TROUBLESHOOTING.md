# Troubleshooting Guide

Common problems and solutions for BookReader AI.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Docker Issues](#docker-issues)
- [Database Issues](#database-issues)
- [Backend Issues](#backend-issues)
- [Frontend Issues](#frontend-issues)
- [NLP System Issues](#nlp-system-issues)
- [Image Generation Issues](#image-generation-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

### Health Check

Run these commands to quickly diagnose issues:

```bash
# Check all services status
docker-compose ps

# Check backend health
curl http://localhost:8000/health

# Check frontend
curl http://localhost:5173

# Check logs
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 frontend
docker-compose logs --tail=50 celery-worker

# Check disk space
df -h

# Check memory
free -h
```

### Common Issues Checklist

- [ ] All Docker containers running?
- [ ] .env file exists and configured?
- [ ] Ports not conflicting (8000, 5173, 5432, 6379)?
- [ ] Database initialized and migrated?
- [ ] NLP models downloaded?
- [ ] Sufficient disk space (>5GB free)?
- [ ] Sufficient memory (>2GB free)?

---

## Installation Issues

### Issue: Cannot clone repository

**Problem:**
```
fatal: repository not found
```

**Solutions:**
1. Check repository URL is correct
2. Verify Git credentials/SSH keys
3. Check network connection
4. Try HTTPS instead of SSH (or vice versa)

```bash
# HTTPS
git clone https://github.com/your-org/fancai-vibe-hackathon.git

# SSH
git clone git@github.com:your-org/fancai-vibe-hackathon.git
```

### Issue: Python version too old

**Problem:**
```
Python 3.11+ required, you have 3.9
```

**Solutions:**
```bash
# macOS
brew install python@3.11

# Ubuntu
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install python3.11

# Verify
python3.11 --version
```

### Issue: Node.js version too old

**Problem:**
```
Node.js 18+ required
```

**Solutions:**
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify
node --version
```

### Issue: Missing .env file

**Problem:**
```
Error: .env file not found
```

**Solution:**
```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env

# Required variables:
# - DATABASE_URL
# - REDIS_URL
# - SECRET_KEY
# - POLLINATIONS_ENABLED=true
```

---

## Docker Issues

### Issue: Docker daemon not running

**Problem:**
```
Cannot connect to the Docker daemon
```

**Solutions:**
```bash
# Start Docker
# macOS
open -a Docker

# Linux
sudo systemctl start docker

# Verify
docker ps
```

### Issue: Port already in use

**Problem:**
```
Error: bind: address already in use
```

**Solutions:**
```bash
# Find process using port (example: 8000)
lsof -i :8000

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "8001:8000"  # Changed from 8000:8000
```

### Issue: Container keeps restarting

**Problem:**
```
backend_1 exited with code 1
```

**Solutions:**
```bash
# Check logs for error
docker-compose logs backend

# Common causes:
# 1. Database not ready - wait 30s and retry
# 2. Missing environment variables - check .env
# 3. Port conflict - see above
# 4. Missing dependencies - rebuild image

# Rebuild image
docker-compose build --no-cache backend
docker-compose up -d
```

### Issue: Permission denied errors

**Problem:**
```
mkdir: cannot create directory: Permission denied
```

**Solutions:**
```bash
# Fix ownership (Linux)
sudo chown -R $USER:$USER .

# Or run with sudo (not recommended)
sudo docker-compose up -d

# macOS: Reset Docker Desktop file sharing
# Docker Desktop → Preferences → Resources → File Sharing
```

### Issue: Out of disk space

**Problem:**
```
No space left on device
```

**Solutions:**
```bash
# Clean Docker system
docker system prune -a --volumes

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Check space freed
df -h
```

---

## Database Issues

### Issue: Database connection failed

**Problem:**
```
sqlalchemy.exc.OperationalError: could not connect to server
```

**Solutions:**
```bash
# Check PostgreSQL running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Verify format
# postgresql://user:password@localhost:5432/dbname

# Restart database
docker-compose restart postgres

# Wait 10s for startup
sleep 10

# Test connection
docker-compose exec backend python -c "from app.core.database import engine; engine.connect()"
```

### Issue: Migration fails

**Problem:**
```
alembic.util.exc.CommandError: Can't locate revision
```

**Solutions:**
```bash
# Check current version
cd backend && alembic current

# Check available versions
alembic history

# Reset to base (DESTRUCTIVE - development only!)
alembic downgrade base

# Apply all migrations
alembic upgrade head

# Force clean (DESTRUCTIVE - development only!)
docker-compose down -v
docker-compose up -d
cd backend && alembic upgrade head
```

### Issue: Duplicate key error

**Problem:**
```
psycopg2.errors.UniqueViolation: duplicate key value
```

**Solutions:**
```bash
# Check for existing data
docker-compose exec postgres psql -U postgres -d bookreader -c "SELECT * FROM table_name WHERE id='value';"

# Delete duplicate (if appropriate)
docker-compose exec postgres psql -U postgres -d bookreader -c "DELETE FROM table_name WHERE id='value';"

# Or reset database (DESTRUCTIVE)
docker-compose down -v
docker-compose up -d
```

### Issue: Table doesn't exist

**Problem:**
```
psycopg2.errors.UndefinedTable: relation "table_name" does not exist
```

**Solutions:**
```bash
# Run migrations
cd backend && alembic upgrade head

# If that fails, check migration files
ls backend/alembic/versions/

# Recreate database (DESTRUCTIVE)
docker-compose down -v
docker-compose up -d
cd backend && alembic upgrade head
```

---

## Backend Issues

### Issue: Import errors

**Problem:**
```
ModuleNotFoundError: No module named 'app'
```

**Solutions:**
```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Verify installation
pip list | grep fastapi

# If in Docker, rebuild
docker-compose build backend
```

### Issue: Celery worker not starting

**Problem:**
```
[ERROR] Consumer: Cannot connect to redis
```

**Solutions:**
```bash
# Check Redis running
docker-compose ps redis

# Check Redis connection
docker-compose exec backend python -c "import redis; r = redis.from_url('redis://redis:6379'); r.ping()"

# Restart Redis
docker-compose restart redis

# Restart Celery worker
docker-compose restart celery-worker

# Check worker logs
docker-compose logs -f celery-worker
```

### Issue: JWT token errors

**Problem:**
```
401 Unauthorized: Invalid token
```

**Solutions:**
```bash
# Check SECRET_KEY is set
echo $SECRET_KEY

# Generate new secret (if missing)
openssl rand -hex 32

# Update .env
SECRET_KEY=<generated_key>

# Restart backend
docker-compose restart backend

# Clear browser cookies/localStorage
# DevTools → Application → Clear Storage
```

### Issue: Slow API responses

**Problem:**
API calls take >1 second

**Solutions:**
```bash
# Check database indexes
docker-compose exec postgres psql -U postgres -d bookreader -c "\d+ books"

# Check Redis cache
docker-compose exec redis redis-cli INFO stats

# Enable query logging
# In backend/app/core/database.py
# engine = create_async_engine(url, echo=True)

# Restart backend
docker-compose restart backend
```

---

## Frontend Issues

### Issue: npm install fails

**Problem:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**
```bash
# Clean install
cd frontend
rm -rf node_modules package-lock.json
npm install

# Use legacy peer deps (if needed)
npm install --legacy-peer-deps

# Or use exact versions
npm ci
```

### Issue: Build fails

**Problem:**
```
ERROR in ./src/components/Component.tsx
Module not found: Error: Can't resolve 'module'
```

**Solutions:**
```bash
# Check imports
# Make sure paths are correct
# Use absolute imports from 'src/'

# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build

# Check TypeScript errors
npm run type-check
```

### Issue: Development server won't start

**Problem:**
```
Port 5173 is already in use
```

**Solutions:**
```bash
# Find process
lsof -i :5173

# Kill process
kill -9 <PID>

# Or change port
# In vite.config.ts
server: {
  port: 5174
}
```

### Issue: Hot reload not working

**Problem:**
Changes not reflected in browser

**Solutions:**
```bash
# Clear cache
# Browser DevTools → Network → Disable cache

# Restart dev server
# Ctrl+C
npm run dev

# Check file watcher limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Issue: TypeScript errors

**Problem:**
```
Type 'X' is not assignable to type 'Y'
```

**Solutions:**
```bash
# Check type definitions
npm run type-check

# Update types
npm install --save-dev @types/node @types/react @types/react-dom

# Restart TypeScript server (VS Code)
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

## NLP System Issues

### Issue: NLP models not found

**Problem:**
```
OSError: Can't find model 'ru_core_news_lg'
```

**Solutions:**
```bash
# Download SpaCy model
python -m spacy download ru_core_news_lg

# Download Stanza model
python -c "import stanza; stanza.download('ru')"

# Install Natasha (if missing)
pip install natasha

# Verify installation
python -c "import spacy; nlp = spacy.load('ru_core_news_lg'); print('SpaCy OK')"
python -c "import stanza; nlp = stanza.Pipeline('ru'); print('Stanza OK')"
python -c "from natasha import Segmenter; print('Natasha OK')"
```

### Issue: Low description quality

**Problem:**
Too few or irrelevant descriptions extracted

**Solutions:**
```bash
# Switch to ENSEMBLE mode (best quality)
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "ENSEMBLE"}'

# Adjust processor weights
# Increase Natasha (best for Russian literature)
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/natasha \
  -d '{"weight": 1.5, "threshold": 0.2}'

# Check processor status
curl http://localhost:8000/api/v1/admin/multi-nlp-settings/status
```

### Issue: NLP processing too slow

**Problem:**
Book parsing takes >30 seconds

**Solutions:**
```bash
# Use SINGLE mode (fastest)
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/mode \
  -d '{"mode": "SINGLE"}'

# Use only SpaCy (fastest processor)
# In backend/app/core/config.py
ACTIVE_PROCESSORS = ["spacy"]

# Increase batch size (careful with memory!)
# In multi_nlp_manager.py
BATCH_SIZE = 10  # Default: 5
```

### Issue: Memory errors during NLP

**Problem:**
```
MemoryError: Unable to allocate array
```

**Solutions:**
```bash
# Reduce batch size
# In multi_nlp_manager.py
BATCH_SIZE = 3  # Default: 5

# Process chapters sequentially
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/mode \
  -d '{"mode": "SEQUENTIAL"}'

# Increase Docker memory limit
# In docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 4G  # Increase from 2G
```

---

## Image Generation Issues

### Issue: Images not generating

**Problem:**
No images appear after book upload

**Solutions:**
```bash
# Check Celery worker
docker-compose logs celery-worker

# Check pollinations.ai service
curl https://image.pollinations.ai/prompt/test

# Verify descriptions exist
curl http://localhost:8000/api/v1/books/{book_id}/descriptions

# Restart Celery worker
docker-compose restart celery-worker

# Check task queue
docker-compose exec redis redis-cli LLEN celery
```

### Issue: Image generation fails

**Problem:**
```
Task generate_image failed: Connection timeout
```

**Solutions:**
```bash
# Check internet connection
ping image.pollinations.ai

# Increase timeout
# In backend/app/services/image_generator.py
timeout = 60  # Increase from 30

# Use alternative service
# In .env
OPENAI_API_KEY=sk-...
```

### Issue: Poor image quality

**Problem:**
Generated images don't match descriptions

**Solutions:**
```bash
# Improve prompts
# Edit backend/app/services/prompt_engineering.py
# Add more context, genre-specific details

# Use better AI service
# DALL-E instead of pollinations.ai
# In .env
OPENAI_API_KEY=sk-...
IMAGE_SERVICE=openai

# Adjust generation parameters
# In backend/app/services/image_generator.py
quality = "hd"  # For DALL-E
steps = 50  # For Stable Diffusion
```

---

## Performance Issues

### Issue: Slow database queries

**Problem:**
API responses >500ms

**Solutions:**
```bash
# Check indexes exist
docker-compose exec postgres psql -U postgres -d bookreader -c "\d+ books"

# Create missing indexes
# Should see GIN indexes on JSONB columns

# Run VACUUM
docker-compose exec postgres psql -U postgres -d bookreader -c "VACUUM ANALYZE;"

# Check slow queries
docker-compose exec postgres psql -U postgres -d bookreader -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Issue: High memory usage

**Problem:**
Docker containers using >4GB RAM

**Solutions:**
```bash
# Check memory usage
docker stats

# Reduce Celery workers
# In docker-compose.yml
command: celery -A app.core.celery worker --concurrency=2

# Reduce NLP batch size
# In multi_nlp_manager.py
BATCH_SIZE = 3

# Increase swap (Linux)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Issue: Slow frontend loading

**Problem:**
Page load time >3 seconds

**Solutions:**
```bash
# Build production bundle
cd frontend
npm run build

# Check bundle size
npm run build -- --mode=production --analyze

# Enable code splitting
# Already implemented with React.lazy()

# Enable caching
# In nginx.conf
location /static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Deployment Issues

### Issue: SSL certificate fails

**Problem:**
```
Failed to obtain Let's Encrypt certificate
```

**Solutions:**
```bash
# Check domain DNS
nslookup your-domain.com

# Check port 80 accessible
curl http://your-domain.com

# Check Certbot logs
docker-compose logs certbot

# Manual certificate request
./scripts/deploy.sh ssl

# If fails, check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Issue: Production deployment fails

**Problem:**
```
Health check failed
```

**Solutions:**
```bash
# Check all services running
./scripts/deploy.sh status

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Verify .env.production
cat .env.production | grep -v PASSWORD

# Restart services
./scripts/deploy.sh restart

# Full redeployment
./scripts/deploy.sh deploy
```

### Issue: Nginx 502 Bad Gateway

**Problem:**
Browser shows "502 Bad Gateway"

**Solutions:**
```bash
# Check backend running
docker-compose ps backend

# Check Nginx logs
docker-compose logs nginx

# Check Nginx config
docker-compose exec nginx nginx -t

# Restart Nginx
docker-compose restart nginx

# If persists, check firewall
sudo ufw status
```

---

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Search existing [GitHub Issues](https://github.com/your-org/fancai-vibe-hackathon/issues)
3. Check [FAQ](FAQ.md)
4. Review relevant documentation in [docs/](docs/)

### How to Report an Issue

Include:
1. **Description:** What's wrong?
2. **Steps to reproduce:** How can we reproduce it?
3. **Expected behavior:** What should happen?
4. **Actual behavior:** What actually happens?
5. **Environment:**
   - OS (macOS 14, Ubuntu 22.04, etc.)
   - Docker version
   - Browser (if frontend issue)
6. **Logs:** Relevant error messages
7. **Screenshots:** If applicable

### Useful Diagnostic Commands

```bash
# System info
uname -a
docker --version
docker-compose --version

# Service status
docker-compose ps
docker-compose logs --tail=100

# Resource usage
docker stats
df -h
free -h

# Network
netstat -tuln | grep -E '8000|5173|5432|6379'

# Environment
env | grep -E 'DATABASE_URL|REDIS_URL|SECRET_KEY' | sed 's/=.*/=***/'
```

### Contact

- **GitHub Issues:** https://github.com/your-org/fancai-vibe-hackathon/issues
- **Documentation:** [docs/](docs/)
- **Email:** support@bookreader.ai (if available)

---

**Last Updated:** November 14, 2025

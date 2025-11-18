Выполни comprehensive pre-deployment health check перед деплоем на production.

ЗАДАЧА:
1. **Health Checks:**
   - Backend API: GET /health (должен вернуть 200 OK)
   - Database: connection check
   - Redis: ping check
   - Celery workers: active workers count

2. **Critical Tests:**
   - Run pytest для core modules (app/core/, app/models/)
   - Run Multi-NLP smoke test (1 chapter processing)
   - Check migrations status (alembic current)

3. **Configuration Validation:**
   - Проверь .env.production variables
   - SSL certificates validity (expire date >30 days)
   - Docker images versions (latest tags)

4. **Resource Checks:**
   - Disk space (должно быть >20% free)
   - Database size (check growth trends)
   - Redis memory usage (<80%)

5. **Security Scan:**
   - Check for exposed secrets in git
   - Verify HTTPS redirect active
   - Check CORS settings

6. **Recent Changes Review:**
   - Last 5 git commits
   - Changed files count
   - Breaking changes detection

ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
```markdown
# Pre-Deployment Health Check - {date}

## ✅ Health Status
- Backend API: HEALTHY
- Database: HEALTHY
- Redis: HEALTHY
- Celery Workers: 3 active

## ✅ Tests
- Core Tests: 120/120 passed
- NLP Smoke Test: PASSED (0.16s)
- Migrations: Up-to-date

## ✅ Configuration
- Environment: production
- SSL: Valid until {date}
- Docker: Latest images

## ✅ Resources
- Disk: 45% free (GOOD)
- Database: 2.5GB (NORMAL)
- Redis: 65% memory (GOOD)

## ✅ Security
- No exposed secrets
- HTTPS: Active
- CORS: Configured

## 📊 Recent Changes
- Commits: 5 (last 24h)
- Changed files: 12
- Breaking changes: NONE

## 🎯 Deployment Decision
✅ APPROVED - Safe to deploy

или

❌ BLOCKED - Issues found:
- {issue 1}
- {issue 2}
```

АГЕНТЫ:
- DevOps Engineer (для health checks)
- Testing & QA Specialist (для тестов)
- Backend API Developer (для API checks)

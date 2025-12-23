# Database Optimization Summary - 4GB RAM Server

**Date:** 2025-11-15
**Target:** Production/Staging deployment на 4GB RAM, 2 CPU cores server
**Status:** READY FOR DEPLOYMENT

## Created Files

### 1. PostgreSQL Configuration

#### postgres/postgresql.conf
**Size:** ~15KB
**Purpose:** Оптимизированные настройки PostgreSQL для 4GB RAM server

**Key Settings:**
```conf
shared_buffers = 256MB
max_connections = 100
work_mem = 4MB
maintenance_work_mem = 64MB
effective_cache_size = 1GB
random_page_cost = 1.1 (SSD optimized)
autovacuum = on (aggressive)
```

**Memory Budget:**
- Shared buffers: 256MB
- Connections (100 * 4MB work_mem): 400MB
- Overhead: ~200MB
- **Total:** ~850MB (safe для 1GB limit)

#### postgres/init/01-extensions.sql
**Size:** ~8KB
**Purpose:** Database initialization script

**Features:**
- Creates extensions: pg_stat_statements, pg_trgm, btree_gin, uuid-ossp
- Creates monitoring user (read-only)
- Creates helper functions: get_slow_queries(), get_table_sizes(), etc.
- Sets database defaults (timezone, text search config)

#### postgres/README.md
**Size:** ~3KB
**Purpose:** Quick reference для PostgreSQL configuration

### 2. Redis Configuration

#### redis/redis.conf
**Size:** ~12KB
**Purpose:** Оптимизированные настройки Redis для 256-512MB RAM

**Key Settings:**
```conf
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes (AOF enabled)
appendfsync everysec
activedefrag yes
```

**Security:**
- FLUSHDB/FLUSHALL disabled
- CONFIG renamed
- Password required

#### redis/README.md
**Size:** ~4KB
**Purpose:** Quick reference для Redis configuration

### 3. Backup Script

#### scripts/backup-database.sh
**Size:** ~15KB
**Purpose:** Automated PostgreSQL backups с retention policy

**Features:**
- Compressed pg_dump (custom format, level 9)
- Automatic retention (7 days default)
- Docker-aware
- Error handling и logging
- Backup verification

**Usage:**
```bash
# Manual backup
./scripts/backup-database.sh

# Custom retention
./scripts/backup-database.sh --keep-days 14

# List backups
./scripts/backup-database.sh --list
```

**Cron Setup:**
```cron
0 2 * * * /path/to/backup-database.sh >> /var/log/backup-database.log 2>&1
```

### 4. Documentation

#### docs/operations/deployment/database-optimization-4gb-server.md
**Size:** ~45KB
**Purpose:** Complete optimization guide

**Sections:**
1. Memory Budget Overview
2. PostgreSQL Configuration
3. Redis Configuration
4. Backup Strategy
5. Environment Variables
6. Performance Tuning
7. Monitoring Setup
8. Troubleshooting
9. Disaster Recovery
10. Production Recommendations
11. Checklist

### 5. Docker Compose Updates

#### docker-compose.production.yml
**Updated sections:**

**PostgreSQL:**
```yaml
postgres:
  command: postgres -c config_file=/etc/postgresql/postgresql.conf
  volumes:
    - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    - ./postgres/init:/docker-entrypoint-initdb.d:ro
    - postgres_logs:/var/log/postgresql
```

**Redis:**
```yaml
redis:
  command: redis-server /usr/local/etc/redis/redis.conf --requirepass ${REDIS_PASSWORD}
  volumes:
    - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
```

**New volumes:**
```yaml
volumes:
  postgres_logs:
    driver: local
```

## Memory Allocation Summary

**Total Server RAM:** 4GB

| Component | Allocated RAM | Notes |
|-----------|---------------|-------|
| PostgreSQL | 512MB-1GB | Shared buffers + connections |
| Redis | 256MB-512MB | Maxmemory limit |
| Backend API | 500MB-1GB | 4 Gunicorn workers |
| Celery Worker | 500MB-1GB | NLP models + tasks |
| OS + Overhead | 500MB-800MB | Kernel, system processes |
| **TOTAL** | **~3.5GB** | Safe margin для 4GB server |

## SQLAlchemy Connection Pool

**Environment Variables (Staging Profile):**

```bash
# Connection Pool Settings
DB_POOL_SIZE=10               # Base pool size per worker
DB_MAX_OVERFLOW=10            # Additional connections under load
DB_POOL_RECYCLE=3600          # Recycle connections every 1 hour
DB_POOL_TIMEOUT=30            # Wait timeout (30 seconds)

# Total connections calculation:
# - Gunicorn workers: 4
# - Pool per worker: 10 + 10 = 20 max
# - Total capacity: 4 * 20 = 80 connections
# - PostgreSQL max_connections: 100 (safe margin)
```

**Already configured in:**
- `backend/app/core/config.py` (default values)
- `backend/app/core/database.py` (engine configuration)

## Deployment Checklist

### Pre-Deployment

- [x] PostgreSQL config created (postgres/postgresql.conf)
- [x] PostgreSQL init script created (postgres/init/01-extensions.sql)
- [x] Redis config created (redis/redis.conf)
- [x] Backup script created (scripts/backup-database.sh)
- [x] docker-compose.production.yml updated
- [x] Documentation created
- [ ] Set environment variables in .env.production
- [ ] Review and adjust DB_POOL_SIZE для your worker count
- [ ] Test backup script locally

### Deployment Steps

1. **Copy files to server:**
```bash
# All configuration files are in git, just pull latest
git pull origin main
```

2. **Set environment variables (.env.production):**
```bash
# Database
DB_NAME=bookreader
DB_USER=postgres
DB_PASSWORD=<strong_password>

# Redis
REDIS_PASSWORD=<strong_redis_password>

# Connection Pool (Staging Profile)
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=10
DB_POOL_RECYCLE=3600
DB_POOL_TIMEOUT=30

# Workers
WORKERS_COUNT=4
CELERY_CONCURRENCY=1
```

3. **Deploy services:**
```bash
docker-compose -f docker-compose.production.yml up -d
```

4. **Verify PostgreSQL config:**
```bash
docker exec bookreader_postgres cat /etc/postgresql/postgresql.conf | head -50
```

5. **Verify Redis config:**
```bash
docker exec bookreader_redis cat /usr/local/etc/redis/redis.conf | head -50
```

6. **Check extensions installed:**
```bash
docker exec -it bookreader_postgres psql -U postgres -d bookreader -c "SELECT * FROM pg_extension;"
```

7. **Test helper functions:**
```bash
docker exec -it bookreader_postgres psql -U postgres -d bookreader -c "SELECT * FROM get_database_size();"
```

8. **Setup automated backups:**
```bash
# Make backup script executable
chmod +x scripts/backup-database.sh

# Test backup
./scripts/backup-database.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /path/to/fancai-vibe-hackathon/scripts/backup-database.sh >> /var/log/backup-database.log 2>&1
```

### Post-Deployment Verification

- [ ] Check PostgreSQL connections: `SELECT count(*) FROM pg_stat_activity;`
- [ ] Check Redis memory: `redis-cli INFO MEMORY`
- [ ] Verify monitoring user: `psql -U monitoring -d bookreader`
- [ ] Test slow query logging: `SELECT * FROM get_slow_queries(10);`
- [ ] Check cache hit ratio: `SELECT * FROM pg_statio_user_tables;`
- [ ] Monitor backup success: Check /backups/postgresql/
- [ ] Test backup restoration (on staging)

## Monitoring Queries

### PostgreSQL

**Connection Count:**
```sql
SELECT count(*) as total, state
FROM pg_stat_activity
WHERE datname = 'bookreader'
GROUP BY state;
```

**Cache Hit Ratio (target >99%):**
```sql
SELECT
    sum(heap_blks_hit)::NUMERIC /
    nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100
    as cache_hit_ratio
FROM pg_statio_user_tables;
```

**Slow Queries:**
```sql
SELECT * FROM get_slow_queries(10);
```

**Table Sizes:**
```sql
SELECT * FROM get_table_sizes();
```

### Redis

**Memory Usage:**
```bash
docker exec bookreader_redis redis-cli -a ${REDIS_PASSWORD} INFO MEMORY | grep -E "(used_memory_human|maxmemory_human)"
```

**Keyspace:**
```bash
docker exec bookreader_redis redis-cli -a ${REDIS_PASSWORD} INFO KEYSPACE
```

**Cache Hit Rate:**
```bash
docker exec bookreader_redis redis-cli -a ${REDIS_PASSWORD} INFO STATS | grep keyspace
```

## Performance Benchmarks

**Expected metrics для 4GB server:**

| Metric | Target | Command |
|--------|--------|---------|
| PostgreSQL query latency (p95) | <100ms | `SELECT * FROM get_slow_queries(10);` |
| PostgreSQL cache hit ratio | >99% | See query above |
| Redis command latency (p95) | <5ms | `redis-cli --latency` |
| Redis cache hit rate | >90% | `INFO STATS` |
| Connection wait time | <50ms | Monitor pool timeout errors |
| Concurrent users supported | 10-50 | Load testing |

## Troubleshooting

### PostgreSQL Issues

**Connection Pool Exhausted:**
```
sqlalchemy.exc.TimeoutError: QueuePool limit reached
```

**Solution:**
1. Check active connections: `SELECT count(*) FROM pg_stat_activity;`
2. Increase DB_POOL_SIZE (if RAM allows)
3. Check для connection leaks

**High Memory:**
```
PostgreSQL using >1.5GB RAM
```

**Solution:**
1. Reduce shared_buffers or max_connections
2. Check для long-running queries
3. Monitor work_mem usage

### Redis Issues

**OOM:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Solution:**
1. Check memory usage: `INFO MEMORY`
2. Check evicted keys: `INFO STATS`
3. Increase maxmemory or optimize TTLs

**High Fragmentation:**
```
mem_fragmentation_ratio > 1.5
```

**Solution:**
1. Active defrag already enabled
2. Monitor defrag progress: `INFO MEMORY | grep defrag`
3. Restart Redis (last resort)

## Files Summary

```
/Users/sandk/Documents/GitHub/fancai-vibe-hackathon/
├── postgres/
│   ├── postgresql.conf                 # NEW: PostgreSQL optimized config
│   ├── init/
│   │   └── 01-extensions.sql          # NEW: Initialization script
│   └── README.md                       # NEW: PostgreSQL quick reference
├── redis/
│   ├── redis.conf                      # NEW: Redis optimized config
│   └── README.md                       # NEW: Redis quick reference
├── scripts/
│   └── backup-database.sh              # NEW: Automated backup script
├── docs/operations/deployment/
│   └── database-optimization-4gb-server.md  # NEW: Complete guide
├── docker-compose.production.yml       # UPDATED: Uses custom configs
└── DATABASE_OPTIMIZATION_SUMMARY.md    # NEW: This file
```

## Next Steps

### Immediate (After Deployment)

1. Monitor resource usage first 24 hours
2. Check backup success
3. Verify cache hit ratios
4. Review slow query logs

### Short-term (1-2 weeks)

1. Tune autovacuum based on table growth
2. Optimize indexes based on slow queries
3. Adjust connection pool size if needed
4. Fine-tune Redis eviction policy

### Long-term (1-3 months)

1. Plan для scaling if user base grows
2. Consider PgBouncer для connection pooling
3. Evaluate Redis replication для HA
4. Review database growth trends

## Production Upgrade Path

Если в будущем переходите на более мощный сервер (8GB+ RAM):

**PostgreSQL:**
```conf
shared_buffers = 512MB
effective_cache_size = 4GB
max_connections = 200
```

**Redis:**
```conf
maxmemory 2gb
```

**SQLAlchemy:**
```bash
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
```

**Gunicorn:**
```bash
WORKERS_COUNT=8
```

## Support

**Documentation:**
- Full guide: `docs/operations/deployment/database-optimization-4gb-server.md`
- PostgreSQL reference: `postgres/README.md`
- Redis reference: `redis/README.md`

**Monitoring:**
- PostgreSQL helper functions in database
- Redis INFO commands
- Docker stats: `docker stats bookreader_postgres bookreader_redis`

**Logs:**
- PostgreSQL: `docker logs bookreader_postgres`
- Redis: `docker logs bookreader_redis`
- Backup: `/backups/postgresql/backup.log`

---

**Created by:** Database Architect Agent
**Last Updated:** 2025-11-15
**Version:** 1.0
**Status:** Production Ready

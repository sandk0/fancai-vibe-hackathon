# Архитектура развертывания BookReader AI

## Общая схема

BookReader AI использует микросервисную архитектуру на основе Docker контейнеров для обеспечения масштабируемости, надежности и удобства развертывания.

## Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet / Users                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Load Balancer                            │
│              (Let's Encrypt SSL)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Nginx Reverse Proxy                        │
│              (Security Headers, GZIP)                      │
└─────────┬─────────────────────┬─────────────────────────────┘
          │                     │
          ▼                     ▼
┌─────────────────┐   ┌─────────────────────────────────────┐
│   Frontend      │   │            Backend API             │
│  (React SPA)    │   │         (FastAPI + Gunicorn)       │
│   Static Files  │   │                                     │
└─────────────────┘   └─────────┬───────────────────────────┘
                                │
                                ▼
                      ┌─────────────────┐
                      │  Background     │
                      │  Workers        │
                      │  (Celery)       │
                      └─────────┬───────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   PostgreSQL    │   │      Redis      │   │  File Storage   │
│   (Database)    │   │   (Cache/Queue) │   │   (Books/Images)│
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## Компоненты системы

### Frontend Layer

**Container:** `bookreader_frontend`
- **Image:** Multi-stage build (Node.js → Nginx)  
- **Technology:** React 18 + TypeScript + Vite
- **Served by:** Nginx (static files)
- **Features:**
  - PWA с offline support
  - Mobile-responsive design  
  - Service Worker кэширование

### API Gateway Layer

**Container:** `bookreader_nginx`
- **Image:** `nginx:alpine`
- **Configuration:** `/nginx/nginx.prod.conf`
- **Features:**
  - SSL termination (Let's Encrypt)
  - Reverse proxy к backend
  - Security headers (HSTS, CSP, X-Frame-Options)
  - Rate limiting (100 req/min per IP)
  - GZIP compression
  - Static file caching

### Backend Application Layer

**Container:** `bookreader_backend`
- **Image:** Multi-stage build (Python 3.11 → production)
- **Technology:** FastAPI + Gunicorn + Uvicorn workers
- **Features:**
  - RESTful API (25+ endpoints)
  - JWT authentication (access + refresh)
  - Async database operations
  - NLP processing (spaCy)
  - AI image generation integration
  - File upload/processing

### Background Processing Layer

**Containers:** 
- `bookreader_celery_worker` (2 replicas)
- `bookreader_celery_beat` (scheduler)

**Technology:** Celery + Redis broker
- **Tasks:**
  - Book processing (EPUB/FB2 parsing)
  - NLP description extraction  
  - AI image generation
  - Cleanup operations
  - System monitoring

### Data Layer

#### Database
**Container:** `bookreader_postgres`
- **Image:** `postgres:15`
- **Features:**
  - Persistent volumes
  - Connection pooling
  - Daily automated backups
  - Health checks

#### Cache & Message Broker  
**Container:** `bookreader_redis`
- **Image:** `redis:alpine`
- **Features:**
  - Session storage
  - Celery task queue
  - API response caching
  - Rate limiting storage

#### File Storage
**Volume mounts:**
- `/backend/storage/books/` - Uploaded books
- `/backend/storage/covers/` - Book covers  
- `/backend/storage/images/` - Generated images

## Monitoring Stack (Optional)

### Observability Layer
- **Grafana** - Metrics visualization
- **Prometheus** - Metrics collection
- **Loki** - Log aggregation  
- **Promtail** - Log collection
- **cAdvisor** - Container metrics

## Network Architecture

### Docker Networks
```yaml
networks:
  bookreader_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Service Communication
- **Frontend → Backend:** HTTP/HTTPS через Nginx proxy
- **Backend → Database:** PostgreSQL protocol (port 5432)
- **Backend → Redis:** Redis protocol (port 6379)  
- **Celery → Redis:** Message queue protocol
- **External APIs:** HTTPS (pollinations.ai, etc.)

### Port Mapping
```
External:
  80/443  → Nginx (HTTP/HTTPS)
  3000    → Grafana (monitoring, optional)

Internal:
  8000    → Backend API
  5432    → PostgreSQL  
  6379    → Redis
  9090    → Prometheus
  3100    → Loki
```

## Security Architecture

### SSL/TLS Layer
- **Certificate Authority:** Let's Encrypt
- **Automation:** Certbot with auto-renewal
- **Protocol:** TLS 1.2+ only
- **Cipher Suites:** Modern secure ciphers

### Application Security
- **Authentication:** JWT tokens (access + refresh)
- **Authorization:** Role-based (user, admin)
- **CORS:** Strict origin validation
- **Input Validation:** Request/response schemas
- **File Upload:** Type/size validation
- **Rate Limiting:** IP-based throttling

### Infrastructure Security  
- **Container Security:** Non-root users
- **Network Security:** Internal Docker networks
- **Environment Secrets:** Secure env variable management
- **Database Security:** Connection pooling, prepared statements

## Scalability Strategy

### Horizontal Scaling
- **Backend API:** Multiple Gunicorn workers
- **Celery Workers:** Configurable replica count  
- **Database:** Connection pooling + read replicas
- **File Storage:** CDN integration ready

### Vertical Scaling
- **Resource Limits:** Configurable per service
- **Memory Management:** Optimized container sizes
- **CPU Allocation:** Multi-core utilization

### Caching Strategy
- **Redis Caching:** API responses, sessions
- **Browser Caching:** Static files (1 year)
- **CDN Ready:** For images and static assets

## High Availability

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]  
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

### Restart Policies
- **API/Workers:** `restart: unless-stopped`
- **Database:** `restart: unless-stopped`  
- **Monitoring:** `restart: on-failure`

### Backup Strategy
- **Database:** Daily automated backups via `scripts/deploy.sh backup`
- **File Storage:** Incremental backups to external storage
- **Configuration:** Version controlled deployment configs

## Deployment Pipeline

### Environment Stages
1. **Development:** `docker-compose.dev.yml`
2. **Production:** `docker-compose.production.yml`
3. **Monitoring:** `docker-compose.monitoring.yml`

### Deployment Process
```bash
# Initial deployment  
./scripts/deploy.sh init

# SSL setup
./scripts/deploy.sh ssl

# Application deployment
./scripts/deploy.sh deploy

# Monitoring setup (optional)
./scripts/setup-monitoring.sh start
```

### Zero-Downtime Deployment
- **Rolling updates:** Service-by-service updates
- **Health checks:** Before traffic routing
- **Rollback capability:** Previous image versions

## Performance Characteristics

### Expected Load
- **Concurrent Users:** 1000+
- **API Requests:** 10k+/hour
- **Book Processing:** 50+ books/hour
- **Image Generation:** 500+ images/hour

### Response Times
- **API Endpoints:** <200ms average
- **Book Upload:** <5s for 10MB file
- **Image Generation:** <30s average
- **Page Load:** <2s initial load

### Resource Requirements

#### Minimum (Single Server)
- **CPU:** 4 cores
- **RAM:** 8GB  
- **Storage:** 100GB SSD
- **Network:** 100 Mbps

#### Recommended (Production)
- **CPU:** 8+ cores
- **RAM:** 16GB+
- **Storage:** 500GB+ SSD
- **Network:** 1Gbps
- **Backup:** Separate storage system

## Monitoring & Observability

### Key Metrics
- **Application:** Response times, error rates, throughput
- **Infrastructure:** CPU, memory, disk, network usage
- **Business:** User registrations, book uploads, image generations

### Alerting
- **Critical:** Service downtime, database connectivity
- **Warning:** High resource usage, slow responses
- **Info:** Deployment completion, backup status

### Log Management
- **Centralized Logging:** All services → Loki
- **Log Retention:** 30 days default  
- **Log Analysis:** Grafana dashboards

---

## Заключение

Архитектура BookReader AI спроектирована для:
- **Высокой производительности** - асинхронные операции, кэширование
- **Надёжности** - health checks, автоматические перезапуски  
- **Безопасности** - современные стандарты шифрования и аутентификации
- **Масштабируемости** - горизонтальное и вертикальное масштабирование
- **Простоты развертывания** - автоматизированные скрипты и документация

Система готова для production использования и может обслуживать тысячи пользователей с минимальными требованиями к администрированию.
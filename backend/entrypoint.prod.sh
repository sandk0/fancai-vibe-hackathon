#!/bin/bash
# Production startup script for BookReader AI Backend
# Optimized for limited resources (4GB RAM, 2 CPU cores)

set -e  # Exit on error
set -u  # Exit on undefined variable

echo "=========================================="
echo "BookReader AI - Production Startup"
echo "=========================================="

# ============================================================================
# Environment Validation
# ============================================================================
echo "1. Validating environment..."

# Check required environment variables
required_vars=("DATABASE_URL" "REDIS_URL" "SECRET_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var:-}" ]; then
        echo "❌ ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

# Validate production mode
if [ "${DEBUG:-false}" = "true" ]; then
    echo "⚠️  WARNING: DEBUG=true in production startup script. Continuing anyway..."
fi

echo "✅ Environment validation passed"

# ============================================================================
# Database Connection Check
# ============================================================================
echo "2. Checking database connection..."

python3 << EOF
import sys
import asyncio
from app.core.database import engine

async def check_db():
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if not asyncio.run(check_db()):
    sys.exit(1)
EOF

# ============================================================================
# Database Migrations
# ============================================================================
echo "3. Running database migrations..."

if ! alembic upgrade head; then
    echo "❌ Database migration failed"
    exit 1
fi

echo "✅ Database migrations completed"

# ============================================================================
# NLP Models Check
# ============================================================================
echo "4. Checking NLP models availability..."

python3 << 'EOF'
import sys
import warnings
warnings.filterwarnings("ignore")

models_ok = True

# Check SpaCy
try:
    import spacy
    nlp = spacy.load('ru_core_news_lg')
    print("✅ SpaCy model (ru_core_news_lg) loaded successfully")
except Exception as e:
    print(f"⚠️  WARNING: SpaCy model loading failed: {e}")
    print("   Install: python -m spacy download ru_core_news_lg")
    models_ok = False

# Check Natasha
try:
    from natasha import NamesExtractor, MorphVocab
    extractor = NamesExtractor(MorphVocab())
    print("✅ Natasha library available")
except Exception as e:
    print(f"⚠️  WARNING: Natasha import failed: {e}")
    print("   Install: pip install natasha")
    models_ok = False

# Check Stanza
try:
    import stanza
    # Don't download here, just check if installed
    print("✅ Stanza library available")
except Exception as e:
    print(f"⚠️  WARNING: Stanza import failed: {e}")
    print("   Install: pip install stanza && python -c 'import stanza; stanza.download(\"ru\")'")
    models_ok = False

if not models_ok:
    print("\n⚠️  NLP models are incomplete - Multi-NLP features may not work properly")
    print("   Continuing startup anyway (models can be installed later)...")
else:
    print("\n✅ All NLP models are available")
EOF

# ============================================================================
# Redis Connection Check
# ============================================================================
echo "5. Checking Redis connection..."

python3 << EOF
import sys
import asyncio
from app.core.cache import cache_manager

async def check_redis():
    try:
        await cache_manager.initialize()
        if cache_manager.is_available:
            print("✅ Redis connection successful")
            await cache_manager.close()
            return True
        else:
            print("⚠️  WARNING: Redis unavailable - continuing without cache")
            return True  # Non-critical, allow startup
    except Exception as e:
        print(f"⚠️  WARNING: Redis connection failed: {e}")
        print("   Continuing without cache...")
        return True  # Non-critical, allow startup

asyncio.run(check_redis())
EOF

# ============================================================================
# Memory and Resource Info
# ============================================================================
echo "6. System resource info:"
echo "   Workers: ${WORKERS_COUNT:-4}"
echo "   Worker timeout: ${WORKER_TIMEOUT:-300}s"
echo "   DB pool size: ${DB_POOL_SIZE:-20}"
echo "   DB max overflow: ${DB_MAX_OVERFLOW:-40}"
echo "   Redis max connections: ${REDIS_MAX_CONNECTIONS:-50}"

# ============================================================================
# Start Application with Gunicorn + Uvicorn Workers
# ============================================================================
echo "=========================================="
echo "Starting Gunicorn with Uvicorn workers..."
echo "=========================================="

exec gunicorn app.main:app \
    --bind 0.0.0.0:8000 \
    --workers ${WORKERS_COUNT:-4} \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout ${WORKER_TIMEOUT:-300} \
    --max-requests ${WORKER_MAX_REQUESTS:-1000} \
    --max-requests-jitter ${WORKER_MAX_REQUESTS_JITTER:-100} \
    --worker-tmp-dir /dev/shm \
    --access-logfile - \
    --error-logfile - \
    --log-level ${LOG_LEVEL:-info} \
    --preload \
    --graceful-timeout 30 \
    --keep-alive 5

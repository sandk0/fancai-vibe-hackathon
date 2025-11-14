# Quick Start Guide

Get BookReader AI up and running in 5 minutes.

## Prerequisites

Before you begin, ensure you have:
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- [Git](https://git-scm.com/downloads) installed
- 4GB+ RAM available
- 5GB+ disk space available

## 5-Minute Setup

### Step 1: Clone Repository (30 seconds)

```bash
git clone <repository-url>
cd fancai-vibe-hackathon
```

### Step 2: Configure Environment (1 minute)

```bash
# Copy environment template
cp .env.example .env

# Generate secret key
openssl rand -hex 32

# Edit .env and set SECRET_KEY
nano .env
```

**Minimal .env configuration:**
```bash
# Required
SECRET_KEY=<your-generated-key>
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/bookreader
REDIS_URL=redis://redis:6379

# AI Service (free)
POLLINATIONS_ENABLED=true
```

### Step 3: Start Application (3 minutes)

```bash
# Start all services
docker-compose up -d

# Wait for services to start (about 2-3 minutes)
# Watch progress:
docker-compose logs -f backend
```

### Step 4: Verify Installation (30 seconds)

```bash
# Check backend health
curl http://localhost:8000/health
# Expected: {"status": "healthy"}

# Check frontend
open http://localhost:5173
# Or visit in browser
```

### Step 5: Create Admin Account (30 seconds)

```bash
# Access backend container
docker-compose exec backend bash

# Create superuser
python -m app.scripts.create_superuser
# Follow prompts to create account

# Exit container
exit
```

## Quick Test

### Upload Your First Book

1. **Open Application**
   - Navigate to http://localhost:5173
   - Login with admin credentials

2. **Upload Book**
   - Click "Upload Book" button
   - Select an EPUB file
   - Wait for upload (2-5 seconds)

3. **Wait for Processing**
   - Book parsing starts automatically
   - Watch progress indicator
   - Takes ~10-30 seconds depending on book size

4. **Start Reading**
   - Click "Open Book"
   - Descriptions are automatically highlighted
   - Click on highlighted text to see generated images

## What's Running?

After `docker-compose up -d`, you have:

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React application |
| Backend | 8000 | FastAPI server |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & task queue |
| Celery Worker | - | Background tasks |

## Common Commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f celery-worker

# Restart service
docker-compose restart backend

# Stop all services
docker-compose down

# Start again
docker-compose up -d

# Clean restart (removes data!)
docker-compose down -v
docker-compose up -d
```

## What's Next?

### For Users

- [Upload your first book](first-book.md) - Detailed walkthrough
- [User Manual](user-manual.md) - Full feature guide
- [FAQ](../../../FAQ.md) - Frequently asked questions

### For Developers

- [Installation Guide](installation.md) - Detailed setup
- [Development Workflow](../development/workflow.md) - How to contribute
- [Testing Guide](../testing/testing-guide.md) - Running tests
- [Contributing Guide](../../../CONTRIBUTING.md) - Contribution guidelines

## Troubleshooting

### Services Won't Start

```bash
# Check if ports are available
lsof -i :8000
lsof -i :5173

# Check Docker is running
docker ps

# View detailed logs
docker-compose logs
```

### Cannot Connect to Backend

```bash
# Restart backend
docker-compose restart backend

# Wait 10 seconds
sleep 10

# Test connection
curl http://localhost:8000/health
```

### NLP Models Missing

```bash
# Enter backend container
docker-compose exec backend bash

# Download models
python -m spacy download ru_core_news_lg
python -c "import stanza; stanza.download('ru')"

# Exit and restart
exit
docker-compose restart backend
```

### More Help

- [Troubleshooting Guide](../../../TROUBLESHOOTING.md) - Complete troubleshooting
- [FAQ](../../../FAQ.md) - Common questions
- [GitHub Issues](https://github.com/your-org/fancai-vibe-hackathon/issues) - Report bugs

## Quick Reference

### URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **API Redoc:** http://localhost:8000/redoc

### Default Credentials (Development)

- **Username:** admin@example.com
- **Password:** Set during superuser creation

### Environment Variables

See [.env.example](.env.example) for all available options.

**Required:**
- `SECRET_KEY` - JWT secret (32+ characters)
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection

**Optional:**
- `OPENAI_API_KEY` - For DALL-E image generation
- `DEBUG` - Enable debug mode (default: false)

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│   Frontend   │────▶│   Backend   │
│  (Client)   │     │   (React)    │     │  (FastAPI)  │
└─────────────┘     └──────────────┘     └─────────────┘
                                                 │
                          ┌──────────────────────┼────────────────┐
                          │                      │                │
                    ┌─────▼─────┐         ┌─────▼─────┐   ┌─────▼─────┐
                    │PostgreSQL │         │   Redis   │   │  Celery   │
                    │ (Database)│         │  (Cache)  │   │ (Workers) │
                    └───────────┘         └───────────┘   └───────────┘
```

## Features Available After Setup

- User authentication (JWT)
- Book upload (EPUB, FB2)
- Automatic NLP parsing
- AI image generation
- Reading interface with CFI positioning
- Smart description highlighting
- Progress tracking
- Dark/light themes

## Performance Expectations

| Operation | Time |
|-----------|------|
| Book upload | 2-5s |
| Book parsing | 10-30s |
| Image generation | 5-15s per image |
| Page load | <2s |

## Next Steps

1. **Explore Features**
   - Upload different book formats
   - Try different NLP modes (Admin panel)
   - Customize reading settings

2. **Development**
   - Read [Development Workflow](../development/workflow.md)
   - Check [Contributing Guide](../../../CONTRIBUTING.md)
   - Run tests: `cd backend && pytest`

3. **Production Deployment**
   - See [Production Deployment Guide](../deployment/production-deployment.md)
   - Set up SSL certificates
   - Configure monitoring

## Support

- **Documentation:** [docs/](../../README.md)
- **FAQ:** [FAQ.md](../../../FAQ.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](../../../TROUBLESHOOTING.md)
- **Issues:** [GitHub Issues](https://github.com/your-org/fancai-vibe-hackathon/issues)

---

**Congratulations!** You now have BookReader AI running locally.

For detailed documentation, see [Documentation Index](../../README.md).

**Last Updated:** November 14, 2025

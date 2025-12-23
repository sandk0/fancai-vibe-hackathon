<div align="center">

# BookReader AI

**Transform your reading experience with AI-generated visualizations**

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.125-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7.4-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

[Live Demo](https://fancai.ru) · [Documentation](docs/README.md) · [Report Bug](https://github.com/yourusername/bookreader-ai/issues) · [Request Feature](https://github.com/yourusername/bookreader-ai/issues)

---

English | **[Русский](README-ru.md)**

</div>

---

## About The Project

BookReader AI is a modern web application for reading fiction with **automatic AI-generated images** based on scene descriptions. As you read, the app extracts visual descriptions from the text and generates stunning illustrations using state-of-the-art AI models.

### How It Works

```
📖 Upload Book → 🔍 AI Extracts Descriptions → 🎨 Generate Images → ✨ Read with Visuals
```

1. **Upload** your EPUB or FB2 book
2. **Read** with a beautiful, customizable reader
3. **Discover** highlighted descriptions as you read
4. **Generate** AI illustrations for any scene with one click
5. **Save** your progress and reading position automatically

### Key Features

| Feature | Description |
|---------|-------------|
| 📚 **Multi-format Support** | EPUB and FB2 formats with full metadata extraction |
| 🤖 **LLM-Powered Extraction** | Google Gemini identifies characters, scenes, and settings |
| 🎨 **AI Image Generation** | Google Imagen 4 creates high-quality illustrations |
| 📍 **Smart Position Tracking** | CFI-based reading position with pixel-perfect restoration |
| 🌙 **Dark Mode** | Comfortable reading day and night |
| 📱 **PWA Ready** | Install as an app, works offline |
| 🔐 **Subscription Model** | FREE / PREMIUM / ULTIMATE tiers |

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Built With

### Frontend
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-5.90-FF4154?style=for-the-badge&logo=reactquery&logoColor=white)](https://tanstack.com/query)

### Backend
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.125-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.7-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7.4-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Celery](https://img.shields.io/badge/Celery-5.4-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev)

### AI Services
[![Google Gemini](https://img.shields.io/badge/Gemini-3.0_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Google Imagen](https://img.shields.io/badge/Imagen-4.0-EA4335?style=for-the-badge&logo=google&logoColor=white)](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Getting Started

Get BookReader AI running locally in under 5 minutes.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Git](https://git-scm.com/)
- Google Cloud API key (for Gemini + Imagen) - [Get one here](https://ai.google.dev/)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/bookreader-ai.git
cd bookreader-ai

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor

# Start all services
docker-compose up -d

# Open in browser
open http://localhost:5173
```

### Environment Variables

Create a `.env` file with these essential variables:

```env
# Required
DB_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password
SECRET_KEY=your_jwt_secret_key

# AI Services (required for image generation)
GOOGLE_API_KEY=your_google_api_key

# Optional
DEBUG=true
CORS_ORIGINS=http://localhost:5173
```

> **Note:** See [.env.example](.env.example) for all available options.

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client (Browser)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │ React 19    │  │ epub.js      │  │ TanStack Query + IndexedDB │  │
│  │ + TypeScript│  │ EPUB Renderer│  │ Caching Layer              │  │
│  └─────────────┘  └──────────────┘  └────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ REST API
┌────────────────────────────────┴────────────────────────────────────┐
│                        FastAPI Backend                              │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │ Auth (JWT)   │  │ Book Parser   │  │ Description Extractor    │  │
│  │              │  │ EPUB/FB2      │  │ (Google Gemini 3.0 Flash)│  │
│  └──────────────┘  └───────────────┘  └──────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Image Generator (Google Imagen 4)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────┬───────────────────────┘
               │                              │
    ┌──────────┴──────────┐        ┌─────────┴─────────┐
    │   PostgreSQL 15     │        │     Redis 7.4     │
    │   (Data Storage)    │        │ (Cache + Queue)   │
    └─────────────────────┘        └───────────────────┘
```

### Core Services

| Service | Purpose | Lines of Code |
|---------|---------|---------------|
| `book_parser.py` | EPUB/FB2 parsing, chapter extraction, CFI generation | 925 |
| `gemini_extractor.py` | LLM-based description extraction via Gemini API | 661 |
| `imagen_generator.py` | AI image generation via Imagen 4 | 644 |
| `reading_session_cache.py` | Redis-backed session caching | 454 |
| `auth_service.py` | JWT authentication and authorization | 373 |

> **Total Backend:** 15+ services, 7,757 lines of code

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## API Reference

### Authentication
```http
POST /api/v1/auth/register    # Create account
POST /api/v1/auth/login       # Get JWT token
POST /api/v1/auth/refresh     # Refresh token
```

### Books
```http
GET    /api/v1/books          # List user's books
POST   /api/v1/books/upload   # Upload EPUB/FB2
GET    /api/v1/books/{id}     # Get book details
DELETE /api/v1/books/{id}     # Delete book
```

### Reading
```http
GET  /api/v1/chapters/{id}              # Get chapter content
PUT  /api/v1/books/{id}/progress        # Update reading position
GET  /api/v1/descriptions/{chapter_id}  # Get extracted descriptions
```

### Images
```http
POST /api/v1/images/generate/{description_id}  # Generate image
GET  /api/v1/images/{id}                       # Get generated image
```

> **Full API Documentation:** Available at `/docs` (Swagger UI) when running locally.

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Performance

### Benchmarks

| Metric | Value | Improvement |
|--------|-------|-------------|
| Database Query Time | <5ms | 100x faster (vs 500ms) |
| API Response (cached) | <50ms | 83% faster |
| Frontend TTI | 1.2s | 66% faster |
| Bundle Size | 386KB gzipped | 29% smaller |
| Memory Usage | 2-3 GB RAM | 75% reduction |
| Docker Image | 800 MB | 68% smaller |

### Optimizations Applied

- **Database:** JSONB + GIN indexes for 100x faster queries
- **Caching:** Redis with 85% cache hit rate
- **Frontend:** TanStack Query with stale-while-revalidate pattern
- **Offline:** IndexedDB caching for chapters and images
- **Algorithms:** O(n) text highlighting (vs O(n²))

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Roadmap

- [x] EPUB/FB2 book parsing
- [x] LLM-based description extraction (Gemini)
- [x] AI image generation (Imagen 4)
- [x] Reading progress tracking (CFI)
- [x] Offline support (PWA + IndexedDB)
- [x] Subscription system
- [ ] Mobile apps (React Native)
- [ ] Social features (sharing, comments)
- [ ] Multiple AI model support
- [ ] Book recommendations

See the [open issues](https://github.com/yourusername/bookreader-ai/issues) for planned features and known issues.

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Contributing

Contributions make the open-source community amazing. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and development process.

### Development Setup

```bash
# Backend development
cd backend
pip install -r requirements.txt
pytest -v --cov=app           # Run tests
mypy app/                     # Type checking

# Frontend development
cd frontend
npm install
npm test                      # Run tests
npm run type-check            # TypeScript check
```

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Project Structure

```
bookreader-ai/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # UI components (47 total)
│   │   │   ├── Reader/       # EPUB reader (13 components)
│   │   │   ├── Library/      # Book library (6 components)
│   │   │   └── Admin/        # Admin panel (5 components)
│   │   ├── hooks/            # React hooks
│   │   │   ├── api/          # TanStack Query hooks (5 files)
│   │   │   ├── epub/         # EPUB reader hooks (17 files)
│   │   │   └── reader/       # Reader logic (7 files)
│   │   ├── services/         # API clients + caching
│   │   └── pages/            # Page components (11 pages)
│   └── tests/                # Vitest + Playwright tests
├── backend/                  # FastAPI + Python backend
│   ├── app/
│   │   ├── routers/          # API endpoints (70+ endpoints)
│   │   ├── services/         # Business logic (15+ services)
│   │   ├── models/           # SQLAlchemy models (9 models)
│   │   └── core/             # Config, DB, exceptions
│   └── tests/                # Pytest tests
├── docs/                     # Documentation (Diataxis framework)
├── docker-compose.yml        # Development stack
└── scripts/                  # Deployment scripts
```

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Documentation

Documentation follows the [Diataxis framework](https://diataxis.fr/):

| Category | Description | Link |
|----------|-------------|------|
| **Guides** | Step-by-step tutorials and how-to guides | [docs/guides/](docs/guides/) |
| **Reference** | API, database, component specifications | [docs/reference/](docs/reference/) |
| **Explanations** | Architecture and design decisions | [docs/explanations/](docs/explanations/) |
| **Operations** | Deployment and maintenance | [docs/operations/](docs/operations/) |

**Quick Links:**
- [Quick Start Guide](docs/guides/getting-started/quick-start.md)
- [API Documentation](docs/reference/api/overview.md)
- [Deployment Guide](docs/guides/deployment/production-deployment.md)
- [Architecture Overview](docs/explanations/architecture/system-architecture.md)

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## License

Proprietary software. All rights reserved.

See [LICENSE](LICENSE) for more information.

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

## Acknowledgments

- [epub.js](https://github.com/futurepress/epub.js) - EPUB rendering
- [TanStack Query](https://tanstack.com/query) - Server state management
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework
- [Google AI](https://ai.google.dev/) - Gemini and Imagen APIs
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template) - README inspiration

<p align="right">(<a href="#bookreader-ai">back to top</a>)</p>

---

<div align="center">

**[Website](https://fancai.ru)** · **[Documentation](docs/README.md)** · **[Report Bug](https://github.com/yourusername/bookreader-ai/issues)**

Made with passion for readers everywhere

</div>

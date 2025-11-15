"""
BookReader AI - FastAPI Main Application

Главный файл FastAPI приложения для веб-приложения чтения книг
с автоматической генерацией изображений по описаниям.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from datetime import datetime, timezone
from typing import Dict, Any

from .routers import (
    users,
    nlp,
    auth,
    images,
    chapters,
    reading_progress,
    descriptions,
    reading_sessions_router,
    health_router,
)
from .routers.admin import admin_router
from .routers.books import books_router
from .core.config import settings
from .core.cache import cache_manager
from .core.secrets import startup_secrets_check
from .services.settings_manager import settings_manager
from .services.multi_nlp_manager import multi_nlp_manager
from .middleware.security_headers import SecurityHeadersMiddleware
from .middleware.rate_limit import rate_limiter, rate_limit

# Версия приложения
VERSION = "0.1.0"

# Инициализация FastAPI приложения
app = FastAPI(
    title="BookReader AI API",
    description="API для чтения книг с ИИ-генерацией изображений",
    version=VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================================================
# Middleware Configuration
# ============================================================================

# Middleware добавляются в обратном порядке выполнения!
# Последний добавленный = первый выполняется

# 1. GZip Compression Middleware (добавляется первым, выполняется последним)
# Сжимает ответы > 1KB для снижения bandwidth и latency
app.add_middleware(
    GZipMiddleware,
    minimum_size=1000,  # Сжимать только ответы > 1KB
    compresslevel=6,  # Баланс скорость/размер (1=fastest, 9=best compression)
)

# 2. Security Headers Middleware (добавляется вторым, выполняется предпоследним)
# Защита от XSS, clickjacking, MIME sniffing, etc.
app.add_middleware(SecurityHeadersMiddleware)

# 3. CORS Middleware (добавляется последним, выполняется ПЕРВЫМ)
# КРИТИЧЕСКИ ВАЖНО: должен быть последним чтобы обрабатывать preflight запросы до всех остальных middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Total-Count", "X-Page-Count"],  # For file downloads & pagination
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Подключение роутеров
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(nlp.router, prefix="/api/v1", tags=["nlp"])
app.include_router(images.router, prefix="/api/v1", tags=["images"])
app.include_router(admin_router, prefix="/api/v1")

# Books routers (refactored into modular structure)
app.include_router(books_router, prefix="/api/v1")
app.include_router(chapters.router, prefix="/api/v1/books", tags=["chapters"])
app.include_router(
    reading_progress.router, prefix="/api/v1/books", tags=["reading_progress"]
)
app.include_router(descriptions.router, prefix="/api/v1/books", tags=["descriptions"])

# Reading Sessions router
app.include_router(reading_sessions_router, prefix="/api/v1", tags=["reading-sessions"])

# Health & Monitoring router
app.include_router(health_router, prefix="/api/v1", tags=["health"])


@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения."""
    print("🚀 Starting BookReader AI...")

    # ========================================================================
    # DEBUG: Print CORS configuration
    # ========================================================================
    print(f"🔧 CORS Origins configured: {settings.CORS_ORIGINS}")
    print(f"🔧 CORS Origins list: {settings.cors_origins_list}")

    # ========================================================================
    # SECURITY: Validate secrets before starting
    # ========================================================================
    try:
        is_production = not settings.DEBUG
        startup_secrets_check(is_production=is_production)
    except SystemExit:
        # Re-raise to stop application if secrets validation failed
        raise
    except Exception as e:
        print(f"⚠️ Secrets validation error: {e}")
        # Continue with warning (non-critical error)

    # ========================================================================
    # Initialize Rate Limiter
    # ========================================================================
    try:
        await rate_limiter.connect()
        if rate_limiter.enabled:
            print("✅ Rate limiter initialized and connected to Redis")
        else:
            print("⚠️ Rate limiter disabled (Redis unavailable)")
    except Exception as e:
        print(f"⚠️ Failed to initialize rate limiter: {e}")

    # Инициализация Redis cache
    try:
        await cache_manager.initialize()
        if cache_manager.is_available:
            print("✅ Redis cache initialized and ready")
        else:
            print("⚠️ Redis cache unavailable - running without cache")
    except Exception as e:
        print(f"⚠️ Failed to initialize Redis cache: {e}")

    # Инициализация настроек по умолчанию
    try:
        await settings_manager.initialize_default_settings()
        print("✅ Default settings initialized")
    except Exception as e:
        print(f"⚠️ Failed to initialize settings: {e}")

    # Инициализация Multi-NLP Manager
    try:
        await multi_nlp_manager.initialize()
        print("✅ Multi-NLP Manager initialized")
    except Exception as e:
        print(f"⚠️ Failed to initialize Multi-NLP Manager: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Очистка ресурсов при остановке приложения."""
    print("🛑 Shutting down BookReader AI...")

    # Закрываем Rate Limiter
    try:
        await rate_limiter.close()
        print("✅ Rate limiter closed")
    except Exception as e:
        print(f"⚠️ Error closing rate limiter: {e}")

    # Закрываем Redis connection pool
    try:
        await cache_manager.close()
        print("✅ Redis cache closed")
    except Exception as e:
        print(f"⚠️ Error closing Redis cache: {e}")


@app.get("/")
async def root() -> Dict[str, Any]:
    """
    Базовый endpoint для проверки работоспособности API.

    Returns:
        Dict с информацией о сервисе
    """
    return {
        "message": "BookReader AI API",
        "version": VERSION,
        "status": "running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "docs": "/docs",
    }


@app.get("/health")
@rate_limit(max_requests=20, window_seconds=60)  # Public endpoint - stricter limit
async def health_check(request: Request) -> Dict[str, Any]:
    """
    Health check endpoint для мониторинга.

    Returns:
        Dict со статусом здоровья сервиса
    """
    # Check Redis status
    redis_status = "ok" if cache_manager.is_available else "unavailable"

    return {
        "status": "healthy",
        "version": VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "api": "ok",
            "database": "checking...",  # TODO: добавить проверку БД
            "redis": redis_status,
        },
    }


@app.get("/api/v1/info")
async def api_info() -> Dict[str, Any]:
    """
    Информация о API и доступных endpoints.

    Returns:
        Dict с информацией об API
    """
    return {
        "api_version": "v1",
        "app_version": VERSION,
        "features": [
            "book_upload",
            "epub_parsing",
            "fb2_parsing",
            "nlp_description_extraction",
            "ai_image_generation",
            "user_authentication",
            "subscription_management",
        ],
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "books": "/api/v1/books",
            "users": "/api/v1/users",
            "auth": "/api/v1/auth",
            "images": "/api/v1/images",
        },
    }


# Обработчик ошибок
@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Обработчик 404 ошибок."""
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": "Requested resource not found",
            "path": str(request.url.path),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Обработчик внутренних ошибок сервера."""
    import traceback

    error_traceback = traceback.format_exc()
    print(f"[ERROR HANDLER] 500 error: {exc}")
    print(f"[ERROR HANDLER] Traceback: {error_traceback}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": f"An internal server error occurred: {str(exc)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


if __name__ == "__main__":
    # Запуск сервера для локальной разработки
    uvicorn.run(
        "main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"  # nosec B104
    )

"""
BookReader AI - FastAPI Main Application

Главный файл FastAPI приложения для веб-приложения чтения книг
с автоматической генерацией изображений по описаниям.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from datetime import datetime, timezone
from typing import Dict, Any

from .routers import users, nlp, books, auth, images, chapters, reading_progress, descriptions
from .routers.admin import admin_router
from .core.config import settings
from .services.settings_manager import settings_manager
from .services.multi_nlp_manager import multi_nlp_manager

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

# CORS настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(nlp.router, prefix="/api/v1", tags=["nlp"])
app.include_router(images.router, prefix="/api/v1", tags=["images"])
app.include_router(admin_router, prefix="/api/v1")

# Books routers (refactored into focused modules)
app.include_router(books.router, prefix="/api/v1/books", tags=["books"])
app.include_router(chapters.router, prefix="/api/v1/books", tags=["chapters"])
app.include_router(reading_progress.router, prefix="/api/v1/books", tags=["reading_progress"])
app.include_router(descriptions.router, prefix="/api/v1/books", tags=["descriptions"])


@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения."""
    print("🚀 Starting BookReader AI...")

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
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint для мониторинга.

    Returns:
        Dict со статусом здоровья сервиса
    """
    return {
        "status": "healthy",
        "version": VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "api": "ok",
            "database": "checking...",  # TODO: добавить проверку БД
            "redis": "checking...",  # TODO: добавить проверку Redis
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")

"""
BookReader AI - FastAPI Main Application

Главный файл FastAPI приложения для веб-приложения чтения книг 
с автоматической генерацией изображений по описаниям.
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from datetime import datetime
from typing import Dict, Any
import os

from .routers import users, nlp

# Версия приложения
VERSION = "0.1.0"

# Инициализация FastAPI приложения
app = FastAPI(
    title="BookReader AI API",
    description="API для чтения книг с ИИ-генерацией изображений",
    version=VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS настройки для разработки
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(nlp.router, prefix="/api/v1", tags=["nlp"])


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
        "timestamp": datetime.utcnow().isoformat(),
        "docs": "/docs"
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
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {
            "api": "ok",
            "database": "checking...",  # TODO: добавить проверку БД
            "redis": "checking..."      # TODO: добавить проверку Redis
        }
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
            "subscription_management"
        ],
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "books": "/api/v1/books",
            "users": "/api/v1/users",
            "auth": "/api/v1/auth"
        }
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
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Обработчик внутренних ошибок сервера."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error", 
            "message": "An internal server error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


if __name__ == "__main__":
    # Запуск сервера для локальной разработки
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
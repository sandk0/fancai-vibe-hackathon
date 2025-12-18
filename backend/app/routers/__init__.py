"""Routers package для API endpoints BookReader AI."""

from .books import books_router
from .chapters import router as chapters_router
from .descriptions import router as descriptions_router
from .reading_progress import router as reading_progress_router
from .users import router as users_router
from .auth import router as auth_router
from .admin import router as admin_router
from .images import router as images_router
from .reading_sessions import router as reading_sessions_router
from .health import router as health_router

__all__ = [
    "books_router",
    "chapters_router",
    "descriptions_router",
    "reading_progress_router",
    "users_router",
    "auth_router",
    "admin_router",
    "images_router",
    "reading_sessions_router",
    "health_router",
]

"""Routers package для API endpoints BookReader AI."""

from .books import router as books_router
from .chapters import router as chapters_router
from .reading_progress import router as reading_progress_router
from .descriptions import router as descriptions_router
from .users import router as users_router
from .auth import router as auth_router
from .admin import router as admin_router
from .nlp import router as nlp_router
from .images import router as images_router

__all__ = [
    "books_router",
    "chapters_router",
    "reading_progress_router",
    "descriptions_router",
    "users_router",
    "auth_router",
    "admin_router",
    "nlp_router",
    "images_router",
]

"""
Admin router - aggregates all admin sub-modules.

This module provides a modular structure for admin functionality:
- stats: System statistics and monitoring
- nlp_settings: Multi-NLP processor configuration
- parsing: Parsing queue and settings management
- images: Image generation settings
- system: System-wide settings
- users: User management

Each sub-module is focused on a single responsibility for better
maintainability and code organization.
"""

from fastapi import APIRouter

from . import stats, nlp_settings, parsing, images, system, users

# Create main admin router
admin_router = APIRouter(prefix="/admin", tags=["admin"])

# Include all sub-routers
admin_router.include_router(stats.router)
admin_router.include_router(nlp_settings.router)
admin_router.include_router(parsing.router)
admin_router.include_router(images.router)
admin_router.include_router(system.router)
admin_router.include_router(users.router)

__all__ = ["admin_router"]

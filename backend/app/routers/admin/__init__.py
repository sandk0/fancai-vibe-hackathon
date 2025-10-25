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
router = APIRouter(prefix="/admin", tags=["admin"])

# Include all sub-routers
router.include_router(stats.router)
router.include_router(nlp_settings.router)
router.include_router(parsing.router)
router.include_router(images.router)
router.include_router(system.router)
router.include_router(users.router)

# Export both names for compatibility
admin_router = router

__all__ = ["router", "admin_router"]

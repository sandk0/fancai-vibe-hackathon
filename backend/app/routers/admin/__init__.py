"""
Admin router - aggregates all admin sub-modules.

This module provides a modular structure for admin functionality:
- stats: System statistics and monitoring
- nlp_settings: Multi-NLP processor configuration
- parsing: Parsing queue and settings management
- images: Image generation settings
- system: System-wide settings
- users: User management
- reading_sessions: Reading sessions monitoring and cleanup
- cache: Redis cache monitoring and management
- feature_flags: Feature flags management

Each sub-module is focused on a single responsibility for better
maintainability and code organization.
"""

from fastapi import APIRouter

from . import (
    stats,
    nlp_settings,
    parsing,
    images,
    system,
    users,
    reading_sessions,
    cache,
    feature_flags,
)

# Create main admin router
router = APIRouter(prefix="/admin", tags=["admin"])

# Include all sub-routers
router.include_router(stats.router)
router.include_router(nlp_settings.router)
router.include_router(parsing.router)
router.include_router(images.router)
router.include_router(system.router)
router.include_router(users.router)
router.include_router(reading_sessions.router)
router.include_router(cache.router)
router.include_router(feature_flags.router)

# Export both names for compatibility
admin_router = router

__all__ = ["router", "admin_router"]

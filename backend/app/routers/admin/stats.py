"""
Admin API routes for system statistics.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import os
import redis.asyncio as redis

from ...core.database import get_database_session
from ...core.auth import get_current_admin_user
from ...models.user import User
from ...models.book import Book
from ...models.description import Description
from ...models.image import GeneratedImage

router = APIRouter()


class SystemStats(BaseModel):
    total_users: int
    total_books: int
    total_descriptions: int
    total_images: int
    processing_rate: float
    generation_rate: float
    active_parsing_tasks: int
    queue_size: int


@router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    db: AsyncSession = Depends(get_database_session),
    admin_user: User = Depends(get_current_admin_user),
):
    """Get comprehensive system statistics."""

    # Get counts from database
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar()

    books_result = await db.execute(select(func.count(Book.id)))
    total_books = books_result.scalar()

    descriptions_result = await db.execute(select(func.count(Description.id)))
    total_descriptions = descriptions_result.scalar()

    images_result = await db.execute(select(func.count(GeneratedImage.id)))
    total_images = images_result.scalar()

    # Get parsing queue info from Redis
    try:
        redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

        # Check for active parsing lock
        parsing_lock = await redis_client.get("global_parsing_lock")
        active_parsing_tasks = 1 if parsing_lock else 0

        # Get queue size
        queue_size = await redis_client.llen("parsing_queue")

        await redis_client.close()
    except Exception:
        active_parsing_tasks = 0
        queue_size = 0

    # Calculate processing and generation rates
    # These would be based on actual metrics in production
    processing_rate = min(100.0, (total_descriptions / max(total_books, 1)) * 10)
    generation_rate = min(100.0, (total_images / max(total_descriptions, 1)) * 100)

    return SystemStats(
        total_users=total_users,
        total_books=total_books,
        total_descriptions=total_descriptions,
        total_images=total_images,
        processing_rate=round(processing_rate, 1),
        generation_rate=round(generation_rate, 1),
        active_parsing_tasks=active_parsing_tasks,
        queue_size=queue_size,
    )

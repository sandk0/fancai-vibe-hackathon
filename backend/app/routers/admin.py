"""
Admin API routes for system management and configuration.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Dict, Any
import os
import redis.asyncio as redis
from pydantic import BaseModel

from ..core.database import get_database_session
from ..core.auth import get_current_admin_user
from ..models.user import User
from ..models.book import Book
from ..models.chapter import Chapter
from ..models.description import Description
from ..models.image import GeneratedImage

router = APIRouter(prefix="/admin", tags=["admin"])

# Pydantic models for settings
class NLPSettings(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    min_description_length: int
    min_word_count: int
    max_description_length: int
    min_sentence_length: int
    confidence_threshold: float
    model_name: str
    available_models: list[str]

class ParsingSettings(BaseModel):
    max_concurrent_parsing: int
    queue_priority_weights: Dict[str, int]
    timeout_minutes: int
    retry_attempts: int

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
    admin_user: User = Depends(get_current_admin_user)
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
        queue_size=queue_size
    )

@router.get("/nlp-settings", response_model=NLPSettings)
async def get_nlp_settings(admin_user: User = Depends(get_current_admin_user)):
    """Get current NLP configuration settings."""
    
    # Get current settings from environment or defaults
    return NLPSettings(
        min_description_length=int(os.getenv('NLP_MIN_DESCRIPTION_LENGTH', '50')),
        min_word_count=int(os.getenv('NLP_MIN_WORD_COUNT', '10')),
        max_description_length=int(os.getenv('NLP_MAX_DESCRIPTION_LENGTH', '1000')),
        min_sentence_length=int(os.getenv('NLP_MIN_SENTENCE_LENGTH', '30')),
        confidence_threshold=float(os.getenv('NLP_CONFIDENCE_THRESHOLD', '0.3')),
        model_name=os.getenv('NLP_MODEL_NAME', 'ru_core_news_lg'),
        available_models=['ru_core_news_lg', 'ru_core_news_md', 'ru_core_news_sm']
    )

@router.put("/nlp-settings")
async def update_nlp_settings(
    settings: NLPSettings,
    admin_user: User = Depends(get_current_admin_user)
):
    """Update NLP configuration settings."""
    
    # Validate settings
    if settings.min_description_length < 10 or settings.min_description_length > 200:
        raise HTTPException(status_code=400, detail="Min description length must be between 10-200")
    
    if settings.min_word_count < 1 or settings.min_word_count > 50:
        raise HTTPException(status_code=400, detail="Min word count must be between 1-50")
    
    if settings.confidence_threshold < 0.1 or settings.confidence_threshold > 1.0:
        raise HTTPException(status_code=400, detail="Confidence threshold must be between 0.1-1.0")
    
    # Update the global NLP processor instance with new settings
    from ..services.nlp_processor import nlp_processor
    nlp_processor.MIN_DESCRIPTION_LENGTH = settings.min_description_length
    nlp_processor.MIN_WORD_COUNT = settings.min_word_count
    nlp_processor.MAX_DESCRIPTION_LENGTH = settings.max_description_length
    nlp_processor.MIN_SENTENCE_LENGTH = settings.min_sentence_length
    
    # In production, these would be persisted to database or config file
    # For now, they only update the runtime instance
    
    return {
        "message": "NLP settings updated successfully",
        "settings": settings
    }

@router.get("/parsing-settings", response_model=ParsingSettings)
async def get_parsing_settings(admin_user: User = Depends(get_current_admin_user)):
    """Get current parsing queue configuration."""
    
    return ParsingSettings(
        max_concurrent_parsing=int(os.getenv('PARSING_MAX_CONCURRENT', '1')),
        queue_priority_weights={
            "free": int(os.getenv('PARSING_PRIORITY_FREE', '1')),
            "premium": int(os.getenv('PARSING_PRIORITY_PREMIUM', '5')),
            "ultimate": int(os.getenv('PARSING_PRIORITY_ULTIMATE', '10'))
        },
        timeout_minutes=int(os.getenv('PARSING_TIMEOUT_MINUTES', '30')),
        retry_attempts=int(os.getenv('PARSING_RETRY_ATTEMPTS', '3'))
    )

@router.put("/parsing-settings")
async def update_parsing_settings(
    settings: ParsingSettings,
    admin_user: User = Depends(get_current_admin_user)
):
    """Update parsing queue configuration."""
    
    # Validate settings
    if settings.max_concurrent_parsing < 1 or settings.max_concurrent_parsing > 10:
        raise HTTPException(status_code=400, detail="Max concurrent parsing must be between 1-10")
    
    if settings.timeout_minutes < 10 or settings.timeout_minutes > 120:
        raise HTTPException(status_code=400, detail="Timeout must be between 10-120 minutes")
    
    # Update parsing manager settings
    from ..services.parsing_manager import parsing_manager
    parsing_manager.max_concurrent = settings.max_concurrent_parsing
    parsing_manager.priority_weights = settings.queue_priority_weights
    parsing_manager.lock_timeout = settings.timeout_minutes * 60  # Convert to seconds
    
    return {
        "message": "Parsing settings updated successfully",
        "settings": settings
    }

@router.get("/users")
async def get_users_list(
    skip: int = 0,
    limit: int = 50,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Get paginated list of users for admin management."""
    
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(User)
        .options(selectinload(User.subscription))
        .offset(skip)
        .limit(limit)
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    
    # Get total count
    count_result = await db.execute(select(func.count(User.id)))
    total = count_result.scalar()
    
    return {
        "users": [
            {
                "id": str(user.id),
                "email": user.email,
                "username": user.full_name or "Unknown",
                "subscription_plan": user.subscription.plan.value if user.subscription else "free",
                "is_active": user.is_active,
                "is_admin": user.is_admin,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
            for user in users
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/queue-status")
async def get_queue_status(admin_user: User = Depends(get_current_admin_user)):
    """Get detailed parsing queue status."""
    
    try:
        redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        
        # Get current parsing lock info
        lock_data = await redis_client.get("global_parsing_lock")
        
        # Get queue items
        queue_items = await redis_client.lrange("parsing_queue", 0, -1)
        
        await redis_client.close()
        
        return {
            "is_parsing_active": lock_data is not None,
            "current_parsing": lock_data,
            "queue_size": len(queue_items),
            "queue_items": queue_items[:10]  # Show first 10 items
        }
    except Exception as e:
        return {
            "is_parsing_active": False,
            "current_parsing": None,
            "queue_size": 0,
            "queue_items": [],
            "error": str(e)
        }

@router.post("/clear-queue")
async def clear_parsing_queue(admin_user: User = Depends(get_current_admin_user)):
    """Clear all items from parsing queue (emergency function)."""
    
    try:
        redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        
        # Clear the queue
        await redis_client.delete("parsing_queue")
        
        await redis_client.close()
        
        return {"message": "Parsing queue cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear queue: {str(e)}")

@router.post("/unlock-parsing")
async def unlock_parsing(admin_user: User = Depends(get_current_admin_user)):
    """Force unlock parsing (emergency function)."""
    
    try:
        redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        
        # Remove parsing lock
        await redis_client.delete("global_parsing_lock")
        
        await redis_client.close()
        
        return {"message": "Parsing lock removed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to unlock parsing: {str(e)}")
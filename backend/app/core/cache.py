"""
Redis caching layer for BookReader AI backend.

Provides:
- Redis connection management with connection pooling
- Generic caching decorators for functions and FastAPI endpoints
- Cache invalidation utilities
- Cache key pattern management
- JSON serialization for complex objects
- Graceful fallback to database if Redis unavailable

Performance targets:
- API response time: <50ms for cached data
- Cache hit rate: >80% for read-heavy endpoints
- Database load reduction: -80%
"""

import json
import functools
from typing import Any, Callable, Optional, Union
from datetime import timedelta
from redis.asyncio import Redis, ConnectionPool
from redis.exceptions import RedisError
from loguru import logger

from .config import settings


class CacheManager:
    """
    Redis cache manager with connection pooling and error handling.

    Features:
    - Async Redis operations
    - Connection pooling for performance
    - Automatic JSON serialization/deserialization
    - Graceful error handling with fallback
    - Cache key pattern management
    - TTL (Time-To-Live) support
    """

    def __init__(self):
        """Initialize Redis connection pool."""
        self._redis: Optional[Redis] = None
        self._pool: Optional[ConnectionPool] = None
        self._is_available = False

    async def initialize(self):
        """
        Initialize Redis connection pool.

        Called during application startup.
        """
        try:
            # Parse Redis URL
            # Format: redis://:password@host:port/db
            redis_url = settings.REDIS_URL

            # Create connection pool
            self._pool = ConnectionPool.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50,
                socket_connect_timeout=5,
                socket_keepalive=True,
            )

            self._redis = Redis(connection_pool=self._pool)

            # Test connection
            await self._redis.ping()
            self._is_available = True
            logger.info(f"✅ Redis cache initialized: {redis_url}")

        except Exception as e:
            logger.warning(f"⚠️ Redis initialization failed: {e}")
            logger.warning(
                "📊 Application will work without caching (fallback to database)"
            )
            self._is_available = False

    async def close(self):
        """
        Close Redis connection pool.

        Called during application shutdown.
        """
        if self._redis:
            await self._redis.close()
            logger.info("Redis connection closed")

    @property
    def is_available(self) -> bool:
        """Check if Redis is available."""
        return self._is_available

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value (deserialized from JSON) or None if not found
        """
        if not self._is_available or not self._redis:
            return None

        try:
            value = await self._redis.get(key)
            if value:
                logger.debug(f"🎯 Cache HIT: {key}")
                return json.loads(value)
            logger.debug(f"❌ Cache MISS: {key}")
            return None
        except RedisError as e:
            logger.warning(f"Redis GET error for key {key}: {e}")
            return None

    async def set(
        self, key: str, value: Any, ttl: Optional[Union[int, timedelta]] = None
    ) -> bool:
        """
        Set value in cache with optional TTL.

        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time-to-live in seconds or timedelta (None = no expiration)

        Returns:
            True if successful, False otherwise
        """
        if not self._is_available or not self._redis:
            return False

        try:
            # Convert timedelta to seconds
            if isinstance(ttl, timedelta):
                ttl = int(ttl.total_seconds())

            # Serialize to JSON
            serialized = json.dumps(value, default=str)

            # Set with optional TTL
            if ttl:
                await self._redis.setex(key, ttl, serialized)
            else:
                await self._redis.set(key, serialized)

            logger.debug(f"💾 Cache SET: {key} (TTL: {ttl}s)")
            return True

        except (RedisError, TypeError, ValueError) as e:
            logger.warning(f"Redis SET error for key {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete key from cache.

        Args:
            key: Cache key to delete

        Returns:
            True if successful, False otherwise
        """
        if not self._is_available or not self._redis:
            return False

        try:
            await self._redis.delete(key)
            logger.debug(f"🗑️ Cache DELETE: {key}")
            return True
        except RedisError as e:
            logger.warning(f"Redis DELETE error for key {key}: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern.

        Args:
            pattern: Redis key pattern (e.g., "book:*", "user:123:*")

        Returns:
            Number of keys deleted
        """
        if not self._is_available or not self._redis:
            return 0

        try:
            # Find all matching keys
            keys = []
            async for key in self._redis.scan_iter(match=pattern):
                keys.append(key)

            # Delete all keys
            if keys:
                deleted = await self._redis.delete(*keys)
                logger.info(f"🗑️ Cache DELETE pattern '{pattern}': {deleted} keys")
                return deleted

            return 0

        except RedisError as e:
            logger.warning(f"Redis DELETE pattern error for '{pattern}': {e}")
            return 0

    async def clear_all(self) -> bool:
        """
        Clear all cache (DANGEROUS - use with caution).

        Returns:
            True if successful, False otherwise
        """
        if not self._is_available or not self._redis:
            return False

        try:
            await self._redis.flushdb()
            logger.warning("🗑️ Cache CLEARED (all keys deleted)")
            return True
        except RedisError as e:
            logger.error(f"Redis FLUSH error: {e}")
            return False

    async def get_stats(self) -> dict:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        if not self._is_available or not self._redis:
            return {"available": False, "error": "Redis not available"}

        try:
            info = await self._redis.info()

            # Calculate hit rate
            hits = info.get("keyspace_hits", 0)
            misses = info.get("keyspace_misses", 0)
            total = hits + misses
            hit_rate = (hits / total * 100) if total > 0 else 0

            return {
                "available": True,
                "keys_count": await self._redis.dbsize(),
                "memory_used_mb": round(info.get("used_memory", 0) / 1024 / 1024, 2),
                "memory_peak_mb": round(
                    info.get("used_memory_peak", 0) / 1024 / 1024, 2
                ),
                "hits": hits,
                "misses": misses,
                "hit_rate_percent": round(hit_rate, 2),
                "connected_clients": info.get("connected_clients", 0),
                "uptime_seconds": info.get("uptime_in_seconds", 0),
            }

        except RedisError as e:
            logger.error(f"Redis INFO error: {e}")
            return {"available": False, "error": str(e)}


# Global cache manager instance
cache_manager = CacheManager()


def cache_key(*args, **kwargs) -> str:
    """
    Generate cache key from arguments.

    Uses consistent hashing for complex objects.

    Example:
        cache_key("book", book_id, user_id=123)
        -> "book:uuid:user:123"
    """
    parts = []

    # Add positional arguments
    for arg in args:
        parts.append(str(arg))

    # Add keyword arguments (sorted for consistency)
    for key in sorted(kwargs.keys()):
        parts.append(f"{key}:{kwargs[key]}")

    return ":".join(parts)


def cache_result(
    ttl: Union[int, timedelta] = 3600,
    key_prefix: Optional[str] = None,
):
    """
    Decorator to cache function results.

    Args:
        ttl: Cache TTL in seconds or timedelta (default: 1 hour)
        key_prefix: Custom key prefix (default: function name)

    Example:
        @cache_result(ttl=300, key_prefix="book_metadata")
        async def get_book_metadata(book_id: UUID) -> dict:
            ...
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            prefix = key_prefix or func.__name__
            key = cache_key(prefix, *args, **kwargs)

            # Try to get from cache
            cached = await cache_manager.get(key)
            if cached is not None:
                return cached

            # Execute function
            result = await func(*args, **kwargs)

            # Cache result
            await cache_manager.set(key, result, ttl)

            return result

        return wrapper

    return decorator


def invalidate_cache(*patterns: str):
    """
    Decorator to invalidate cache after function execution.

    Args:
        patterns: Cache key patterns to invalidate

    Example:
        @invalidate_cache("book:*", "user:{user_id}:*")
        async def update_book(book_id: UUID, user_id: UUID, data: dict):
            ...
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Execute function first
            result = await func(*args, **kwargs)

            # Invalidate cache patterns
            for pattern in patterns:
                # Replace placeholders with actual values
                # Example: "user:{user_id}:*" -> "user:123:*"
                formatted_pattern = pattern.format(**kwargs)
                await cache_manager.delete_pattern(formatted_pattern)

            return result

        return wrapper

    return decorator


# Common cache key patterns (documentation)
CACHE_KEY_PATTERNS = {
    # Books
    "book_metadata": "book:{book_id}:metadata",
    "book_chapters": "book:{book_id}:chapters",
    "book_list": "user:{user_id}:books:skip:{skip}:limit:{limit}",
    "book_toc": "book:{book_id}:toc",
    # Chapters
    "chapter_content": "book:{book_id}:chapter:{chapter_number}",
    "chapter_list": "book:{book_id}:chapters:list",
    # Reading Progress
    "user_progress": "user:{user_id}:progress:{book_id}",
    # Descriptions
    "book_descriptions": "book:{book_id}:descriptions",
    "chapter_descriptions": "book:{book_id}:chapter:{chapter_number}:descriptions",
    # Images
    "description_image": "description:{description_id}:image",
}


# Cache TTL configuration (in seconds)
CACHE_TTL = {
    "book_metadata": 3600,  # 1 hour
    "book_chapters": 3600,  # 1 hour
    "book_list": 10,  # 10 seconds (FREQUENTLY UPDATED - short TTL!)
    "chapter_content": 3600,  # 1 hour
    "user_progress": 300,  # 5 minutes (updated frequently)
    "book_descriptions": 3600,  # 1 hour
    "book_toc": 3600,  # 1 hour
}

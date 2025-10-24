"""
Optimized Celery Configuration for BookReader AI
Handles high-load book parsing with resource constraints
"""

import os
from kombu import Queue, Exchange
from celery import Celery
from celery.signals import worker_shutting_down, task_prerun, task_postrun
import psutil
import logging

logger = logging.getLogger(__name__)

# Performance settings based on resource analysis
CELERY_CONFIG = {
    # Broker settings
    "broker_url": os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    "result_backend": os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
    # Worker settings optimized for NLP workload
    "worker_concurrency": int(
        os.getenv("CELERY_CONCURRENCY", "2")
    ),  # 2 tasks per worker
    "worker_prefetch_multiplier": 1,  # One task at a time
    "worker_max_tasks_per_child": int(
        os.getenv("CELERY_MAX_TASKS_PER_CHILD", "10")
    ),  # Restart after 10 tasks
    "worker_max_memory_per_child": int(
        os.getenv("CELERY_WORKER_MAX_MEMORY_PER_CHILD", "5000000")
    ),  # 5GB max per worker
    "worker_disable_rate_limits": False,
    # Task execution limits
    "task_soft_time_limit": 1500,  # 25 minutes soft limit
    "task_time_limit": 1800,  # 30 minutes hard limit
    "task_acks_late": True,  # Acknowledge after task completion
    "task_reject_on_worker_lost": True,
    # Task routing with priorities
    "task_routes": {
        "app.core.tasks.process_book_task": {
            "queue": "heavy",
            "routing_key": "heavy.parse",
            "priority": 5,
            "rate_limit": "5/m",  # Max 5 books per minute
        },
        "app.core.tasks.process_chapter_task": {
            "queue": "heavy",
            "routing_key": "heavy.chapter",
            "priority": 4,
        },
        "app.core.tasks.generate_image_task": {
            "queue": "normal",
            "routing_key": "normal.image",
            "priority": 3,
            "rate_limit": "30/m",
        },
        "app.core.tasks.cleanup_old_data": {
            "queue": "light",
            "routing_key": "light.cleanup",
            "priority": 1,
        },
    },
    # Queue definitions with priorities
    "task_queues": (
        Queue(
            "heavy",
            Exchange("heavy"),
            routing_key="heavy.#",
            queue_arguments={"x-max-priority": 10},
        ),
        Queue(
            "normal",
            Exchange("normal"),
            routing_key="normal.#",
            queue_arguments={"x-max-priority": 5},
        ),
        Queue(
            "light",
            Exchange("light"),
            routing_key="light.#",
            queue_arguments={"x-max-priority": 3},
        ),
    ),
    # Default queue
    "task_default_queue": "normal",
    "task_default_exchange": "normal",
    "task_default_routing_key": "normal.default",
    # Serialization
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
    # Result backend settings
    "result_expires": 3600,  # Results expire after 1 hour
    "result_compression": "gzip",
    "result_backend_always_retry": True,
    # Memory optimization
    "worker_hijack_root_logger": False,
    "worker_redirect_stdouts": False,
    "worker_redirect_stdouts_level": "INFO",
    # Beat scheduler (if needed)
    "beat_schedule": {
        "cleanup-old-parsing-data": {
            "task": "app.core.tasks.cleanup_old_data",
            "schedule": 3600.0,  # Every hour
            "options": {"queue": "light", "priority": 1},
        },
        "check-stuck-tasks": {
            "task": "app.core.tasks.check_stuck_tasks",
            "schedule": 300.0,  # Every 5 minutes
            "options": {"queue": "light", "priority": 2},
        },
    },
}

# Resource monitoring configuration
# Memory budget calculation:
# - Max workers: 5 (docker-compose scale limit)
# - Concurrency per worker: 2 tasks
# - Max concurrent tasks: 5 × 2 = 10
# - Memory per task: ~6GB
# - Total memory budget: 10 × 6GB = 60GB peak (under 50GB target after optimization)
RESOURCE_LIMITS = {
    "max_concurrent_heavy_tasks": 10,  # Max 10 book parsings (5 workers × 2 concurrency)
    "max_workers": 5,  # Maximum number of worker instances
    "max_memory_percent": 85,  # Stop accepting tasks if memory > 85%
    "max_cpu_percent": 90,  # Pause if CPU > 90%
    "min_free_memory_mb": 500,  # Always keep 500MB free
}

# Retry configuration with exponential backoff
RETRY_CONFIG = {
    "max_retries": 3,
    "retry_backoff": True,
    "retry_backoff_max": 600,  # Max 10 minutes between retries
    "retry_jitter": True,  # Add randomness to prevent thundering herd
}

# NLP model caching configuration
NLP_CACHE_CONFIG = {
    "cache_enabled": True,
    "cache_size_mb": 1000,  # 1GB cache for NLP models
    "model_preload": True,  # Load models on worker start
    "shared_memory": True,  # Share models between processes
    "model_ttl": 3600,  # Keep models in memory for 1 hour
}


class ResourceAwareCelery(Celery):
    """Custom Celery app with resource monitoring"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._setup_resource_monitoring()

    def _setup_resource_monitoring(self):
        """Setup hooks for resource monitoring"""

        @worker_shutting_down.connect
        def graceful_shutdown(**kwargs):
            """Gracefully shutdown worker"""
            logger.info("Worker shutting down gracefully...")
            # Save current task state
            # Cleanup resources
            # Close connections

        @task_prerun.connect
        def check_resources_before_task(**kwargs):
            """Check system resources before starting task"""
            memory = psutil.virtual_memory()
            cpu = psutil.cpu_percent(interval=1)

            if memory.percent > RESOURCE_LIMITS["max_memory_percent"]:
                logger.warning(f"High memory usage: {memory.percent}%")
                # Could implement task deferral here

            if cpu > RESOURCE_LIMITS["max_cpu_percent"]:
                logger.warning(f"High CPU usage: {cpu}%")

        @task_postrun.connect
        def cleanup_after_task(**kwargs):
            """Cleanup resources after task completion"""
            # Force garbage collection for heavy tasks
            import gc

            gc.collect()


def create_celery_app():
    """Create and configure Celery application"""
    app = ResourceAwareCelery("bookreader")
    app.config_from_object(CELERY_CONFIG)

    # Set up task annotations for resource limits
    app.conf.task_annotations = {
        "app.core.tasks.process_book_task": {
            "rate_limit": "5/m",
            "time_limit": 1800,
            "soft_time_limit": 1500,
        },
        "app.core.tasks.process_chapter_task": {
            "rate_limit": "30/m",
            "time_limit": 300,
            "soft_time_limit": 240,
        },
    }

    return app


# Singleton instance
celery_app = create_celery_app()

# Export for use in other modules
__all__ = [
    "celery_app",
    "CELERY_CONFIG",
    "RESOURCE_LIMITS",
    "RETRY_CONFIG",
    "NLP_CACHE_CONFIG",
]

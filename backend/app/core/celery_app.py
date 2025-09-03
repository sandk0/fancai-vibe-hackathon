"""
Celery configuration for BookReader AI.
Настройка Celery для фоновых задач.
"""

from celery import Celery
import os
from app.core.config import settings

# Create Celery instance with basic config
celery_app = Celery(
    "bookreader",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.core.tasks"]
)

# Basic Celery configuration (compatible with existing code)
celery_app.conf.update(
    # Serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Worker settings (optimized)
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=int(os.getenv('CELERY_MAX_TASKS_PER_CHILD', '100')),
    worker_max_memory_per_child=int(os.getenv('CELERY_MAX_MEMORY_PER_CHILD', '150000')),  # 150MB default
    
    # Task settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_soft_time_limit=int(os.getenv('CELERY_SOFT_TIME_LIMIT', '1500')),  # 25 min
    task_time_limit=int(os.getenv('CELERY_TIME_LIMIT', '1800')),  # 30 min
    
    # Result settings
    result_expires=3600,  # 1 hour
    result_compression='gzip',
    
    # Broker settings
    broker_connection_retry_on_startup=True,
    broker_transport_options={'visibility_timeout': 3600},
    
    # Rate limiting (basic)
    task_routes={
        'app.core.tasks.process_book_task': {'queue': 'heavy'},
        'app.core.tasks.generate_image_task': {'queue': 'normal'},
    },
    
    # Default queue
    task_default_queue='normal',
)

# Auto-discover tasks
celery_app.autodiscover_tasks()
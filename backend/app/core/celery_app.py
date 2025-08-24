"""
Celery configuration for BookReader AI.
Настройка Celery для фоновых задач.
"""

from celery import Celery
from app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "bookreader",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.core.tasks"]
)

# Configure Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    result_expires=3600,  # 1 hour
    broker_connection_retry_on_startup=True,
)

# Auto-discover tasks
celery_app.autodiscover_tasks()
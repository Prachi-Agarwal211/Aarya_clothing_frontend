"""
Celery App Initialization for Commerce Service.
Provides an enterprise-grade async task queue using Redis.
"""
import os
import logging
from celery import Celery
from core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Initialize Celery app
celery_app = Celery(
    "commerce_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

# Optional tuning for high-throughput
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1, # Fair dispatching for long tasks
    task_routes={
        "core.tasks.inventory.*": {"queue": "inventory"},
        "core.tasks.mail.*": {"queue": "mail"},
    }
)

logger.info("Celery configured for commerce service.")

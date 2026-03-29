"""Core configuration and utilities for the Core Platform service."""
from core.config import get_settings
from core.redis_client import redis_client, get_redis_client

# Lazy settings - call get_settings() when needed
settings = None

def get_settings_lazy():
    """Get settings lazily to avoid import-time initialization."""
    global settings
    if settings is None:
        settings = get_settings()
    return settings

__all__ = ["get_settings", "get_settings_lazy", "redis_client", "get_redis_client"]

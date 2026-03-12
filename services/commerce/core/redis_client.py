"""
Redis client for Commerce service.

This module provides a Redis client that uses the unified Redis client
from the shared module. The fallback implementation has been removed to
eliminate code duplication.

Usage:
    from core.redis_client import redis_client, get_redis_client
    
    # Use the client directly
    redis_client.set_cache("key", {"data": "value"}, ttl=300)
    
    # Or get the client instance
    client = get_redis_client()
"""

import logging
from typing import Optional, Any, Dict

logger = logging.getLogger(__name__)

# Import unified Redis client
from shared.unified_redis_client import create_redis_client
from core.config import get_settings

# Lazy initialization of Redis client
_redis_client = None


def get_redis_client():
    """
    Get the Redis client instance (lazy initialization).
    
    Returns:
        The unified Redis client instance for the commerce service.
    """
    global _redis_client
    if _redis_client is None or not _redis_client.is_connected():
        settings = get_settings()
        _redis_client = create_redis_client(
            redis_url=settings.REDIS_URL,
            redis_db=settings.REDIS_DB,
            service_name="commerce"
        )
        logger.info("Commerce service Redis client initialized")
    return _redis_client


class RedisClientWrapper:
    """
    Wrapper class for backwards compatibility.
    
    This class delegates all attribute access to the underlying Redis client,
    allowing existing code to continue working without changes.
    """
    
    def __init__(self):
        self._client = None
    
    def _get_client(self):
        """Get the underlying Redis client, caching for performance."""
        if self._client is None:
            self._client = get_redis_client()
        return self._client
    
    def __getattr__(self, name):
        return getattr(self._get_client(), name)


# Create the wrapper instance for backwards compatibility
redis_client = RedisClientWrapper()

# Flag to indicate we're using the unified client
USING_UNIFIED_CLIENT = True

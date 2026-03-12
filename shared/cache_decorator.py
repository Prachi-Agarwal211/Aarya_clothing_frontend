"""Caching decorator for API responses."""
import json
from functools import wraps
from typing import Optional, Any, Callable
import logging

logger = logging.getLogger(__name__)


def cache_response(
    key_prefix: str,
    ttl: int = 300,
    skip_cache: Callable = None
):
    """
    Decorator to cache API responses in Redis.
    
    Args:
        key_prefix: Prefix for cache key
        ttl: Time to live in seconds
        skip_cache: Function to determine if caching should be skipped
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Try to get redis_client from args (usually db session has it or it's a global)
            # In this project, redis_client is usually imported from core.redis_client
            # But we can try to find it in args if passed, or use the global one if available
            
            try:
                from core.redis_client import redis_client
            except ImportError:
                logger.warning("Redis client not available for caching")
                return await func(*args, **kwargs)
            
            # Build cache key from arguments
            # We use kwargs to build a unique key
            # Simple implementation: use key_prefix + specific kwargs values
            
            # Extract relevant args for key generation (skipping self, db, etc.)
            key_parts = []
            for k, v in kwargs.items():
                if k not in ['db', 'current_user', 'background_tasks']:
                    key_parts.append(f"{k}:{v}")
            
            cache_key = f"{key_prefix}:{':'.join(sorted(key_parts))}"
            
            # Try cache first
            try:
                cached = redis_client.get_cache(cache_key)
                if cached:
                    logger.debug(f"Cache hit: {cache_key}")
                    return cached
            except Exception as e:
                logger.warning(f"Cache read error: {e}")
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Skip caching if condition met
            if skip_cache and skip_cache(result):
                return result
            
            # Store in cache
            if result:
                try:
                    # Check if result is Pydantic model and convert to dict if needed
                    # redis_client.set_cache usually handles dict/list/str
                    # If result is a Pydantic model, we might need to rely on FastAPI's serialization
                    # but for caching we usually cache the data dict.
                    
                    # NOTE: This simple decorator assumes result is JSON-serializable 
                    # or redis_client handles it.
                    
                    redis_client.set_cache(cache_key, result, ttl)
                    logger.debug(f"Cache set: {cache_key}")
                except Exception as e:
                    logger.warning(f"Cache write error: {e}")
            
            return result
        
        return wrapper
    return decorator


# Cache key generators helpers
def product_cache_key(product_id: int) -> str:
    return f"product:{product_id}"

def category_cache_key(category_id: int) -> str:
    return f"category:{category_id}"

def user_cache_key(user_id: int) -> str:
    return f"user:{user_id}"

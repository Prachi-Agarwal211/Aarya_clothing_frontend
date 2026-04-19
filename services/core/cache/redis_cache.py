"""
Redis Caching Layer for High Traffic
Caches frequently accessed data to reduce database load
"""
import redis
import json
from datetime import timedelta
from typing import Optional, Any

class RedisCache:
    def __init__(self, redis_url: str = "redis://redis:6379"):
        self.redis = redis.StrictRedis.from_url(redis_url, decode_responses=True)

    def get(self, key: str) -> Optional[Any]:
        """Get cached value"""
        value = self.redis.get(key)
        return json.loads(value) if value else None

    def set(self, key: str, value: Any, expire: timedelta) -> None:
        """Set cached value with expiration"""
        self.redis.setex(key, int(expire.total_seconds()), json.dumps(value))

    def delete(self, key: str) -> None:
        """Delete cached value"""
        self.redis.delete(key)

    def cache_user(self, user_id: int, user_data: dict) -> None:
        """Cache user data for 5 minutes"""
        self.set(f"user:{user_id}", user_data, timedelta(minutes=5))

    def get_cached_user(self, user_id: int) -> Optional[dict]:
        """Get cached user data"""
        return self.get(f"user:{user_id}")

    def cache_product(self, product_id: int, product_data: dict) -> None:
        """Cache product data for 10 minutes"""
        self.set(f"product:{product_id}", product_data, timedelta(minutes=10))

    def get_cached_product(self, product_id: int) -> Optional[dict]:
        """Get cached product data"""
        return self.get(f"product:{product_id}")

    def cache_collection(self, collection_id: int, collection_data: dict) -> None:
        """Cache collection data for 15 minutes"""
        self.set(f"collection:{collection_id}", collection_data, timedelta(minutes=15))

    def get_cached_collection(self, collection_id: int) -> Optional[dict]:
        """Get cached collection data"""
        return self.get(f"collection:{collection_id}")

# Global cache instance
cache = RedisCache()

# FastAPI cache decorator
from functools import wraps
from fastapi import Request

def cache_response(expire: timedelta = timedelta(minutes=5)):
    """Decorator to cache API responses"""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # Create cache key from request
            cache_key = f"api:{request.url.path}:{hash(frozenset(request.query_params.items()))}"
            
            # Try to get cached response
            cached = cache.get(cache_key)
            if cached:
                return cached
            
            # Call original function
            response = await func(request, *args, **kwargs)
            
            # Cache the response
            if response.status_code == 200:
                cache.set(cache_key, response, expire)
            
            return response
        return wrapper
    return decorator

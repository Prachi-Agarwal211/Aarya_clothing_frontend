"""Advanced Caching System for Commerce Service.

Implements an L1 (in-memory dictionary) and L2 (Redis) caching strategy
to dramatically reduce database load for high-volume read queries like
product catalogs and active categories.
"""
import hashlib
import json
import logging
from functools import wraps
from typing import Optional, Any, Callable, Dict
import time

logger = logging.getLogger(__name__)

from core.redis_client import redis_client

class AdvancedCache:
    """Multi-layer cache implementation."""
    
    def __init__(self, l1_max_size: int = 1000):
        self.local_cache: Dict[str, dict] = {}  # L1: In-memory
        self.l1_max_size = l1_max_size
        self.redis = redis_client  # L2: Redis
    
    def _enforce_l1_limits(self):
        """Prevent memory leaks by capping the L1 cache size."""
        if len(self.local_cache) > self.l1_max_size:
            # Simple LRU-ish clear by nuking the oldest half 
            # In a true LRU we'd use OrderedDict, but this is fast enough for L1
            keys_to_remove = list(self.local_cache.keys())[:self.l1_max_size // 2]
            for k in keys_to_remove:
                self.local_cache.pop(k, None)

    async def get_or_set(self, key: str, fetch_func: Callable, ttl: int = 300) -> Any:
        """
        Get value from cache or fetch and store it.
        
        Args:
            key: Cache key
            fetch_func: Async function to fetch data if cache miss
            ttl: Time to live in seconds
            
        Returns:
            The cached or freshly fetched data
        """
        now = time.time()
        
        # L1 Check (In-Memory)
        if key in self.local_cache:
            entry = self.local_cache[key]
            if now < entry['expires_at']:
                return entry['data']
            else:
                del self.local_cache[key]
        
        # L2 Check (Redis)
        try:
            cached_data = self.redis.get_cache(key)
            if cached_data is not None:
                # Populate L1 from L2
                self._enforce_l1_limits()
                self.local_cache[key] = {
                    'data': cached_data,
                    'expires_at': now + min(ttl, 60) # Keep L1 short-lived to prevent staleness
                }
                return cached_data
        except Exception as e:
            logger.warning(f"L2 Cache read failed for {key}: {e}")

        # Cache Miss - Fetch Data
        try:
            data = await fetch_func()
            
            # Allow data to be None? Usually we don't cache negative results, but let's cache them for 30s to prevent stampedes
            cache_ttl = ttl if data is not None else 30
            
            # Store L1
            self._enforce_l1_limits()
            self.local_cache[key] = {
                'data': data,
                'expires_at': now + min(cache_ttl, 60)
            }
            
            # Store L2
            try:
                self.redis.set_cache(key, data, ttl=cache_ttl)
            except Exception as e:
                logger.warning(f"L2 Cache write failed for {key}: {e}")
                
            return data
            
        except Exception as e:
            logger.error(f"Fetch function failed for cache key {key}: {e}")
            raise

    def invalidate(self, key: str):
        """Invalidate a specific cache key."""
        self.local_cache.pop(key, None)
        try:
            self.redis.delete_cache(key)
        except Exception:
            pass
            
    def invalidate_pattern(self, pattern: str):
        """
        Invalidate cache by pattern.
        WARNING: keys() is an O(N) operation in Redis. 
        Use carefully on small datasets or use Redis SCAN in a loop for large datasets.
        """
        # Clear L1 matching pattern
        keys_to_remove = [k for k in self.local_cache.keys() if pattern.replace('*', '') in k]
        for k in keys_to_remove:
            self.local_cache.pop(k, None)
            
        # Clear L2: keys are stored via unified client as namespace "cache" (e.g. cache:products:*)
        try:
            deleted = self.redis.invalidate_pattern(pattern)
            if deleted:
                logger.debug("Invalidated %s Redis keys for pattern %s", deleted, pattern)
        except Exception as e:
            logger.warning(f"Pattern invalidation failed for {pattern}: {e}")


# Global advanced cache instance
cache = AdvancedCache()


def cached(ttl: int = 300, key_prefix: str = "app_cache"):
    """
    Decorator for caching async FastAPI endpoints or service methods.
    
    Args:
        ttl: Time to live in seconds
        key_prefix: Prefix for the cache key
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a deterministic hash of the arguments
            arg_str = f"{args}-{kwargs}"
            arg_hash = hashlib.md5(arg_str.encode()).hexdigest()
            cache_key = f"{key_prefix}:{func.__name__}:{arg_hash}"
            
            return await cache.get_or_set(
                cache_key, 
                lambda: func(*args, **kwargs),
                ttl=ttl
            )
        return wrapper
    return decorator

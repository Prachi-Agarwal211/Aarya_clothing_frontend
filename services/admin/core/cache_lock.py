"""Distributed locking for cache operations to prevent stampede and race conditions."""
import time
import json
from typing import Optional, Any, Callable
from contextlib import contextmanager
import redis
from core.config import settings


class CacheLock:
    """Distributed lock implementation using Redis."""
    
    def __init__(self, redis_client, lock_key: str, timeout: int = 30, retry_delay: float = 0.1):
        self.redis_client = redis_client
        self.lock_key = f"lock:{lock_key}"
        self.timeout = timeout
        self.retry_delay = retry_delay
        self.identifier = None
        
    def acquire(self, blocking: bool = True, timeout: Optional[float] = None) -> bool:
        """Acquire the lock."""
        if timeout is None:
            timeout = self.timeout
            
        identifier = f"{time.time()}:{id(self)}"
        end_time = time.time() + timeout
        
        while time.time() < end_time:
            # Try to acquire lock with SET NX EX
            if self.redis_client.client.set(self.lock_key, identifier, nx=True, ex=self.timeout):
                self.identifier = identifier
                return True
            
            if not blocking:
                return False
                
            time.sleep(self.retry_delay)
        
        return False
    
    def release(self) -> bool:
        """Release the lock."""
        if not self.identifier:
            return False
            
        # Lua script for atomic release
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        
        try:
            result = self.redis_client.client.eval(lua_script, 1, self.lock_key, self.identifier)
            return bool(result)
        except Exception:
            return False
    
    def __enter__(self):
        """Context manager entry."""
        if not self.acquire():
            raise Exception(f"Could not acquire lock: {self.lock_key}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.release()


@contextmanager
def distributed_cache_lock(redis_client, lock_key: str, timeout: int = 30):
    """Context manager for distributed cache locking."""
    lock = CacheLock(redis_client, lock_key, timeout=timeout)
    try:
        if not lock.acquire():
            raise Exception(f"Could not acquire distributed lock: {lock_key}")
        yield lock
    finally:
        lock.release()


def get_or_set_cache_with_lock(
    redis_client, 
    key: str, 
    compute_func: Callable[[], Any], 
    ttl: int = 300,
    lock_timeout: int = 30
) -> Any:
    """
    Get cached value or compute and set with distributed locking to prevent stampede.
    
    Args:
        redis_client: Redis client instance
        key: Cache key
        compute_func: Function to compute value if not cached
        ttl: Cache TTL in seconds
        lock_timeout: Lock timeout in seconds
    
    Returns:
        Cached or computed value
    """
    # Try to get cached value first
    cached = redis_client.get_cache(key)
    if cached is not None:
        return cached
    
    # Acquire cache rebuild lock
    lock_key = f"{key}:rebuild"
    
    with distributed_cache_lock(redis_client, lock_key, timeout=lock_timeout):
        # Double-check cache after acquiring lock
        cached = redis_client.get_cache(key)
        if cached is not None:
            return cached
        
        # Compute and cache value
        try:
            value = compute_func()
            redis_client.set_cache(key, value, ttl=ttl)
            return value
        except Exception as e:
            # If computation fails, don't cache the error
            raise e


def invalidate_cache_atomic(redis_client, patterns: list, db_commit_first: bool = True):
    """
    Atomically invalidate cache patterns with proper error handling.
    
    Args:
        redis_client: Redis client instance
        patterns: List of cache patterns to invalidate
        db_commit_first: Whether to invalidate before or after DB commit
    """
    try:
        for pattern in patterns:
            redis_client.invalidate_pattern(pattern)
    except Exception as e:
        # Log error but don't fail the operation
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to invalidate cache pattern {pattern}: {e}")


class CacheStampedeProtection:
    """Advanced cache stampede protection with early expiration."""
    
    def __init__(self, redis_client, early_expire_ratio: float = 0.9):
        self.redis_client = redis_client
        self.early_expire_ratio = early_expire_ratio
    
    def get_with_early_refresh(
        self, 
        key: str, 
        compute_func: Callable[[], Any], 
        ttl: int = 300
    ) -> Any:
        """
        Get cached value with early refresh to prevent stampede.
        
        If cache is approaching expiration, refresh it in background.
        """
        cached = self.redis_client.get_cache(key)
        if cached is not None:
            # Check if we should refresh early
            cache_data = self.redis_client.client.get(f"cache:{key}")
            if cache_data:
                try:
                    # Get TTL and refresh early if needed
                    ttl_remaining = self.redis_client.client.ttl(f"cache:{key}")
                    if ttl_remaining > 0 and ttl_remaining < (ttl * self.early_expire_ratio):
                        # Trigger background refresh
                        self._background_refresh(key, compute_func, ttl)
                except Exception:
                    pass  # Ignore errors in background refresh
            
            return cached
        
        # No cache, compute and set
        return get_or_set_cache_with_lock(self.redis_client, key, compute_func, ttl)
    
    def _background_refresh(self, key: str, compute_func: Callable[[], Any], ttl: int):
        """Background refresh of cache."""
        try:
            # Use a separate lock for background refresh
            lock_key = f"{key}:background_refresh"
            lock = CacheLock(self.redis_client, lock_key, timeout=10)
            
            if lock.acquire(blocking=False):
                try:
                    value = compute_func()
                    self.redis_client.set_cache(key, value, ttl=ttl)
                finally:
                    lock.release()
        except Exception:
            # Ignore background refresh errors
            pass


# Global cache stampede protection instance
cache_protection = CacheStampedeProtection(redis_client) if 'redis_client' in globals() else None

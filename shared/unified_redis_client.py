"""
Unified Redis client for all services.
Provides consistent caching, session management, and distributed locking.
"""
import json
import redis
import logging
from typing import Optional, Any, Dict, List, Union
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


class UnifiedRedisClient:
    """
    Unified Redis client with fallback support and consistent interface.
    
    This client provides:
    - Caching with namespaced keys
    - Session management
    - Rate limiting
    - Cart operations
    - Inventory locking
    - Token blacklisting
    - Pub/Sub for real-time features
    """
    
    def __init__(self, redis_url: str, redis_db: int = 0, service_name: str = "default"):
        """
        Initialize unified Redis client.
        
        Args:
            redis_url: Redis connection URL
            redis_db: Redis database number
            service_name: Service name for key namespacing
        """
        self.service_name = service_name
        self._connected = False
        
        try:
            self._client = redis.Redis.from_url(
                redis_url,
                db=redis_db,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            
            # Test connection
            if self._client.ping():
                self._connected = True
                logger.info(f"Redis connected successfully for {service_name}")
            else:
                logger.error(f"Redis ping failed for {service_name}")
                self._client = None
        except Exception as e:
            logger.error(f"Redis connection failed for {service_name}: {e}")
            self._client = None
        
        # Try to use resilient wrapper if available and Redis is connected
        if self._client and self._connected:
            try:
                from shared.resilient_redis import ResilientRedisClient
                self.client = ResilientRedisClient(self._client)
                self._use_resilient = True
                logger.info(f"Redis client initialized with resilient wrapper for {service_name}")
            except ImportError:
                self.client = self._client
                self._use_resilient = False
                logger.info(f"Redis client initialized without resilient wrapper for {service_name}")
        else:
            # Fallback client that handles failures gracefully
            self.client = self._create_fallback_client()
            self._use_resilient = False
            logger.warning(f"Using fallback Redis client for {service_name}")
    
    def _create_fallback_client(self):
        """Create a fallback client that gracefully handles Redis failures."""
        class FallbackRedisClient:
            def __init__(self):
                self.connected = False
            
            def ping(self):
                return False
            
            def get(self, key):
                return None
            
            def set(self, key, value, **kwargs):
                return False
            
            def setex(self, key, time, value):
                return False
            
            def delete(self, *keys):
                return 0
            
            def exists(self, key):
                return 0
            
            def expire(self, key, seconds):
                return False
            
            def ttl(self, key):
                return -1
            
            def keys(self, pattern):
                return []
            
            def zadd(self, key, mapping, **kwargs):
                return 0
            
            def zcard(self, key):
                return 0
            
            def zrange(self, key, start, end, **kwargs):
                return []
            
            def zremrangebyscore(self, key, min, max):
                return 0
            
            def incr(self, key):
                return 0
            
            def sadd(self, key, *values):
                return 0
            
            def srem(self, key, *values):
                return 0
            
            def smembers(self, key):
                return set()
            
            def publish(self, channel, message):
                return 0
            
            def pubsub(self):
                return None
            
            def info(self):
                return {}
        
        return FallbackRedisClient()
    
    # ==================== Connection Management ====================
    
    def ping(self) -> bool:
        """Check Redis connection."""
        try:
            return self.client.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {e}")
            self._connected = False
            return False
    
    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        return self._connected
    
    def exists(self, key: str) -> bool:
        """Check if key exists."""
        try:
            return self.client.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis exists check failed for {key}: {e}")
            return False

    def get_status(self) -> Dict[str, Any]:
        """Get client status."""
        status = {
            "service": self.service_name,
            "connected": self._connected,
            "using_resilient": self._use_resilient
        }
        if self._use_resilient and hasattr(self.client, 'get_status'):
            status.update(self.client.get_status())
        return status
    
    # ==================== Key Management ====================
    
    def _make_key(self, key: str, namespace: str = None) -> str:
        """Create namespaced key."""
        if namespace:
            return f"{namespace}:{key}"
        return key
    
    # ==================== Cache Operations ====================
    
    def get_cache(self, key: str, namespace: str = "cache") -> Optional[Any]:
        """
        Get cached value.
        
        Args:
            key: Cache key
            namespace: Key namespace (default: "cache")
            
        Returns:
            Cached value or None
        """
        try:
            full_key = self._make_key(key, namespace)
            data = self.client.get(full_key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Cache get failed for {key}: {e}")
            return None
    
    def set_cache(
        self,
        key: str,
        value: Any,
        ttl: int = 300,
        namespace: str = "cache",
        expires_in: Optional[int] = None
    ) -> bool:
        """
        Set cache value with TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (default: 5 minutes)
            namespace: Key namespace (default: "cache")
            expires_in: Optional expiration in minutes (backward compatibility)
            
        Returns:
            True if successful
        """
        try:
            if expires_in is not None:
                ttl = int(expires_in) * 60
            full_key = self._make_key(key, namespace)
            self.client.setex(full_key, ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.error(f"Cache set failed for {key}: {e}")
            return False
    
    def delete_cache(self, key: str, namespace: str = "cache") -> bool:
        """Delete cached value."""
        try:
            full_key = self._make_key(key, namespace)
            self.client.delete(full_key)
            return True
        except Exception as e:
            logger.error(f"Cache delete failed for {key}: {e}")
            return False
    
    def invalidate_pattern(self, pattern: str, namespace: str = "cache") -> int:
        """
        Delete all keys matching pattern.
        
        Args:
            pattern: Key pattern (e.g., "products:*")
            namespace: Key namespace
            
        Returns:
            Number of keys deleted
        """
        try:
            full_pattern = self._make_key(pattern, namespace)
            keys = self.client.keys(full_pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache invalidate pattern failed for {pattern}: {e}")
            return 0
    
    # ==================== Session Operations ====================
    
    def create_session(self, session_id: str, user_data: Dict[str, Any], 
                       expires_in: int = 1440) -> bool:
        """
        Create a new session.
        
        Args:
            session_id: Unique session identifier
            user_data: User data to store
            expires_in: Session duration in minutes (default: 24 hours)
            
        Returns:
            True if successful
        """
        try:
            session_key = f"session:{session_id}"
            self.client.setex(
                session_key, 
                expires_in * 60, 
                json.dumps(user_data)
            )
            
            # Track user sessions
            user_id = user_data.get("user_id")
            if user_id:
                self.client.sadd(f"user_sessions:{user_id}", session_id)
                self.client.expire(f"user_sessions:{user_id}", expires_in * 60)
            
            return True
        except Exception as e:
            logger.error(f"Session creation failed: {e}")
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data."""
        try:
            session_key = f"session:{session_id}"
            data = self.client.get(session_key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Session get failed: {e}")
            return None
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        try:
            session_key = f"session:{session_id}"
            
            # Get user_id before deleting
            data = self.client.get(session_key)
            if data:
                user_data = json.loads(data)
                user_id = user_data.get("user_id")
                if user_id:
                    self.client.srem(f"user_sessions:{user_id}", session_id)
            
            self.client.delete(session_key)
            return True
        except Exception as e:
            logger.error(f"Session delete failed: {e}")
            return False
    
    def delete_user_sessions(self, user_id: int) -> int:
        """Delete all sessions for a user."""
        try:
            sessions = self.client.smembers(f"user_sessions:{user_id}")
            deleted = 0
            for session_id in sessions:
                self.client.delete(f"session:{session_id}")
                deleted += 1
            self.client.delete(f"user_sessions:{user_id}")
            return deleted
        except Exception as e:
            logger.error(f"Delete user sessions failed: {e}")
            return 0
    
    # ==================== Cart Operations ====================
    
    def get_cart(self, user_id: int) -> Optional[Dict]:
        """Get user's cart."""
        return self.get_cache(f"cart:{user_id}", namespace="")
    
    def set_cart(self, user_id: int, cart_data: Dict, expires_in: int = 10080) -> bool:
        """
        Save user's cart.
        
        Args:
            user_id: User ID
            cart_data: Cart data to store
            expires_in: Expiration in minutes (default: 7 days)
        """
        try:
            key = f"cart:{user_id}"
            self.client.setex(key, expires_in * 60, json.dumps(cart_data))
            return True
        except Exception as e:
            logger.error(f"Cart set failed: {e}")
            return False
    
    def delete_cart(self, user_id: int) -> bool:
        """Delete user's cart."""
        try:
            self.client.delete(f"cart:{user_id}")
            return True
        except Exception as e:
            logger.error(f"Cart delete failed: {e}")
            return False
    
    # ==================== Inventory Locking ====================
    
    def lock_inventory(self, product_id: int, quantity: int, 
                       timeout: int = 300) -> bool:
        """
        Lock inventory for a product.
        
        Args:
            product_id: Product ID
            quantity: Quantity to lock
            timeout: Lock timeout in seconds
            
        Returns:
            True if lock acquired
        """
        try:
            key = f"inventory_lock:{product_id}"
            return self.client.set(key, quantity, nx=True, ex=timeout)
        except Exception as e:
            logger.error(f"Inventory lock failed: {e}")
            return False
    
    def unlock_inventory(self, product_id: int) -> bool:
        """Unlock inventory."""
        try:
            self.client.delete(f"inventory_lock:{product_id}")
            return True
        except Exception as e:
            logger.error(f"Inventory unlock failed: {e}")
            return False
    
    def extend_inventory_lock(self, product_id: int, additional_time: int = 300) -> bool:
        """Extend inventory lock timeout."""
        try:
            key = f"inventory_lock:{product_id}"
            return self.client.expire(key, additional_time)
        except Exception as e:
            logger.error(f"Inventory lock extension failed: {e}")
            return False
    
    # ==================== Rate Limiting ====================
    
    def check_rate_limit(self, key: str, limit: int = 5, 
                         window: int = 300) -> Dict[str, Any]:
        """
        Check rate limit using sliding window algorithm.
        
        Args:
            key: Rate limit key (e.g., "login:user@example.com")
            limit: Maximum requests allowed in window
            window: Time window in seconds
            
        Returns:
            Dict with 'allowed', 'remaining', 'reset_after'
        """
        try:
            rate_key = f"rate_limit:{key}"
            now = int(datetime.now(timezone.utc).timestamp())
            window_start = now - window
            
            # Remove old entries
            self.client.zremrangebyscore(rate_key, 0, window_start)
            
            # Count current requests
            current_count = self.client.zcard(rate_key)
            
            if current_count < limit:
                # Add current request
                self.client.zadd(rate_key, {str(now): now})
                self.client.expire(rate_key, window)
                
                return {
                    "allowed": True,
                    "remaining": limit - current_count - 1,
                    "reset_after": window
                }
            else:
                # Calculate reset time
                oldest = self.client.zrange(rate_key, 0, 0, withscores=True)
                reset_after = 0
                if oldest:
                    reset_after = int(oldest[0][1] + window - now)
                
                return {
                    "allowed": False,
                    "remaining": 0,
                    "reset_after": max(1, reset_after)
                }
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Allow on error (fail open)
            return {"allowed": True, "remaining": limit, "reset_after": window}
    
    # ==================== Token Blacklisting ====================
    
    def blacklist_token(self, token: str, expires_in: int = 1800) -> bool:
        """
        Add token to blacklist.
        
        Args:
            token: JWT token to blacklist
            expires_in: Seconds until token expires
            
        Returns:
            True if successful
        """
        try:
            self.client.setex(f"blacklist:{token}", expires_in, "1")
            return True
        except Exception as e:
            logger.error(f"Token blacklist failed: {e}")
            return False
    
    def is_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted."""
        try:
            return self.client.exists(f"blacklist:{token}") > 0
        except Exception as e:
            logger.error(f"Token blacklist check failed: {e}")
            return False
    
    # ==================== OTP Operations ====================
    
    def store_otp(self, key: str, otp: str, expires_in: int = 300) -> bool:
        """
        Store OTP for verification.
        
        Args:
            key: OTP key (e.g., email or phone)
            otp: One-time password
            expires_in: Expiration in seconds (default: 5 minutes)
            
        Returns:
            True if successful
        """
        try:
            self.client.setex(f"otp:{key}", expires_in, otp)
            return True
        except Exception as e:
            logger.error(f"OTP store failed: {e}")
            return False
    
    def get_otp(self, key: str) -> Optional[str]:
        """Get stored OTP."""
        try:
            return self.client.get(f"otp:{key}")
        except Exception as e:
            logger.error(f"OTP get failed: {e}")
            return None
    
    def delete_otp(self, key: str) -> bool:
        """Delete OTP after use."""
        try:
            self.client.delete(f"otp:{key}")
            self.client.delete(f"otp_attempts:{key}")
            return True
        except Exception as e:
            logger.error(f"OTP delete failed: {e}")
            return False

    def get_and_delete_otp(self, key: str) -> Optional[str]:
        """
        Atomically read and delete OTP using Lua script.
        Prevents race condition where two concurrent requests both read the same OTP.
        Returns the OTP value if found and deleted, None otherwise.
        """
        try:
            otp_key = f"otp:{key}"
            attempts_key = f"otp_attempts:{key}"
            # Lua script: GET + DEL in one atomic operation
            script = """
            local otp = redis.call('GET', KEYS[1])
            if otp then
                redis.call('DEL', KEYS[1])
                redis.call('DEL', KEYS[2])
            end
            return otp
            """
            return self.client.eval(script, 2, otp_key, attempts_key)
        except Exception as e:
            logger.error(f"OTP atomic read-delete failed: {e}")
            return None
    
    def increment_otp_attempts(self, key: str, max_attempts: int = 5) -> Dict[str, Any]:
        """
        Increment OTP verification attempts.
        
        Args:
            key: OTP key
            max_attempts: Maximum allowed attempts
            
        Returns:
            Dict with 'attempts' and 'locked'
        """
        try:
            attempts = self.client.incr(f"otp_attempts:{key}")
            self.client.expire(f"otp_attempts:{key}", 300)  # 5 min window
            
            return {
                "attempts": attempts,
                "locked": attempts >= max_attempts,
                "remaining": max(0, max_attempts - attempts)
            }
        except Exception as e:
            logger.error(f"OTP attempts increment failed: {e}")
            return {"attempts": 0, "locked": False, "remaining": max_attempts}
    
    # ==================== Pub/Sub Operations ====================
    
    def publish(self, channel: str, message: Any) -> bool:
        """
        Publish message to a Redis channel.
        
        Args:
            channel: Channel name
            message: Message to publish
            
        Returns:
            True if successful
        """
        try:
            self.client.publish(channel, json.dumps(message, default=str))
            return True
        except Exception as e:
            logger.error(f"Publish failed: {e}")
            return False
    
    def subscribe(self, *channels: str):
        """
        Subscribe to channels.
        
        Args:
            channels: Channel names to subscribe to
            
        Returns:
            PubSub object
        """
        try:
            pubsub = self.client.pubsub()
            pubsub.subscribe(*channels)
            return pubsub
        except Exception as e:
            logger.error(f"Subscribe failed: {e}")
            return None
    
    # ==================== Health Check ====================
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check.
        
        Returns:
            Health status dict
        """
        try:
            ping_result = self.ping()
            info = self.client.info() if ping_result else {}
            
            return {
                "status": "healthy" if ping_result else "unhealthy",
                "connected": ping_result,
                "using_resilient": self._use_resilient,
                "redis_version": info.get("redis_version", "unknown"),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(e)
            }


# Factory function for creating service-specific clients
def create_redis_client(redis_url: str, redis_db: int = 0, 
                        service_name: str = "default") -> UnifiedRedisClient:
    """
    Create a unified Redis client for a service.
    
    Args:
        redis_url: Redis connection URL
        redis_db: Redis database number
        service_name: Service name for logging
        
    Returns:
        UnifiedRedisClient instance
    """
    return UnifiedRedisClient(redis_url, redis_db, service_name)

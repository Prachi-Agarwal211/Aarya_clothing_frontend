"""
Smart Cache implementation with automatic invalidation and TTL management.
Provides intelligent caching for frequently accessed data.
"""
import json
import hashlib
import logging
from typing import Optional, Any, Dict, List, Callable, TypeVar, Generic
from functools import wraps
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CacheKey:
    """Utility class for generating cache keys."""
    
    @staticmethod
    def make(*parts: Any, prefix: str = "cache") -> str:
        """Generate a cache key from parts."""
        key_parts = [str(p) for p in parts if p is not None]
        return f"{prefix}:{':'.join(key_parts)}"
    
    @staticmethod
    def hash_key(key: str) -> str:
        """Hash a long key to a fixed length."""
        return hashlib.md5(key.encode()).hexdigest()
    
    @staticmethod
    def for_model(model: str, model_id: int, relation: str = None) -> str:
        """Generate key for a model instance."""
        if relation:
            return f"cache:{model}:{model_id}:{relation}"
        return f"cache:{model}:{model_id}"
    
    @staticmethod
    def for_list(model: str, filters: Dict = None, page: int = None) -> str:
        """Generate key for a model list."""
        filter_str = ""
        if filters:
            filter_str = ":" + CacheKey.hash_key(json.dumps(filters, sort_keys=True))
        page_str = f":page:{page}" if page else ""
        return f"cache:{model}:list{filter_str}{page_str}"
    
    @staticmethod
    def for_user(user_id: int, resource: str) -> str:
        """Generate key for user-specific data."""
        return f"cache:user:{user_id}:{resource}"


class SmartCache:
    """
    Intelligent cache with automatic invalidation and TTL management.
    
    Features:
    - Automatic key generation
    - TTL management with sensible defaults
    - Pattern-based invalidation
    - Cache warming support
    - Fallback to database on miss
    """
    
    # Default TTL values by data type (in seconds)
    DEFAULT_TTLS = {
        "product": 300,          # 5 minutes
        "product_list": 60,      # 1 minute
        "category": 600,         # 10 minutes
        "category_tree": 600,    # 10 minutes
        "user": 300,             # 5 minutes
        "cart": 1800,            # 30 minutes
        "order": 60,             # 1 minute
        "promotion": 300,        # 5 minutes
        "review": 300,           # 5 minutes
        "inventory": 30,         # 30 seconds
        "default": 300,          # 5 minutes
    }
    
    def __init__(self, redis_client, default_ttl: int = 300):
        """
        Initialize SmartCache.
        
        Args:
            redis_client: Redis client instance
            default_ttl: Default TTL in seconds
        """
        self.redis = redis_client
        self.default_ttl = default_ttl
        self._local_cache: Dict[str, Dict] = {}  # For request-level caching
    
    def _get_ttl(self, data_type: str) -> int:
        """Get TTL for a data type."""
        return self.DEFAULT_TTLS.get(data_type, self.default_ttl)
    
    def get(
        self,
        key: str,
        default: Any = None,
        use_local: bool = True
    ) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            default: Default value if not found
            use_local: Whether to check local cache first
            
        Returns:
            Cached value or default
        """
        # Check local cache first
        if use_local and key in self._local_cache:
            entry = self._local_cache[key]
            if entry["expires_at"] > datetime.now(timezone.utc):
                return entry["value"]
            else:
                del self._local_cache[key]
        
        # Check Redis
        try:
            data = self.redis.get_cache(key)
            if data is not None:
                # Update local cache
                if use_local:
                    self._local_cache[key] = {
                        "value": data,
                        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=60)
                    }
                return data
        except Exception as e:
            logger.warning(f"Cache get error for {key}: {e}")
        
        return default
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: int = None,
        data_type: str = "default",
        use_local: bool = True
    ) -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: TTL in seconds (uses data_type default if not provided)
            data_type: Type of data for default TTL
            use_local: Whether to also set in local cache
            
        Returns:
            True if successful
        """
        if ttl is None:
            ttl = self._get_ttl(data_type)
        
        # Set in Redis
        try:
            self.redis.set_cache(key, value, ttl)
        except Exception as e:
            logger.warning(f"Cache set error for {key}: {e}")
            return False
        
        # Set in local cache
        if use_local:
            self._local_cache[key] = {
                "value": value,
                "expires_at": datetime.now(timezone.utc) + timedelta(seconds=min(60, ttl))
            }
        
        return True
    
    def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        # Delete from local cache
        if key in self._local_cache:
            del self._local_cache[key]
        
        # Delete from Redis
        try:
            self.redis.delete_cache(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete error for {key}: {e}")
            return False
    
    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching a pattern.
        
        Args:
            pattern: Key pattern (e.g., "product:*")
            
        Returns:
            Number of keys invalidated
        """
        # Clear matching keys from local cache
        keys_to_remove = [
            k for k in self._local_cache.keys() 
            if pattern.replace("*", "") in k
        ]
        for key in keys_to_remove:
            del self._local_cache[key]
        
        # Clear from Redis
        try:
            return self.redis.invalidate_pattern(pattern)
        except Exception as e:
            logger.warning(f"Cache invalidate pattern error for {pattern}: {e}")
            return 0
    
    def invalidate_model(self, model: str, model_id: int = None) -> int:
        """
        Invalidate all cache entries for a model.
        
        Args:
            model: Model name (e.g., "product")
            model_id: Optional specific model ID
            
        Returns:
            Number of keys invalidated
        """
        if model_id:
            # Invalidate specific model instance
            pattern = f"cache:{model}:{model_id}*"
        else:
            # Invalidate all instances of this model
            pattern = f"cache:{model}:*"
        
        return self.invalidate_pattern(pattern)
    
    def get_or_set(
        self,
        key: str,
        callback: Callable[[], T],
        ttl: int = None,
        data_type: str = "default"
    ) -> T:
        """
        Get from cache or execute callback and cache result.
        
        Args:
            key: Cache key
            callback: Function to execute on cache miss
            ttl: TTL in seconds
            data_type: Type of data for default TTL
            
        Returns:
            Cached or fresh value
        """
        # Try to get from cache
        value = self.get(key)
        if value is not None:
            return value
        
        # Execute callback
        value = callback()
        
        # Cache result
        if value is not None:
            self.set(key, value, ttl=ttl, data_type=data_type)
        
        return value
    
    async def get_or_set_async(
        self,
        key: str,
        callback: Callable[[], T],
        ttl: int = None,
        data_type: str = "default"
    ) -> T:
        """
        Async version of get_or_set.
        
        Args:
            key: Cache key
            callback: Async function to execute on cache miss
            ttl: TTL in seconds
            data_type: Type of data for default TTL
            
        Returns:
            Cached or fresh value
        """
        # Try to get from cache
        value = self.get(key)
        if value is not None:
            return value
        
        # Execute async callback
        value = await callback()
        
        # Cache result
        if value is not None:
            self.set(key, value, ttl=ttl, data_type=data_type)
        
        return value
    
    def clear_local_cache(self):
        """Clear the local request cache."""
        self._local_cache.clear()
    
    def warm_cache(self, items: List[Dict[str, Any]], model: str) -> int:
        """
        Warm cache with multiple items.
        
        Args:
            items: List of items with 'id' and 'data' keys
            model: Model name for key generation
            
        Returns:
            Number of items cached
        """
        count = 0
        for item in items:
            key = CacheKey.for_model(model, item["id"])
            if self.set(key, item.get("data"), data_type=model):
                count += 1
        return count


# ==================== Decorators ====================

def cached(
    key_pattern: str,
    ttl: int = None,
    data_type: str = "default"
):
    """
    Decorator to cache function results.
    
    Args:
        key_pattern: Cache key pattern (use {arg} for argument substitution)
        ttl: TTL in seconds
        data_type: Type of data for default TTL
        
    Example:
        @cached("product:{product_id}", data_type="product")
        def get_product(product_id: int):
            return db.query(Product).get(product_id)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Get cache instance from first argument if it has one
            cache = None
            if args and hasattr(args[0], '_cache'):
                cache = args[0]._cache
            
            if cache is None:
                # No cache available, just execute function
                return func(*args, **kwargs)
            
            # Generate cache key
            key = key_pattern
            # Simple argument substitution
            arg_names = func.__code__.co_varnames[:func.__code__.co_argcount]
            for i, arg_name in enumerate(arg_names):
                if i < len(args):
                    key = key.replace(f"{{{arg_name}}}", str(args[i]))
            for arg_name, arg_value in kwargs.items():
                key = key.replace(f"{{{arg_name}}}", str(arg_value))
            
            # Get or set from cache
            return cache.get_or_set(
                key,
                lambda: func(*args, **kwargs),
                ttl=ttl,
                data_type=data_type
            )
        
        return wrapper
    return decorator


def invalidate_cache(pattern: str):
    """
    Decorator to invalidate cache after function execution.
    
    Example:
        @invalidate_cache("product:{product_id}")
        def update_product(product_id: int, data: dict):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            
            # Get cache instance
            cache = None
            if args and hasattr(args[0], '_cache'):
                cache = args[0]._cache
            
            if cache:
                # Generate pattern for invalidation
                pattern_to_invalidate = pattern
                arg_names = func.__code__.co_varnames[:func.__code__.co_argcount]
                for i, arg_name in enumerate(arg_names):
                    if i < len(args):
                        pattern_to_invalidate = pattern_to_invalidate.replace(
                            f"{{{arg_name}}}", str(args[i])
                        )
                for arg_name, arg_value in kwargs.items():
                    pattern_to_invalidate = pattern_to_invalidate.replace(
                        f"{{{arg_name}}}", str(arg_value)
                    )
                
                cache.invalidate_pattern(pattern_to_invalidate)
            
            return result
        
        return wrapper
    return decorator


# ==================== Cache Warming ====================

class CacheWarmer:
    """
    Utility for warming cache with frequently accessed data.
    
    Note: Model classes (Product, Category) should be passed to methods
    or imported locally to avoid circular imports in shared module.
    """
    
    def __init__(self, cache: SmartCache, db_session, product_model=None, category_model=None):
        """
        Initialize cache warmer.
        
        Args:
            cache: SmartCache instance
            db_session: Database session
            product_model: Optional Product model class (to avoid circular imports)
            category_model: Optional Category model class (to avoid circular imports)
        """
        self.cache = cache
        self.db = db_session
        self.Product = product_model
        self.Category = category_model
    
    def warm_products(self, product_ids: List[int] = None, product_model=None) -> int:
        """
        Warm product cache.
        
        Args:
            product_ids: Optional list of specific product IDs
            product_model: Optional Product model class (overrides constructor)
            
        Returns:
            Number of products cached
        """
        from sqlalchemy.orm import joinedload
        
        # Use provided model or fall back to constructor model
        Product = product_model or self.Product
        if Product is None:
            logger.warning("Product model not provided - skipping product cache warming")
            return 0
        
        query = self.db.query(Product).options(
            joinedload(Product.images),
            joinedload(Product.category)
        ).filter(Product.is_active == True)
        
        if product_ids:
            query = query.filter(Product.id.in_(product_ids))
        
        products = query.all()
        count = 0
        
        for product in products:
            key = CacheKey.for_model("product", product.id)
            data = {
                "id": product.id,
                "name": product.name,
                "slug": product.slug,
                "price": float(product.price),
                "images": [{"url": img.url} for img in product.images],
                "category": {"name": product.category.name} if product.category else None
            }
            if self.cache.set(key, data, data_type="product"):
                count += 1
        
        return count
    
    def warm_categories(self, category_model=None) -> int:
        """
        Warm category cache.
        
        Args:
            category_model: Optional Category model class (overrides constructor)
            
        Returns:
            Number of categories cached
        """
        # Use provided model or fall back to constructor model
        Category = category_model or self.Category
        if Category is None:
            logger.warning("Category model not provided - skipping category cache warming")
            return 0
        
        categories = self.db.query(Category).filter(
            Category.is_active == True
        ).all()
        
        count = 0
        for category in categories:
            key = CacheKey.for_model("category", category.id)
            data = {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "parent_id": category.parent_id
            }
            if self.cache.set(key, data, data_type="category"):
                count += 1
        
        # Also cache category tree
        tree_key = CacheKey.make("category_tree")
        tree_data = self._build_category_tree(categories)
        self.cache.set(tree_key, tree_data, data_type="category_tree")
        
        return count + 1
    
    def _build_category_tree(self, categories, parent_id=None):
        """Build hierarchical category tree."""
        tree = []
        for cat in categories:
            if cat.parent_id == parent_id:
                node = {
                    "id": cat.id,
                    "name": cat.name,
                    "slug": cat.slug,
                    "children": self._build_category_tree(categories, cat.id)
                }
                tree.append(node)
        return tree

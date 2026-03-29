"""
Enhanced Query Optimization with Redis Caching.
Provides automatic query result caching and cache invalidation.
"""
import json
import hashlib
import logging
from typing import Optional, Any, Dict, List, Callable, TypeVar, Union
from functools import wraps
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

T = TypeVar('T')


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal types."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class QueryCache:
    """
    Query result cache with automatic invalidation.
    
    Features:
    - Automatic key generation from query parameters
    - Configurable TTL per query type
    - Cache warming support
    - Pattern-based invalidation
    - Fallback to database on cache miss
    """
    
    # Default TTL values in seconds
    DEFAULT_TTLS = {
        "product_list": 60,          # 1 minute for product lists
        "product_detail": 300,       # 5 minutes for product details
        "category_list": 300,        # 5 minutes for categories
        "order_list": 30,            # 30 seconds for orders (frequently changing)
        "order_detail": 60,          # 1 minute for order details
        "user_profile": 300,         # 5 minutes for user data
        "cart": 1800,                # 30 minutes for cart
        "review_list": 300,          # 5 minutes for reviews
        "analytics": 600,            # 10 minutes for analytics
        "default": 120,              # 2 minutes default
    }
    
    def __init__(self, redis_client=None):
        """
        Initialize query cache.
        
        Args:
            redis_client: Redis client instance (from core.redis_client)
        """
        self.redis = redis_client
        self._local_cache: Dict[str, Dict] = {}  # Request-level cache
    
    def _generate_key(self, prefix: str, **kwargs) -> str:
        """
        Generate cache key from parameters.
        
        Args:
            prefix: Key prefix (e.g., "products", "orders")
            **kwargs: Query parameters
            
        Returns:
            Cache key string
        """
        # Sort kwargs for consistent key generation
        sorted_params = sorted(kwargs.items(), key=lambda x: x[0])
        param_str = "&".join(f"{k}={v}" for k, v in sorted_params if v is not None)
        
        # Hash long parameter strings
        if len(param_str) > 100:
            param_hash = hashlib.md5(param_str.encode()).hexdigest()[:16]
            return f"query:{prefix}:{param_hash}"
        
        return f"query:{prefix}:{param_str}" if param_str else f"query:{prefix}"
    
    def _get_ttl(self, query_type: str, custom_ttl: int = None) -> int:
        """Get TTL for query type."""
        if custom_ttl:
            return custom_ttl
        return self.DEFAULT_TTLS.get(query_type, self.DEFAULT_TTLS["default"])
    
    def get(self, key: str, default: Any = None) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            default: Default value if not found
            
        Returns:
            Cached value or default
        """
        # Check local cache first
        if key in self._local_cache:
            entry = self._local_cache[key]
            if entry.get("expires_at", float('inf')) > datetime.now(timezone.utc).timestamp():
                return entry.get("value")
            else:
                del self._local_cache[key]
        
        # Check Redis cache
        if self.redis:
            try:
                cached = self.redis.get(key)
                if cached:
                    data = json.loads(cached)
                    # Store in local cache for faster subsequent access
                    self._local_cache[key] = {
                        "value": data,
                        "expires_at": datetime.now(timezone.utc).timestamp() + 60  # 1 minute local cache
                    }
                    return data
            except Exception as e:
                logger.warning(f"Cache get error for key {key}: {e}")
        
        return default
    
    def set(self, key: str, value: Any, ttl: int = None, query_type: str = "default") -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            query_type: Type of query for default TTL
            
        Returns:
            True if successful
        """
        if ttl is None:
            ttl = self._get_ttl(query_type)
        
        # Store in local cache
        self._local_cache[key] = {
            "value": value,
            "expires_at": datetime.now(timezone.utc).timestamp() + min(ttl, 60)
        }
        
        # Store in Redis
        if self.redis:
            try:
                serialized = json.dumps(value, cls=DecimalEncoder)
                self.redis.setex(key, ttl, serialized)
                return True
            except Exception as e:
                logger.warning(f"Cache set error for key {key}: {e}")
        
        return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        # Delete from local cache
        self._local_cache.pop(key, None)
        
        # Delete from Redis
        if self.redis:
            try:
                self.redis.delete(key)
                return True
            except Exception as e:
                logger.warning(f"Cache delete error for key {key}: {e}")
        
        return False
    
    def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern.
        
        Args:
            pattern: Redis pattern (e.g., "query:products:*")
            
        Returns:
            Number of keys deleted
        """
        if not self.redis:
            return 0
        
        try:
            keys = self.redis.keys(pattern)
            if keys:
                return self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"Cache delete_pattern error for {pattern}: {e}")
            return 0
    
    def invalidate_related(self, model: str, model_id: int = None) -> None:
        """
        Invalidate cache for related queries.
        
        Args:
            model: Model name (e.g., "product", "order")
            model_id: Optional specific model ID
        """
        if model_id:
            # Invalidate specific model cache
            self.delete_pattern(f"query:{model}:*id*{model_id}*")
        else:
            # Invalidate all model cache
            self.delete_pattern(f"query:{model}:*")
    
    def clear_local(self) -> None:
        """Clear local cache (call at end of request)."""
        self._local_cache.clear()


# ==================== Decorators for Automatic Caching ====================

def cache_query(
    prefix: str,
    query_type: str = "default",
    ttl: int = None,
    key_func: Callable = None,
    invalidate_on: List[str] = None
):
    """
    Decorator to cache query results automatically.
    
    Args:
        prefix: Cache key prefix
        query_type: Type for TTL lookup
        ttl: Custom TTL in seconds
        key_func: Custom key generation function
        invalidate_on: List of model names to invalidate on write operations
        
    Example:
        @cache_query("products", query_type="product_list", ttl=60)
        def get_products(db, category_id=None, limit=20):
            query = db.query(Product)
            if category_id:
                query = query.filter(Product.category_id == category_id)
            return query.limit(limit).all()
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract cache from args or use global
            cache = kwargs.pop('_cache', None)
            if not cache:
                # Try to get from first arg if it's a service with cache
                if args and hasattr(args[0], 'cache'):
                    cache = args[0].cache
            
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # Auto-generate from function name and parameters
                param_str = "&".join(
                    f"{k}={v}" for k, v in kwargs.items()
                    if v is not None and not isinstance(v, Session)
                )
                cache_key = f"query:{prefix}:{func.__name__}:{param_str}"
            
            # Try cache first
            if cache:
                cached = cache.get(cache_key)
                if cached is not None:
                    logger.debug(f"Cache hit for {cache_key}")
                    return cached
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Cache result
            if cache and result is not None:
                cache.set(cache_key, result, ttl=ttl, query_type=query_type)
                logger.debug(f"Cached {cache_key}")
            
            return result
        return wrapper
    return decorator


def invalidate_cache(*patterns: str):
    """
    Decorator to invalidate cache on write operations.
    
    Args:
        *patterns: Cache patterns to invalidate
        
    Example:
        @invalidate_cache("query:products:*", "query:categories:*")
        def create_product(db, product_data):
            product = Product(**product_data)
            db.add(product)
            db.commit()
            return product
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Execute function
            result = func(*args, **kwargs)
            
            # Invalidate cache
            cache = kwargs.pop('_cache', None)
            if not cache:
                if args and hasattr(args[0], 'cache'):
                    cache = args[0].cache
            
            if cache:
                for pattern in patterns:
                    cache.delete_pattern(pattern)
                    logger.debug(f"Invalidated cache pattern: {pattern}")
            
            return result
        return wrapper
    return decorator


# ==================== Optimized Query Functions ====================

def get_cached_products(
    db: Session,
    cache: QueryCache,
    skip: int = 0,
    limit: int = 100,
    category_id: int = None,
    featured: bool = False,
    new_arrivals: bool = False
) -> List[Dict]:
    """
    Get products with caching.
    
    Args:
        db: Database session
        cache: Query cache instance
        skip: Pagination offset
        limit: Page size
        category_id: Filter by category
        featured: Filter featured only
        new_arrivals: Filter new arrivals only
        
    Returns:
        List of product dicts
    """
    from models.product import Product
    from sqlalchemy.orm import selectinload, joinedload
    
    # Generate cache key
    cache_key = cache._generate_key(
        "products",
        skip=skip,
        limit=limit,
        category_id=category_id,
        featured=featured,
        new_arrivals=new_arrivals
    )
    
    # Try cache
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # Build query with eager loading
    query = db.query(Product).options(
        selectinload(Product.images),
        selectinload(Product.inventory),
        joinedload(Product.category)
    )
    
    # Apply filters
    query = query.filter(Product.is_active == True)
    
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if featured:
        query = query.filter(Product.is_featured == True)
    if new_arrivals:
        query = query.filter(Product.is_new_arrival == True)
    
    # Execute query
    products = query.offset(skip).limit(limit).all()
    
    # Convert to dict for caching
    result = [product_to_dict(p) for p in products]
    
    # Cache result
    cache.set(cache_key, result, query_type="product_list")
    
    return result


def get_cached_product_detail(
    db: Session,
    cache: QueryCache,
    product_id: int
) -> Optional[Dict]:
    """
    Get product detail with caching.
    
    Args:
        db: Database session
        cache: Query cache instance
        product_id: Product ID
        
    Returns:
        Product dict or None
    """
    from models.product import Product
    from sqlalchemy.orm import selectinload, joinedload
    
    # Generate cache key
    cache_key = f"query:products:detail:{product_id}"
    
    # Try cache
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # Build query with eager loading
    product = db.query(Product).options(
        selectinload(Product.images),
        selectinload(Product.inventory),
        joinedload(Product.category)
    ).filter(Product.id == product_id).first()
    
    if not product:
        return None
    
    # Convert to dict
    result = product_to_dict(product, include_details=True)
    
    # Cache result
    cache.set(cache_key, result, query_type="product_detail")
    
    return result


def product_to_dict(product, include_details: bool = False) -> Dict:
    """Convert product model to dict."""
    from decimal import Decimal
    
    result = {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "short_description": product.short_description,
        "base_price": float(product.base_price) if product.base_price else 0,
        "mrp": float(product.mrp) if product.mrp else None,
        "hsn_code": product.hsn_code,
        "gst_rate": float(product.gst_rate) if product.gst_rate else None,
        "is_taxable": product.is_taxable,
        "category_id": product.category_id,
        "brand": product.brand,
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_new_arrival": product.is_new_arrival,
        "average_rating": float(product.average_rating) if product.average_rating else 0,
        "review_count": product.review_count,
        "meta_title": product.meta_title,
        "meta_description": product.meta_description,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None,
    }
    
    if include_details:
        result["images"] = [
            {
                "id": img.id,
                "image_url": img.image_url,
                "alt_text": img.alt_text,
                "is_primary": img.is_primary,
                "display_order": img.display_order
            }
            for img in product.images
        ]
        result["inventory"] = [
            {
                "id": inv.id,
                "sku": inv.sku,
                "size": inv.size,
                "color": inv.color,
                "quantity": inv.quantity,
                "available_quantity": inv.available_quantity,
                "effective_price": float(inv.effective_price) if inv.effective_price else None
            }
            for inv in product.inventory
        ]
        if product.category:
            result["category"] = {
                "id": product.category.id,
                "name": product.category.name,
                "slug": product.category.slug
            }
    
    return result


# ==================== Cache Warming ====================

def warm_product_cache(
    db: Session,
    cache: QueryCache,
    product_ids: List[int] = None,
    limit: int = 100
) -> int:
    """
    Warm product cache for frequently accessed products.
    
    Args:
        db: Database session
        cache: Query cache instance
        product_ids: Specific product IDs to warm
        limit: Max products to warm
        
    Returns:
        Number of products cached
    """
    from models.product import Product
    from sqlalchemy.orm import selectinload, joinedload
    
    query = db.query(Product).options(
        selectinload(Product.images),
        selectinload(Product.inventory),
        joinedload(Product.category)
    ).filter(Product.is_active == True)
    
    if product_ids:
        query = query.filter(Product.id.in_(product_ids))
    else:
        # Warm featured and new arrivals first
        query = query.order_by(
            Product.is_featured.desc(),
            Product.is_new_arrival.desc(),
            Product.created_at.desc()
        )
    
    products = query.limit(limit).all()
    
    cached_count = 0
    for product in products:
        cache_key = f"query:products:detail:{product.id}"
        result = product_to_dict(product, include_details=True)
        cache.set(cache_key, result, query_type="product_detail")
        cached_count += 1
    
    logger.info(f"Warmed cache for {cached_count} products")
    return cached_count


def get_cache_stats(cache: QueryCache) -> Dict:
    """Get cache statistics."""
    stats = {
        "local_cache_size": len(cache._local_cache),
        "redis_connected": cache.redis is not None and cache.redis.ping() if cache.redis else False,
    }
    
    if cache.redis and stats["redis_connected"]:
        info = cache.redis.info("memory")
        stats["redis_memory_used"] = info.get("used_memory_human", "unknown")
        stats["redis_keys"] = cache.redis.dbsize()
    
    return stats

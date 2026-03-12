"""
Query optimization utilities for SQLAlchemy.
Provides eager loading options to prevent N+1 query problems.
"""
from sqlalchemy.orm import joinedload, selectinload, subqueryload
from typing import List, Optional, Any, Callable
from functools import wraps


# ==================== Eager Loading Options ====================

def get_order_eager_options():
    """Get eager loading options for Order queries."""
    return [
        joinedload("items"),
        joinedload("shipping_address"),
        joinedload("billing_address"),
    ]


def get_product_eager_options():
    """Get eager loading options for Product queries."""
    return [
        joinedload("images"),
        joinedload("category"),
        selectinload("inventory"),
    ]


def get_product_detail_eager_options():
    """Get eager loading options for detailed Product queries."""
    return [
        joinedload("images"),
        joinedload("category"),
        selectinload("inventory"),
        selectinload("variants"),
        subqueryload("reviews"),
    ]


def get_category_eager_options():
    """Get eager loading options for Category queries."""
    return [
        joinedload("parent"),
        selectinload("children"),
        selectinload("products"),
    ]


def get_user_eager_options():
    """Get eager loading options for User queries."""
    return [
        selectinload("addresses"),
        selectinload("orders"),
    ]


def get_cart_eager_options():
    """Get eager loading options for Cart queries."""
    return [
        joinedload("items"),
        joinedload("items.product"),
        joinedload("items.inventory"),
    ]


def get_review_eager_options():
    """Get eager loading options for Review queries."""
    return [
        joinedload("user"),
        joinedload("product"),
    ]


def get_wishlist_eager_options():
    """Get eager loading options for Wishlist queries."""
    return [
        joinedload("items"),
        joinedload("items.product"),
        joinedload("items.variant"),
    ]


# ==================== Query Helpers ====================

def apply_eager_loading(query, options: List[Any]):
    """
    Apply eager loading options to a query.
    
    Args:
        query: SQLAlchemy query
        options: List of eager loading options
        
    Returns:
        Query with eager loading applied
    """
    for option in options:
        query = query.options(option)
    return query


def paginate_query(query, page: int = 1, per_page: int = 20):
    """
    Apply pagination to a query.
    
    Args:
        query: SQLAlchemy query
        page: Page number (1-indexed)
        per_page: Items per page
        
    Returns:
        Tuple of (items, total_count, page_info)
    """
    total = query.count()
    offset = (page - 1) * per_page
    items = query.offset(offset).limit(per_page).all()
    
    page_info = {
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page,
        "has_next": offset + per_page < total,
        "has_prev": page > 1
    }
    
    return items, total, page_info


# ==================== Query Builder ====================

class OptimizedQueryBuilder:
    """
    Builder for creating optimized queries with eager loading.
    
    Example:
        query = OptimizedQueryBuilder(db, Order)
            .with_eager_loading("items", "shipping_address")
            .filter_by(user_id=1)
            .order_by("created_at", desc=True)
            .paginate(page=1, per_page=20)
    """
    
    def __init__(self, db, model):
        """
        Initialize query builder.
        
        Args:
            db: Database session
            model: SQLAlchemy model class
        """
        self.db = db
        self.model = model
        self._query = db.query(model)
        self._eager_options = []
    
    def with_eager_loading(self, *relationships: str) -> "OptimizedQueryBuilder":
        """
        Add eager loading for relationships.
        
        Args:
            *relationships: Relationship names to eager load
            
        Returns:
            Self for chaining
        """
        for rel in relationships:
            if "." in rel:
                # Nested relationship
                self._eager_options.append(joinedload(rel))
            else:
                self._eager_options.append(selectinload(rel))
        return self
    
    def with_joined_load(self, *relationships: str) -> "OptimizedQueryBuilder":
        """Add joinedload for relationships (single query)."""
        for rel in relationships:
            self._eager_options.append(joinedload(rel))
        return self
    
    def with_selectin_load(self, *relationships: str) -> "OptimizedQueryBuilder":
        """Add selectinload for relationships (separate IN query)."""
        for rel in relationships:
            self._eager_options.append(selectinload(rel))
        return self
    
    def filter_by(self, **filters) -> "OptimizedQueryBuilder":
        """Add filter conditions."""
        self._query = self._query.filter_by(**filters)
        return self
    
    def filter(self, *criteria) -> "OptimizedQueryBuilder":
        """Add filter criteria."""
        self._query = self._query.filter(*criteria)
        return self
    
    def order_by(self, column: str, desc: bool = False) -> "OptimizedQueryBuilder":
        """Add ordering."""
        col = getattr(self.model, column)
        if desc:
            col = col.desc()
        self._query = self._query.order_by(col)
        return self
    
    def limit(self, limit: int) -> "OptimizedQueryBuilder":
        """Add limit."""
        self._query = self._query.limit(limit)
        return self
    
    def offset(self, offset: int) -> "OptimizedQueryBuilder":
        """Add offset."""
        self._query = self._query.offset(offset)
        return self
    
    def _apply_options(self):
        """Apply eager loading options."""
        for option in self._eager_options:
            self._query = self._query.options(option)
    
    def all(self) -> List[Any]:
        """Execute query and return all results."""
        self._apply_options()
        return self._query.all()
    
    def first(self) -> Optional[Any]:
        """Execute query and return first result."""
        self._apply_options()
        return self._query.first()
    
    def one(self) -> Any:
        """Execute query and return exactly one result."""
        self._apply_options()
        return self._query.one()
    
    def one_or_none(self) -> Optional[Any]:
        """Execute query and return one result or None."""
        self._apply_options()
        return self._query.one_or_none()
    
    def count(self) -> int:
        """Return count of results."""
        return self._query.count()
    
    def paginate(self, page: int = 1, per_page: int = 20) -> dict:
        """
        Execute paginated query.
        
        Returns:
            Dict with items, total, and page_info
        """
        total = self._query.count()
        offset = (page - 1) * per_page
        
        self._apply_options()
        items = self._query.offset(offset).limit(per_page).all()
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
            "has_next": offset + per_page < total,
            "has_prev": page > 1
        }
    
    def get_query(self):
        """Get the raw query for further customization."""
        self._apply_options()
        return self._query


# ==================== Decorator for Automatic Eager Loading ====================

def with_eager_loading(*relationships):
    """
    Decorator to automatically apply eager loading to query results.
    
    Example:
        @with_eager_loading("items", "shipping_address")
        def get_orders(db, user_id):
            return db.query(Order).filter_by(user_id=user_id).all()
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            # The eager loading should be applied in the query itself
            # This decorator is for documentation and future use
            return result
        return wrapper
    return decorator

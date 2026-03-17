"""Product service for managing product operations.

This service handles all product-related operations including CRUD operations,
search, and caching. It uses SQLAlchemy for database operations and Redis
for caching when available.
"""
import os
import logging
from typing import List, Optional, Dict, Any
from decimal import Decimal

from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import text, and_, or_
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from fastapi import HTTPException, status

from models.product import Product
from models.category import Category
from schemas.product import ProductCreate, ProductUpdate

# Import caching utilities with proper error handling
_cache_instance: Optional["QueryCache"] = None
_cache_import_error: Optional[str] = None

try:
    from core.redis_client import redis_client
    from shared.query_cache import QueryCache, get_cached_products, get_cached_product_detail
    
    if redis_client:
        _cache_instance = QueryCache(redis_client)
        logger = logging.getLogger(__name__)
        logger.info("Product service cache initialized successfully")
    else:
        _cache_import_error = "Redis client not available"
        logger = logging.getLogger(__name__)
        logger.warning("Product service cache disabled: Redis client not initialized")
except ImportError as e:
    _cache_import_error = str(e)
    logger = logging.getLogger(__name__)
    logger.warning(f"Product service cache disabled: Import error - {e}")

# Helper functions for cache access
def is_cache_available() -> bool:
    """Check if caching is available and functional.
    
    Returns:
        True if cache is available, False otherwise.
    """
    return _cache_instance is not None


def get_cache() -> Optional["QueryCache"]:
    """Get the cache instance with logging if unavailable.
    
    Returns:
        Cache instance if available, None otherwise.
    """
    if _cache_instance is None:
        logger.debug(f"Cache access attempted but unavailable: {_cache_import_error or 'Not initialized'}")
    return _cache_instance


logger = logging.getLogger(__name__)


def _generate_product_embedding(product: Product, db: Session) -> None:
    """Generate and store pgvector embedding for a product.
    
    This function generates an AI embedding for product search functionality.
    It fails silently if the API key is not configured or if generation fails.
    
    Args:
        product: The Product instance to generate embedding for.
        db: SQLAlchemy database session.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        logger.debug(f"Skipping embedding generation for product #{product.id}: API key not configured")
        return
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        # Get category name if available
        cat_name = ""
        if product.category_id:
            cat_row = db.execute(
                text("SELECT name FROM collections WHERE id = :cid"),
                {"cid": product.category_id}
            ).fetchone()
            cat_name = cat_row[0] if cat_row else ""
        
        # Build embedding text
        parts = [f"Product: {product.name}"]
        if cat_name:
            parts.append(f"Category: {cat_name}")
        if product.description:
            parts.append(f"Description: {(product.description or '')[:400]}")
        embed_text = " | ".join(parts)
        
        # Generate embedding
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=embed_text,
            task_type="retrieval_document",
        )
        vec = result["embedding"]
        vec_str = "[" + ",".join(f"{v:.8f}" for v in vec) + "]"
        
        # Store embedding
        db.execute(
            text("UPDATE products SET embedding = :vec::vector WHERE id = :pid"),
            {"vec": vec_str, "pid": product.id}
        )
        db.commit()
        logger.info(f"Generated embedding for product #{product.id}")
        
    except ImportError:
        logger.warning(f"Could not generate embedding for product #{product.id}: google.generativeai not installed")
    except Exception as e:
        logger.warning(f"Could not generate embedding for product #{product.id}: {type(e).__name__} - {e}")


class ProductService:
    """Service for product management operations.
    
    This service provides methods for CRUD operations on products,
    as well as search, filtering, and caching functionality.
    
    Attributes:
        db: SQLAlchemy database session.
    """

    def __init__(self, db: Session):
        """Initialize product service.
        
        Args:
            db: SQLAlchemy database session.
            
        Raises:
            ValueError: If db session is None.
        """
        if db is None:
            raise ValueError("Database session cannot be None")
        self.db = db

    def get_products(
        self,
        skip: int = 0,
        limit: int = 100,
        category_id: Optional[int] = None,
        new_arrivals: bool = False,
        featured: bool = False,
        active_only: bool = True,
        min_price: Optional[Decimal] = None,
        max_price: Optional[Decimal] = None
    ) -> List[Product]:
        """Get products with filtering options.
        
        Uses eager loading to prevent N+1 queries. When cache is available
        and no price filters are applied, results may be cached.
        
        Args:
            skip: Number of records to skip for pagination.
            limit: Maximum number of records to return.
            category_id: Optional category ID to filter by.
            new_arrivals: If True, filter to new arrivals only.
            featured: If True, filter to featured products only.
            active_only: If True, filter to active products only (default: True).
            min_price: Optional minimum price filter.
            max_price: Optional maximum price filter.
            
        Returns:
            List of Product objects matching the filters.
        """
        # Use cache for common queries without price filters
        if is_cache_available() and min_price is None and max_price is None:
            cached_result = get_cached_products(
                self.db, get_cache(), skip=skip, limit=limit,
                category_id=category_id, featured=featured,
                new_arrivals=new_arrivals
            )
            if cached_result:
                logger.debug(f"Cache available for products query with skip={skip}, limit={limit}")

        query = self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        )

        if active_only:
            query = query.filter(Product.is_active == True)

        if category_id:
            query = query.filter(Product.category_id == category_id)

        if new_arrivals:
            query = query.filter(Product.is_new_arrival == True)

        if featured:
            query = query.filter(Product.is_featured == True)

        if min_price is not None:
            query = query.filter(Product.base_price >= min_price)

        if max_price is not None:
            query = query.filter(Product.base_price <= max_price)

        return query.offset(skip).limit(limit).all()
    
    def get_product_by_id(self, product_id: int, active_only: bool = True) -> Optional[Product]:
        """Get product by ID with eager loading.
        
        Args:
            product_id: The product ID to retrieve.
            active_only: If True, only return active products (default: True).
            
        Returns:
            Product object if found, None otherwise.
        """
        if is_cache_available():
            cached_result = get_cached_product_detail(self.db, get_cache(), product_id=product_id)
            if cached_result:
                logger.debug(f"Cache hit for product {product_id}")

        query = self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        ).filter(Product.id == product_id)

        if active_only:
            query = query.filter(Product.is_active == True)

        return query.first()

    def get_product_by_slug(self, slug: str, active_only: bool = True) -> Optional[Product]:
        """Get product by slug.
        
        Args:
            slug: The product slug to retrieve.
            active_only: If True, only return active products (default: True).
            
        Returns:
            Product object if found, None otherwise.
        """
        query = self.db.query(Product).filter(Product.slug == slug)

        if active_only:
            query = query.filter(Product.is_active == True)

        return query.first()
    
    def create_product(self, product_data: ProductCreate) -> Product:
        """Create a new product.
        
        Args:
            product_data: Product creation schema with validation.
            
        Returns:
            Created Product object.
            
        Raises:
            HTTPException: If category not found (404) or slug already exists (400).
            SQLAlchemyError: If database operation fails.
        """
        # Validate category exists if provided
        if product_data.category_id:
            category = self.db.query(Category).filter(
                Category.id == product_data.category_id
            ).first()
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Category not found"
                )

        # Check slug uniqueness if provided
        if product_data.slug:
            existing = self.db.query(Product).filter(
                Product.slug == product_data.slug
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product with slug '{product_data.slug}' already exists"
                )

        data = product_data.model_dump()
        initial_stock = data.pop('initial_stock', 0)

        # Map price to base_price to match the DB schema
        data['base_price'] = data.pop('price', 0.0)

        # collection_id is a Python property alias — resolve to category_id
        if data.get('collection_id') and not data.get('category_id'):
            data['category_id'] = data['collection_id']
        data.pop('collection_id', None)

        # Only pass fields that exist as real columns
        valid_fields = {c.key for c in Product.__table__.columns}
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}

        try:
            product = Product(**filtered_data)
            self.db.add(product)
            self.db.commit()
            self.db.refresh(product)
            logger.info(f"Created product #{product.id} with slug '{product.slug}'")

        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error creating product: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Database integrity error: {str(e)}"
            )
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error creating product: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )

        # Create initial inventory record
        try:
            from models.inventory import Inventory
            base_sku = product_data.sku if hasattr(product_data, 'sku') and product_data.sku else f"PRD-{product.id}-BASE"
            inventory = Inventory(
                product_id=product.id,
                sku=base_sku,
                size="Standard",
                color="Standard",
                quantity=initial_stock or 0
            )
            self.db.add(inventory)
            self.db.commit()
            logger.debug(f"Created inventory record for product #{product.id}")

        except IntegrityError as e:
            logger.error(f"Database integrity error creating inventory for product #{product.id}: {e}")
            # Don't fail the whole operation, inventory can be created later
        except SQLAlchemyError as e:
            logger.error(f"Database error creating inventory for product #{product.id}: {e}")

        # Generate embedding asynchronously (non-blocking)
        _generate_product_embedding(product, self.db)

        return product

    def update_product(self, product_id: int, product_data: ProductUpdate) -> Product:
        """Update a product.
        
        Args:
            product_id: The ID of the product to update.
            product_data: Product update schema with validation.
            
        Returns:
            Updated Product object.
            
        Raises:
            HTTPException: If product not found (404), category not found (404), 
                          or slug already exists (400).
            SQLAlchemyError: If database operation fails.
        """
        product = self.db.query(Product).filter(Product.id == product_id).first()

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        # Validate category if being updated
        if product_data.category_id is not None:
            category = self.db.query(Category).filter(
                Category.id == product_data.category_id
            ).first()
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Category not found"
                )

        # Check slug uniqueness if being updated
        if product_data.slug and product_data.slug != product.slug:
            existing = self.db.query(Product).filter(
                Product.slug == product_data.slug
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product with slug '{product_data.slug}' already exists"
                )

        update_data = product_data.model_dump(exclude_unset=True)
        # Resolve collection_id → category_id
        if 'collection_id' in update_data:
            if not update_data.get('category_id'):
                update_data['category_id'] = update_data['collection_id']
            del update_data['collection_id']
        
        valid_fields = {c.key for c in Product.__table__.columns}
        
        try:
            for field, value in update_data.items():
                if field in valid_fields:
                    setattr(product, field, value)
            self.db.commit()
            self.db.refresh(product)
            logger.info(f"Updated product #{product_id}")

        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error updating product #{product_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Database integrity error: {str(e)}"
            )
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error updating product #{product_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )

        # Regenerate embedding if relevant fields changed
        update_keys = set(update_data.keys())
        if update_keys.intersection({"name", "description", "category_id", "tags"}):
            _generate_product_embedding(product, self.db)

        return product

    def delete_product(self, product_id: int) -> bool:
        """Delete a product (soft delete by setting is_active=False).
        
        Args:
            product_id: The ID of the product to delete.
            
        Returns:
            True if deletion was successful.
            
        Raises:
            HTTPException: If product not found (404).
            SQLAlchemyError: If database operation fails.
        """
        product = self.db.query(Product).filter(Product.id == product_id).first()

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        try:
            # Soft delete
            product.is_active = False
            self.db.commit()
            logger.info(f"Soft deleted product #{product_id}")
            return True

        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error deleting product #{product_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
    
    def search_products(
        self,
        query: str,
        skip: int = 0,
        limit: int = 50,
        category_id: Optional[int] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
    ) -> List[Product]:
        """Search products by name or description with optional filters.
        
        This is used as a fallback when Meilisearch is unavailable.
        
        Args:
            query: Search query string.
            skip: Number of records to skip for pagination.
            limit: Maximum number of records to return.
            category_id: Optional category ID to filter by.
            min_price: Optional minimum price filter.
            max_price: Optional maximum price filter.
            
        Returns:
            List of Product objects matching the search query.
        """
        search_pattern = f"%{query}%"

        filters = [
            Product.is_active == True,
            or_(
                Product.name.ilike(search_pattern),
                Product.description.ilike(search_pattern),
                Product.short_description.ilike(search_pattern)
            )
        ]
        if category_id:
            filters.append(Product.category_id == category_id)
        if min_price is not None:
            filters.append(Product.base_price >= min_price)
        if max_price is not None:
            filters.append(Product.base_price <= max_price)

        products = self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        ).filter(and_(*filters)).offset(skip).limit(limit).all()

        return products

    def get_featured_products(self, limit: int = 10) -> List[Product]:
        """Get featured products with eager loading.
        
        Args:
            limit: Maximum number of featured products to return.
            
        Returns:
            List of featured Product objects.
        """
        return self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        ).filter(
            Product.is_featured == True,
            Product.is_active == True
        ).limit(limit).all()

    def get_new_arrivals(self, limit: int = 20) -> List[Product]:
        """Get new arrival products with eager loading.
        
        Args:
            limit: Maximum number of new arrival products to return.
            
        Returns:
            List of new arrival Product objects, ordered by creation date descending.
        """
        return self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        ).filter(
            Product.is_new_arrival == True,
            Product.is_active == True
        ).order_by(Product.created_at.desc()).limit(limit).all()

    def get_products_by_category(
        self,
        category_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[Product]:
        """Get all products in a category with eager loading.
        
        Args:
            category_id: The category ID to filter by.
            skip: Number of records to skip for pagination.
            limit: Maximum number of records to return.
            
        Returns:
            List of active Product objects in the specified category.
        """
        return self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        ).filter(
            Product.category_id == category_id,
            Product.is_active == True
        ).offset(skip).limit(limit).all()

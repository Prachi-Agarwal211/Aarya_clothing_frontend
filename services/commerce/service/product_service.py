"""Product service for managing product operations."""
import os
import logging
from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import text, and_, or_
from fastapi import HTTPException, status
from decimal import Decimal

from models.product import Product
from models.category import Category
from schemas.product import ProductCreate, ProductUpdate

logger = logging.getLogger(__name__)


def _generate_product_embedding(product: Product, db: Session) -> None:
    """Generate and store pgvector embedding for a product. Fails silently."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        return
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        cat_name = ""
        if product.category_id:
            cat_row = db.execute(
                text("SELECT name FROM collections WHERE id = :cid"),
                {"cid": product.category_id}
            ).fetchone()
            cat_name = cat_row[0] if cat_row else ""
        parts = [f"Product: {product.name}"]
        if cat_name:
            parts.append(f"Category: {cat_name}")
        if product.description:
            parts.append(f"Description: {(product.description or '')[:400]}")
        embed_text = " | ".join(parts)
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=embed_text,
            task_type="retrieval_document",
        )
        vec = result["embedding"]
        vec_str = "[" + ",".join(f"{v:.8f}" for v in vec) + "]"
        db.execute(
            text("UPDATE products SET embedding = :vec::vector WHERE id = :pid"),
            {"vec": vec_str, "pid": product.id}
        )
        db.commit()
    except Exception as e:
        logger.warning(f"Could not generate embedding for product #{product.id}: {e}")


class ProductService:
    """Service for product management operations."""
    
    def __init__(self, db: Session):
        """Initialize product service."""
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
        """Get products with filtering options. Uses eager loading to prevent N+1 queries."""
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
        """Get product by ID with eager loading."""
        query = self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        ).filter(Product.id == product_id)

        if active_only:
            query = query.filter(Product.is_active == True)

        return query.first()
    
    def get_product_by_slug(self, slug: str, active_only: bool = True) -> Optional[Product]:
        """Get product by slug."""
        query = self.db.query(Product).filter(Product.slug == slug)
        
        if active_only:
            query = query.filter(Product.is_active == True)
        
        return query.first()
    
    def create_product(self, product_data: ProductCreate) -> Product:
        """Create a new product."""
        # Validate category exists if provided
        if product_data.category_id:
            category = self.db.query(Category).filter(
                Category.id ==product_data.category_id
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
        
        # map price to base_price to match the DB schema
        data['base_price'] = data.pop('price', 0.0)
            
        # collection_id is a Python property alias — resolve to category_id
        if data.get('collection_id') and not data.get('category_id'):
            data['category_id'] = data['collection_id']
        data.pop('collection_id', None)
        
        # Only pass fields that exist as real columns
        valid_fields = {c.key for c in Product.__table__.columns}
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}
        
        product = Product(**filtered_data)
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        
        # Create initial inventory record if initial_stock is provided or we need a base record
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

        _generate_product_embedding(product, self.db)

        return product

    def update_product(self, product_id: int, product_data: ProductUpdate) -> Product:
        """Update a product."""
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
        for field, value in update_data.items():
            if field in valid_fields:
                setattr(product, field, value)
        self.db.commit()
        self.db.refresh(product)

        update_keys = set(update_data.keys())
        if update_keys.intersection({"name", "description", "category_id", "tags"}):
            _generate_product_embedding(product, self.db)

        return product

    def delete_product(self, product_id: int) -> bool:
        """Delete a product (soft delete by setting is_active=False)."""
        product = self.db.query(Product).filter(Product.id == product_id).first()
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        
        # Soft delete
        product.is_active = False
        self.db.commit()
        
        return True
    
    def search_products(
        self,
        query: str,
        skip: int = 0,
        limit: int = 50,
        category_id: int = None,
        min_price: float = None,
        max_price: float = None,
    ) -> List[Product]:
        """
        Search products by name or description with optional filters.
        Used as fallback when Meilisearch is unavailable.
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
        """Get featured products with eager loading."""
        return self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        ).filter(
            Product.is_featured == True,
            Product.is_active == True
        ).limit(limit).all()

    def get_new_arrivals(self, limit: int = 20) -> List[Product]:
        """Get new arrival products with eager loading."""
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
        """Get all products in a category with eager loading."""
        return self.db.query(Product).options(
            selectinload(Product.images),
            selectinload(Product.inventory),
            joinedload(Product.category),
        ).filter(
            Product.category_id == category_id,
            Product.is_active == True
        ).offset(skip).limit(limit).all()

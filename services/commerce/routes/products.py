"""
Commerce Service - Products Routes

Product catalog management endpoints:
- Product listing and search
- Product detail views
- Product CRUD (admin)
- Bulk operations
- Image management
"""

import logging
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from database.database import get_db
from models.product import Product
from models.category import Category
from models.inventory import Inventory
from models.product_image import ProductImage
from schemas.product import (
    ProductCreate, ProductResponse, ProductUpdate, ProductDetailResponse,
    BulkPriceUpdate, BulkStatusUpdate, BulkCollectionAssign, BulkInventoryUpdate, BulkDeleteProducts
)
from schemas.error import ErrorResponse, PaginatedResponse
from service.product_service import ProductService
from service.r2_service import r2_service
from search.meilisearch_client import (
    search_products as meili_search_products,
    index_product as meili_index_product,
    delete_product as meili_delete_product,
)
from shared.auth_middleware import get_current_user, require_admin, require_staff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/products", tags=["Products"])


# ==================== Helper Functions ====================

def _enrich_product(product, db: Session) -> dict:
    """Convert Product ORM to dict with enriched data."""
    primary_image = product.primary_image
    images = [
        {
            "id": img.id,
            "image_url": img.image_url,
            "alt_text": img.alt_text,
            "is_primary": img.is_primary,
            "display_order": img.display_order
        }
        for img in (product.images or [])
    ]
    
    inventory = [
        {
            "id": inv.id,
            "sku": inv.sku,
            "size": inv.size,
            "color": inv.color,
            "quantity": inv.quantity,
            "reserved_quantity": inv.reserved_quantity,
            "available_quantity": inv.available_quantity,
            "low_stock_threshold": inv.low_stock_threshold,
            "is_low_stock": inv.is_low_stock,
            "is_out_of_stock": inv.is_out_of_stock,
            "updated_at": inv.updated_at
        }
        for inv in (product.inventory or [])
    ]
    
    sizes = sorted(list(set(
        inv.size for inv in (product.inventory or []) if inv.size
    )))
    colors = sorted(list(set(
        inv.color for inv in (product.inventory or []) if inv.color
    )))
    
    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "short_description": product.short_description,
        "price": float(product.base_price),
        "mrp": float(product.mrp) if product.mrp else None,
        "category_id": product.category_id,
        "category_name": product.category.name if product.category else None,
        "brand": product.brand,
        "primary_image": primary_image.image_url if primary_image else None,
        "images": images,
        "inventory": inventory,
        "sizes": sizes,
        "colors": [{"name": c, "hex": "#888888"} for c in colors],
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_new_arrival": product.is_new_arrival,
        "total_stock": product.total_stock or 0,
        "average_rating": float(product.average_rating) if product.average_rating else 0,
        "review_count": product.review_count or 0,
        "hsn_code": product.hsn_code,
        "gst_rate": float(product.gst_rate) if product.gst_rate else None,
        "is_taxable": product.is_taxable,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


# ==================== Public Product Endpoints ====================

@router.get("", response_model=PaginatedResponse)
async def list_products(
    request: Request,
    category_id: Optional[int] = None,
    collection: Optional[str] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    sizes: Optional[str] = None,
    colors: Optional[str] = None,
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List products with filtering, sorting, and pagination.
    
    - **category_id**: Filter by category/collection ID
    - **collection**: Filter by collection slug
    - **min_price/max_price**: Price range filter
    - **sizes**: Comma-separated size filter (e.g., "S,M,L")
    - **colors**: Comma-separated color filter
    - **sort**: Sort field (created_at, price, name, rating)
    - **order**: Sort order (asc, desc)
    - **page**: Page number (1-indexed)
    - **limit**: Items per page (max 100)
    - **search**: Full-text search query (uses Meilisearch)
    """
    # Use Meilisearch for search queries
    if search:
        try:
            results = await meili_search_products(search, {
                "filter": [
                    f"category_id = {category_id}" if category_id else None,
                    f"is_active = true",
                ],
                "sort": [f"{sort}:{order}"],
                "page": page,
                "hitsPerPage": limit
            })
            return {
                "items": results.get("hits", []),
                "total": results.get("totalHits", 0),
                "page": page,
                "limit": limit,
                "pages": results.get("totalPages", 0)
            }
        except Exception as e:
            logger.error(f"Meilisearch error: {e}")
            # Fallback to database search
            search = None
    
    # Database query
    query = db.query(Product).filter(Product.is_active == True)
    
    if category_id:
        query = query.filter(Product.category_id == category_id)
    
    if min_price:
        query = query.filter(Product.base_price >= min_price)
    if max_price:
        query = query.filter(Product.base_price <= max_price)
    
    # Sorting
    sort_field = getattr(Product, sort, Product.created_at)
    if order == "desc":
        query = query.order_by(desc(sort_field))
    else:
        query = query.order_by(sort_field.asc())
    
    # Pagination
    total = query.count()
    offset = (page - 1) * limit
    products = query.offset(offset).limit(limit).all()
    
    # Enrich products
    items = [_enrich_product(p, db) for p in products]

    # Calculate pagination metadata to match PaginatedResponse schema
    skip = offset
    has_more = offset + limit < total

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": has_more
    }


@router.get("/{product_id}", response_model=ProductDetailResponse)
async def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    """Get product details by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return _enrich_product(product, db)


@router.get("/slug/{slug}", response_model=ProductDetailResponse)
async def get_product_by_slug(
    slug: str,
    db: Session = Depends(get_db)
):
    """Get product details by slug."""
    product = db.query(Product).filter(Product.slug == slug).first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return _enrich_product(product, db)


# ==================== Admin Product Management ====================

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Create a new product (admin/staff only)."""
    try:
        product_service = ProductService(db)
        product = product_service.create_product(product_data)
        
        # Index in Meilisearch
        try:
            await meili_index_product(_enrich_product(product, db))
        except Exception as e:
            logger.warning(f"Failed to index product in Meilisearch: {e}")
        
        return _enrich_product(product, db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Update product (admin/staff only)."""
    product_service = ProductService(db)
    
    try:
        product = product_service.update_product(product_id, product_data)
        
        # Update Meilisearch index
        try:
            await meili_index_product(_enrich_product(product, db))
        except Exception as e:
            logger.warning(f"Failed to update product in Meilisearch: {e}")
        
        return _enrich_product(product, db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete product (admin only)."""
    product_service = ProductService(db)
    
    try:
        product_service.delete_product(product_id)
        
        # Remove from Meilisearch
        try:
            await meili_delete_product(product_id)
        except Exception as e:
            logger.warning(f"Failed to delete product from Meilisearch: {e}")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# ==================== Bulk Operations ====================

@router.post("/bulk/update-status", status_code=status.HTTP_200_OK)
async def bulk_update_status(
    bulk_data: BulkStatusUpdate,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Bulk update product status (admin/staff only)."""
    product_service = ProductService(db)
    updated = product_service.bulk_update_status(
        product_ids=bulk_data.product_ids,
        is_active=bulk_data.is_active
    )
    return {"message": f"Updated {updated} products", "updated_count": updated}


@router.post("/bulk/update-prices", status_code=status.HTTP_200_OK)
async def bulk_update_prices(
    bulk_data: BulkPriceUpdate,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Bulk update product prices (admin/staff only)."""
    product_service = ProductService(db)
    updated = product_service.bulk_update_prices(
        product_ids=bulk_data.product_ids,
        price_adjustment=bulk_data.price_adjustment,
        adjustment_type=bulk_data.adjustment_type
    )
    return {"message": f"Updated {updated} products", "updated_count": updated}


@router.post("/bulk/assign-collection", status_code=status.HTTP_200_OK)
async def bulk_assign_collection(
    bulk_data: BulkCollectionAssign,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Bulk assign products to collection (admin/staff only)."""
    product_service = ProductService(db)
    updated = product_service.bulk_assign_to_collection(
        product_ids=bulk_data.product_ids,
        collection_id=bulk_data.collection_id
    )
    return {"message": f"Assigned {updated} products", "updated_count": updated}


@router.post("/bulk/delete", status_code=status.HTTP_200_OK)
async def bulk_delete_products(
    bulk_data: BulkDeleteProducts,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Bulk delete products (admin only)."""
    product_service = ProductService(db)
    deleted = product_service.bulk_delete_products(bulk_data.product_ids)
    return {"message": f"Deleted {deleted} products", "deleted_count": deleted}


# ==================== Image Management ====================

@router.post("/{product_id}/images", status_code=status.HTTP_201_CREATED)
async def upload_product_image(
    product_id: int,
    image: UploadFile = File(...),
    alt_text: Optional[str] = None,
    is_primary: bool = False,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Upload product image to Cloudflare R2 (admin/staff only)."""
    # Verify product exists
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Upload to R2
    try:
        image_path = await r2_service.upload_product_image(
            product_id=product_id,
            file=image,
            image_type="product"
        )
        
        # Create product image record
        product_image = ProductImage(
            product_id=product_id,
            image_url=image_path,
            alt_text=alt_text,
            is_primary=is_primary
        )
        db.add(product_image)
        
        # If primary, unset other primary images
        if is_primary:
            db.query(ProductImage).filter(
                ProductImage.product_id == product_id,
                ProductImage.id != product_image.id
            ).update({"is_primary": False})
        
        db.commit()
        db.refresh(product_image)
        
        return {
            "id": product_image.id,
            "image_url": image_path,
            "alt_text": alt_text,
            "is_primary": is_primary
        }
    except Exception as e:
        logger.error(f"Image upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload failed"
        )


@router.delete("/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_image(
    product_id: int,
    image_id: int,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Delete product image (admin/staff only)."""
    image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    ).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    
    # Delete from R2
    try:
        await r2_service.delete_image(image.image_url)
    except Exception as e:
        logger.warning(f"Failed to delete image from R2: {e}")
    
    # Delete from database
    db.delete(image)
    db.commit()

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
import hashlib
import asyncio
import re
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc, func

from database.database import get_db
from models.product import Product
from models.collection import Collection
from models.inventory import Inventory
from models.product_image import ProductImage
from schemas.product import (
    ProductCreate, ProductResponse, ProductUpdate, ProductDetailResponse,
    BulkPriceUpdate, BulkStatusUpdate, BulkCollectionAssign, BulkInventoryUpdate, BulkDeleteProducts
)
from schemas.error import ErrorResponse, PaginatedResponse
from service.product_service import ProductService
from service.r2_service import r2_service
from core.advanced_cache import cache
from search.meilisearch_client import (
    search_products as meili_search_products,
    index_product as meili_index_product,
    delete_product as meili_delete_product,
)
from shared.auth_middleware import get_current_user, get_current_user_optional, require_admin, require_staff
from shared.roles import is_staff, is_admin
from shared.color_utils import get_nearest_color_name

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/products", tags=["Products"])


# ==================== Helper Functions ====================

def _r2_url(path: str) -> str:
    """Convert R2 relative path to full R2 CDN URL."""
    if not path:
        return ""
    from core.config import get_settings
    settings = get_settings()
    r2_base = settings.R2_PUBLIC_URL.rstrip('/')
    return f"{r2_base}/{path.lstrip('/')}"


def _is_hex_color(value: str) -> bool:
    """Check if a string is a hex color code."""
    if not value:
        return False
    return bool(re.match(r'^#[0-9a-fA-F]{6}$', value.strip()))


def _hex_to_color_name(hex_color: str) -> str:
    """Convert hex color to human-readable name using nearest match."""
    if not hex_color:
        return None
    return get_nearest_color_name(hex_color.strip())


def _resolve_variant_hex(inv) -> str:
    """Return the best hex for a variant (stored hex first, then safe fallback)."""
    explicit = (getattr(inv, "color_hex", None) or "").strip()
    if re.match(r"^#[0-9a-fA-F]{6}$", explicit):
        return explicit.upper()

    # Model-level fallback keeps unknown names deterministic (not all gray).
    derived = getattr(inv, "resolved_color_hex", None)
    if isinstance(derived, str) and re.match(r"^#[0-9A-F]{6}$", derived):
        return derived
    return "#9CA3AF"


def _resolve_display_color_name(color_value: Optional[str], color_hex: Optional[str]) -> Optional[str]:
    """
    Return customer-friendly color labels.

    Priority:
    1) Explicit non-hex color value from DB (e.g. "Wine" or "Deep Blue")
    2) Nearest neighbor match from color_hex
    3) Nearest neighbor match from color_value (if it's a hex)
    4) Safe fallback (never hits 'Custom' if possible)
    """
    if color_value:
        value = color_value.strip()
        # If it's a real name (not hex), return it exactly as is (e.g. "Jaipur Ruby")
        if value and not _is_hex_color(value):
            return value

    # Try resolving from the dedicated hex column
    if color_hex:
        name = _hex_to_color_name(color_hex)
        if name:
            return name

    # Try resolving if the color name field itself contains a hex
    if color_value and _is_hex_color(color_value):
        name = _hex_to_color_name(color_value)
        if name:
            return name

    return "Default"


def _enrich_images(images) -> list:
    """Convert product image ORM list to enriched dicts with full R2 URLs."""
    return [
        {
            "id": img.id,
            "product_id": img.product_id,
            "image_url": _r2_url(img.image_url),
            "alt_text": getattr(img, "alt_text", None),
            "display_order": getattr(img, "display_order", 0) or 0,
            "is_primary": getattr(img, "is_primary", False),
            "created_at": img.created_at,
        }
        for img in (images or [])
    ]


def _enrich_inventory(inventory, user_role: str = None) -> list:
    """
    Convert inventory ORM list to enriched dicts.

    Role-based filtering:
    - Admin/Staff: See full inventory data (quantities, thresholds, etc.)
    - Customers/Unauthenticated: See only size, color, color_name, and in_stock boolean
    """
    is_admin_user = is_staff(user_role) if user_role else False

    if is_admin_user:
        return [
            {
                "id": inv.id,
                "product_id": inv.product_id,
                "sku": inv.sku,
                "size": inv.size,
                "color": inv.color,
                "color_hex": _resolve_variant_hex(inv),
                "color_name": _resolve_display_color_name(
                    inv.color, getattr(inv, "color_hex", None)
                ),
                "image_url": _r2_url(getattr(inv, "image_url", "") or ""),
                "quantity": inv.quantity,
                "reserved_quantity": inv.reserved_quantity,
                "available_quantity": inv.available_quantity,
                "low_stock_threshold": inv.low_stock_threshold,
                "is_low_stock": inv.is_low_stock,
                "is_out_of_stock": inv.is_out_of_stock,
                "is_active": getattr(inv, "is_active", True),
                "created_at": inv.created_at,
                "updated_at": inv.updated_at,
            }
            for inv in (inventory or [])
        ]
    return [
        {
            "id": inv.id,
            "sku": inv.sku,
            "size": inv.size,
            "color": inv.color,
            "color_hex": _resolve_variant_hex(inv),
            "color_name": _resolve_display_color_name(
                inv.color, getattr(inv, "color_hex", None)
            ),
            "image_url": _r2_url(getattr(inv, "image_url", "") or ""),
            "available_quantity": inv.available_quantity,
            "in_stock": not inv.is_out_of_stock,
        }
        for inv in (inventory or [])
        if getattr(inv, "is_active", True)
    ]


def _enrich_product(product, db: Session = None, user_role: str = None) -> dict:
    """
    Convert Product ORM to dict with enriched data (R2 URLs, variants, collection info).
    
    Role-based filtering:
    - Admin/Staff: See full inventory data
    - Customers/Unauthenticated: See only in_stock boolean, no quantities
    """
    primary_image = product.primary_image
    inventory_list = list(product.inventory or [])

    # Logical size ordering (not alphabetical) — matches Indian apparel sizing
    SIZE_ORDER = {'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, 'XXXL': 6, '3XL': 6, '4XL': 7, 'Free Size': 99}
    sizes = sorted(
        {inv.size for inv in inventory_list if inv.size},
        key=lambda s: SIZE_ORDER.get(s.upper(), 50)
    )
    is_admin_user = is_staff(user_role) if user_role else False

    # Group colors case-insensitively so "Black" and "black" merge into one swatch
    color_groups = {}  # normalized_key -> {"original": str, "hex": str, "display_name": str, "image_url": str|None}
    for inv in inventory_list:
        if not inv.color:
            continue
        key = inv.color.strip().lower()
        if key in color_groups:
            # Prefer the variant that has an image
            if getattr(inv, "image_url", None) and not color_groups[key].get("image_url"):
                color_groups[key]["image_url"] = _r2_url(inv.image_url)
            continue
        color_groups[key] = {
            "original": inv.color.strip(),
            "hex": _resolve_variant_hex(inv),
            "display_name": _resolve_display_color_name(inv.color, _resolve_variant_hex(inv)),
            "image_url": _r2_url(inv.image_url) if getattr(inv, "image_url", None) else None,
        }

    colors = [
        {
            "name": grp["original"],
            "hex": grp["hex"],
            "display_name": grp["display_name"] or grp["original"],
            "image_url": grp.get("image_url"),
        }
        for grp in sorted(color_groups.values(), key=lambda g: g["original"].lower())
    ]

    # Compute actual in_stock from inventory items (not from total_stock which may be null)
    actual_in_stock = any(not inv.is_out_of_stock for inv in inventory_list)

    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "short_description": product.short_description,
        "sku": getattr(product, 'sku', None),
        "price": float(product.base_price),
        "mrp": float(product.mrp) if product.mrp else None,
        "category_id": product.category_id,
        "collection_id": product.category_id,
        "category_name": product.collection.name if product.collection else None,
        "category": product.collection.name if product.collection else None,
        "collection_name": product.collection.name if product.collection else None,
        "collection_slug": product.collection.slug if product.collection else None,
        "brand": product.brand,
        "image_url": _r2_url(primary_image) if primary_image else None,
        "primary_image": _r2_url(primary_image) if primary_image else None,
        "images": _enrich_images(product.images),
        "inventory": _enrich_inventory(inventory_list, user_role),
        "variants": _enrich_inventory(inventory_list, user_role),
        "sizes": sizes,
        "colors": colors,
        "color_images": {c["name"]: c.get("image_url") for c in colors if c.get("image_url")},
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_new_arrival": product.is_new_arrival,
        "is_new": product.is_new_arrival,
        # Stock visibility: admin sees quantities, customers see actual stock boolean + qty
        "total_stock": product.total_stock or 0 if is_admin_user else (product.total_stock or 0),
        "stock_quantity": product.total_stock or 0 if is_admin_user else (product.total_stock or 0),
        "in_stock": actual_in_stock,  # Computed from actual inventory, not total_stock field
        "is_on_sale": product.is_on_sale,
        "discount_percentage": product.discount_percentage,
        "average_rating": float(product.average_rating) if product.average_rating else 0,
        "rating": float(product.average_rating) if product.average_rating else 0,
        "review_count": product.review_count or 0,
        "reviews_count": product.review_count or 0,
        "hsn_code": product.hsn_code,
        "gst_rate": float(product.gst_rate) if product.gst_rate else None,
        "is_taxable": product.is_taxable,
        "meta_title": product.meta_title,
        "meta_description": product.meta_description,
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
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
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
    user_role = current_user.get("role") if current_user else None

    # Use Meilisearch for search queries (never cached — search is dynamic)
    if search:
        try:
            results = meili_search_products(
                query=search,
                category_id=category_id,
                min_price=float(min_price) if min_price else None,
                max_price=float(max_price) if max_price else None,
                offset=(page - 1) * limit,
                limit=limit,
            )
            if results.get("hits") is not None and not results.get("error"):
                hits = results.get("hits", [])
                if not (current_user and is_staff(user_role)):
                    hits = [
                        {**h, "total_stock": None, "stock_quantity": None}
                        for h in hits
                    ]
                return {
                    "items": hits,
                    "total": results.get("total", 0),
                    "skip": (page - 1) * limit,
                    "limit": limit,
                    "has_more": results.get("total", 0) > page * limit,
                }
        except Exception as e:
            logger.error(f"Meilisearch error: {e}")
        db_search = search
    else:
        db_search = None

    # Build cache key — CRITICAL: include user_role to prevent admin inventory data leaking to customers
    cache_params = f"role={user_role or 'public'}:cat={category_id}:col={collection}:min={min_price}:max={max_price}:sizes={sizes}:colors={colors}:sort={sort}:order={order}:page={page}:limit={limit}"
    cache_key_hash = hashlib.md5(cache_params.encode()).hexdigest()[:12]
    cache_key = f"products:list:{cache_key_hash}"

    def _fetch_products():
        """Execute the database query for product listing.

        Must be a sync function because it is called from
        cache.get_or_set_sync() which runs inside asyncio.to_thread().
        Using async def here would return a coroutine object instead of
        the actual result, causing FastAPI ResponseValidationError.
        """
        query = db.query(Product).options(
            joinedload(Product.collection),
            selectinload(Product.images),
            selectinload(Product.variants),
        ).filter(Product.is_active == True)

        if category_id:
            query = query.filter(Product.category_id == category_id)
        elif collection:
            col = db.query(Collection).filter(Collection.slug == collection).first()
            if col:
                query = query.filter(Product.category_id == col.id)

        if min_price:
            query = query.filter(Product.base_price >= min_price)
        if max_price:
            query = query.filter(Product.base_price <= max_price)

        if sizes:
            size_list = [s.strip() for s in sizes.split(',') if s.strip()]
            if size_list:
                # Use subquery to avoid passing Query directly to in_()
                size_subq = db.query(Inventory.product_id).filter(Inventory.size.in_(size_list)).subquery()
                query = query.filter(Product.id.in_(size_subq))

        if colors:
            color_list = [c.strip() for c in colors.split(',') if c.strip()]
            if color_list:
                # Use subquery to avoid passing Query directly to in_()
                color_subq = db.query(Inventory.product_id).filter(Inventory.color.in_(color_list)).subquery()
                query = query.filter(Product.id.in_(color_subq))

        if db_search:
            query = query.filter(
                Product.name.ilike(f"%{db_search}%") |
                Product.description.ilike(f"%{db_search}%") |
                Product.short_description.ilike(f"%{db_search}%")
            )

        SORT_MAP = {
            "price": "base_price",
            "rating": "average_rating",
            "newest": "created_at",
            "name": "name",
            "created_at": "created_at",
            "base_price": "base_price",
            "average_rating": "average_rating",
        }
        sort_col_name = SORT_MAP.get(sort, "created_at")
        sort_col = getattr(Product, sort_col_name, Product.created_at)
        if order == "desc":
            query = query.order_by(desc(sort_col))
        else:
            query = query.order_by(sort_col.asc())

        total = query.count()
        offset = (page - 1) * limit
        products = query.offset(offset).limit(limit).all()
        items = [_enrich_product(p, db, user_role) for p in products]

        return {
            "items": items,
            "total": total,
            "skip": offset,
            "limit": limit,
            "has_more": offset + limit < total
        }

    # Use L1+L2 cache for non-search queries (run sync Redis in thread pool to avoid blocking event loop)
    if not db_search:
        try:
            cached_result = await asyncio.to_thread(
                cache.get_or_set_sync, cache_key, _fetch_products, ttl=120
            )
            return cached_result
        except Exception as e:
            logger.warning(f"Cache miss fallback for products list: {e}")

    # Fallback: direct DB query (for search or cache failure)
    return _fetch_products()


@router.get("/search")
async def search_products(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query"),
    category_id: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Search products using Meilisearch with DB fallback."""
    user_role = current_user.get("role") if current_user else None
    
    result = meili_search_products(
        query=q,
        category_id=category_id,
        min_price=min_price,
        max_price=max_price,
        offset=skip,
        limit=limit,
    )
    if result.get("hits") or not result.get("error"):
        # Apply role-based filtering to Meilisearch results
        hits = result.get("hits", [])
        if hits and not (current_user and is_staff(user_role)):
            result["hits"] = [
                {**h, "total_stock": None, "stock_quantity": None}
                for h in hits
            ]
        return result

    product_service = ProductService(db)
    products = product_service.search_products(
        query=q, category_id=category_id,
        min_price=min_price, max_price=max_price,
        skip=skip, limit=limit
    )
    return {
        "hits": [_enrich_product(p, db, user_role) for p in products] if products else [],
        "total": len(products) if products else 0,
        "query": q,
        "fallback": True,
    }


@router.get("/new-arrivals")
async def get_new_arrivals(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get new arrival products."""
    user_role = current_user.get("role") if current_user else None
    
    products = db.query(Product).options(
        joinedload(Product.collection),
        selectinload(Product.images),
        selectinload(Product.variants),
    ).filter(
        Product.is_new_arrival == True,
        Product.is_active == True
    ).order_by(Product.created_at.desc()).limit(limit).all()
    return [_enrich_product(p, db, user_role) for p in products]


@router.get("/featured")
async def get_featured_products(
    limit: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get featured products."""
    user_role = current_user.get("role") if current_user else None

    products = db.query(Product).options(
        joinedload(Product.collection),
        selectinload(Product.images),
        selectinload(Product.variants),
    ).filter(
        Product.is_active == True,
        Product.is_featured == True
    ).order_by(Product.created_at.desc()).limit(limit).all()
    return [_enrich_product(p, db, user_role) for p in products]


# IMPORTANT: /browse route MUST come before /{product_id} to avoid route matching conflicts
# FastAPI matches routes in order, and "browse" would be interpreted as a product_id otherwise
@router.get("/browse")
async def browse_products(
    category_id: Optional[int] = None,
    category_slug: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = Query(None, regex="^(newest|price_low|price_high|popular|name_asc|name_desc)$"),
    sort: Optional[str] = Query(None, regex="^(created_at|base_price|average_rating|name|price|rating|newest)$"),
    order: str = Query("desc", regex="^(asc|desc)$"),
    size: Optional[str] = None,
    color: Optional[str] = None,
    in_stock_only: bool = True,
    page: Optional[int] = Query(None, ge=1),
    skip: Optional[int] = Query(None, ge=0),
    limit: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Browse products with advanced filtering, sorting, and pagination.

    Backward-compatible pagination:
    - New clients can send page+limit
    - Existing clients can keep sending skip+limit
    """
    from models.inventory import Inventory as _Inv
    from sqlalchemy import select
    
    user_role = current_user.get("role") if current_user else None

    query = db.query(Product).filter(Product.is_active == True)

    # Category filter (by ID or slug)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    elif category_slug:
        cat = db.query(Collection).filter(Collection.slug == category_slug).first()
        if cat:
            query = query.filter(Product.category_id == cat.id)

    # Price range filter
    if min_price is not None:
        query = query.filter(Product.base_price >= min_price)
    if max_price is not None:
        query = query.filter(Product.base_price <= max_price)

    # In-stock filter
    if in_stock_only:
        # Use select() construct explicitly to avoid Subquery coercion warning
        in_stock_subq = select(_Inv.product_id).where(_Inv.quantity > 0).subquery()
        query = query.filter(Product.id.in_(in_stock_subq))

    # Normalize pagination params (support both page and skip styles)
    effective_skip = skip if skip is not None else ((page - 1) * limit if page else 0)
    effective_page = (effective_skip // limit) + 1 if limit > 0 else 1

    # Normalize sorting params (support both sort_by and sort+order styles)
    effective_sort_by = sort_by
    if not effective_sort_by and sort:
        sort_key = sort.lower()
        if sort_key in ("newest", "created_at"):
            effective_sort_by = "newest" if order == "desc" else "name_asc"
        elif sort_key in ("price", "base_price"):
            effective_sort_by = "price_high" if order == "desc" else "price_low"
        elif sort_key in ("rating", "average_rating"):
            effective_sort_by = "popular"
        elif sort_key == "name":
            effective_sort_by = "name_desc" if order == "desc" else "name_asc"
    if not effective_sort_by:
        effective_sort_by = "newest"

    # Sorting
    if effective_sort_by == "price_low":
        query = query.order_by(Product.base_price.asc())
    elif effective_sort_by == "price_high":
        query = query.order_by(Product.base_price.desc())
    elif effective_sort_by == "popular":
        query = query.order_by(Product.average_rating.desc())  # Proxy for popularity
    elif effective_sort_by == "name_asc":
        query = query.order_by(Product.name.asc())
    elif effective_sort_by == "name_desc":
        query = query.order_by(Product.name.desc())
    else:  # newest
        query = query.order_by(Product.created_at.desc())

    total = query.count()
    products = query.offset(effective_skip).limit(limit).all()
    enriched_products = [_enrich_product(p, db, user_role) for p in products]

    return {
        "items": enriched_products,
        "products": enriched_products,
        "total": total,
        "page": effective_page,
        "skip": effective_skip,
        "total_pages": (total + limit - 1) // limit,
        "sort_by": effective_sort_by,
        "filters": {
            "category_id": category_id,
            "min_price": min_price,
            "max_price": max_price,
            "in_stock_only": in_stock_only,
        }
    }


@router.get("/slug/{slug}")
async def get_product_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get product details by slug."""
    user_role = current_user.get("role") if current_user else None
    
    product = db.query(Product).options(
        joinedload(Product.collection),
        selectinload(Product.images),
        selectinload(Product.variants),
    ).filter(Product.slug == slug).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    return _enrich_product(product, db, user_role)


@router.get("/{product_id}")
async def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get product details by ID."""
    user_role = current_user.get("role") if current_user else None
    
    product = db.query(Product).options(
        joinedload(Product.collection),
        selectinload(Product.images),
        selectinload(Product.variants),
    ).filter(Product.id == product_id).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    return _enrich_product(product, db, user_role)


@router.get("/{product_id}/related")
async def get_related_products(
    product_id: int,
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Return up to ``limit`` other active products from the same collection."""
    user_role = current_user.get("role") if current_user else None

    product = db.query(Product).filter(
        Product.id == product_id,
        Product.is_active == True,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    related = db.query(Product).filter(
        Product.category_id == product.category_id,
        Product.id != product_id,
        Product.is_active == True,
    ).order_by(func.random()).limit(limit).all()

    return {
        "products": [_enrich_product(p, db, user_role) for p in related],
    }


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
            meili_index_product(_enrich_product(product, db))
        except Exception as e:
            logger.warning(f"Failed to index product in Meilisearch: {e}")
        
        # Invalidate caches so customer pages reflect changes immediately
        cache.invalidate_pattern("products:*")
        cache.invalidate_pattern("collections:*")
        
        return _enrich_product(product, db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{product_id}")
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
            meili_index_product(_enrich_product(product, db))
        except Exception as e:
            logger.warning(f"Failed to update product in Meilisearch: {e}")
        
        # Invalidate caches
        cache.invalidate_pattern("products:*")
        cache.invalidate_pattern("collections:*")
        
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
            meili_delete_product(product_id)
        except Exception as e:
            logger.warning(f"Failed to delete product from Meilisearch: {e}")
        
        # Invalidate caches
        cache.invalidate_pattern("products:*")
        cache.invalidate_pattern("collections:*")
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
    cache.invalidate_pattern("products:*")
    cache.invalidate_pattern("collections:*")
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
    cache.invalidate_pattern("products:*")
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
    cache.invalidate_pattern("products:*")
    cache.invalidate_pattern("collections:*")
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
    cache.invalidate_pattern("products:*")
    cache.invalidate_pattern("collections:*")
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


@router.get("/variants/{variant_id}/color-name")
async def get_variant_color_name(
    variant_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get auto-named color from hex for a variant (admin only)."""
    variant = db.query(Inventory).filter(Inventory.id == variant_id).first()
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant not found"
        )

    # Auto-name from hex using backend function
    color_name = _hex_to_color_name(variant.color_hex)

    return {
        "id": variant.id,
        "name": color_name,
        "hex": variant.color_hex,
        "color": variant.color
    }


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

    # Invalidate caches
    cache.invalidate_pattern("products:*")

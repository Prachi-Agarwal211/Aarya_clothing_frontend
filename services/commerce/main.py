"""
Commerce Service - Aarya Clothing
Product Management, Categories, Cart, Orders, Inventory

This service handles:
- Product catalog management
- Category hierarchy management
- Shopping cart operations
- Order processing
- Inventory management
- Image uploads to Cloudflare R2
- Wishlist management
- Promotions/Coupons
- Reviews and ratings
- Address management
- Returns and refunds
"""
import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File, Query, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel
import json

logger = logging.getLogger(__name__)

from core.config import settings
from core.redis_client import redis_client
from core.advanced_cache import cache, cached
from database.database import get_db, init_db, SessionLocal
from search.meilisearch_client import (
    init_products_index, sync_all_products,
    search_products as meili_search_products,
    index_product as meili_index_product,
    delete_product as meili_delete_product,
)
# Models
from models.product import Product
from models.collection import Collection
from models.category import Category  # backward-compat alias
from models.product_image import ProductImage
from models.inventory import Inventory
from models.order import Order, OrderItem, OrderStatus
from models.address import Address, AddressType
from models.review import Review
from models.order_tracking import OrderTracking
from models.return_request import ReturnRequest, ReturnStatus, ReturnReason
from models.wishlist import Wishlist

# Schemas
from schemas.product import (
    ProductCreate, ProductResponse, ProductUpdate, ProductDetailResponse,
    BulkPriceUpdate, BulkStatusUpdate, BulkCollectionAssign, BulkInventoryUpdate, BulkDeleteProducts
)
from schemas.collection import (
    CollectionCreate, CollectionUpdate, CollectionResponse, CollectionWithProducts,
    BulkCollectionStatusUpdate, BulkCollectionReorder,
)
from schemas.category import (
    CategoryCreate, CategoryUpdate, CategoryResponse, CategoryWithChildren,  # backward-compat
)
from schemas.product_image import ProductImageCreate, ProductImageResponse
from schemas.inventory import InventoryCreate, InventoryUpdate, InventoryResponse, StockAdjustment, LowStockItem
from schemas.order import (
    OrderCreate, OrderResponse, CartItem, CartResponse,
    BulkOrderStatusUpdate, SetDeliveryState
)
from schemas.wishlist import WishlistItemCreate, WishlistItemResponse, WishlistResponse
from schemas.promotion import PromotionCreate, PromotionUpdate, PromotionResponse, PromotionValidateRequest, PromotionValidateResponse
from schemas.address import AddressCreate, AddressUpdate, AddressResponse
from schemas.review import ReviewCreate, ReviewResponse
from schemas.order_tracking import OrderTrackingCreate, OrderTrackingResponse
from schemas.return_request import ReturnRequestCreate, ReturnRequestUpdate, ReturnRequestResponse
from schemas.error import ErrorResponse, PaginatedResponse

# Services
from service.collection_service import CollectionService
from service.category_service import CategoryService  # backward-compat alias
from service.inventory_service import InventoryService
from service.r2_service import r2_service
from service.wishlist_service import WishlistService
from service.promotion_service import PromotionService
from service.product_service import ProductService
from service.cart_service import CartService
from service.order_service import OrderService
from service.address_service import AddressService
from service.review_service import ReviewService
from service.order_tracking_service import OrderTrackingService
from service.return_service import ReturnService

# Route modules (for better code organization)
# These modularize the 2800+ line main.py into manageable route files
try:
    from routes import products_router, orders_router, cart_router, addresses_router, size_guide_router
    ROUTES_AVAILABLE = True
except ImportError:
    ROUTES_AVAILABLE = False
    # Fallback to monolithic routes in main.py
    pass

# Concurrency control
from core.cart_lock import CartConcurrencyManager, cart_operation_lock


# ==================== R2 URL Helper ====================

def _r2_url(path: str) -> str:
    """Convert R2 relative path to full public URL."""
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path  # Already a full URL
    
    # Construct R2 public URL from shared settings
    r2_base = settings.R2_PUBLIC_URL.rstrip('/')
    return f"{r2_base}/{path.lstrip('/')}"


def _enrich_product(product, user_role: str = None) -> dict:
    """
    Convert a Product ORM object to a dict with full R2 URLs.

    This is the single place where R2 URL construction happens for products.
    Frontend receives ready-to-use URLs — no transformation needed.
    
    Role-based filtering:
    - Admin/Staff: See full inventory data (quantities, thresholds, etc.)
    - Customers/Unauthenticated: See only in_stock boolean, no quantities
    """
    primary = product.primary_image
    is_admin_user = is_staff(user_role) if user_role else False
    
    # Role-based inventory filtering
    if is_admin_user:
        # Full inventory data for admin/staff
        inventory = [
            {"id": inv.id, "sku": inv.sku, "size": inv.size, "color": inv.color,
             "quantity": inv.quantity, "reserved_quantity": inv.reserved_quantity,
             "available_quantity": inv.available_quantity,
             "low_stock_threshold": inv.low_stock_threshold,
             "is_low_stock": inv.is_low_stock, "is_out_of_stock": inv.is_out_of_stock,
             "updated_at": inv.updated_at}
            for inv in (product.inventory or [])
        ]
    else:
        # Limited inventory data for customers - no quantities exposed
        inventory = [
            {"size": inv.size, "color": inv.color, "in_stock": not inv.is_out_of_stock}
            for inv in (product.inventory or [])
        ]

    # Extract unique sizes and colors from inventory for frontend selection
    sizes = sorted(list(set(inv.size for inv in (product.inventory or []) if inv.size)))
    colors = sorted(list(set(inv.color for inv in (product.inventory or []) if inv.color)))

    # Build color objects with hex codes (if stored) or just names
    color_objects = [{"name": c, "hex": "#888888"} for c in colors]  # Default hex, can be enhanced

    images = [
        {"id": img.id, "image_url": _r2_url(img.image_url),
         "alt_text": img.alt_text, "is_primary": img.is_primary,
         "display_order": img.display_order}
        for img in (product.images or [])
    ]

    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "sku": getattr(product, 'sku', None),
        "description": product.description,
        "short_description": product.short_description,
        "price": float(product.price),
        "mrp": float(product.mrp) if product.mrp else None,
        "category_id": product.category_id,
        "collection_id": product.category_id,
        "collection_name": product.collection.name if product.collection else None,
        "collection_slug": product.collection.slug if product.collection else None,
        "category": product.collection.name if product.collection else None,
        "brand": getattr(product, 'brand', None),
        "image_url": _r2_url(primary) if primary else None,
        "primary_image": _r2_url(primary) if primary else None,
        "images": images,
        "inventory": inventory,
        "sizes": sizes,  # For frontend size selection
        "colors": color_objects,  # For frontend color selection
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_new_arrival": product.is_new_arrival,
        "is_new": product.is_new_arrival,  # Alias for frontend
        # Stock visibility: admin sees quantities, customers see only boolean
        "total_stock": product.total_stock or 0 if is_admin_user else None,
        "inventory_count": product.total_stock or 0 if is_admin_user else None,
        "stock_quantity": product.total_stock or 0 if is_admin_user else None,  # Alias for frontend
        "in_stock": (product.total_stock or 0) > 0,  # Boolean for frontend Add to Cart
        "is_on_sale": product.is_on_sale,
        "discount_percentage": product.discount_percentage,
        "rating": float(product.average_rating) if product.average_rating else 0,
        "reviews_count": product.review_count or 0,
        "meta_title": product.meta_title,
        "meta_description": product.meta_description,
        "hsn_code": getattr(product, 'hsn_code', None),
        "gst_rate": float(product.gst_rate) if product.gst_rate else None,
        "is_taxable": getattr(product, 'is_taxable', None),
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


def _enrich_collection(cat) -> dict:
    """Convert a Category/Collection ORM object to dict with full R2 URL."""
    return {
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "description": cat.description,
        "image_url": _r2_url(cat.image_url) if cat.image_url else None,
        "display_order": cat.display_order,
        "is_active": cat.is_active,
        "is_featured": cat.is_featured,
        "product_count": len(cat.products) if cat.products else 0,
        "created_at": cat.created_at,
        "updated_at": cat.updated_at,
    }

# Middleware
from shared.auth_middleware import (
    get_current_user,
    get_current_user_optional,
    require_admin,
    require_staff,
    initialize_auth_middleware
)
from shared.roles import is_staff
from shared.request_id_middleware import RequestIDMiddleware
from shared.error_handlers import register_error_handlers

def reconcile_cart_reservations(db: Session) -> int:
    """
    Reconcile inventory.reserved_quantity against active cart reservations in Redis.

    This prevents reservation leaks when cart reservation TTLs expire or Redis
    evicts keys without corresponding DB updates.
    """
    if not redis_client.ping():
        return 0

    try:
        raw_client = redis_client.client
    except Exception:
        return 0

    keys = list(raw_client.scan_iter("cache:cart:reservation:*", count=100))
    if not keys:
        # Clear any stale reservations in DB
        stale_rows = db.query(Inventory).filter(Inventory.reserved_quantity > 0).all()
        if not stale_rows:
            return 0
        for row in stale_rows:
            row.reserved_quantity = 0
        db.commit()
        return len(stale_rows)

    reserved_by_sku = {}
    for key in keys:
        raw = raw_client.get(key)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        sku = data.get("sku")
        qty = data.get("quantity")
        if not sku or qty is None:
            continue
        try:
            qty_int = int(qty)
        except Exception:
            continue
        if qty_int <= 0:
            continue
        reserved_by_sku[sku] = reserved_by_sku.get(sku, 0) + qty_int

    skus = list(reserved_by_sku.keys())
    rows = db.query(Inventory).filter(Inventory.reserved_quantity > 0).all()
    if skus:
        rows += db.query(Inventory).filter(Inventory.sku.in_(skus)).all()

    changed = 0
    seen = set()
    for row in rows:
        if row.sku in seen:
            continue
        seen.add(row.sku)
        target = reserved_by_sku.get(row.sku, 0)
        if row.reserved_quantity != target:
            row.reserved_quantity = max(0, target)
            changed += 1

    if changed:
        db.commit()
    return changed


async def _reservation_reconciler(stop_event: asyncio.Event, interval_seconds: int = 600):
    """Background task to reconcile cart reservations on a schedule."""
    while not stop_event.is_set():
        try:
            db = SessionLocal()
            try:
                changed = reconcile_cart_reservations(db)
                if changed:
                    logger.info("Reconciled %s inventory reservations", changed)
            finally:
                db.close()
        except Exception as e:
            logger.warning("Reservation reconciler failed: %s", e)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue



# ==================== Rate Limiting Helpers ====================

import ipaddress

LOCAL_TEST_IPS = {"127.0.0.1", "::1", "localhost", "testclient"}


def _get_client_ip(request: Request) -> str:
    """Resolve the best-effort client IP, honoring proxy headers when present."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first_hop = forwarded_for.split(",")[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else "unknown"


def _should_bypass_local_rate_limit(request: Request) -> bool:
    """
    Keep rate limiting for deployed traffic while allowing local dev/test
    automation from loopback addresses to exercise flows repeatedly.
    """
    if not settings.is_development:
        return False

    client_ip = _get_client_ip(request)
    if client_ip in LOCAL_TEST_IPS:
        return True

    try:
        parsed_ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    return parsed_ip.is_loopback or parsed_ip.is_private


def _check_rate_limit(request: Request, endpoint: str, limit: int, window: int = 60) -> bool:
    """
    Check if request exceeds rate limit.
    
    Args:
        request: FastAPI request object
        endpoint: Endpoint identifier (e.g., 'cart_add', 'order_create')
        limit: Maximum requests allowed in window
        window: Time window in seconds (default: 60)
    
    Returns:
        True if within limit, False if exceeded
    """
    if _should_bypass_local_rate_limit(request):
        return True
    
    try:
        client_ip = _get_client_ip(request)
        limit_key = f"rate_limit:{endpoint}:{client_ip}"
        count = redis_client.get_cache(limit_key) or 0
        
        if int(count) >= limit:
            return False
        
        redis_client.set_cache(limit_key, int(count) + 1, ttl=window)
        return True
    except Exception as e:
        logger.warning(f"Rate limit check error (skipping): {e}")
        return True  # Allow on error (fail open)


# ==================== Lifespan ====================

# Global instances
event_bus = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    global event_bus
    
    # Initialize DB (create tables)
    init_db()
    
    # Initialize auth middleware
    initialize_auth_middleware(
        secret_key=settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
        redis_client=redis_client
    )
    
    # Ensure Redis connects
    if redis_client.is_connected():
        logger.info("Redis connected for Commerce service")
    else:
        logger.warning("Redis ping failed")
        
    # Start background reservation reconciler
    stop_event = asyncio.Event()
    task = asyncio.create_task(_reservation_reconciler(stop_event))
    
    # Initialize Event Bus
    from shared.event_bus import EventBus
    event_bus = EventBus(redis_client=redis_client, service_name="commerce_service")
    app.state.event_bus = event_bus  # Store in app.state for route access
    
    # Initialize Meilisearch
    try:
        init_products_index()
        db = SessionLocal()
        try:
            count = sync_all_products(db)
            logger.info(f"✓ Commerce service: Meilisearch synced {count} products")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"⚠ Commerce service: Meilisearch init skipped ({e})")
    
    yield
    
    # Shutdown
    logger.info("Commerce service shutting down")


# ==================== FastAPI App ====================

app = FastAPI(
    title="Aarya Clothing - Commerce Service",
    description="Product Management, Categories, Cart, Orders, Inventory",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token"],
)

# Request ID
app.add_middleware(RequestIDMiddleware)

# Standardized error handlers
register_error_handlers(app)

# Register route modules (if available)
# This modularizes the 2800+ line main.py into manageable route files
# NOTE: cart_router and orders_router are DISABLED - all endpoints are defined inline below
# to avoid route conflicts and ensure proper integration with services.
if ROUTES_AVAILABLE:
    app.include_router(products_router)
    # NOTE: categories/collections routes are defined inline above (with R2 URL enrichment)
    # orders_router DISABLED - use inline order routes (lines 1555-1821)
    # app.include_router(orders_router)
    # cart_router DISABLED - use inline cart routes (lines 783-1180)
    # app.include_router(cart_router)
    app.include_router(addresses_router)
    app.include_router(size_guide_router)
    logger.info("Route modules registered successfully")
else:
    logger.warning("Route modules not available - using monolithic routes in main.py")


# ==================== Health ====================

@app.get("/health", tags=["Health"])
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint."""
    redis_status = "healthy" if redis_client.ping() else "unhealthy"
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"
        
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "commerce",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dependencies": {
            "redis": redis_status,
            "database": db_status
        }
    }


@app.get("/api/v1/health", tags=["Health"])
async def health_api(db: Session = Depends(get_db)):
    """API health check endpoint."""
    redis_status = "healthy" if redis_client.ping() else "unhealthy"
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "commerce",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dependencies": {
            "redis": redis_status,
            "database": db_status
        }
    }


# ==================== Collections / Categories (same thing) ====================

@app.get("/api/v1/collections", tags=["Collections"])
@app.get("/api/v1/categories", tags=["Collections"])  # backward compat
async def list_collections(
    featured_only: bool = False,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """List all collections with full R2 image URLs."""
    cache_key = f"collections:list:{featured_only}:{active_only}"
    
    async def fetch_collections():
        query = db.query(Collection)
        if active_only:
            query = query.filter(Collection.is_active == True)
        if featured_only:
            query = query.filter(Collection.is_featured == True)
        collections = query.order_by(Collection.display_order, Collection.name).all()
        return [_enrich_collection(c) for c in collections]

    return await cache.get_or_set(cache_key, fetch_collections, ttl=300)


@app.get("/api/v1/collections/{collection_id}", tags=["Collections"])
@app.get("/api/v1/categories/{category_id}", tags=["Collections"])  # backward compat
async def get_collection(
    collection_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get collection by ID with full R2 image URL."""
    cid = collection_id or category_id
    col = db.query(Collection).filter(Collection.id == cid).first()
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return _enrich_collection(col)


@app.get("/api/v1/collections/slug/{slug}", tags=["Collections"])
@app.get("/api/v1/categories/slug/{slug}", tags=["Collections"])  # backward compat
async def get_collection_by_slug(slug: str, db: Session = Depends(get_db)):
    """Get collection by slug with full R2 image URL."""
    col = db.query(Collection).filter(Collection.slug == slug).first()
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return _enrich_collection(col)


# ==================== Admin Collection Routes ====================

@app.post("/api/v1/admin/collections", response_model=CategoryResponse,
          status_code=status.HTTP_201_CREATED,
          tags=["Admin - Collections"])
@app.post("/api/v1/admin/categories", response_model=CategoryResponse,
          status_code=status.HTTP_201_CREATED,
          tags=["Admin - Collections"])
async def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Create a new collection/category."""
    # Check if slug already exists
    existing = db.query(Collection).filter(Collection.slug == category.slug).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists")

    db_collection = Collection(**{k: v for k, v in category.model_dump().items() if hasattr(Collection, k)})
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    cache.invalidate_pattern("collections:*")
    cache.invalidate_pattern("products:*")
    return _enrich_collection(db_collection)


@app.get("/api/v1/admin/collections", response_model=List[CategoryResponse],
         tags=["Admin - Collections"])
@app.get("/api/v1/admin/categories", response_model=List[CategoryResponse],
         tags=["Admin - Collections"])
async def list_admin_categories(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """List all categories for admin."""
    query = db.query(Collection)
    if active_only:
        query = query.filter(Collection.is_active == True)

    collections = query.order_by(Collection.display_order.asc(), Collection.name.asc()).offset(skip).limit(limit).all()
    return [_enrich_collection(col) for col in collections]


@app.patch("/api/v1/admin/collections/{collection_id}", response_model=CategoryResponse,
           tags=["Admin - Collections"])
@app.patch("/api/v1/admin/categories/{category_id}", response_model=CategoryResponse,
           tags=["Admin - Collections"])
async def update_category(
    category_id: Optional[int] = None,
    collection_id: Optional[int] = None,
    category_update: CategoryUpdate = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Update a collection."""
    cid = collection_id or category_id
    db_collection = db.query(Collection).filter(Collection.id == cid).first()
    if not db_collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    update_data = category_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(db_collection, field):
            setattr(db_collection, field, value)

    db.commit()
    db.refresh(db_collection)
    cache.invalidate_pattern("collections:*")
    cache.invalidate_pattern("products:*")
    return _enrich_collection(db_collection)


@app.delete("/api/v1/admin/collections/{collection_id}",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Admin - Collections"])
@app.delete("/api/v1/admin/categories/{category_id}",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Admin - Collections"])
async def delete_category(
    category_id: Optional[int] = None,
    collection_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Delete a collection."""
    cid = collection_id or category_id
    db_collection = db.query(Collection).filter(Collection.id == cid).first()
    if not db_collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    db.delete(db_collection)
    db.commit()
    # Invalidate caches
    cache.invalidate_pattern("collections:*")
    cache.invalidate_pattern("products:*")
    return


@app.post("/api/v1/admin/collections/{collection_id}/image",
          response_model=CategoryResponse,
          tags=["Admin - Collections"])
@app.post("/api/v1/admin/categories/{category_id}/image",
          response_model=CategoryResponse,
          tags=["Admin - Collections"])
async def upload_category_image(
    category_id: Optional[int] = None,
    collection_id: Optional[int] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Upload an image for a collection."""
    from service.r2_service import r2_service
    cid = collection_id or category_id
    # Check if collection exists
    db_collection = db.query(Collection).filter(Collection.id == cid).first()
    if not db_collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    try:
        image_url = await r2_service.upload_image(file, folder="collections")
        db_collection.image_url = image_url
        db.commit()
        db.refresh(db_collection)
        cache.invalidate_pattern("collections:*")
        return _enrich_collection(db_collection)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload category image: {str(e)}"
        )


@app.post("/api/v1/admin/collections/bulk/status",
          tags=["Admin - Collections"])
@app.post("/api/v1/admin/categories/bulk/status",
          tags=["Admin - Collections"])
async def bulk_update_collection_status(
    payload: BulkCollectionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Bulk activate/deactivate collections."""
    updated = db.query(Collection).filter(Collection.id.in_(payload.ids)).update(
        {"is_active": payload.is_active}, synchronize_session=False
    )
    db.commit()
    cache.invalidate_pattern("collections:*")
    return {"updated": updated}


@app.post("/api/v1/admin/collections/bulk/reorder",
          tags=["Admin - Collections"])
@app.post("/api/v1/admin/categories/bulk/reorder",
          tags=["Admin - Collections"])
async def bulk_reorder_collections(
    payload: BulkCollectionReorder,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Bulk update collection display order."""
    for item in payload.items:
        db.query(Collection).filter(Collection.id == item["id"]).update(
            {"display_order": item["display_order"]}, synchronize_session=False
        )
    db.commit()
    cache.invalidate_pattern("collections:*")
    return {"reordered": len(payload.items)}


# ==================== Product Search (supplemental — main product routes in products_router) ==


@app.get("/api/v1/search/suggestions", tags=["Search"])
async def get_search_suggestions(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query for suggestions"),
    limit: int = Query(5, ge=1, le=10, description="Max suggestions per category"),
    db: Session = Depends(get_db)
):
    """
    Get search suggestions for autocomplete.
    Returns products, categories, and trending searches.
    Optimized for fast response times.
    """
    # Rate limiting: 30 requests per minute per IP
    if not _check_rate_limit(request, "search_suggestions", limit=30, window=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many suggestion requests. Please try again later."
        )

    from search.meilisearch_client import get_search_suggestions as meili_suggestions
    
    result = meili_suggestions(query=q, limit=limit, db_session=db)
    return result










# ==================== Cart Routes (Token Based) ====================

@app.get("/api/v1/cart", response_model=CartResponse, tags=["Cart"])
async def get_my_cart(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current user's cart (user_id from token)."""
    user_id = current_user["user_id"]  # Fixed: use user_id from auth middleware
    cart_service = CartService(db)
    cart_data = cart_service.get_cart(user_id)
    return CartResponse(**cart_data)


@app.post("/api/v1/cart/items", response_model=CartResponse, tags=["Cart"])
async def add_to_my_cart(
    item: CartItem,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add item to current user's cart (user_id from token)."""
    # Rate limiting: 30 requests per minute per IP
    if not _check_rate_limit(request, "cart_add", limit=30, window=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many cart operations. Please try again later."
        )
    
    user_id = current_user["user_id"]  # Fixed: use user_id from auth middleware
    
    # Validate product exists
    product = db.query(Product).filter(Product.id == item.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Check variant-specific stock when variant_id is given; otherwise check total product stock
    if item.variant_id:
        variant = db.query(Inventory).filter(
            Inventory.id == item.variant_id,
            Inventory.product_id == item.product_id
        ).first()
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Variant not found"
            )
        if variant.available_quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only {variant.available_quantity} items available"
            )
    else:
        if product.total_stock < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient inventory"
            )
    
    item_data = {
        "product_id": item.product_id,
        "variant_id": item.variant_id,
        "quantity": item.quantity
    }
    
    cart_data = CartConcurrencyManager.add_to_cart_locked(user_id, item_data, db)
    return CartResponse(**cart_data)


class CartItemUpdate(BaseModel):
    """Body for PUT /cart/items/{product_id}."""
    quantity: int
    variant_id: Optional[int] = None


@app.put("/api/v1/cart/items/{product_id}", response_model=CartResponse, tags=["Cart"])
async def update_my_cart_item(
    product_id: int,
    body: CartItemUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update item quantity in cart. Accepts JSON body: {quantity, variant_id?}."""
    if body.quantity < 1:
        raise HTTPException(status_code=400, detail="quantity must be >= 1")
    user_id = current_user["user_id"]
    cart_data = CartConcurrencyManager.update_cart_item_locked(user_id, product_id, body.quantity, db, body.variant_id)
    return CartResponse(**cart_data)


@app.delete("/api/v1/cart/items/{product_id}", response_model=CartResponse, tags=["Cart"])
async def remove_from_my_cart(
    product_id: int,
    variant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove item from cart."""
    user_id = current_user["user_id"]  # Fixed: use user_id from auth middleware
    cart_data = CartConcurrencyManager.remove_from_cart_locked(user_id, product_id, db, variant_id)
    return CartResponse(**cart_data)


@app.delete("/api/v1/cart", response_model=CartResponse, tags=["Cart"])
async def clear_my_cart(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Clear current user's cart."""
    user_id = current_user["user_id"]  # Fixed: use user_id from auth middleware
    cart_data = CartConcurrencyManager.clear_cart_locked(user_id, db)
    return CartResponse(**cart_data)


@app.post("/api/v1/cart/coupon", response_model=CartResponse, tags=["Cart"])
async def apply_coupon_to_my_cart(
    code: str = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Apply coupon to cart."""
    user_id = current_user["user_id"]  # Fixed: use user_id from auth middleware
    cart_service = CartService(db)
    
    # Get cart to check total
    cart = cart_service.get_cart(user_id)
    if not cart or not cart["items"]:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cart is empty"
        )
        
    # Validate coupon
    promotion_service = PromotionService(db)
    validation = promotion_service.validate_promotion(code, user_id, Decimal(str(cart["subtotal"])))
    
    if not validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation["message"]
        )
    
    # Apply discount
    cart = cart_service.apply_promotion(user_id, code, validation["discount_amount"])
    return CartResponse(**cart)


@app.post("/api/v1/cart/delivery-state", response_model=CartResponse, tags=["Cart"])
async def set_cart_delivery_state(
    payload: SetDeliveryState,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Set delivery state on cart to trigger correct GST (CGST+SGST vs IGST) calculation."""
    user_id = current_user["user_id"]
    cart_service = CartService(db)
    cart = cart_service.get_cart(user_id)
    cart["delivery_state"] = payload.delivery_state
    if payload.customer_gstin:
        cart["customer_gstin"] = payload.customer_gstin
    cart_service._recalculate_cart(cart)
    cart_service.save_cart(user_id, cart)
    return CartResponse(**cart)


@app.post("/api/v1/cart/clear-expired", tags=["Cart"])
async def clear_expired_cart_items(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Clear expired cart reservations and clean up stale cart data."""
    user_id = current_user["user_id"]
    cart_service = CartService(db)
    cart = cart_service.get_cart(user_id)
    # Refresh reservation expiry
    cart["reservation_expires_at"] = cart_service._get_earliest_reservation_expiry(user_id)
    cart_service.save_cart(user_id, cart)
    return {"status": "ok", "cart": cart}


# ==================== Cart Stock Validation SSE ====================

@app.get("/api/v1/cart/stock-stream", tags=["Cart"])
async def cart_stock_stream(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Server-Sent Events endpoint for real-time cart stock updates.
    Streams stock availability changes for items in user's cart.
    Automatically disconnects when client closes connection or after max runtime.
    """
    user_id = current_user["user_id"]
    cart_service = CartService(db)
    MAX_RUNTIME_SECONDS = 3600  # 1 hour max connection lifetime
    start_time = asyncio.get_event_loop().time()
    
    async def event_generator():
        """Generate SSE events for stock updates."""
        while True:
            # Check if client disconnected or max runtime exceeded
            if await request.is_disconnected():
                logger.debug(f"Client disconnected from stock stream for user {user_id}")
                break
            
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > MAX_RUNTIME_SECONDS:
                logger.debug(f"Max runtime exceeded for stock stream user {user_id}")
                yield f"data: {json.dumps({'type': 'timeout', 'message': 'Connection timeout'})}\n\n"
                break
            
            try:
                # Get current cart
                cart = cart_service.get_cart(user_id)
                
                if cart["items"]:
                    # Check stock for each item
                    stock_updates = []
                    for item in cart["items"]:
                        # Query current stock from database
                        result = db.execute(
                            text("SELECT quantity, reserved_quantity FROM inventory WHERE sku = :sku"),
                            {"sku": item.get("sku")}
                        ).fetchone()
                        
                        if result:
                            available = max(0, result[0] - result[1])
                            stock_updates.append({
                                "product_id": item["product_id"],
                                "variant_id": item.get("variant_id"),
                                "sku": item.get("sku"),
                                "available_quantity": available,
                                "requested_quantity": item["quantity"],
                                "in_stock": available >= item["quantity"]
                            })
                    
                    # Send stock status event
                    event_data = {
                        "type": "stock_update",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "items": stock_updates
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"
                
                # Send keepalive every 30 seconds
                await asyncio.sleep(30)
                yield ":keepalive\n\n"
                
            except ConnectionResetError:
                logger.debug(f"Connection reset for stock stream user {user_id}")
                break
            except TimeoutError:
                logger.warning(f"Database timeout in stock stream for user {user_id}")
                error_data = {"type": "error", "message": "Database timeout"}
                yield f"data: {json.dumps(error_data)}\n\n"
                await asyncio.sleep(60)
            except Exception as e:
                logger.error(f"Unexpected error in stock stream for user {user_id}: {e}", exc_info=True)
                error_data = {"type": "error", "message": "Internal server error"}
                yield f"data: {json.dumps(error_data)}\n\n"
                await asyncio.sleep(60)  # Wait longer on error
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


# ==================== Cart Routes (Legacy/Admin) ====================

@app.get("/api/v1/cart/{user_id}", response_model=CartResponse,
         tags=["Cart"])
async def get_cart(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get user's shopping cart."""
    # Authorization check
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this cart"
        )
    
    cart_key = f"cart:{user_id}"
    cart_data = redis_client.get_cache(cart_key)
    
    if not cart_data:
        return CartResponse(user_id=user_id, items=[], total=0)
    
    return CartResponse(**cart_data)


# ==================== Checkout Routes ====================

@app.post("/api/v1/checkout/validate", tags=["Checkout"])
async def validate_checkout(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Validate cart and confirm all reservations are still valid.
    Should be called immediately before payment modal.
    """
    cart_service = CartService(db)
    try:
        is_valid = cart_service.confirm_cart_for_checkout(current_user["user_id"])
        return {"valid": is_valid, "message": "Cart is valid for checkout"}
    except HTTPException as e:
        # Re-raise HTTP exceptions from cart service directly
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )



@app.post("/api/v1/cart/{user_id}/add",
          response_model=CartResponse,
          tags=["Cart"])
async def add_to_cart(
    user_id: int,
    item: CartItem,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Authorization check
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this cart"
        )
    
    # Validate product exists and has sufficient stock
    product = db.query(Product).filter(Product.id == item.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Check inventory (simplified - check total stock)
    if product.total_stock < item.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient inventory"
        )
    
    # Use distributed locking for cart operations
    item_data = {
        "product_id": item.product_id,
        "variant_id": item.variant_id,
        "quantity": item.quantity
    }
    
    cart_data = CartConcurrencyManager.add_to_cart_locked(user_id, item_data, db)
    
    return CartResponse(**cart_data)


@app.delete("/api/v1/cart/{user_id}/remove/{product_id}",
            response_model=CartResponse,
            tags=["Cart"])
async def remove_from_cart(
    user_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove item from cart (legacy endpoint — delegates to CartService for proper reservation release)."""
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this cart"
        )
    cart_data = CartConcurrencyManager.remove_from_cart_locked(user_id, product_id, db)
    return CartResponse(**cart_data)


@app.delete("/api/v1/cart/{user_id}/clear", response_model=CartResponse,
           tags=["Cart"])
async def clear_cart(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Clear user's shopping cart (legacy endpoint — delegates to CartService for proper reservation release)."""
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this cart"
        )
    cart_data = CartConcurrencyManager.clear_cart_locked(user_id, db)
    return CartResponse(**cart_data)


# ==================== Order Routes ====================

# ==================== Wishlist Routes (Token Based) ====================

@app.get("/api/v1/wishlist", response_model=WishlistResponse, tags=["Wishlist"])
async def get_my_wishlist(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current user's wishlist with enriched product data."""
    from sqlalchemy.orm import joinedload
    user_id = current_user["user_id"]
    wishlist_service = WishlistService(db)
    
    # Eagerly load product relationship to avoid lazy-load issues
    items = db.query(Wishlist).options(
        joinedload(Wishlist.product).joinedload(Product.images)
    ).filter(Wishlist.user_id == user_id).all()
    
    # Serialize with enriched product data
    serialized_items = []
    for item in items:
        product_data = None
        if item.product:
            p = item.product
            primary = p.primary_image
            product_data = {
                "id": p.id,
                "name": p.name,
                "slug": p.slug,
                "short_description": p.short_description,
                "price": float(p.price),
                "mrp": float(p.mrp) if p.mrp else None,
                "category_id": p.category_id,
                "collection_id": p.category_id,
                "brand": getattr(p, 'brand', None),
                "image_url": _r2_url(primary) if primary else None,
                "is_active": p.is_active,
                "is_featured": p.is_featured,
                "is_new_arrival": p.is_new_arrival,
                "total_stock": p.total_stock or 0,
                "inventory_count": p.total_stock or 0,
                "is_on_sale": p.is_on_sale,
                "discount_percentage": p.discount_percentage,
                "in_stock": (p.total_stock or 0) > 0,
                "hsn_code": getattr(p, 'hsn_code', None),
                "gst_rate": float(p.gst_rate) if p.gst_rate else None,
                "is_taxable": getattr(p, 'is_taxable', None),
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            }
        
        serialized_items.append({
            "id": item.id,
            "user_id": item.user_id,
            "product_id": item.product_id,
            "added_at": item.added_at,
            "product": product_data,
        })
    
    return WishlistResponse(
        user_id=user_id,
        items=serialized_items,
        total_items=len(serialized_items)
    )


@app.post("/api/v1/wishlist/items", response_model=WishlistItemResponse, 
          status_code=status.HTTP_201_CREATED, tags=["Wishlist"])
async def add_to_my_wishlist(
    item: WishlistItemCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add item to wishlist."""
    user_id = current_user["user_id"]  # Fixed: use user_id from auth middleware
    wishlist_service = WishlistService(db)
    return wishlist_service.add_to_wishlist(user_id, item.product_id)


@app.delete("/api/v1/wishlist/items/{product_id}", 
            status_code=status.HTTP_204_NO_CONTENT, tags=["Wishlist"])
async def remove_from_my_wishlist(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove item from wishlist."""
    user_id = current_user["user_id"]  # Fixed: use user_id from auth middleware
    wishlist_service = WishlistService(db)
    wishlist_service.remove_from_wishlist(user_id, product_id)
    return


@app.get("/api/v1/wishlist/check/{product_id}", tags=["Wishlist"])
async def check_in_my_wishlist(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Check if product is in wishlist."""
    user_id = current_user["user_id"]  # Fixed: use user_id from auth middleware
    wishlist_service = WishlistService(db)
    in_wishlist = wishlist_service.is_in_wishlist(user_id, product_id)
    return {"in_wishlist": in_wishlist}


# ==================== Wishlist Routes (Legacy/Admin) ====================

@app.get("/api/v1/wishlist/{user_id}", response_model=WishlistResponse,
         tags=["Wishlist"])
async def get_wishlist(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get user's wishlist (legacy/admin endpoint)."""
    from sqlalchemy.orm import joinedload
    # Authorization check
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this wishlist"
        )
    
    # Eagerly load product relationship
    items = db.query(Wishlist).options(
        joinedload(Wishlist.product).joinedload(Product.images)
    ).filter(Wishlist.user_id == user_id).all()
    
    # Serialize with enriched product data
    serialized_items = []
    for item in items:
        product_data = None
        if item.product:
            p = item.product
            primary = p.primary_image
            product_data = {
                "id": p.id,
                "name": p.name,
                "slug": p.slug,
                "short_description": p.short_description,
                "price": float(p.price),
                "mrp": float(p.mrp) if p.mrp else None,
                "category_id": p.category_id,
                "collection_id": p.category_id,
                "brand": getattr(p, 'brand', None),
                "image_url": _r2_url(primary) if primary else None,
                "is_active": p.is_active,
                "is_featured": p.is_featured,
                "is_new_arrival": p.is_new_arrival,
                "total_stock": p.total_stock or 0,
                "inventory_count": p.total_stock or 0,
                "is_on_sale": p.is_on_sale,
                "discount_percentage": p.discount_percentage,
                "in_stock": (p.total_stock or 0) > 0,
                "hsn_code": getattr(p, 'hsn_code', None),
                "gst_rate": float(p.gst_rate) if p.gst_rate else None,
                "is_taxable": getattr(p, 'is_taxable', None),
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            }
        
        serialized_items.append({
            "id": item.id,
            "user_id": item.user_id,
            "product_id": item.product_id,
            "added_at": item.added_at,
            "product": product_data,
        })
    
    return WishlistResponse(
        user_id=user_id,
        items=serialized_items,
        total_items=len(serialized_items)
    )


@app.post("/api/v1/wishlist/{user_id}/add", response_model=WishlistItemResponse,
          status_code=status.HTTP_201_CREATED,
          tags=["Wishlist"])
async def add_to_wishlist(
    user_id: int,
    item: WishlistItemCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add product to wishlist."""
    # Authorization check
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this wishlist"
        )
    
    wishlist_service = WishlistService(db)
    return wishlist_service.add_to_wishlist(user_id, item.product_id)


@app.delete("/api/v1/wishlist/{user_id}/remove/{product_id}",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Wishlist"])
async def remove_from_wishlist(
    user_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Remove product from wishlist."""
    # Authorization check
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this wishlist"
        )
    
    wishlist_service = WishlistService(db)
    wishlist_service.remove_from_wishlist(user_id, product_id)
    return


@app.delete("/api/v1/wishlist/{user_id}/clear",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Wishlist"])
async def clear_wishlist(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Clear user's wishlist."""
    # Authorization check
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this wishlist"
        )
    
    wishlist_service = WishlistService(db)
    wishlist_service.clear_wishlist(user_id)
    return


@app.get("/api/v1/wishlist/{user_id}/check/{product_id}",
         tags=["Wishlist"])
async def check_in_wishlist(
    user_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Check if product is in wishlist."""
    # Authorization check
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this wishlist"
        )
    
    wishlist_service = WishlistService(db)
    in_wishlist = wishlist_service.is_in_wishlist(user_id, product_id)
    return {"in_wishlist": in_wishlist}


# ==================== Promotion Routes ====================

@app.post("/api/v1/promotions/validate", response_model=PromotionValidateResponse,
          tags=["Promotions"])
async def validate_promotion(
    validation_request: PromotionValidateRequest,
    db: Session = Depends(get_db)
):
    """Validate a promotion code."""
    promotion_service = PromotionService(db)
    result = promotion_service.validate_promotion(
        validation_request.code,
        validation_request.user_id,
        validation_request.order_total
    )
    
    return PromotionValidateResponse(**result)


# ==================== Admin Promotion Routes ====================

@app.get("/api/v1/admin/promotions", response_model=List[PromotionResponse],
         tags=["Admin - Promotions"])
async def list_promotions(
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """List all promotions (admin only)."""
    promotion_service = PromotionService(db)
    return promotion_service.get_all_promotions(active_only)


@app.get("/api/v1/admin/promotions/{code}", response_model=PromotionResponse,
         tags=["Admin - Promotions"])
async def get_promotion(
    code: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Get promotion by code (admin only)."""
    promotion_service = PromotionService(db)
    promotion = promotion_service.get_promotion_by_code(code)
    
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promotion not found"
        )
    
    return promotion


@app.post("/api/v1/admin/promotions", response_model=PromotionResponse,
          status_code=status.HTTP_201_CREATED,
          tags=["Admin - Promotions"])
async def create_promotion(
    promotion_data: PromotionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Create a new promotion (admin only)."""
    promotion_service = PromotionService(db)
    return promotion_service.create_promotion(promotion_data)


@app.patch("/api/v1/admin/promotions/{promotion_id}", response_model=PromotionResponse,
           tags=["Admin - Promotions"])
async def update_promotion(
    promotion_id: int,
    promotion_data: PromotionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Update a promotion (admin only)."""
    promotion_service = PromotionService(db)
    return promotion_service.update_promotion(promotion_id, promotion_data)


@app.delete("/api/v1/admin/promotions/{promotion_id}",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Admin - Promotions"])
async def delete_promotion(
    promotion_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Delete a promotion (admin only)."""
    promotion_service = PromotionService(db)
    promotion_service.delete_promotion(promotion_id)
    return


# ==================== Order Routes ====================

@app.post("/api/v1/orders", response_model=OrderResponse,
          status_code=status.HTTP_201_CREATED,
          tags=["Orders"])
async def create_order(
    order_data: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new order from cart."""
    # Rate limiting: 10 orders per minute per IP
    if not _check_rate_limit(request, "order_create", limit=10, window=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many order creation attempts. Please try again later."
        )
    
    order_service = OrderService(db)
    # Create order via service
    try:
        from shared.event_bus import Event, EventType

        order = order_service.create_order(
            user_id=current_user["user_id"],
            shipping_address=order_data.shipping_address,
            address_id=order_data.address_id,
            promo_code=order_data.promo_code,
            order_notes=order_data.notes or order_data.order_notes,
            # transaction_id = razorpay payment_id (pay_xxx) or cashfree payment id
            transaction_id=order_data.transaction_id or order_data.payment_id,
            payment_method=order_data.payment_method,
            # Razorpay-specific fields
            razorpay_order_id=order_data.razorpay_order_id,
            payment_signature=order_data.razorpay_signature,
            # Cashfree-specific fields
            cashfree_order_id=order_data.cashfree_order_id,
            cashfree_payment_id=order_data.cashfree_payment_id,
            cashfree_reference_id=order_data.cashfree_reference_id,
        )
        
        # Publish event
        if event_bus and order:
            try:
                event_data = {
                    "order_id": order.id,
                    "order_number": order.invoice_number,
                    "user_id": current_user["user_id"], # Changed from current_user["id"] to current_user["user_id"]
                    "total_amount": float(order.total_amount),
                    "shipping_address": order_data.shipping_address, # Changed from shipping_address to order_data.shipping_address
                    "status": order.status.value
                }
                order_event = Event(
                    event_type=EventType.ORDER_CREATED,
                    aggregate_id=str(order.id),
                    aggregate_type="order",
                    data=event_data,
                    metadata={"source": "commerce_service"}
                )
                await event_bus.publish(order_event)
            except Exception as exc:
                logger.warning(
                    "Failed to publish order created event for order %s: %s",
                    order.id,
                    exc
                )
        
        return order # Added return statement for the created order
            
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@app.get("/api/v1/orders", response_model=List[OrderResponse],
         tags=["Orders"])
async def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List current user's orders."""
    order_service = OrderService(db)
    return order_service.get_user_orders(
        user_id=current_user["user_id"],
        skip=skip,
        limit=limit
    )


@app.get("/api/v1/orders/{order_id}", response_model=OrderResponse,
         tags=["Orders"])
async def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get order details."""
    order_service = OrderService(db)
    order = order_service.get_order_by_id(order_id, user_id=current_user["user_id"])
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    return order


@app.post("/api/v1/orders/{order_id}/cancel", response_model=OrderResponse,
          tags=["Orders"])
async def cancel_order(
    order_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Cancel an order."""
    order_service = OrderService(db)
    return order_service.cancel_order(
        order_id=order_id,
        user_id=current_user["user_id"],
        reason=reason
    )


@app.get("/api/v1/orders/{order_id}/tracking", response_model=List[OrderTrackingResponse],
         tags=["Orders"])
async def get_order_tracking(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get order tracking history."""
    # Verify order belongs to user
    order_service = OrderService(db)
    order = order_service.get_order_by_id(order_id, user_id=current_user["user_id"])
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    tracking_service = OrderTrackingService(db)
    return tracking_service.get_order_tracking(order_id)


# ==================== Admin Order Routes ====================

@app.get("/api/v1/admin/orders",
         tags=["Admin - Orders"])
async def list_all_orders(
    status_filter: Optional[str] = None,
    status: Optional[str] = None,          # alias accepted by frontend
    search: Optional[str] = None,          # search by order id or customer
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """List all orders (admin/staff). Returns {orders, total}."""
    from models.order import Order
    from sqlalchemy import or_, cast, String
    effective_status = status_filter or status
    order_service = OrderService(db)
    order_status = OrderStatus(effective_status) if effective_status else None
    orders = order_service.get_all_orders(status=order_status, skip=skip, limit=limit)
    # Count query for pagination
    count_q = db.query(Order)
    if order_status:
        count_q = count_q.filter(Order.status == order_status)
    if search:
        count_q = count_q.filter(
            or_(
                cast(Order.id, String).ilike(f"%{search}%"),
                Order.customer_name.ilike(f"%{search}%"),
                Order.customer_email.ilike(f"%{search}%"),
            )
        )
        # Also filter the already-fetched list by search
        sl = search.lower()
        orders = [
            o for o in orders
            if sl in str(o.id) or
               (o.customer_name and sl in o.customer_name.lower()) or
               (o.customer_email and sl in o.customer_email.lower())
        ]
    total = count_q.count()
    return {"orders": orders, "total": total}


class OrderStatusUpdate(BaseModel):
    """Body for PATCH /admin/orders/{id}/status."""
    status: str
    pod_number: Optional[str] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None


@app.patch("/api/v1/admin/orders/{order_id}/status", response_model=OrderResponse,
           tags=["Admin - Orders"])
async def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Update order status (admin/staff). Accepts JSON body: {status, pod_number, tracking_number, notes}."""
    new_status = body.status
    tracking_number = body.pod_number or body.tracking_number
    notes = body.notes
    order_service = OrderService(db)
    order = order_service.update_order_status(
        order_id=order_id,
        new_status=OrderStatus(new_status),
        tracking_number=tracking_number,
        admin_notes=notes
    )

    tracking_service = OrderTrackingService(db)
    tracking_service.add_tracking_entry(
        order_id=order_id,
        status=OrderStatus(new_status),
        notes=notes,
        updated_by=current_user["user_id"]
    )

    redis_client.publish("order:status", {
        "order_id": order_id,
        "status": new_status,
        "tracking_number": tracking_number,
        "notes": notes,
        "updated_by": current_user["user_id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return order


@app.get("/api/v1/admin/orders/{order_id}/tracking", tags=["Admin - Orders"])
async def get_order_tracking(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Get order tracking/history (admin/staff)."""
    from models.order_tracking import OrderTracking
    
    tracking = db.query(OrderTracking).filter(
        OrderTracking.order_id == order_id
    ).order_by(OrderTracking.created_at.desc()).all()
    
    return {
        "tracking": [
            {
                "id": t.id,
                "status": t.status.value,
                "notes": t.notes,
                "location": t.location,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tracking
        ]
    }


# ==================== SSE Order Events ====================

@app.get("/api/v1/orders/{order_id}/events", tags=["Orders"])
async def order_status_events(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Server-Sent Events endpoint for real-time order status updates.
    
    Subscribes to Redis Pub/Sub channel `order_updates:{order_id}`.
    When staff updates the order status, the event is pushed instantly.
    
    Usage: const es = new EventSource('/api/v1/orders/{order_id}/events')
    
    Security: Verifies that the user owns the order or is a staff member.
    """
    from starlette.responses import StreamingResponse
    from core.redis_client import redis_client
    from models.order import Order
    
    # Verify order exists and user has access
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check if user owns this order OR is a staff/admin
    is_staff = current_user.get("is_staff", False) or current_user.get("is_admin", False)
    if order.user_id != current_user.get("user_id") and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this order's events"
        )
    
    # Check Redis connectivity before creating SSE stream
    if not redis_client.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Real-time updates unavailable. Please try again later."
        )

    async def event_generator():
        """Subscribe to Redis Pub/Sub and yield SSE events."""
        # Create a dedicated pubsub subscriber for this connection
        pubsub = redis_client.client.pubsub()
        channel = f"order_updates:{order_id}"
        pubsub.subscribe(channel)

        try:
            # Send initial connection event
            yield f"event: connected\ndata: {{\"order_id\": {order_id}}}\n\n"

            heartbeat_counter = 0
            while True:
                # Non-blocking check for new messages
                message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)

                if message and message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"event: status_update\ndata: {data}\n\n"
                
                heartbeat_counter += 1
                # Send heartbeat every ~30 seconds (30 iterations × 1s timeout)
                if heartbeat_counter >= 30:
                    yield ": heartbeat\n\n"
                    heartbeat_counter = 0

                await asyncio.sleep(0)  # Yield control to event loop

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"SSE error for order {order_id}: {e}")
        finally:
            # Ensure proper cleanup of pubsub connection
            if pubsub:
                try:
                    pubsub.unsubscribe(channel)
                    pubsub.close()
                except Exception as cleanup_err:
                    logger.warning(f"SSE pubsub cleanup error for order {order_id}: {cleanup_err}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ==================== Admin Bulk Order Status ====================

class BulkOrderStatusUpdateBody(BaseModel):
    """Body for bulk status update — extends BulkOrderStatusUpdate with pod_number."""
    order_ids: List[int]
    status: str
    pod_number: Optional[str] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None
    dry_run: bool = False


@app.patch("/api/v1/admin/orders/bulk-status", tags=["Admin - Orders"])
async def bulk_update_order_status(
    data: BulkOrderStatusUpdateBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """
    Bulk update order status for multiple orders.
    Accepts: {order_ids, status, pod_number?, notes?, dry_run?}
    """
    MAX_BULK_SIZE = 100
    if len(data.order_ids) > MAX_BULK_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot process more than {MAX_BULK_SIZE} orders at once"
        )

    if data.dry_run:
        from models.order import Order as OrderModel
        count = db.query(OrderModel).filter(OrderModel.id.in_(data.order_ids)).count()
        return {"updated": count, "order_ids": data.order_ids, "new_status": data.status, "dry_run": True}

    tracking_number = data.pod_number or data.tracking_number
    order_service = OrderService(db)
    # Update status
    updated_count = order_service.bulk_update_order_status(
        order_ids=data.order_ids,
        new_status=OrderStatus(data.status)
    )
    # If tracking number provided (e.g. ship), write it to each order
    if tracking_number:
        from models.order import Order as OrderModel
        db.query(OrderModel).filter(OrderModel.id.in_(data.order_ids)).update(
            {"tracking_number": tracking_number},
            synchronize_session=False
        )
        db.commit()
    return {"updated": updated_count, "order_ids": data.order_ids, "new_status": data.status, "dry_run": False}


@app.get("/api/v1/admin/orders/pod-template", tags=["Admin - Orders"])
async def download_pod_template(
    current_user: dict = Depends(require_staff)
):
    """Download a blank Excel template for bulk POD number upload."""
    import io
    try:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "POD Upload"
        ws.append(["order_id", "pod_number"])
        ws.append(["123", "TRACK123456"])  # example row
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        from fastapi.responses import StreamingResponse as _SR
        return _SR(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=pod_template.xlsx"}
        )
    except ImportError:
        import csv, io as _io
        output = _io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["order_id", "pod_number"])
        writer.writerow(["123", "TRACK123456"])
        from fastapi.responses import Response as _Resp
        return _Resp(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=pod_template.csv"}
        )


@app.post("/api/v1/admin/orders/upload-pod-excel", tags=["Admin - Orders"])
async def upload_pod_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Upload an Excel/CSV file with order_id + pod_number columns to bulk-set tracking numbers."""
    import io
    content = await file.read()
    rows_updated = 0
    errors = []
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content))
        ws = wb.active
        headers = [str(c.value).strip().lower() if c.value else "" for c in next(ws.iter_rows(min_row=1, max_row=1))]
        oid_idx = headers.index("order_id") if "order_id" in headers else 0
        pod_idx = headers.index("pod_number") if "pod_number" in headers else 1
        for row in ws.iter_rows(min_row=2, values_only=True):
            try:
                oid = int(row[oid_idx])
                pod = str(row[pod_idx]).strip() if row[pod_idx] else ""
                if not pod:
                    continue
                from models.order import Order as OrderModel
                updated = db.query(OrderModel).filter(OrderModel.id == oid).update(
                    {"tracking_number": pod}, synchronize_session=False
                )
                if updated:
                    rows_updated += 1
                else:
                    errors.append(f"Order {oid} not found")
            except Exception as row_err:
                errors.append(str(row_err))
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")
    return {"updated": rows_updated, "errors": errors}


@app.get("/api/v1/admin/orders/export/excel", tags=["Admin - Orders"])
async def export_orders_excel(
    status_filter: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Export all orders as Excel (XLSX) download."""
    import io
    from models.order import Order as OrderModel
    from sqlalchemy import and_
    q = db.query(OrderModel)
    if status_filter:
        q = q.filter(OrderModel.status == OrderStatus(status_filter))
    if from_date:
        q = q.filter(OrderModel.created_at >= from_date)
    if to_date:
        q = q.filter(OrderModel.created_at <= to_date + " 23:59:59")
    orders = q.order_by(OrderModel.created_at.desc()).all()
    try:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Orders"
        ws.append(["Order ID", "Invoice #", "Customer Name", "Customer Email",
                   "Total (INR)", "Payment Method", "Status", "POD/Tracking",
                   "Shipping Address", "Order Date"])
        for o in orders:
            ws.append([
                o.id,
                o.invoice_number or f"INV-{o.id}",
                o.customer_name or "",
                o.customer_email or "",
                float(o.total_amount) if o.total_amount else 0,
                o.payment_method or "",
                o.status.value if hasattr(o.status, 'value') else str(o.status),
                o.tracking_number or "",
                o.shipping_address or "",
                o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else "",
            ])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        from fastapi.responses import StreamingResponse as _SR
        return _SR(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=orders_export.xlsx"}
        )
    except ImportError:
        raise HTTPException(status_code=501, detail="openpyxl not installed — use client-side export")



# ==================== Internal Service Routes ====================

import secrets

def verify_internal_secret(x_internal_secret: str = Header(None)):
    """Verify internal service-to-service authentication secret."""
    expected_secret = getattr(settings, 'INTERNAL_SERVICE_SECRET', None)
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal service secret not configured on server"
        )
    # Use constant-time comparison to prevent timing attacks
    if not x_internal_secret or not secrets.compare_digest(str(x_internal_secret), str(expected_secret)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal service secret"
        )
    return True


@app.post("/api/v1/internal/orders/{order_id}/reservation/confirm", tags=["Internal"])
async def internal_confirm_reservation(
    order_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_secret)
):
    """
    Internal endpoint called by payment service after successful payment.
    Confirms inventory reservation (deducts reserved_quantity permanently).
    """
    # Get order items
    items = db.execute(text(
        "SELECT oi.inventory_id, oi.quantity FROM order_items oi WHERE oi.order_id = :oid"
    ), {"oid": order_id}).fetchall()
    
    for item in items:
        inv_id, qty = item[0], item[1]
        db.execute(text(
            "UPDATE inventory SET reserved_quantity = GREATEST(0, reserved_quantity - :qty) WHERE id = :id"
        ), {"qty": qty, "id": inv_id})
    
    db.commit()
    return {"message": "Reservation confirmed", "order_id": order_id}


@app.post("/api/v1/internal/orders/{order_id}/reservation/release", tags=["Internal"])
async def internal_release_reservation(
    order_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_secret)
):
    """
    Internal endpoint called by payment service after failed payment.
    Releases reserved stock back to available inventory.
    """
    items = db.execute(text(
        "SELECT oi.inventory_id, oi.quantity FROM order_items oi WHERE oi.order_id = :oid"
    ), {"oid": order_id}).fetchall()
    
    for item in items:
        inv_id, qty = item[0], item[1]
        db.execute(text(
            "UPDATE inventory SET reserved_quantity = GREATEST(0, reserved_quantity - :qty), "
            "quantity = quantity + :qty WHERE id = :id"
        ), {"qty": qty, "id": inv_id})
    
    db.commit()
    return {"message": "Reservation released", "order_id": order_id}


# ==================== Address Routes ====================

@app.post("/api/v1/addresses", response_model=AddressResponse,
          status_code=status.HTTP_201_CREATED,
          tags=["Addresses"])
async def create_address(
    address_data: AddressCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new address."""
    address_service = AddressService(db)
    return address_service.create_address(current_user["user_id"], address_data)


@app.get("/api/v1/addresses", response_model=List[AddressResponse],
         tags=["Addresses"])
async def list_addresses(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List current user's addresses."""
    address_service = AddressService(db)
    return address_service.get_user_addresses(current_user["user_id"])


@app.get("/api/v1/addresses/{address_id}", response_model=AddressResponse,
         tags=["Addresses"])
async def get_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get address by ID."""
    address_service = AddressService(db)
    address = address_service.get_address_by_id(address_id, current_user["user_id"])
    
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )
    
    return address


@app.patch("/api/v1/addresses/{address_id}", response_model=AddressResponse,
           tags=["Addresses"])
async def update_address(
    address_id: int,
    address_data: AddressUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update an address."""
    address_service = AddressService(db)
    return address_service.update_address(
        address_id,
        current_user["user_id"],
        address_data
    )


@app.delete("/api/v1/addresses/{address_id}",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Addresses"])
async def delete_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete an address."""
    address_service = AddressService(db)
    address_service.delete_address(address_id, current_user["user_id"])
    return


# ==================== Review Routes ====================

@app.post("/api/v1/reviews", response_model=ReviewResponse,
          status_code=status.HTTP_201_CREATED,
          tags=["Reviews"])
async def create_review(
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a product review."""
    review_service = ReviewService(db)
    return review_service.create_review(current_user["user_id"], review_data)


@app.get("/api/v1/products/{product_id}/reviews", response_model=List[ReviewResponse],
         tags=["Reviews"])
async def get_product_reviews(
    product_id: int,
    approved_only: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get reviews for a product."""
    review_service = ReviewService(db)
    return review_service.get_product_reviews(
        product_id,
        approved_only=approved_only,
        skip=skip,
        limit=limit
    )


@app.post("/api/v1/reviews/{review_id}/helpful",
          tags=["Reviews"])
async def mark_review_helpful(
    review_id: int,
    db: Session = Depends(get_db)
):
    """Mark a review as helpful."""
    review_service = ReviewService(db)
    review_service.mark_helpful(review_id)
    return {"message": "Review marked as helpful"}


@app.delete("/api/v1/reviews/{review_id}",
            status_code=status.HTTP_204_NO_CONTENT,
            tags=["Reviews"])
async def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete own review."""
    review_service = ReviewService(db)
    review_service.delete_review(review_id, current_user["user_id"])
    return


@app.post("/api/v1/admin/reviews/{review_id}/approve",
          response_model=ReviewResponse,
          tags=["Admin - Reviews"])
async def approve_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Approve a review (admin/staff)."""
    review_service = ReviewService(db)
    return review_service.approve_review(review_id)


# ==================== Return Routes ====================

@app.post("/api/v1/returns", response_model=ReturnRequestResponse,
          status_code=status.HTTP_201_CREATED,
          tags=["Returns"])
async def create_return_request(
    return_data: ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a return request."""
    return_service = ReturnService(db)
    return return_service.create_return(current_user["user_id"], return_data)


@app.post("/api/v1/returns/upload-video",
          status_code=status.HTTP_201_CREATED,
          tags=["Returns"])
async def upload_return_video(
    file: UploadFile = File(..., description="Video file for return evidence"),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a video for return request evidence.
    
    - Accepts: mp4, mov, webm formats
    - Max file size: 50MB
    - Returns the video URL after successful upload
    """
    # Import the r2 service
    from service.r2_service import r2_service
    
    try:
        video_url = await r2_service.upload_video(file, folder="returns")
        return {
            "video_url": video_url,
            "message": "Video uploaded successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload video: {str(e)}"
        )


@app.get("/api/v1/returns", response_model=List[ReturnRequestResponse],
         tags=["Returns"])
async def list_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List current user's return requests."""
    return_service = ReturnService(db)
    return return_service.get_user_returns(
        current_user["user_id"],
        skip=skip,
        limit=limit
    )


@app.get("/api/v1/returns/{return_id}", response_model=ReturnRequestResponse,
         tags=["Returns"])
async def get_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get return request details."""
    return_service = ReturnService(db)
    return_request = return_service.get_return_by_id(
        return_id,
        user_id=current_user["user_id"]
    )
    
    if not return_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Return request not found"
        )
    
    return return_request


# ==================== Admin Return Routes ====================

@app.get("/api/v1/admin/returns", response_model=List[ReturnRequestResponse],
         tags=["Admin - Returns"])
async def list_all_returns(
    status_filter: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """List all return requests (admin/staff)."""
    return_service = ReturnService(db)
    return_status = ReturnStatus(status_filter) if status_filter else None
    return return_service.get_all_returns(status=return_status, skip=skip, limit=limit)


@app.post("/api/v1/admin/returns/{return_id}/approve",
          response_model=ReturnRequestResponse,
          tags=["Admin - Returns"])
async def approve_return(
    return_id: int,
    refund_amount: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Approve a return request (admin/staff)."""
    return_service = ReturnService(db)
    return return_service.approve_return(
        return_id,
        approved_by=current_user["user_id"],
        refund_amount=Decimal(refund_amount) if refund_amount else None
    )


@app.post("/api/v1/admin/returns/{return_id}/reject",
          response_model=ReturnRequestResponse,
          tags=["Admin - Returns"])
async def reject_return(
    return_id: int,
    reason: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Reject a return request (admin/staff)."""
    return_service = ReturnService(db)
    return return_service.reject_return(
        return_id,
        approved_by=current_user["user_id"],
        rejection_reason=reason
    )


@app.post("/api/v1/admin/returns/{return_id}/receive",
          response_model=ReturnRequestResponse,
          tags=["Admin - Returns"])
async def mark_return_received(
    return_id: int,
    tracking_number: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Mark return item as received (admin/staff)."""
    return_service = ReturnService(db)
    return return_service.mark_item_received(
        return_id,
        tracking_number=tracking_number
    )


@app.post("/api/v1/admin/returns/{return_id}/refund",
          response_model=ReturnRequestResponse,
          tags=["Admin - Returns"])
async def process_return_refund(
    return_id: int,
    refund_transaction_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """Mark return as refunded with transaction ID (admin/staff)."""
    return_service = ReturnService(db)
    return return_service.mark_refunded(
        return_id,
        refund_transaction_id=refund_transaction_id
    )


@app.post("/api/v1/returns/{return_id}/cancel",
          response_model=ReturnRequestResponse,
          tags=["Returns"])
async def cancel_return_request(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Cancel a return request (customer). Only allowed for 'requested' status."""
    return_service = ReturnService(db)
    return_request = return_service.get_return_by_id(
        return_id,
        user_id=current_user["user_id"]
    )
    
    if not return_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Return request not found"
        )
    
    if return_request.status != ReturnStatus.REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only cancel return requests with 'requested' status"
        )
    
    # Delete the return request
    db.delete(return_request)
    db.commit()
    
    return {"message": "Return request cancelled successfully", "id": return_id}


# ==================== Product Sorting & Filtering ====================

@app.get("/api/v1/products/browse", tags=["Products"])
async def browse_products(
    category_id: Optional[int] = None,
    category_slug: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: str = Query("newest", regex="^(newest|price_low|price_high|popular|name_asc|name_desc)$"),
    size: Optional[str] = None,
    color: Optional[str] = None,
    in_stock_only: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Browse products with advanced filtering, sorting, and pagination."""
    user_role = current_user.get("role") if current_user else None
    
    query = db.query(Product).filter(Product.is_active == True)

    # Category filter (by ID or slug)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    elif category_slug:
        cat = db.query(Category).filter(Category.slug == category_slug).first()
        if cat:
            query = query.filter(Product.category_id == cat.id)

    # Price range filter
    if min_price is not None:
        query = query.filter(Product.base_price >= min_price)
    if max_price is not None:
        query = query.filter(Product.base_price <= max_price)

    # In-stock filter
    if in_stock_only:
        from models.inventory import Inventory as _Inv
        in_stock_ids = db.query(_Inv.product_id).filter(_Inv.quantity > 0).subquery()
        query = query.filter(Product.id.in_(in_stock_ids))

    # Sorting
    if sort_by == "price_low":
        query = query.order_by(Product.base_price.asc())
    elif sort_by == "price_high":
        query = query.order_by(Product.base_price.desc())
    elif sort_by == "popular":
        query = query.order_by(Product.average_rating.desc())  # Proxy for popularity
    elif sort_by == "name_asc":
        query = query.order_by(Product.name.asc())
    elif sort_by == "name_desc":
        query = query.order_by(Product.name.desc())
    else:  # newest
        query = query.order_by(Product.created_at.desc())

    total = query.count()
    products = query.offset(skip).limit(limit).all()

    return {
        "products": [_enrich_product(p, user_role) for p in products],
        "total": total,
        "page": skip // limit + 1,
        "total_pages": (total + limit - 1) // limit,
        "sort_by": sort_by,
        "filters": {
            "category_id": category_id,
            "min_price": min_price,
            "max_price": max_price,
            "in_stock_only": in_stock_only,
        }
    }


@app.get("/api/v1/products/{product_id}/related", tags=["Products"])
async def get_related_products(
    product_id: int,
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get related products based on same category."""
    user_role = current_user.get("role") if current_user else None
    
    product = db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    related = db.query(Product).filter(
        Product.category_id == product.category_id,
        Product.id != product_id,
        Product.is_active == True
    ).order_by(func.random()).limit(limit).all()
    return {"products": [_enrich_product(p, user_role) for p in related]}


# ==================== Cart Enhancements ====================

@app.put("/api/v1/cart/{user_id}/update-quantity", response_model=CartResponse,
         tags=["Cart"])
async def update_cart_quantity(
    user_id: int,
    product_id: int,
    quantity: int = Query(ge=1),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update quantity for an item already in the cart (legacy endpoint — delegates to CartService)."""
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    cart_data = CartConcurrencyManager.update_cart_item_locked(user_id, product_id, quantity, db)
    return CartResponse(**cart_data)


@app.post("/api/v1/cart/{user_id}/apply-promo", tags=["Cart"])
async def apply_promo_to_cart(
    user_id: int,
    promo_code: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Apply a promotion code to the cart (legacy endpoint — delegates to CartService)."""
    if current_user["user_id"] != user_id and current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    cart_service = CartService(db)
    cart = cart_service.get_cart(user_id)

    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")

    subtotal = Decimal(str(cart["subtotal"]))
    promotion_service = PromotionService(db)
    validation = promotion_service.validate_promotion(promo_code, user_id, subtotal)

    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["message"])

    cart = cart_service.apply_promotion(user_id, promo_code, validation["discount_amount"])
    return CartResponse(**cart)


@app.get("/api/v1/cart/{user_id}/summary", tags=["Cart"])
async def cart_summary(user_id: int):
    """Get cart summary with calculated totals, shipping, and any applied promo."""
    cart_key = f"cart:{user_id}"
    cart_data = redis_client.get_cache(cart_key)

    if not cart_data or not cart_data.get("items"):
        return {"subtotal": 0, "total_items": 0, "discount": 0, "shipping": 0, "total": 0, "items": []}

    subtotal = sum(i["price"] * i["quantity"] for i in cart_data["items"])
    total_items = sum(i["quantity"] for i in cart_data["items"])
    discount = cart_data.get("discount", 0)
    total = max(0, subtotal - discount)

    return {
        "subtotal": subtotal,
        "total_items": total_items,
        "discount": discount,
        "promo_code": cart_data.get("promo_code"),
        "shipping": 0,
        "total": total,
        "items": cart_data["items"],
    }


# ==================== Customer Profile ====================

@app.get("/api/v1/me/profile", tags=["Customer Profile"])
async def get_customer_profile(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current customer's complete profile with stats."""
    user_id = current_user["user_id"]

    user = db.execute(text(
        "SELECT id, email, username, full_name, phone, role, is_active, created_at "
        "FROM users WHERE id = :id"
    ), {"id": user_id}).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    order_stats = db.execute(text(
        "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = :uid AND status != 'cancelled'"
    ), {"uid": user_id}).fetchone()

    wishlist_count = db.execute(text("SELECT COUNT(*) FROM wishlist WHERE user_id = :uid"), {"uid": user_id}).scalar() or 0
    address_count = db.execute(text("SELECT COUNT(*) FROM addresses WHERE user_id = :uid"), {"uid": user_id}).scalar() or 0
    review_count = db.execute(text("SELECT COUNT(*) FROM reviews WHERE user_id = :uid"), {"uid": user_id}).scalar() or 0

    return {
        "user": {"id": user[0], "email": user[1], "username": user[2], "full_name": user[3], "phone": user[4], "role": str(user[5]), "is_active": user[6], "member_since": str(user[7])},
        "stats": {
            "total_orders": order_stats[0] if order_stats else 0,
            "total_spent": float(order_stats[1]) if order_stats else 0,
            "wishlist_items": wishlist_count,
            "saved_addresses": address_count,
            "reviews_written": review_count,
        }
    }


@app.get("/api/v1/me/order-history", tags=["Customer Profile"])
async def get_order_history(
    status_filter: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get paginated order history with filtering."""
    user_id = current_user["user_id"]
    where = "WHERE o.user_id = :uid"
    params = {"uid": user_id, "lim": limit, "off": skip}
    if status_filter:
        where += " AND o.status = :status"
        params["status"] = status_filter

    rows = db.execute(text(f"""
        SELECT o.id, o.total_amount, o.status, o.created_at,
               (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o {where} ORDER BY o.created_at DESC LIMIT :lim OFFSET :off
    """), params).fetchall()
    total = db.execute(text(f"SELECT COUNT(*) FROM orders o {where}"), params).scalar()

    return {
        "orders": [{"id": r[0], "total_amount": float(r[1]), "status": r[2], "created_at": str(r[3]), "item_count": r[4]} for r in rows],
        "total": total,
        "page": skip // limit + 1,
    }


# ==================== Customer Chat ====================

class ChatConnectionManager:
    def __init__(self):
        # room_id -> list of active connections
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: int):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: int):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: dict, room_id: int):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"WebSocket send error: {e}")

chat_manager = ChatConnectionManager()

@app.websocket("/api/v1/chat/ws/{room_id}")
async def websocket_chat(websocket: WebSocket, room_id: int, token: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    WebSocket endpoint for real-time customer support chat.
    Auth: reads access_token from HttpOnly cookie first, falls back to query param.
    Token in URL is deprecated (leaks into access logs).
    """
    # Prefer cookie-based auth over URL token param (security: URL tokens appear in logs)
    cookie_token = websocket.cookies.get("access_token")
    resolved_token = cookie_token or token

    user = None
    if resolved_token:
        try:
            from shared.auth_middleware import auth_middleware
            if auth_middleware:
                payload = auth_middleware.decode_token(resolved_token)
                user = auth_middleware.extract_user_info(payload)
        except Exception as e:
            logger.warning(f"WebSocket auth failed: {e}")
            
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

        
    user_id = user.get("user_id")
    is_staff = user.get("is_staff", False) or user.get("is_admin", False)

    # Verify room access
    room = db.execute(text("SELECT id, status FROM chat_rooms WHERE id = :rid"), {"rid": room_id}).fetchone()
    if not room:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    # Check authorization
    if not is_staff:
        # User must own the room
        owner = db.execute(text("SELECT customer_id FROM chat_rooms WHERE id = :rid"), {"rid": room_id}).scalar()
        if owner != user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await chat_manager.connect(websocket, room_id)
    try:
        while True:
            raw = await websocket.receive_json()
            msg_text = raw.get("message", "").strip() if isinstance(raw, dict) else str(raw).strip()
            if not msg_text:
                continue

            # Save to DB
            sender_type = "admin" if is_staff else "customer"
            db.execute(text(
                "INSERT INTO chat_messages (room_id, sender_id, sender_type, message) VALUES (:rid, :sid, :stype, :msg)"
            ), {"rid": room_id, "sid": user_id, "stype": sender_type, "msg": msg_text})
            db.execute(text("UPDATE chat_rooms SET updated_at = NOW() WHERE id = :rid"), {"rid": room_id})
            db.commit()
            
            payload = {
                "room_id": room_id,
                "sender_id": user_id,
                "sender_type": sender_type,
                "message": msg_text,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            # Broadcast to all connected clients in this room
            await chat_manager.broadcast(payload, room_id)
            
    except WebSocketDisconnect:
        chat_manager.disconnect(websocket, room_id)


@app.post("/api/v1/chat/rooms", tags=["Customer Chat"])
async def create_chat_room(
    subject: Optional[str] = None,
    order_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new chat room for customer support."""
    user_id = current_user["user_id"]

    # Check for existing open room
    existing = db.execute(text(
        "SELECT id FROM chat_rooms WHERE customer_id = :uid AND status IN ('open', 'assigned') LIMIT 1"
    ), {"uid": user_id}).fetchone()
    if existing:
        return {"room_id": existing[0], "message": "You already have an open chat"}

    result = db.execute(text(
        "INSERT INTO chat_rooms (customer_id, customer_name, customer_email, subject, order_id, status) "
        "VALUES (:uid, :name, :email, :subject, :oid, 'open') RETURNING id"
    ), {"uid": user_id, "name": current_user.get("username"), "email": current_user.get("email"),
        "subject": subject, "oid": order_id})
    room_id = result.scalar()

    # System greeting message
    db.execute(text(
        "INSERT INTO chat_messages (room_id, sender_type, message) "
        "VALUES (:rid, 'system', 'Welcome! A team member will be with you shortly.')"
    ), {"rid": room_id})
    db.commit()

    return {"room_id": room_id, "message": "Chat room created"}


@app.get("/api/v1/chat/rooms/mine", tags=["Customer Chat"])
async def get_my_chat_rooms(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current customer's chat rooms."""
    user_id = current_user["user_id"]
    rows = db.execute(text(
        "SELECT * FROM chat_rooms WHERE customer_id = :uid ORDER BY updated_at DESC"
    ), {"uid": user_id}).fetchall()
    return {"rooms": [dict(r._mapping) for r in rows]}


@app.get("/api/v1/chat/rooms/{room_id}/messages", tags=["Customer Chat"])
async def get_my_chat_messages(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get messages in a chat room (customer view)."""
    user_id = current_user["user_id"]

    # Verify room belongs to this customer
    room = db.execute(text("SELECT id FROM chat_rooms WHERE id = :rid AND customer_id = :uid"),
                      {"rid": room_id, "uid": user_id}).fetchone()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")

    msgs = db.execute(text("SELECT * FROM chat_messages WHERE room_id = :rid ORDER BY created_at ASC"),
                      {"rid": room_id}).fetchall()
    return {"messages": [dict(m._mapping) for m in msgs]}


@app.post("/api/v1/chat/rooms/{room_id}/messages", tags=["Customer Chat"])
async def send_customer_message(
    room_id: int,
    message: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Send a message in a chat room (customer side)."""
    user_id = current_user["user_id"]

    room = db.execute(text("SELECT id, status FROM chat_rooms WHERE id = :rid AND customer_id = :uid"),
                      {"rid": room_id, "uid": user_id}).fetchone()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    if room[1] == "closed":
        raise HTTPException(status_code=400, detail="Chat room is closed")

    db.execute(text(
        "INSERT INTO chat_messages (room_id, sender_id, sender_type, message) VALUES (:rid, :sid, 'customer', :msg)"
    ), {"rid": room_id, "sid": user_id, "msg": message})
    db.execute(text("UPDATE chat_rooms SET updated_at = NOW() WHERE id = :rid"), {"rid": room_id})
    db.commit()
    return {"message": "Message sent"}


# ==================== Public Landing Page ====================

@app.get("/api/v1/landing/config", tags=["Landing Page"])
async def get_landing_page_config(db: Session = Depends(get_db)):
    """Get public landing page configuration (active sections only)."""
    sections = db.execute(text("SELECT section, config FROM landing_config WHERE is_active = true ORDER BY section")).fetchall()
    images = db.execute(text("SELECT section, image_url, title, subtitle, link_url, display_order FROM landing_images WHERE is_active = true ORDER BY section, display_order")).fetchall()

    config = {}
    for s in sections:
        config[s[0]] = s[1]

    image_map = {}
    for i in images:
        if i[0] not in image_map:
            image_map[i[0]] = []
        image_map[i[0]].append({"image_url": i[1], "title": i[2], "subtitle": i[3], "link_url": i[4], "display_order": i[5]})

    return {"sections": config, "images": image_map}


@app.get("/api/v1/landing/featured", tags=["Landing Page"])
async def get_featured_data(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get featured products, categories, and new arrivals for the landing page."""
    from sqlalchemy.orm import selectinload, joinedload
    
    user_role = current_user.get("role") if current_user else None

    featured_products = db.query(Product).options(
        joinedload(Product.category),
        selectinload(Product.images),
        selectinload(Product.inventory),
    ).filter(
        Product.is_active == True, Product.is_featured == True
    ).order_by(Product.created_at.desc()).limit(12).all()

    new_arrivals = db.query(Product).options(
        joinedload(Product.category),
        selectinload(Product.images),
        selectinload(Product.inventory),
    ).filter(
        Product.is_active == True, Product.is_new_arrival == True
    ).order_by(Product.created_at.desc()).limit(12).all()

    featured_categories = db.query(Category).filter(
        Category.is_active == True, Category.is_featured == True
    ).all()

    return {
        "featured_products": [_enrich_product(p, user_role) for p in featured_products],
        "new_arrivals": [_enrich_product(p, user_role) for p in new_arrivals],
        "featured_categories": [_enrich_collection(c) for c in featured_categories],
    }


@app.get("/api/v1/landing/all", tags=["Landing Page"])
async def get_landing_all(db: Session = Depends(get_db)):
    """Get all landing page data in a single request (config, images, featured data)."""
    # Try cache first
    cached = redis_client.get_cache("public:landing:all")
    if cached:
        # Return cached data with headers to prevent browser caching
        response = JSONResponse(content=cached)
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
        
    result = {
        "hero": {"config": {}, "images": []},
        "newArrivals": {"config": {}, "products": []},
        "collections": {"config": {}, "collections": []},
        "about": {"config": {}, "images": []}
    }
    
    try:
        # 1. Get configs for all sections
        configs = db.execute(text("SELECT section, config FROM landing_config WHERE is_active = true")).fetchall()
        for c in configs:
            if c[0] in result:
                result[c[0]]["config"] = c[1] if isinstance(c[1], dict) else json.loads(c[1] if c[1] else '{}')
                
        # 2. Get images for hero and about sections
        images = db.execute(text("SELECT id, section, image_url, title, subtitle, link_url, device_variant FROM landing_images WHERE is_active = true ORDER BY display_order")).fetchall()
        for img in images:
            img_data = {
                "id": img[0], "url": img[2], "title": img[3], "subtitle": img[4], 
                "link": img[5], "device": img[6]
            }
            if img[1] in ["hero", "about"] and img[1] in result:
                result[img[1]]["images"].append(img_data)
                
        # 3. Get featured products for newArrivals
        products = db.execute(text("""
            SELECT p.id, p.name, p.slug, p.description, p.base_price, p.mrp, p.is_new_arrival, 
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as primary_image
            FROM landing_products lp
            JOIN products p ON p.id = lp.product_id
            WHERE lp.section = 'newArrivals' AND lp.is_active = true AND p.is_active = true
            ORDER BY lp.display_order
        """)).fetchall()
        
        result["newArrivals"]["products"] = [{
            "id": p[0], "name": p[1], "slug": p[2], "description": p[3],
            "price": float(p[4]), "compareAtPrice": float(p[5]) if p[5] else None,
            "isNew": p[6], "image": p[7]
        } for p in products]
        
        # 4. Get featured collections
        collections = db.execute(text("""
            SELECT id, name, slug, description, image_url
            FROM collections
            WHERE is_active = true AND is_featured = true
            ORDER BY display_order
        """)).fetchall()

        result["collections"]["collections"] = [{
            "id": c[0], "name": c[1], "slug": c[2], "description": c[3],
            "image": c[4]
        } for c in collections]
        
        # 5. Get site config for landing page
        site_config = db.execute(text("SELECT key, value FROM site_config")).fetchall()
        config_dict = {r[0]: r[1] for r in site_config}
        
        from core.config import settings as core_settings
        r2_public = getattr(core_settings, "R2_PUBLIC_URL", "") or ""
        
        result["site"] = {
            "logo": config_dict.get("logo_url") or (f"{r2_public}/logo.png" if r2_public else "/logo.png"),
            "video": {
                "intro": config_dict.get("intro_video_url") or (f"{r2_public}/Create_a_video_202602141450_ub9p5.mp4" if r2_public else "/Create_a_video_202602141450_ub9p5.mp4"),
                "enabled": config_dict.get("intro_video_enabled", "true").lower() == "true"
            },
            "brand_name": config_dict.get("brand_name", "Aarya Clothing")
        }
        
        # Cache for 60 seconds (reduced from 300 for faster updates)
        redis_client.set_cache("public:landing:all", result, ttl=60)
        
        # Return with cache-control headers to prevent browser caching
        response = JSONResponse(content=result)
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
        
    except Exception as e:
        logger.error(f"Error fetching landing data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch landing data")


# ==================== Exchange Requests ====================

@app.post("/api/v1/returns/{return_id}/exchange", tags=["Returns"])
async def request_exchange(
    return_id: int,
    exchange_product_id: int,
    exchange_variant_id: Optional[int] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Convert a return request into an exchange request."""
    user_id = current_user["user_id"]

    ret = db.execute(text(
        "SELECT id, status, user_id, order_id FROM return_requests WHERE id = :rid"
    ), {"rid": return_id}).fetchone()

    if not ret:
        raise HTTPException(status_code=404, detail="Return request not found")
    if ret[2] != user_id:
        raise HTTPException(status_code=403, detail="Not your return request")
    if ret[1] not in ("requested", "approved"):
        raise HTTPException(status_code=400, detail="Return cannot be converted to exchange")

    # Validate exchange product exists and is active
    product = db.query(Product).filter(Product.id == exchange_product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Exchange product not found")

    # Validate variant belongs to product if variant_id provided
    if exchange_variant_id:
        from models.inventory import Inventory as InventoryModel
        variant = db.query(InventoryModel).filter(
            InventoryModel.id == exchange_variant_id,
            InventoryModel.product_id == exchange_product_id,
            InventoryModel.is_active == True
        ).first()
        if not variant:
            raise HTTPException(status_code=404, detail="Exchange variant not found or doesn't belong to product")
        
        # Check variant stock availability
        available = (variant.quantity or 0) - (variant.reserved_quantity or 0)
        if available <= 0:
            raise HTTPException(status_code=400, detail="Exchange variant is out of stock")
    else:
        # Check product stock via inventory aggregation
        from models.inventory import Inventory as InventoryModel
        total = db.execute(
            text("SELECT COALESCE(SUM(quantity - reserved_quantity), 0) FROM inventory WHERE product_id = :pid AND is_active = true"),
            {"pid": exchange_product_id}
        ).scalar()
        if (total or 0) <= 0:
            raise HTTPException(status_code=400, detail="Exchange product is out of stock")

    # Validate exchange policy (same price or higher value)
    # Get original order item to compare prices - using order_id from return_requests
    order_id = ret[3]  # order_id from return_requests
    original_items = db.execute(text("""
        SELECT product_id, inventory_id, unit_price
        FROM order_items
        WHERE order_id = :oid
    """), {"oid": order_id}).fetchall()
    
    if original_items:
        # Get exchange item price
        if exchange_variant_id:
            exchange_price = db.execute(text("""
                SELECT COALESCE(variant_price, 0) FROM inventory
                WHERE id = :vid AND product_id = :pid
            """), {"vid": exchange_variant_id, "pid": exchange_product_id}).fetchone()
            exchange_price = float(exchange_price[0]) if exchange_price and exchange_price[0] else float(product.base_price or 0)
        else:
            exchange_price = float(product.base_price or 0)
        
        # Use the first item's price for comparison (or sum all items)
        original_price = sum(float(item[2]) for item in original_items)
        
        # Allow exchange only if price difference is reasonable (within 20% or higher value)
        if exchange_price < original_price * 0.8:
            raise HTTPException(
                status_code=400, 
                detail=f"Exchange item value too low. Original: ${original_price:.2f}, Exchange: ${exchange_price:.2f}"
            )

    # Update the return request with exchange info
    db.execute(text(
        "UPDATE return_requests SET description = CONCAT(COALESCE(description, ''), ' | Exchange to product #', :pid, '. ', :notes) WHERE id = :rid"
    ), {"pid": exchange_product_id, "notes": notes or '', "rid": return_id})
    db.commit()
    return {"message": "Exchange request submitted", "return_id": return_id, "exchange_product_id": exchange_product_id}


# ==================== About / Static Pages ====================

@app.get("/api/v1/pages/about", tags=["Pages"])
async def get_about_page(db: Session = Depends(get_db)):
    """Get about page content from landing config."""
    config = db.execute(text("SELECT config FROM landing_config WHERE section = 'about' AND is_active = true")).fetchone()
    return {"content": config[0] if config else {
        "brand_name": "Aarya Clothing",
        "tagline": "Elevate Your Style",
        "description": "Premium ethnic wear for the modern woman.",
        "founded_year": 2024,
    }}


@app.get("/api/v1/pages/contact", tags=["Pages"])
async def get_contact_info(db: Session = Depends(get_db)):
    """Get contact information."""
    config = db.execute(text("SELECT config FROM landing_config WHERE section = 'contact' AND is_active = true")).fetchone()
    return {"content": config[0] if config else {
        "email": "support@aaryaclothing.cloud",
        "phone": "+91-XXXXXXXXXX",
        "address": "India",
    }}


# ==================== Run Server ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5002,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )


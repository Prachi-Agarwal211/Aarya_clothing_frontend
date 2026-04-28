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
- Reviews and ratings
- Address management
- Returns and refunds
"""

import logging
import asyncio
import os
from contextlib import asynccontextmanager
from shared.time_utils import now_ist
from starlette.concurrency import run_in_threadpool
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    Request,
    UploadFile,
    File,
    Query,
)
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel
import json

logger = logging.getLogger(__name__)

from core.config import settings
from core.redis_client import redis_client
from core.advanced_cache import cache, cached
from database.database import get_db, init_db, SessionLocal, get_db_context
from search.meilisearch_client import (
    init_products_index,
    sync_all_products,
    search_products as meili_search_products,
    index_product as meili_index_product,
    delete_product as meili_delete_product,
)

# Models
from models.product import Product
from models.product_image import ProductImage
from models.inventory import Inventory
from models.order import Order, OrderItem, OrderStatus
from models.order_tracking import OrderTracking

# Schemas
from schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductDetailResponse,
    BulkPriceUpdate,
    BulkStatusUpdate,
    BulkCollectionAssign,
    BulkInventoryUpdate,
    BulkDeleteProducts,
)
from schemas.product_image import ProductImageCreate, ProductImageResponse
from schemas.inventory import (
    InventoryCreate,
    InventoryUpdate,
    InventoryResponse,
    StockAdjustment,
    LowStockItem,
)
from schemas.order import OrderCreate, OrderResponse
from schemas.error import ErrorResponse, PaginatedResponse

# Services
from service.inventory_service import InventoryService
from service.r2_service import r2_service
from service.color_utils import _hex_to_color_name
from service.product_service import ProductService
from service.order_service import OrderService
from service.order_tracking_service import OrderTrackingService

# Route modules (for better code organization)
# These modularize the 2800+ line main.py into manageable route files
try:
    from routes import (
        addresses_router,
        cart_router,
        chat_router,
        collections_router,
        customer_orders_router,
        internal_router,
        landing_router,
        orders_router,
        products_router,
        profile_router,
        returns_router,
        reviews_router,
        search_router,
        size_guide_router,
    )

    ROUTES_AVAILABLE = True
except ImportError:
    ROUTES_AVAILABLE = False
    # Fallback to monolithic routes in main.py
    pass

# Cart locking primitives now live in core.cart_lock and are imported by routes/cart.py.


# R2 URL + product/collection enrichment now live in helpers.py.
# Aliased here with the legacy underscore names so existing call sites keep working.
from helpers import (  # noqa: E402
    enrich_collection as _enrich_collection,
    enrich_product as _enrich_product,
    is_hex_color as _is_hex_color,
    r2_url as _r2_url,
)

# Middleware
from shared.auth_middleware import (
    get_current_user,
    get_current_user_optional,
    require_admin,
    require_staff,
    initialize_auth_middleware,
)
from shared.roles import is_staff
from shared.request_id_middleware import RequestIDMiddleware


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


async def _reservation_reconciler(
    stop_event: asyncio.Event, interval_seconds: int = 600
):
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

from rate_limit import check_rate_limit as _check_rate_limit  # noqa: E402, F401


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
        redis_client=redis_client,
    )

    # Ensure Redis connects
    if redis_client.is_connected():
        logger.info("Redis connected for Commerce service")
    else:
        logger.warning("Redis ping failed")

    # Start background reservation reconciler
    stop_event = asyncio.Event()
    task = asyncio.create_task(_reservation_reconciler(stop_event))

    # Start background email worker (fire-and-forget outbox processor)
    from jobs.email_worker import start_worker as start_email_worker
    import threading

    email_stop_event = threading.Event()
    email_thread = threading.Thread(
        target=start_email_worker,
        args=(email_stop_event, 60),  # poll_interval=60s
        daemon=True,
        name="email-worker",
    )
    email_thread.start()
    app.state.email_stop_event = email_stop_event  # For graceful shutdown
    logger.info("✓ Email worker started")

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

    # Sync invoice sequence to prevent collisions after data migrations/restores
    try:
        db = SessionLocal()
        try:
            from service.order_service import sync_invoice_sequence

            sync_invoice_sequence(db)
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"⚠ Could not sync invoice sequence on startup: {e}")

    yield

    # Shutdown
    logger.info("Commerce service shutting down")

    # Stop email worker gracefully
    try:
        if hasattr(app.state, "email_stop_event"):
            app.state.email_stop_event.set()
            logger.info("Email worker stop signal sent")
    except Exception as e:
        logger.warning(f"Failed to stop email worker: {e}")


# ==================== FastAPI App ====================

_env = os.environ.get("ENVIRONMENT", "production")
app = FastAPI(
    title="Aarya Clothing - Commerce Service",
    description="Product Management, Categories, Cart, Orders, Inventory",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _env != "production" else None,
    redoc_url="/redoc" if _env != "production" else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "X-CSRF-Token",
    ],
)

# Prometheus metrics — /metrics endpoint for scraping
try:
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except Exception:
    pass  # Graceful degradation if prometheus lib is missing

# Request ID
app.add_middleware(RequestIDMiddleware)

# Register route modules. Customer SSE/track/checkout flows use ``customer_orders_router``;
# ``orders_router`` owns POST/GET /api/v1/orders, invoices, and internal payment webhooks.
if ROUTES_AVAILABLE:
    app.include_router(products_router)
    app.include_router(cart_router)
    app.include_router(addresses_router)
    app.include_router(size_guide_router)
    app.include_router(chat_router)
    app.include_router(landing_router)
    app.include_router(internal_router)
    app.include_router(reviews_router)
    app.include_router(returns_router)
    app.include_router(collections_router)
    app.include_router(search_router)
    app.include_router(profile_router)
    app.include_router(orders_router)
    app.include_router(customer_orders_router)
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
        "timestamp": now_ist().isoformat(),
        "dependencies": {"redis": redis_status, "database": db_status},
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
        "timestamp": now_ist().isoformat(),
        "dependencies": {"redis": redis_status, "database": db_status},
    }


# Public + admin collection endpoints have moved to routes/collections.py.
# Storefront search-suggestions endpoint has moved to routes/search.py.


# ==================== Order Routes ====================

# Customer order endpoints have moved to routes/customer_orders.py.


# Internal service-to-service routes have been moved to routes/internal.py.


# Address endpoints have moved to routes/addresses.py.

# Reviews + returns endpoints have moved to routes/reviews.py and routes/returns.py.


# /api/v1/products/* endpoints (including /related, /browse, /search, etc.)
# live in routes/products.py.


# Legacy /cart/{user_id}/update-quantity and /summary endpoints have been moved to routes/cart.py.


# Customer profile endpoints have moved to routes/profile.py.


# Customer chat endpoints have been moved to routes/chat.py.


# Landing-page endpoints have been moved to routes/landing.py.


# Exchange endpoint has moved to routes/returns.py.


# About / Contact page endpoints have moved to routes/landing.py.


# ==================== Run Server ====================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5002,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )

"""Aarya Clothing — Admin & Staff Service (Port 8004).

Thin composition root: builds the FastAPI app, wires middleware, runs the
lifespan (database, Redis, event bus, AI provider check), and mounts every
admin/staff router from ``routes/``. All HTTP endpoints live in their own
module; only ``/health`` and ``/metrics`` are defined inline.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.exception_handler import setup_exception_handlers
from core.redis_client import redis_client
from database.database import get_db, init_db
from service.event_handlers import OrderCreatedHandler
from shared.auth_middleware import initialize_auth_middleware
from shared.error_responses import register_error_handlers
from shared.event_bus import EventBus
from shared.request_id_middleware import RequestIDMiddleware

logger = logging.getLogger(__name__)

# Global instances
event_bus = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global event_bus
    logger.info(f"Starting {settings.SERVICE_NAME}...")
    init_db()

    # Initialize auth middleware
    initialize_auth_middleware(
        secret_key=settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
        redis_client=redis_client,
    )

    # Ensure Redis connects and pub/sub is active
    if redis_client.is_connected():
        logger.info("Redis connected for Admin service")
    else:
        logger.warning("Redis connection failed for Admin service")

    # Initialize Event Bus
    event_bus = EventBus(redis_client=redis_client, service_name="admin_service")

    # Register event handlers
    order_handler = OrderCreatedHandler()
    event_bus.register_handler(order_handler)

    # Validate AI provider config at startup (no network call — avoids blocking startup)
    from service.ai_service import _get_active_provider
    try:
        provider = _get_active_provider()
        if not provider.get("key") or not provider.get("base_url"):
            raise ValueError("Provider key or base_url missing")
        logger.info(f"AI service ready (Provider: {provider['name']}, Model: {provider['model']})")
    except ValueError as e:
        logger.warning(f"AI service disabled: {e}")
    except Exception as e:
        logger.warning(f"AI provider config check failed: {e}. AI features may not work.")

    yield

    # Cleanup event bus history on shutdown
    if event_bus:
        event_bus.clear_history()

    logger.info(f"Shutting down {settings.SERVICE_NAME}...")


_env = os.environ.get("ENVIRONMENT", "production")
app = FastAPI(
    title="Aarya Clothing - Admin & Staff Service",
    description="Dashboard, Analytics, Order/Inventory Management, Chat, Landing Config",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _env != "production" else None,
    redoc_url="/redoc" if _env != "production" else None,
)

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

# Prometheus metrics — /metrics endpoint for scraping.
# If fastapi-instrumentator is unavailable, expose a basic endpoint so
# Prometheus scraping does not fail with 404.
try:
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except Exception as exc:
    logger.warning("Prometheus instrumentator unavailable in admin service: %s", exc)
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

    @app.get("/metrics")
    async def metrics_fallback():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Request ID
app.add_middleware(RequestIDMiddleware)

# Standardized error handlers (complements admin's own exception handler)
register_error_handlers(app)

# Mount routers. Each router owns one cohesive slice of the admin API so this
# file stays focused on lifespan + middleware wiring.
from routes import (
    ai_router,
    analytics_router,
    backup_router,
    chat_router,
    collections_router,
    dashboard_router,
    excel_router,
    inventory_router,
    landing_admin_router,
    landing_public_router,
    orders_router,
    products_router,
    returns_router,
    reviews_router,
    site_config_router,
    staff_access_control_router,
    staff_ai_dashboard_router,
    staff_management_router,
    staff_ops_router,
    uploads_router,
    users_router,
)

app.include_router(staff_ai_dashboard_router)
app.include_router(staff_management_router)
app.include_router(staff_access_control_router)
app.include_router(reviews_router)
app.include_router(returns_router)
app.include_router(backup_router)
app.include_router(dashboard_router)
app.include_router(staff_ops_router)
app.include_router(chat_router)
app.include_router(site_config_router)
app.include_router(uploads_router)
app.include_router(users_router)
app.include_router(orders_router)
app.include_router(analytics_router)
app.include_router(excel_router)
app.include_router(inventory_router)
app.include_router(ai_router)
app.include_router(landing_admin_router)
app.include_router(landing_public_router)
app.include_router(products_router)
app.include_router(collections_router)


# ==================== Health ====================


@app.get("/health", tags=["Health"])
async def health_root(db: Session = Depends(get_db)):
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "admin",
        "db": db_status,
    }


setup_exception_handlers(app)

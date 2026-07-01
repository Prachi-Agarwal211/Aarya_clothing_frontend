"""
Customer cart router.

Owns every read/write on the shopping cart, including:

* Token-based endpoints (`/api/v1/cart/...`) — the primary surface used by the
  storefront. They derive `user_id` from the JWT, lock through
  ``CartConcurrencyManager``, and validate stock on the way in.
* Legacy `/api/v1/cart/{user_id}/...` endpoints — kept for backward
  compatibility with older clients, with explicit ownership checks.
* The Server-Sent Events `cart/stock-stream` endpoint that pushes per-item
  stock availability so the checkout button can react in real time.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from shared.time_utils import now_ist

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from core.redis_client import redis_client
from database.database import get_db, SessionLocal
from models.inventory import Inventory
from models.product import Product
from rate_limit import check_rate_limit
from schemas.order import CartItem, CartResponse
from core.cart_lock import CartConcurrencyManager
from service.cart_service import CartService
from shared.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Cart"])


class CartItemUpdate(BaseModel):
    """Body for ``PUT /api/v1/cart/items/{product_id}``."""

    quantity: int
    variant_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Token-based endpoints (preferred)
# ---------------------------------------------------------------------------

@router.get("/api/v1/cart", response_model=CartResponse)
async def get_my_cart(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return the cart belonging to the authenticated user."""
    user_id = current_user["user_id"]
    cart_service = CartService(db)
    cart_data = cart_service.get_cart(user_id)
    return CartResponse(**cart_data)


@router.post("/api/v1/cart/items", response_model=CartResponse)
async def add_to_my_cart(
    item: CartItem,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Add an item to the authenticated user's cart, validating stock first."""
    if not check_rate_limit(request, "cart_add", limit=100, window=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many cart operations. Please try again later.",
        )

    user_id = current_user["user_id"]

    # Stock and product validation is handled by CartService.add_to_cart() —
    # no need to duplicate those DB queries in the route layer.
    item_data = {
        "product_id": item.product_id,
        "variant_id": item.variant_id,
        "quantity": item.quantity,
    }
    cart_data = CartConcurrencyManager.add_to_cart_locked(user_id, item_data, db)
    return CartResponse(**cart_data)


@router.put("/api/v1/cart/items/{product_id}", response_model=CartResponse)
async def update_my_cart_item(
    product_id: int,
    body: CartItemUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Set the quantity for an item already in the cart."""
    if body.quantity < 1:
        raise HTTPException(status_code=400, detail="quantity must be >= 1")
    user_id = current_user["user_id"]
    cart_data = CartConcurrencyManager.update_cart_item_locked(
        user_id, product_id, body.quantity, db, body.variant_id
    )
    return CartResponse(**cart_data)


@router.delete("/api/v1/cart/items/{product_id}", response_model=CartResponse)
async def remove_from_my_cart(
    product_id: int,
    variant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Remove a single item (optionally a specific variant) from the cart."""
    user_id = current_user["user_id"]
    cart_data = CartConcurrencyManager.remove_from_cart_locked(
        user_id, product_id, db, variant_id
    )
    return CartResponse(**cart_data)


@router.delete("/api/v1/cart", response_model=CartResponse)
async def clear_my_cart(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Wipe the cart for the authenticated user and release its reservations."""
    user_id = current_user["user_id"]
    cart_data = CartConcurrencyManager.clear_cart_locked(user_id, db)
    return CartResponse(**cart_data)


@router.post("/api/v1/cart/shipping-address", response_model=CartResponse)
async def update_cart_shipping_address(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update shipping address in cart - needed for order creation fallback."""
    from pydantic import BaseModel
    
    class ShippingAddressUpdate(BaseModel):
        shipping_address: str
    
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    shipping_address = body.get("shipping_address", "")
    user_id = current_user["user_id"]
    
    cart_service = CartService(db)
    cart = cart_service.update_shipping_address(user_id, shipping_address)
    return CartResponse(**cart)


# clear-expired endpoint removed — reservations system was removed.
# Stock is checked and deducted at checkout time only.


# ---------------------------------------------------------------------------
# Real-time stock stream (Server-Sent Events)
# ---------------------------------------------------------------------------

_STOCK_STREAM_MAX_RUNTIME_SECONDS = 3600  # 1 hour cap per connection


@router.get("/api/v1/cart/stock-stream")
async def cart_stock_stream(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Push live stock updates for the items currently in the cart over SSE.

    The connection ends when the client disconnects or after a hard one-hour
    cap, whichever comes first.
    """
    user_id = current_user["user_id"]
    cart_service = CartService(db)
    start_time = asyncio.get_event_loop().time()

    async def event_generator():
        # NOTE: We create a fresh SessionLocal() per iteration because the
        # request-scoped `db` session will go stale over the long-lived SSE
        # connection (up to 1 hour). SessionLocal() draws from the connection
        # pool and is fully thread/async-safe.
        while True:
            if await request.is_disconnected():
                logger.debug(f"Client disconnected from stock stream for user {user_id}")
                break

            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > _STOCK_STREAM_MAX_RUNTIME_SECONDS:
                logger.debug(f"Max runtime exceeded for stock stream user {user_id}")
                yield f"data: {json.dumps({'type': 'timeout', 'message': 'Connection timeout'})}\n\n"
                break

            try:
                cart = cart_service.get_cart(user_id)

                if cart["items"]:
                    # Batch all SKU lookups into a single query (was N separate
                    # queries per item — caused pgbouncer pressure + stale sessions).
                    skus = [item.get("sku") for item in cart["items"] if item.get("sku")]
                    stock_map = {}
                    if skus:
                        fresh_db = SessionLocal()
                        try:
                            placeholders = ", ".join(":sku" + str(i) for i in range(len(skus)))
                            params = {f"sku{i}": s for i, s in enumerate(skus)}
                            rows = fresh_db.execute(
                                text(
                                    f"SELECT sku, quantity, reserved_quantity "
                                    f"FROM inventory WHERE sku IN ({placeholders})"
                                ),
                                params,
                            ).fetchall()
                            stock_map = {
                                row.sku: max(0, row.quantity - row.reserved_quantity)
                                for row in rows
                            }
                        finally:
                            fresh_db.close()

                    stock_updates = []
                    for item in cart["items"]:
                        sku = item.get("sku")
                        available = stock_map.get(sku, 0)
                        stock_updates.append(
                            {
                                "product_id": item["product_id"],
                                "variant_id": item.get("variant_id"),
                                "sku": sku,
                                "available_quantity": available,
                                "requested_quantity": item["quantity"],
                                "in_stock": available >= item["quantity"],
                            }
                        )

                    event_data = {
                        "type": "stock_update",
                        "timestamp": now_ist().isoformat(),
                        "items": stock_updates,
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"

                await asyncio.sleep(30)
                yield ":keepalive\n\n"

            except ConnectionResetError:
                logger.debug(f"Connection reset for stock stream user {user_id}")
                break
            except TimeoutError:
                logger.warning(f"Database timeout in stock stream for user {user_id}")
                yield f"data: {json.dumps({'type': 'error', 'message': 'Database timeout'})}\n\n"
                await asyncio.sleep(60)
            except Exception as exc:
                logger.error(
                    f"Unexpected error in stock stream for user {user_id}: {exc}",
                    exc_info=True,
                )
                yield f"data: {json.dumps({'type': 'error', 'message': 'Internal server error'})}\n\n"
                await asyncio.sleep(60)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Checkout pre-flight
# ---------------------------------------------------------------------------

@router.post("/api/v1/checkout/validate", tags=["Checkout"])
async def validate_checkout(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Validate cart stock before payment.

    Always returns HTTP 200 with a structured payload so the storefront can
    treat ``out_of_stock`` as data, not a transport error.
    """
    cart_service = CartService(db)
    return cart_service.checkout_stock_preview(current_user["user_id"])


# ---------------------------------------------------------------------------
# Legacy `/cart/{user_id}/...` endpoints
# ---------------------------------------------------------------------------

def _ensure_owner_or_staff(current_user: dict, user_id: int) -> None:
    """Reject cross-user access from non-staff callers."""
    if (
        current_user["user_id"] != user_id
        and current_user.get("role") not in ("admin", "staff")
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this cart",
        )


@router.get("/api/v1/cart/{user_id}", response_model=CartResponse)
async def get_cart(
    user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Read the raw Redis cart for *user_id* (legacy fast-path used by ops tools)."""
    _ensure_owner_or_staff(current_user, user_id)

    cart_data = redis_client.get_cache(f"cart:{user_id}")
    if not cart_data:
        return CartResponse(user_id=user_id, items=[], total=0)
    return CartResponse(**cart_data)


@router.post("/api/v1/cart/{user_id}/add", response_model=CartResponse)
async def add_to_cart(
    user_id: int,
    item: CartItem,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Legacy add-to-cart that takes ``user_id`` in the path."""
    _ensure_owner_or_staff(current_user, user_id)

    product = db.query(Product).filter(Product.id == item.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    if product.total_stock < item.quantity:
        # NOTE: total_stock is denormalized and may be stale.
        # The real stock check happens in CartService.add_to_cart().
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient inventory",
        )

    item_data = {
        "product_id": item.product_id,
        "variant_id": item.variant_id,
        "quantity": item.quantity,
    }
    cart_data = CartConcurrencyManager.add_to_cart_locked(user_id, item_data, db)
    return CartResponse(**cart_data)


@router.delete(
    "/api/v1/cart/{user_id}/remove/{product_id}",
    response_model=CartResponse,
)
async def remove_from_cart(
    user_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Legacy remove-from-cart that takes ``user_id`` in the path."""
    _ensure_owner_or_staff(current_user, user_id)
    cart_data = CartConcurrencyManager.remove_from_cart_locked(user_id, product_id, db)
    return CartResponse(**cart_data)


@router.delete("/api/v1/cart/{user_id}/clear", response_model=CartResponse)
async def clear_cart(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Legacy clear-cart that takes ``user_id`` in the path."""
    _ensure_owner_or_staff(current_user, user_id)
    cart_data = CartConcurrencyManager.clear_cart_locked(user_id, db)
    return CartResponse(**cart_data)


@router.put(
    "/api/v1/cart/{user_id}/update-quantity",
    response_model=CartResponse,
)
async def update_cart_quantity(
    user_id: int,
    product_id: int,
    quantity: int = Query(ge=1),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Legacy update-quantity endpoint with ``user_id`` and ``product_id`` in the path."""
    _ensure_owner_or_staff(current_user, user_id)
    cart_data = CartConcurrencyManager.update_cart_item_locked(
        user_id, product_id, quantity, db
    )
    return CartResponse(**cart_data)


@router.get("/api/v1/cart/{user_id}/summary")
async def cart_summary(
    user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Lightweight totals view straight from Redis — no DB hit."""
    _ensure_owner_or_staff(current_user, user_id)
    cart_data = redis_client.get_cache(f"cart:{user_id}")

    if not cart_data or not cart_data.get("items"):
        return {
            "subtotal": 0,
            "total_items": 0,
            "shipping": 0,
            "total": 0,
            "items": [],
        }

    subtotal = sum(i["price"] * i["quantity"] for i in cart_data["items"])
    total_items = sum(i["quantity"] for i in cart_data["items"])

    return {
        "subtotal": subtotal,
        "total_items": total_items,
        "shipping": 0,
        "total": subtotal,
        "items": cart_data["items"],
    }

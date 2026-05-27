"""
Customer-facing order router.

Owns the storefront order surface:

* Create / list / fetch / cancel orders for the authenticated user.
* Guest order tracking via signed token (no auth).
* Order tracking history.
* Server-Sent Events stream for live status updates.

Admin order endpoints (payment recovery, bulk status, POD/Excel, etc.)
intentionally stay in ``main.py`` until they migrate to the admin
service in Phase 2C.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session, joinedload
from starlette.responses import StreamingResponse

from core.redis_client import redis_client
from database.database import get_db
from models.order import Order
from rate_limit import check_rate_limit
from schemas.order import (
    GuestOrderTrackItem,
    GuestOrderTrackResponse,
    OrderCreate,
    OrderResponse,
)
from schemas.order_tracking import OrderTrackingResponse
from service.guest_tracking_token import parse_guest_tracking_token
from service.order_service import OrderService
from service.order_tracking_service import OrderTrackingService
from shared.auth_middleware import get_current_user
from shared.event_bus import Event, EventType

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Orders"])


@router.post(
    "/api/v1/orders",
    status_code=status.HTTP_202_ACCEPTED,
)
async def register_payment(
    order_data: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Register a successful payment and snapshot the cart for async order creation.

    This endpoint does NOT create the order — it verifies the payment signature,
    snapshots the cart as a pending order, and returns immediately.

    The actual order is created asynchronously by the Razorpay webhook handler.
    The frontend should poll ``GET /api/v1/orders/by-payment/{payment_id}``
    until the order appears (typically within 2–15 seconds).

    Rate-limited to 10 registration attempts per user per minute.
    """
    if not check_rate_limit(
        request,
        "order_create",
        limit=10,
        window=60,
        user_identifier=str(current_user["user_id"]),
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later.",
        )

    order_service = OrderService(db)
    result = order_service.register_payment(
        user_id=current_user["user_id"],
        transaction_id=order_data.transaction_id or order_data.payment_id,
        razorpay_order_id=order_data.razorpay_order_id,
        payment_signature=order_data.razorpay_signature,
        address_id=order_data.address_id,
        order_notes=order_data.notes or order_data.order_notes,
        pending_order_id=order_data.pending_order_id,
        qr_code_id=order_data.qr_code_id,
    )

    # If order already existed (webhook processed first), return 200 with order
    if result["status"] == "order_exists":
        return {"status": "success", "order": result["order"]}

    return {
        "status": "payment_registered",
        "payment_id": result["payment_id"],
        "pending_order_id": result["pending_order_id"],
    }


@router.get(
    "/api/v1/orders/by-payment/{payment_id}",
    response_model=Optional[OrderResponse],
)
async def get_order_by_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Polling endpoint: returns the order created for a payment, or null.

    Called by the checkout confirmation page after registering a payment.
    Returns the full order once the webhook creates it, or ``{"found": false}``
    if the webhook hasn't processed the payment yet.
    """
    order_service = OrderService(db)
    order = order_service.find_order_by_payment(
        user_id=current_user["user_id"],
        payment_id=payment_id,
    )
    if order:
        return order
    return {"found": False, "payment_id": payment_id}


@router.get("/api/v1/orders", response_model=List[OrderResponse])
async def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List the authenticated user's orders, newest first."""
    order_service = OrderService(db)
    return order_service.get_user_orders(
        user_id=current_user["user_id"],
        skip=skip,
        limit=limit,
    )


@router.get(
    "/api/v1/orders/track/{token}",
    response_model=GuestOrderTrackResponse,
)
async def get_guest_order_by_tracking_token(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Public guest-tracking endpoint. The token is HMAC-signed by the order
    service so we can confirm provenance without a login.

    Registered before the integer ``/orders/{order_id}`` route so FastAPI
    does not parse ``"track"`` as the int path param.
    """
    order_id = parse_guest_tracking_token(token)
    if order_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired tracking link",
        )
    order = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    items_out = [
        GuestOrderTrackItem(
            product_name=it.product_name,
            size=it.size,
            color=it.color,
            quantity=int(it.quantity),
            price=float(it.price) if it.price is not None else float(it.unit_price or 0),
        )
        for it in (order.items or [])
    ]
    return GuestOrderTrackResponse(
        order_id=order.id,
        status=order.status.value if hasattr(order.status, "value") else str(order.status),
        tracking_number=order.tracking_number,
        total_amount=float(order.total_amount),
        created_at=order.created_at,
        items=items_out,
    )


@router.get("/api/v1/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetch an order, scoped to the authenticated user."""
    order_service = OrderService(db)
    order = order_service.get_order_by_id(order_id, user_id=current_user["user_id"])
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return order


@router.post(
    "/api/v1/orders/{order_id}/cancel",
    response_model=OrderResponse,
)
async def cancel_order(
    order_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cancel an order belonging to the authenticated user."""
    order_service = OrderService(db)
    return order_service.cancel_order(
        order_id=order_id,
        user_id=current_user["user_id"],
        reason=reason,
    )


@router.get(
    "/api/v1/orders/{order_id}/tracking",
    response_model=List[OrderTrackingResponse],
)
async def get_order_tracking(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return the tracking history for one of the caller's orders."""
    order_service = OrderService(db)
    order = order_service.get_order_by_id(order_id, user_id=current_user["user_id"])
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    tracking_service = OrderTrackingService(db)
    return tracking_service.get_order_tracking(order_id)


@router.get("/api/v1/orders/{order_id}/events")
async def order_status_events(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Server-Sent Events stream for live order-status updates.

    Subscribes to the Redis pub/sub channel ``order_updates:{order_id}``;
    when staff change the status, the event is forwarded to the client
    immediately. Owners or staff/admin only.

    Heartbeats every ~30 seconds keep proxies from timing out idle
    connections.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    is_staff = current_user.get("is_staff", False) or current_user.get("is_admin", False)
    if order.user_id != current_user.get("user_id") and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this order's events",
        )

    if not redis_client.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Real-time updates unavailable. Please try again later.",
        )

    async def event_generator():
        pubsub = redis_client.client.pubsub()
        channel = f"order_updates:{order_id}"
        pubsub.subscribe(channel)
        try:
            yield f'event: connected\ndata: {{"order_id": {order_id}}}\n\n'
            heartbeat_counter = 0
            while True:
                message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"event: status_update\ndata: {data}\n\n"
                heartbeat_counter += 1
                if heartbeat_counter >= 30:
                    yield ": heartbeat\n\n"
                    heartbeat_counter = 0
                await asyncio.sleep(0)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error(f"SSE error for order {order_id}: {exc}")
        finally:
            if pubsub:
                try:
                    pubsub.unsubscribe(channel)
                    pubsub.close()
                except Exception as cleanup_err:
                    logger.warning(
                        f"SSE pubsub cleanup error for order {order_id}: {cleanup_err}"
                    )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

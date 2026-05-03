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
from typing import List, Optional

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
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_order(
    order_data: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Create an order from the user's cart.

    Rate-limited to 10 orders per user per minute. Publishes an
    ``ORDER_CREATED`` event on the event bus so downstream services
    (notifications, analytics) can react asynchronously; failure to
    publish is logged but does not roll the order back.
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
            detail="Too many order creation attempts. Please try again later.",
        )

    order_service = OrderService(db)
    try:
        order = order_service.create_order(
            user_id=current_user["user_id"],
            shipping_address=order_data.shipping_address,
            address_id=order_data.address_id,
            order_notes=order_data.notes or order_data.order_notes,
            transaction_id=order_data.transaction_id or order_data.payment_id,
            payment_method=order_data.payment_method,
            razorpay_order_id=order_data.razorpay_order_id,
            payment_signature=order_data.razorpay_signature,
            qr_code_id=order_data.qr_code_id,
            pending_order_id=order_data.pending_order_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    event_bus = getattr(request.app.state, "event_bus", None)
    if event_bus and order:
        try:
            event_data = {
                "order_id": order.id,
                "order_number": order.invoice_number,
                "user_id": current_user["user_id"],
                "total_amount": float(order.total_amount),
                "shipping_address": order_data.shipping_address,
                "status": order.status.value,
            }
            await event_bus.publish(
                Event(
                    event_type=EventType.ORDER_CREATED,
                    aggregate_id=str(order.id),
                    aggregate_type="order",
                    data=event_data,
                    metadata={"source": "commerce_service"},
                )
            )
        except Exception as exc:
            logger.warning(
                "Failed to publish order created event for order %s: %s",
                order.id,
                exc,
            )

    return order


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

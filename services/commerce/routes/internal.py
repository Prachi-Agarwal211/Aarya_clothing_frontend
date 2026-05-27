"""
Service-to-service internal router.

All endpoints under /api/v1/internal/* and /api/v1/orders/internal/* live here.
They use a shared X-Internal-Secret header instead of a JWT and are called by
the payment service (webhook + recovery job) to talk to commerce without
impersonating a user.
"""
from __future__ import annotations

import asyncio
import logging
import secrets
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db
from models.order import Order
from models.product_image import ProductImage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Internal"])


def verify_internal_secret(x_internal_secret: Optional[str] = Header(None)) -> bool:
    """Constant-time check of the X-Internal-Secret header."""
    expected_secret = getattr(settings, "INTERNAL_SERVICE_SECRET", None)
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal service secret not configured on server",
        )
    if not x_internal_secret or not secrets.compare_digest(
        str(x_internal_secret), str(expected_secret)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal service secret",
        )
    return True


# ==================== Distributed Lock Helpers ====================


def _acquire_order_lock(lock_key: str, ttl: int = 30) -> Optional[str]:
    """
    Acquire a distributed Redis lock for order creation.

    Uses the underlying Redis client's SET NX EX pattern for atomicity.
    Returns a token string if acquired, None if not (lock held by another process).
    """
    try:
        token = str(uuid.uuid4())
        result = redis_client.client.set(lock_key, token, nx=True, ex=ttl)
        return token if result else None
    except Exception as e:
        logger.warning(f"LOCK_ACQUIRE_ERROR: key={lock_key} error={e}")
        return None


def _release_order_lock(lock_key: str, token: str) -> None:
    """
    Release a distributed Redis lock safely.

    Uses a Lua script to only delete the key if the token matches
    (prevents releasing a lock held by another process).
    """
    try:
        script = """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
        else
            return 0
        end
        """
        redis_client.client.eval(script, 1, lock_key, token)
    except Exception as e:
        logger.warning(f"LOCK_RELEASE_ERROR: key={lock_key} error={e}")


@router.post("/api/v1/internal/orders/{order_id}/reservation/confirm")
async def internal_confirm_reservation(
    order_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_secret),
):
    """Confirm a reservation: deduct reserved_quantity permanently after payment."""
    items = db.execute(
        text(
            "SELECT oi.inventory_id, oi.quantity FROM order_items oi WHERE oi.order_id = :oid"
        ),
        {"oid": order_id},
    ).fetchall()

    for inv_id, qty in items:
        db.execute(
            text(
                "UPDATE inventory"
                " SET reserved_quantity = GREATEST(0, reserved_quantity - :qty)"
                " WHERE id = :id"
            ),
            {"qty": qty, "id": inv_id},
        )

    db.commit()
    return {"message": "Reservation confirmed", "order_id": order_id}


@router.post("/api/v1/internal/orders/{order_id}/reservation/release")
async def internal_release_reservation(
    order_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_secret),
):
    """Release a reservation: hand the stock back to available inventory."""
    items = db.execute(
        text(
            "SELECT oi.inventory_id, oi.quantity FROM order_items oi WHERE oi.order_id = :oid"
        ),
        {"oid": order_id},
    ).fetchall()

    for inv_id, qty in items:
        db.execute(
            text(
                "UPDATE inventory"
                " SET reserved_quantity = GREATEST(0, reserved_quantity - :qty),"
                "     quantity = quantity + :qty"
                " WHERE id = :id"
            ),
            {"qty": qty, "id": inv_id},
        )

    db.commit()
    return {"message": "Reservation released", "order_id": order_id}


@router.get("/api/v1/internal/cart/{user_id}")
async def internal_get_cart(
    user_id: int,
    db: Session = Depends(get_db),  # noqa: B008 - kept for parity even if unused
    _: bool = Depends(verify_internal_secret),
):
    """
    Fetch a user's cart for the payment recovery job and webhook handler.

    Reads from Redis (cart:{user_id}) and exposes a stable serialised shape.
    """
    cart_key = f"cart:{user_id}"
    cart_data = redis_client.get_cache(cart_key)

    if not cart_data:
        return {
            "user_id": user_id,
            "items": [],
            "cart_snapshot": [],
            "shipping_address": "",
            "subtotal": 0.0,
            "total": 0.0,
            "item_count": 0,
        }

    items = cart_data.get("items", [])
    cart_snapshot = [
        {
            "product_id": item.get("product_id"),
            "variant_id": item.get("variant_id"),
            "name": item.get("name"),
            "price": item.get("price"),
            "quantity": item.get("quantity"),
            "sku": item.get("sku"),
            "image": item.get("image"),
            "size": item.get("size"),
            "color": item.get("color"),
            "color_hex": item.get("color_hex"),
            "hsn_code": item.get("hsn_code"),
            "gst_rate": item.get("gst_rate"),
        }
        for item in items
    ]

    return {
        "user_id": cart_data.get("user_id", user_id),
        "items": items,
        "cart_snapshot": cart_snapshot,
        "shipping_address": cart_data.get("shipping_address", ""),
        "subtotal": cart_data.get("subtotal", 0.0),
        "total": cart_data.get("total", 0.0),
        "item_count": cart_data.get("item_count", len(items)),
    }


@router.post(
    "/api/v1/orders/internal/orders/prepare",
    tags=["Internal - Payment Preparation"],
)
async def internal_prepare_pending_order(
    request: Request,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_secret),
):
    """Create a pending order snapshot before payment initiation."""
    from service.order_service import OrderService
    from decimal import Decimal

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    user_id = body.get("user_id")
    cart_snapshot = body.get("cart_snapshot")
    shipping_address = body.get("shipping_address")
    total_amount = Decimal(str(body.get("total_amount", 0)))
    subtotal = Decimal(str(body.get("subtotal", 0)))
    razorpay_order_id = body.get("razorpay_order_id")

    if not user_id or not cart_snapshot or not shipping_address:
        raise HTTPException(
            status_code=400, detail="user_id, cart_snapshot, and shipping_address are required"
        )

    order_service = OrderService(db)
    pending = order_service.create_pending_order(
        user_id=user_id,
        cart_snapshot=cart_snapshot,
        shipping_address=shipping_address,
        total_amount=total_amount,
        subtotal=subtotal,
        razorpay_order_id=razorpay_order_id,
        discount_applied=Decimal(str(body.get("discount_applied", 0))),
        shipping_cost=Decimal(str(body.get("shipping_cost", 0))),
    )

    return {
        "success": True,
        "pending_order_id": pending.id,
        "payment_intent_id": str(pending.payment_intent_id),
    }


@router.post(
    "/api/v1/orders/internal/orders/create-from-payment",
    tags=["Internal - Payment Recovery"],
)
async def internal_create_order_from_payment(
    request: Request,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_secret),
):
    """
    Create an order from payment-webhook data when normal checkout failed.

    This is the critical reliability path that guarantees order creation
    when a customer paid but the foreground checkout flow crashed.
    """
    from service.order_service import OrderService

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    user_id = body.get("user_id")
    payment_id = body.get("payment_id")
    razorpay_order_id = body.get("razorpay_order_id")
    payment_signature = body.get("payment_signature", "")
    pending_order_data = body.get("pending_order_data", {})
    pending_order_id = body.get("pending_order_id")

    if not user_id or not payment_id:
        raise HTTPException(
            status_code=400, detail="user_id and payment_id are required"
        )

    # ── DISTRIBUTED LOCK by payment_id ──
    # Prevents duplicate order creation when Razorpay fires multiple webhooks
    # for the same payment (e.g. payment.authorized + payment.captured),
    # or when the recovery job runs concurrently with a webhook.
    lock_key = f"order:lock:{payment_id}"
    lock_token = _acquire_order_lock(lock_key, ttl=30)

    if not lock_token:
        # Lock held by another webhook — wait and try to find the existing order
        for attempt in range(5):
            logger.info(f"LOCK_WAIT: attempt {attempt + 1}/5 for payment={payment_id}")
            await asyncio.sleep(0.5)
            existing = db.execute(text("""
                SELECT id FROM orders 
                WHERE transaction_id = :payment_id 
                   OR razorpay_payment_id = :payment_id
                   OR razorpay_order_id = :razorpay_order_id
                LIMIT 1
            """), {
                "payment_id": payment_id,
                "razorpay_order_id": razorpay_order_id or ""
            }).fetchone()
            if existing:
                logger.info(f"LOCK_WAIT_RESOLVED: order {existing[0]} found after {attempt + 1} attempts")
                return {"found": True, "order_id": existing[0]}
        logger.error(f"LOCK_TIMEOUT: payment={payment_id} after 5 attempts")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order is being processed from another payment notification.",
        )

    order_service = OrderService(db)

    try:
        logger.info(f"INTERNAL_ORDER_CREATE: user={user_id} payment={payment_id} pending_id={pending_order_id}")

        if pending_order_id:
            order = order_service.create_order_from_pending_id(
                pending_id=pending_order_id,
                transaction_id=payment_id,
                payment_method=body.get("payment_method", "razorpay"),
            )
        elif pending_order_data:
            order = order_service.create_order_from_pending_order(
                pending_order_data=pending_order_data,
                user_id=user_id,
                payment_id=payment_id,
                razorpay_order_id=razorpay_order_id,
                payment_signature=payment_signature,
            )
        else:
            raise HTTPException(status_code=400, detail="pending_order_id or pending_order_data is required")

        logger.info(f"INTERNAL_ORDER_CREATE_SUCCESS: order_id={order.id} user={user_id}")

        # Build items with image data
        items_data = []
        for item in order.items:
            item_dict = {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "size": item.size,
                "color": item.color or (getattr(item.variant, 'color', None) if item.variant else None),
                "color_hex": item.color_hex or (getattr(item.variant, 'color_hex', None) if item.variant else None),
                "quantity": item.quantity,
                "unit_price": float(item.unit_price) if item.unit_price else 0,
                "price": float(item.price) if item.price else 0,
                "image_url": None,
            }
            if item.product_id:
                primary_img = (
                    db.query(ProductImage)
                    .filter(ProductImage.product_id == item.product_id, ProductImage.is_primary.is_(True))
                    .first()
                )
                if primary_img:
                    item_dict["image_url"] = primary_img.image_url
            items_data.append(item_dict)

        _release_order_lock(lock_key, lock_token)

        return {
            "success": True,
            "order_id": order.id,
            "order": {
                "id": order.id,
                "user_id": order.user_id,
                "total_amount": float(order.total_amount),
                "status": order.status,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "items": items_data,
            },
        }
    except ValueError as exc:
        _release_order_lock(lock_key, lock_token)
        logger.error(f"INTERNAL_ORDER_CREATE_VALIDATION_ERROR: user={user_id} error={exc}")
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        _release_order_lock(lock_key, lock_token)
        raise
    except Exception as exc:
        _release_order_lock(lock_key, lock_token)
        logger.error(f"INTERNAL_ORDER_CREATE_ERROR: user={user_id} error={exc}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Internal order creation failed: {exc}"
        )


@router.post(
    "/api/v1/internal/orders/{order_id}/link-payment-details",
    tags=["Internal - Payment Recovery"],
)
async def internal_link_payment_details(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_secret),
):
    """
    Link payment transaction details to an order.

    Called by the payment service after creating an order via webhook,
    to set the internal transaction_id and payment gateway fields that
    the commerce service doesn't know at order-creation time.

    Replaces raw SQL ``UPDATE orders`` from the payment service,
    respecting the cross-service boundary.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    transaction_id = body.get("transaction_id")
    razorpay_payment_id = body.get("razorpay_payment_id")
    razorpay_order_id = body.get("razorpay_order_id")
    payment_method = body.get("payment_method")

    if transaction_id:
        order.transaction_id = transaction_id
    if razorpay_payment_id:
        order.razorpay_payment_id = razorpay_payment_id
    if razorpay_order_id:
        order.razorpay_order_id = razorpay_order_id
    if payment_method:
        order.payment_method = payment_method

    db.commit()
    logger.info(
        f"ORDER_LINKED_PAYMENT: order_id={order_id} "
        f"txn_id={transaction_id} payment={razorpay_payment_id} "
        f"razorpay_order={razorpay_order_id}"
    )
    return {
        "success": True,
        "order_id": order_id,
        "transaction_id": order.transaction_id,
        "razorpay_payment_id": order.razorpay_payment_id,
        "razorpay_order_id": order.razorpay_order_id,
    }


@router.get(
    "/api/v1/orders/internal/orders/find-by-payment/{payment_id}",
    tags=["Internal - Payment Recovery"],
)
async def internal_find_order_by_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_secret),
):
    """Find an order by payment id; used by reconciliation jobs."""
    order = (
        db.query(Order)
        .filter(
            (Order.transaction_id == payment_id)
            | (Order.razorpay_payment_id == payment_id)
        )
        .first()
    )

    if order:
        return {
            "found": True,
            "order": {
                "id": order.id,
                "user_id": order.user_id,
                "status": order.status,
            },
        }
    return {"found": False, "payment_id": payment_id}

"""
Service-to-service internal router.

All endpoints under /api/v1/internal/* and /api/v1/orders/internal/* live here.
They use a shared X-Internal-Secret header instead of a JWT and are called by
the payment service (webhook + recovery job) to talk to commerce without
impersonating a user.
"""
from __future__ import annotations

import logging
import secrets
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

    if not user_id or not payment_id:
        raise HTTPException(
            status_code=400, detail="user_id and payment_id are required"
        )
    if not pending_order_data:
        raise HTTPException(status_code=400, detail="pending_order_data is required")

    order_service = OrderService(db)

    try:
        logger.info(f"INTERNAL_ORDER_CREATE: user={user_id} payment={payment_id}")
        order = order_service.create_order_from_pending_order(
            pending_order_data=pending_order_data,
            user_id=user_id,
            payment_id=payment_id,
            razorpay_order_id=razorpay_order_id,
            payment_signature=payment_signature,
        )
        logger.info(
            f"INTERNAL_ORDER_CREATE_SUCCESS: order_id={order.id} user={user_id}"
        )

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
                    .filter(
                        ProductImage.product_id == item.product_id,
                        ProductImage.is_primary.is_(True),
                    )
                    .first()
                )
                if primary_img:
                    item_dict["image_url"] = primary_img.image_url
            items_data.append(item_dict)

        return {
            "success": True,
            "order_id": order.id,
            "order": {
                "id": order.id,
                "user_id": order.user_id,
                "total_amount": float(order.total_amount),
                "status": order.status,
                "created_at": order.created_at.isoformat()
                if order.created_at
                else None,
                "items": items_data,
            },
        }
    except ValueError as exc:
        logger.error(
            f"INTERNAL_ORDER_CREATE_VALIDATION_ERROR: user={user_id} error={exc}"
        )
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"INTERNAL_ORDER_CREATE_ERROR: user={user_id} error={exc}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Internal order creation failed: {exc}"
        )


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

"""
Notify Core service to send transactional order emails (SMTP lives in Core only).
Commerce must set INTERNAL_SERVICE_SECRET and CORE_SERVICE_URL (see docker-compose).
Public URLs: PUBLIC_APP_URL (e.g. https://aaryaclothing.in).
"""
from __future__ import annotations

import logging
import os
from datetime import timedelta
from typing import TYPE_CHECKING, Optional

import httpx

from service.guest_tracking_token import create_guest_tracking_token

if TYPE_CHECKING:
    from models.order import Order

logger = logging.getLogger(__name__)


def _core_base() -> str:
    return os.getenv("CORE_SERVICE_URL", "http://core:5001").rstrip("/")


def _internal_secret() -> str:
    return os.getenv("INTERNAL_SERVICE_SECRET", "") or ""


def public_app_url() -> str:
    return os.getenv("PUBLIC_APP_URL", "https://aaryaclothing.in").rstrip("/")


def public_track_order_url(order: "Order") -> str:
    """Signed guest tracking URL; falls back to profile orders if signing fails."""
    base = public_app_url()
    try:
        tok = create_guest_tracking_token(order.id)
        return f"{base}/orders/track/{tok}"
    except Exception:
        return f"{base}/profile/orders"


def _post(path: str, payload: dict) -> bool:
    secret = _internal_secret()
    if not secret:
        logger.warning(
            "INTERNAL_SERVICE_SECRET not set — order emails cannot be sent via Core"
        )
        return False
    url = f"{_core_base()}/api/v1/internal{path}"
    try:
        r = httpx.post(
            url,
            json=payload,
            headers={"X-Internal-Secret": secret},
            timeout=45.0,
        )
        if r.status_code != 200:
            logger.error(
                "Core notification failed %s %s: %s",
                r.status_code,
                path,
                (r.text or "")[:500],
            )
            return False
        return True
    except Exception as e:
        logger.error("Core notification error %s: %s", path, e)
        return False


def notify_order_confirmation_email(order: "Order", user) -> bool:
    """Send order confirmation via Core SMTP."""
    if not user or not getattr(user, "email", None):
        logger.warning("No user email for order confirmation")
        return False

    items_html = ""
    for item in order.items:
        items_html += f"""
            <tr style="border-bottom: 1px solid rgba(183, 110, 121, 0.2);">
                <td style="padding: 12px 0; color: #EAE0D5;">
                    <strong style="color: #F2C29A;">{item.product_name}</strong>
                    {f'<br><span style="color: #B76E79; font-size: 13px;">Size: {item.size}</span>' if item.size else ''}
                    {f'<span style="color: #B76E79; font-size: 13px;"> | Color: {item.color}</span>' if item.color else ''}
                </td>
                <td style="padding: 12px 0; color: #EAE0D5; text-align: center;">{item.quantity}</td>
                <td style="padding: 12px 0; color: #F2C29A; text-align: right;">₹{float(item.price):.2f}</td>
            </tr>
            """

    estimated_delivery = (order.created_at + timedelta(days=7)).strftime("%B %d, %Y")
    track_order_url = public_track_order_url(order)

    payload = {
        "to_email": user.email,
        "customer_name": user.username or "Customer",
        "order_number": order.invoice_number or f"#{order.id}",
        "order_items": items_html,
        "subtotal": f"{float(order.subtotal):.2f}",
        "shipping": f"{float(order.shipping_cost):.2f}",
        "gst": f"{float(order.gst_amount):.2f}",
        "total": f"{float(order.total_amount):.2f}",
        "shipping_address": order.shipping_address or "",
        "payment_method": order.payment_method.upper() if order.payment_method else "ONLINE",
        "estimated_delivery": estimated_delivery,
        "track_order_url": track_order_url,
    }
    return _post("/notifications/order-confirmation", payload)


def notify_order_shipped_email(order: "Order", user, tracking_number: Optional[str]) -> bool:
    if not user or not getattr(user, "email", None) or not tracking_number:
        return False

    estimated_delivery = (order.created_at + timedelta(days=7)).strftime("%B %d, %Y")
    track_url = public_track_order_url(order)
    payload = {
        "to_email": user.email,
        "customer_name": user.username or "Customer",
        "order_number": order.invoice_number or f"#{order.id}",
        "tracking_number": tracking_number,
        "shipping_carrier": "Standard Shipping",
        "estimated_delivery": estimated_delivery,
        "track_order_url": track_url,
    }
    return _post("/notifications/order-shipped", payload)


def notify_order_delivered_email(order: "Order", user) -> bool:
    if not user or not getattr(user, "email", None):
        return False
    delivery_date = (
        order.delivered_at.strftime("%B %d, %Y") if order.delivered_at else "Today"
    )
    details_url = public_track_order_url(order)
    review_url = public_track_order_url(order)
    payload = {
        "to_email": user.email,
        "customer_name": user.username or "Customer",
        "order_number": order.invoice_number or f"#{order.id}",
        "delivery_date": delivery_date,
        "order_details_url": details_url,
        "review_url": review_url,
    }
    return _post("/notifications/order-delivered", payload)


def notify_order_cancelled_email(order: "Order", user, reason: Optional[str]) -> bool:
    if not user or not getattr(user, "email", None):
        return False
    base = public_app_url()
    cancellation_date = (
        order.cancelled_at.strftime("%B %d, %Y") if order.cancelled_at else "Today"
    )
    payload = {
        "to_email": user.email,
        "customer_name": user.username or "Customer",
        "order_number": order.invoice_number or f"#{order.id}",
        "cancellation_date": cancellation_date,
        "reason": reason or order.cancellation_reason or "",
        "refund_info": "Refund will be processed within 5-7 business days.",
        "shop_url": base,
    }
    return _post("/notifications/order-cancelled", payload)

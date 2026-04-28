"""
Email Outbox Service
====================
Manages transactional email queue with idempotency and retry logic.
Integrates with OrderService to enqueue emails after order events.
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status

from models.email_outbox import EmailOutbox, EmailType, EmailStatus
from service.core_notification_client import (
    notify_order_confirmation_email,
    notify_order_shipped_email,
    notify_order_delivered_email,
    notify_order_cancelled_email,
)
from shared.time_utils import now_ist

logger = logging.getLogger(__name__)


class EmailOutboxService:
    """Service for managing email outbox queue with retry logic."""

    # Retry backoff schedule: (max_attempts, delay_minutes)
    RETRY_SCHEDULE = [
        (1, 0),  # First attempt: immediate
        (2, 1),  # Retry after 1 minute
        (3, 5),  # Retry after 5 minutes
        (4, 30),  # Retry after 30 minutes
        (5, 120),  # Retry after 2 hours
        # After 5 attempts, mark as FAILED (manual intervention needed)
    ]

    MAX_ATTEMPTS = 5

    def __init__(self, db: Session):
        self.db = db

    def enqueue_order_confirmation(
        self, order_id: int, user_id: int, order, user
    ) -> bool:
        """
        Enqueue order confirmation email.

        Idempotent: if email already exists for this order/type, won't create duplicate.
        Order creation path: sync transaction → enqueue → return
        """
        return self._enqueue(
            order_id=order_id,
            user_id=user_id,
            email_type=EmailType.ORDER_CONFIRMATION.value,
            to_email=user.email,
            subject=f"Order Confirmed - #{order.invoice_number or order.id}",
            body_html=self._build_confirmation_html(order, user),
            body_text=self._build_confirmation_text(order, user),
        )

    def enqueue_order_shipped(
        self, order_id: int, user_id: int, order, user, tracking_number: str
    ) -> bool:
        """Enqueue order shipped notification."""
        return self._enqueue(
            order_id=order_id,
            user_id=user_id,
            email_type=EmailType.ORDER_SHIPPED.value,
            to_email=user.email,
            subject=f"Your Order is Shipped - #{order.invoice_number or order.id}",
            body_html=self._build_shipped_html(order, user, tracking_number),
            body_text=self._build_shipped_text(order, user, tracking_number),
            metadata={"tracking_number": tracking_number},
        )

    def enqueue_order_delivered(self, order_id: int, user_id: int, order, user) -> bool:
        """Enqueue order delivered notification."""
        return self._enqueue(
            order_id=order_id,
            user_id=user_id,
            email_type=EmailType.ORDER_DELIVERED.value,
            to_email=user.email,
            subject=f"Order Delivered - #{order.invoice_number or order.id}",
            body_html=self._build_delivered_html(order, user),
            body_text=self._build_delivered_text(order, user),
        )

    def enqueue_order_cancelled(
        self, order_id: int, user_id: int, order, user, reason: Optional[str] = None
    ) -> bool:
        """Enqueue order cancellation notice."""
        return self._enqueue(
            order_id=order_id,
            user_id=user_id,
            email_type=EmailType.ORDER_CANCELLED.value,
            to_email=user.email,
            subject=f"Order Cancelled - #{order.invoice_number or order.id}",
            body_html=self._build_cancelled_html(order, user, reason),
            body_text=self._build_cancelled_text(order, user, reason),
            metadata={"cancellation_reason": reason},
        )

    def _enqueue(
        self,
        order_id: int,
        user_id: int,
        email_type: str,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Create email outbox entry if not exists (idempotent).

        Returns True if created, False if already exists.
        """
        try:
            # Check if email already queued/sent for this order+type
            existing = (
                self.db.query(EmailOutbox)
                .filter(
                    EmailOutbox.order_id == order_id,
                    EmailOutbox.email_type == email_type,
                )
                .first()
            )
            if existing:
                logger.info(
                    f"Email already enqueued/sent: order={order_id} type={email_type} status={existing.status}"
                )
                return False

            # Calculate initial retry time (attempt 1 = now)
            next_retry = now_ist()  # Ready to send immediately

            email = EmailOutbox(
                order_id=order_id,
                user_id=user_id,
                email_type=email_type,
                to_email=to_email,
                subject=subject,
                body_html=body_html,
                body_text=body_text,
                email_metadata={"attempts": 0, "metadata": metadata or {}},
                attempts=0,
                next_retry_at=next_retry,
                status=EmailStatus.PENDING.value,
            )
            self.db.add(email)
            self.db.commit()
            logger.info(
                f"✓ Email enqueued: order={order_id} type={email_type} email_id={email.id}"
            )
            return True

        except Exception as e:
            self.db.rollback()
            logger.error(
                f"Failed to enqueue email order={order_id} type={email_type}: {e}"
            )
            return False

    # ==================== Email Builders (HTML/Text) ====================
    # These replicate the HTML from core_notification_client.py

    def _build_confirmation_html(self, order, user) -> str:
        """Build order confirmation email HTML."""
        items_html = ""
        for item in order.items:
            items_html += f"""
            <tr style="border-bottom: 1px solid rgba(183, 110, 121, 0.2);">
                <td style="padding: 12px 0; color: #EAE0D5;">
                    <strong style="color: #F2C29A;">{item.product_name}</strong>
                    {f'<br><span style="color: #B76E79; font-size: 13px;">Size: {item.size}</span>' if item.size else ""}
                    {f'<span style="color: #B76E79; font-size: 13px;"> | Color: {item.color}</span>' if item.color else ""}
                </td>
                <td style="padding: 12px 0; color: #EAE0D5; text-align: center;">{item.quantity}</td>
                <td style="padding: 12px 0; color: #F2C29A; text-align: right;">₹{float(item.price):.2f}</td>
            </tr>
            """
        estimated_delivery = (order.created_at + timedelta(days=7)).strftime(
            "%B %d, %Y"
        )
        track_url = self._public_track_url(order)
        from service.guest_tracking_token import create_guest_tracking_token

        try:
            track_url = f"https://aaryaclothing.in/orders/track/{create_guest_tracking_token(order.id)}"
        except Exception:
            track_url = "https://aaryaclothing.in/profile/orders"

        return f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Order Confirmed</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #EAE0D5; padding: 20px;">
            <div style="background: linear-gradient(135deg, #B76E79, #8B4557); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: #F2C29A; margin: 0;">Order Confirmed! 🎉</h1>
            </div>
            <div style="background: #2a2a2a; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #B76E79; border-top: none;">
                <p style="font-size: 16px; margin-bottom: 20px;">Thank you for your purchase, <strong>{user.username or "Customer"}</strong>!</p>
                <p style="color: #F2C29A; font-size: 18px; margin-bottom: 20px;">Order #: {order.invoice_number or f"#{order.id}"}</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #3a3a3a;">
                            <th style="padding: 10px; text-align: left;">Item</th>
                            <th style="padding: 10px; text-align: center;">Qty</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>{items_html}</tbody>
                </table>
                
                <div style="background: #1a1a1a; padding: 15px; border-radius: 5px; margin-top: 20px;">
                    <p style="margin: 5px 0;">Subtotal: <span style="color: #F2C29A;">₹{float(order.subtotal):.2f}</span></p>
                    <p style="margin: 5px 0;">Shipping: <span style="color: #F2C29A;">₹{float(order.shipping_cost):.2f}</span></p>
                    <p style="margin: 5px 0;">GST: <span style="color: #F2C29A;">₹{float(order.gst_amount):.2f}</span></p>
                    <p style="margin: 5px 0; font-size: 18px; border-top: 1px solid #B76E79; padding-top: 10px;">
                        Total: <span style="color: #F2C29A; font-weight: bold;">₹{float(order.total_amount):.2f}</span>
                    </p>
                </div>
                
                <p style="margin-top: 20px;"><strong>Shipping Address:</strong><br>{order.shipping_address}</p>
                <p><strong>Payment Method:</strong> {order.payment_method.upper() if order.payment_method else "ONLINE"}</p>
                
                <div style="background: linear-gradient(135deg, #B76E79, #8B4557); padding: 15px; text-align: center; border-radius: 5px; margin-top: 30px;">
                    <p style="margin: 0; font-size: 16px;">Estimated Delivery: <strong>{estimated_delivery}</strong></p>
                    <p style="margin: 10px 0 0 0;"><a href="{track_url}" style="color: #F2C29A; text-decoration: underline;">Track Your Order</a></p>
                </div>
                
                <p style="text-align: center; color: #888; margin-top: 30px; font-size: 12px;">
                    Need help? Contact us at support@aaryaclothing.in
                </p>
            </div>
        </body>
        </html>
        """

    def _build_confirmation_text(self, order, user) -> str:
        """Build plain text order confirmation."""
        items_text = ""
        for item in order.items:
            items_text += f"  - {item.product_name} (Size: {item.size}, Color: {item.color}) x {item.quantity} = ₹{float(item.price * item.quantity):.2f}\n"
        track_url = self._public_track_url(order)
        return f"""
Order Confirmed! #{order.invoice_number or order.id}

Thank you, {user.username or "Customer"}!

{items_text}
Subtotal: ₹{float(order.subtotal):.2f}
Shipping: ₹{float(order.shipping_cost):.2f}
GST: ₹{float(order.gst_amount):.2f}
Total: ₹{float(order.total_amount):.2f}

Shipping Address:
{order.shipping_address}

Payment Method: {order.payment_method.upper() if order.payment_method else "ONLINE"}
Estimated Delivery: {(order.created_at + timedelta(days=7)).strftime("%B %d, %Y")}

Track your order: {track_url}
"""

    # Placeholder builders for other email types
    def _build_shipped_html(self, order, user, tracking_number):
        return "<h1>Shipped</h1>"

    def _build_shipped_text(self, order, user, tracking_number):
        return f"Order {order.id} shipped. Tracking: {tracking_number}"

    def _build_delivered_html(self, order, user):
        return "<h1>Delivered</h1>"

    def _build_delivered_text(self, order, user):
        return f"Order {order.id} delivered."

    def _build_cancelled_html(self, order, user, reason):
        return "<h1>Cancelled</h1>"

    def _build_cancelled_text(self, order, user, reason):
        return f"Order {order.id} cancelled. Reason: {reason}"

    def _public_track_url(self, order) -> str:
        from service.guest_tracking_token import create_guest_tracking_token

        base = "https://aaryaclothing.in"
        try:
            token = create_guest_tracking_token(order.id)
            return f"{base}/orders/track/{token}"
        except Exception:
            return f"{base}/profile/orders"

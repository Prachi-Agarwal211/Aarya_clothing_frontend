"""
Route order notifications by verification channel:
- Email verified, phone not → email only
- Phone verified only → SMS when MSG91 order flow template is set; else email fallback
- Both email and phone verified → SMS first, then email fallback if SMS fails or is unconfigured
- Neither flag set → email only (legacy / edge cases)
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from models.user import User
from service.email_service import email_service
from service.sms_service import sms_service

logger = logging.getLogger(__name__)


def _email_only_channel(user: Optional[User]) -> bool:
    """
    If True, send transactional email only (no SMS attempt).
    If False, try SMS first, then fall back to email when appropriate.
    """
    if not user:
        return True
    ev = bool(user.email_verified)
    pv = bool(getattr(user, "phone_verified", False))
    # Email-only verified: keep email as the channel (no duplicate SMS).
    if ev and not pv:
        return True
    # Legacy / unknown: neither verified → email path.
    if not ev and not pv:
        return True
    # Phone-only or both verified → prefer SMS first with email fallback.
    return False


def _phone_for_sms(user: Optional[User]) -> Optional[str]:
    if not user or not user.profile:
        return None
    p = user.profile.phone
    return p.strip() if p else None


def _try_sms_first_then_email(
    *,
    send_email_fn,
    phone: Optional[str],
    sms_fn,
) -> bool:
    """Try SMS; if it fails or is unconfigured, send email."""
    if phone and sms_service is not None:
        r = sms_fn()
        if isinstance(r, dict) and r.get("success"):
            return True
        if isinstance(r, dict) and r.get("error") == "order_flow_template_not_configured":
            logger.info("Order SMS template not configured — falling back to email")
        else:
            logger.warning("Order SMS send failed — falling back to email")
    ok = send_email_fn()
    return bool(ok)


def dispatch_order_confirmation(db: Session, body) -> dict:
    user = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.email == body.to_email)
        .first()
    )
    email_only = _email_only_channel(user)
    phone = _phone_for_sms(user)

    def send_mail():
        return email_service.send_order_confirmation_email(
            to_email=body.to_email,
            customer_name=body.customer_name,
            order_number=body.order_number,
            order_items=body.order_items,
            subtotal=body.subtotal,
            shipping=body.shipping,
            gst=body.gst,
            total=body.total,
            discount_row=body.discount_row,
            shipping_address=body.shipping_address,
            payment_method=body.payment_method,
            estimated_delivery=body.estimated_delivery,
            track_order_url=body.track_order_url,
        )

    if email_only:
        ok = send_mail()
        return {"success": bool(ok)}

    def sms():
        if sms_service is None:
            return {"success": False, "error": "sms_disabled"}
        if not phone:
            return {"success": False, "error": "no_phone"}
        return sms_service.send_order_flow_sms(
            phone,
            order_number=body.order_number,
            summary_line=f"Order confirmed. Total ₹{body.total}.",
            link=body.track_order_url or "",
        )

    ok = _try_sms_first_then_email(send_email_fn=send_mail, phone=phone, sms_fn=sms)
    return {"success": ok}


def dispatch_order_shipped(db: Session, body) -> dict:
    user = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.email == body.to_email)
        .first()
    )
    email_only = _email_only_channel(user)
    phone = _phone_for_sms(user)

    def send_mail():
        return email_service.send_order_shipped_email(
            to_email=body.to_email,
            customer_name=body.customer_name,
            order_number=body.order_number,
            tracking_number=body.tracking_number,
            shipping_carrier=body.shipping_carrier,
            estimated_delivery=body.estimated_delivery,
            track_order_url=body.track_order_url,
        )

    if email_only:
        return {"success": bool(send_mail())}

    def sms():
        if sms_service is None:
            return {"success": False, "error": "sms_disabled"}
        if not phone:
            return {"success": False, "error": "no_phone"}
        return sms_service.send_order_flow_sms(
            phone,
            order_number=body.order_number,
            summary_line=f"Shipped. Track: {body.tracking_number}",
            link=body.track_order_url or "",
        )

    ok = _try_sms_first_then_email(send_email_fn=send_mail, phone=phone, sms_fn=sms)
    return {"success": ok}


def dispatch_order_delivered(db: Session, body) -> dict:
    user = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.email == body.to_email)
        .first()
    )
    email_only = _email_only_channel(user)
    phone = _phone_for_sms(user)

    def send_mail():
        return email_service.send_order_delivered_email(
            to_email=body.to_email,
            customer_name=body.customer_name,
            order_number=body.order_number,
            delivery_date=body.delivery_date,
            order_details_url=body.order_details_url,
            review_url=body.review_url or body.order_details_url,
        )

    if email_only:
        return {"success": bool(send_mail())}

    def sms():
        if sms_service is None:
            return {"success": False, "error": "sms_disabled"}
        if not phone:
            return {"success": False, "error": "no_phone"}
        return sms_service.send_order_flow_sms(
            phone,
            order_number=body.order_number,
            summary_line=f"Delivered on {body.delivery_date}.",
            link=body.order_details_url or "",
        )

    ok = _try_sms_first_then_email(send_email_fn=send_mail, phone=phone, sms_fn=sms)
    return {"success": ok}


def dispatch_order_cancelled(db: Session, body) -> dict:
    user = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.email == body.to_email)
        .first()
    )
    email_only = _email_only_channel(user)
    phone = _phone_for_sms(user)

    def send_mail():
        return email_service.send_order_cancelled_email(
            to_email=body.to_email,
            customer_name=body.customer_name,
            order_number=body.order_number,
            cancellation_date=body.cancellation_date,
            reason=body.reason,
            refund_info=body.refund_info,
            shop_url=body.shop_url,
        )

    if email_only:
        return {"success": bool(send_mail())}

    def sms():
        if sms_service is None:
            return {"success": False, "error": "sms_disabled"}
        if not phone:
            return {"success": False, "error": "no_phone"}
        return sms_service.send_order_flow_sms(
            phone,
            order_number=body.order_number,
            summary_line=f"Cancelled ({body.cancellation_date}).",
            link=body.shop_url or "",
        )

    ok = _try_sms_first_then_email(send_email_fn=send_mail, phone=phone, sms_fn=sms)
    return {"success": ok}

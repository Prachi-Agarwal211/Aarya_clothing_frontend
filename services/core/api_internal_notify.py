"""
Internal API: Commerce calls these to send transactional order notifications.
Secured with X-Internal-Secret (same as payment→commerce internal calls).
SMTP and SMS (MSG91) live in Core — routing prefers email vs SMS from user verification flags.
"""
import hmac
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from database.database import get_db
from schemas.internal_notify import (
    OrderConfirmationNotify,
    OrderShippedNotify,
    OrderDeliveredNotify,
    OrderCancelledNotify,
)
from service.order_notification_dispatch import (
    dispatch_order_confirmation,
    dispatch_order_shipped,
    dispatch_order_delivered,
    dispatch_order_cancelled,
)
from service.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["Internal — service-to-service"])


class DirectEmailBody(BaseModel):
    to_email: str
    subject: str
    body_html: str
    body_text: Optional[str] = None


def _verify_internal_secret(x_internal_secret: Optional[str]) -> None:
    expected = os.getenv("INTERNAL_SERVICE_SECRET") or getattr(settings, "INTERNAL_SERVICE_SECRET", None)
    if not expected:
        logger.error("INTERNAL_SERVICE_SECRET not configured on Core")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal notifications not configured",
        )
    if not x_internal_secret or not hmac.compare_digest(x_internal_secret, expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal secret")


@router.post("/email/send")
def send_direct_email(
    body: DirectEmailBody,
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
):
    """Simple endpoint for sending email directly from commerce email worker."""
    _verify_internal_secret(x_internal_secret)
    
    try:
        success = email_service.send(
            to_email=body.to_email,
            subject=body.subject,
            html_content=body.body_html,
            text_content=body.body_text,
        )
        return {"success": success}
    except Exception as e:
        logger.error(f"Direct email failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notifications/order-confirmation")
def post_order_confirmation(
    body: OrderConfirmationNotify,
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    _verify_internal_secret(x_internal_secret)
    return dispatch_order_confirmation(db, body)


@router.post("/notifications/order-shipped")
def post_order_shipped(
    body: OrderShippedNotify,
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    _verify_internal_secret(x_internal_secret)
    return dispatch_order_shipped(db, body)


@router.post("/notifications/order-delivered")
def post_order_delivered(
    body: OrderDeliveredNotify,
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    _verify_internal_secret(x_internal_secret)
    return dispatch_order_delivered(db, body)


@router.post("/notifications/order-cancelled")
def post_order_cancelled(
    body: OrderCancelledNotify,
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    _verify_internal_secret(x_internal_secret)
    return dispatch_order_cancelled(db, body)

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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["Internal — service-to-service"])


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

"""
Commerce Service - Cart Routes

Shopping cart operations:
- Get/Add/Update/Remove cart items
- Apply promo codes
- Set delivery state for GST calculation
- Cart clearance

NOTE: This router module is DISABLED. All cart endpoints are defined inline
in main.py to avoid route conflicts and ensure proper CartConcurrencyManager
integration. This file is kept for reference only.
"""

import logging
from typing import Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import json

from database.database import get_db
from schemas.order import CartItem, CartResponse
from schemas.error import ErrorResponse
from service.cart_service import CartService
from service.coupon_service import CouponService, CouponValidationError
from core.redis_client import redis_client
from core.cart_lock import cart_operation_lock
from shared.auth_middleware import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)

# DISABLED: This router is not registered in main.py
# All cart endpoints are defined inline in main.py
router = APIRouter(prefix="/api/v1/cart", tags=["Cart"])


@router.get("", response_model=CartResponse)
async def get_cart_disabled(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """DISABLED - Use inline endpoint in main.py instead."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="This endpoint is disabled. Use the inline implementation."
    )

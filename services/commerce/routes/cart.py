"""
Commerce Service - Cart Routes

Shopping cart operations:
- Get/Add/Update/Remove cart items
- Apply promo codes
- Set delivery state for GST calculation
- Cart clearance
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

router = APIRouter(prefix="/api/v1/cart", tags=["Cart"])


# ==================== Helper Functions ====================

def _get_cart_service(db: Session) -> CartService:
    """Get cart service instance."""
    return CartService(db)


def _enrich_cart_response(cart_data: Dict) -> CartResponse:
    """Enrich cart data for response."""
    return CartResponse(
        user_id=cart_data.get("user_id"),
        items=cart_data.get("items", []),
        subtotal=Decimal(str(cart_data.get("subtotal", 0))),
        shipping=Decimal(str(cart_data.get("shipping", 0))),
        discount=Decimal(str(cart_data.get("discount", 0))),
        gst_amount=Decimal(str(cart_data.get("gst_amount", 0))),
        cgst_amount=Decimal(str(cart_data.get("cgst_amount", 0))),
        sgst_amount=Decimal(str(cart_data.get("sgst_amount", 0))),
        igst_amount=Decimal(str(cart_data.get("igst_amount", 0))),
        total_amount=Decimal(str(cart_data.get("total_amount", 0))),
        delivery_state=cart_data.get("delivery_state"),
        customer_gstin=cart_data.get("customer_gstin"),
        promo_code=cart_data.get("promo_code"),
        updated_at=cart_data.get("updated_at")
    )


# ==================== Customer Cart Endpoints ====================

@router.get("", response_model=CartResponse)
async def get_my_cart(
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get current user's shopping cart.
    
    If user is not authenticated, returns empty cart.
    """
    if not current_user:
        return CartResponse(
            user_id=None,
            items=[],
            subtotal=Decimal(0),
            shipping=Decimal(0),
            discount=Decimal(0),
            gst_amount=Decimal(0),
            total_amount=Decimal(0)
        )
    
    user_id = current_user.get("user_id")
    cart_service = _get_cart_service(db)
    
    try:
        cart = cart_service.get_cart(user_id)
        return _enrich_cart_response(cart)
    except Exception as e:
        logger.error(f"Error getting cart: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve cart"
        )


@router.post("/items", response_model=CartResponse)
@cart_operation_lock
async def add_to_my_cart(
    item: CartItem,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add item to current user's cart.
    
    - If item exists, quantity is updated
    - Inventory is reserved for 10 minutes
    """
    user_id = current_user.get("user_id")
    cart_service = _get_cart_service(db)
    
    try:
        cart = cart_service.add_to_cart(
            user_id=user_id,
            product_id=item.product_id,
            variant_id=item.variant_id if hasattr(item, 'variant_id') else None,
            quantity=item.quantity,
            size=item.size if hasattr(item, 'size') else None,
            color=item.color if hasattr(item, 'color') else None
        )
        return _enrich_cart_response(cart)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding to cart: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add item to cart"
        )


@router.put("/items/{product_id}", response_model=CartResponse)
@cart_operation_lock
async def update_my_cart_item(
    product_id: int,
    quantity: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update quantity of item in cart."""
    user_id = current_user.get("user_id")
    cart_service = _get_cart_service(db)
    
    try:
        cart = cart_service.update_cart_item(
            user_id=user_id,
            product_id=product_id,
            quantity=quantity
        )
        return _enrich_cart_response(cart)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating cart item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update cart item"
        )


@router.delete("/items/{product_id}", response_model=CartResponse)
@cart_operation_lock
async def remove_from_my_cart(
    product_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove item from cart and release inventory reservation."""
    user_id = current_user.get("user_id")
    cart_service = _get_cart_service(db)
    
    try:
        cart = cart_service.remove_from_cart(
            user_id=user_id,
            product_id=product_id
        )
        return _enrich_cart_response(cart)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error removing from cart: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove item from cart"
        )


@router.delete("", response_model=CartResponse)
@cart_operation_lock
async def clear_my_cart(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear entire cart and release all inventory reservations."""
    user_id = current_user.get("user_id")
    cart_service = _get_cart_service(db)
    
    try:
        cart = cart_service.clear_cart(user_id=user_id)
        return _enrich_cart_response(cart)
    except Exception as e:
        logger.error(f"Error clearing cart: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear cart"
        )


@router.post("/coupon", response_model=CartResponse)
@cart_operation_lock
async def apply_coupon_to_my_cart(
    promo_code: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Apply promo code to cart with comprehensive validation.
    
    Features:
    - One coupon per order (prevents coupon stacking)
    - Per-user usage tracking
    - Rate limiting on validation attempts
    - Disposable email blocking
    - Minimum order value validation
    - Maximum discount cap enforcement
    - Validity period checks
    """
    user_id = current_user.get("user_id")
    user_email = current_user.get("email")
    user_ip = request.client.host if request.client else None
    
    cart_service = _get_cart_service(db)
    coupon_service = CouponService(db, redis_client)
    
    try:
        # Get current cart
        cart = cart_service.get_cart(user_id)
        
        # Check if coupon already applied (prevent stacking)
        if cart.get("promo_code"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Coupon '{cart['promo_code']}' is already applied. Only one coupon per order is allowed."
            )
        
        # Calculate order total for validation
        order_total = Decimal(str(cart.get("subtotal", 0)))
        
        # Validate coupon with enhanced service
        promotion, discount_amount, metadata = coupon_service.validate_coupon(
            promo_code=promo_code,
            user_id=user_id,
            order_total=order_total,
            user_email=user_email,
            user_ip=user_ip
        )
        
        if not promotion or not metadata.get("valid"):
            error_msg = metadata.get("errors", ["Invalid coupon code"])[0]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
        
        # Apply warnings to response headers if any
        if metadata.get("warnings"):
            logger.info(f"Coupon validation warnings: {metadata['warnings']}")
        
        # Apply discount to cart
        cart["promo_code"] = promo_code.upper().strip()
        cart["discount"] = float(discount_amount)
        cart["discount_metadata"] = {
            "promotion_id": promotion.id,
            "discount_type": promotion.discount_type.value,
            "discount_value": float(promotion.discount_value),
            "max_discount": float(promotion.max_discount_amount) if promotion.max_discount_amount else None,
            "min_order_value": float(promotion.min_order_value),
        }
        
        # Recalculate total with discount
        cart["total"] = max(0, round(
            float(cart.get("subtotal", 0)) + 
            float(cart.get("gst_amount", 0)) + 
            float(cart.get("shipping", 0)) - 
            float(discount_amount),
            2
        ))
        
        # Save cart
        cart_service.save_cart(user_id, cart)
        
        logger.info(f"Coupon applied: {promo_code} by user {user_id}, discount: {discount_amount}")
        
        return _enrich_cart_response(cart)
        
    except CouponValidationError as e:
        logger.warning(f"Coupon validation error: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error applying coupon: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to apply coupon"
        )


@router.delete("/coupon", response_model=CartResponse)
@cart_operation_lock
async def remove_coupon_from_my_cart(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove applied coupon from cart.
    
    Useful when user wants to try a different coupon or cancel the discount.
    """
    user_id = current_user.get("user_id")
    cart_service = _get_cart_service(db)
    
    try:
        # Get current cart
        cart = cart_service.get_cart(user_id)
        
        # Check if there's a coupon to remove
        if not cart.get("promo_code"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No coupon is currently applied to your cart"
            )
        
        # Remove coupon
        removed_coupon = cart.pop("promo_code")
        cart.pop("discount_metadata", None)
        cart["discount"] = 0
        
        # Recalculate total without discount
        cart["total"] = round(
            float(cart.get("subtotal", 0)) + 
            float(cart.get("gst_amount", 0)) + 
            float(cart.get("shipping", 0)),
            2
        )
        
        # Save cart
        cart_service.save_cart(user_id, cart)
        
        logger.info(f"Coupon removed: {removed_coupon} from user {user_id}'s cart")
        
        return _enrich_cart_response(cart)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing coupon: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove coupon"
        )


@router.post("/delivery-state", response_model=CartResponse)
@cart_operation_lock
async def set_cart_delivery_state(
    state: str,
    gstin: Optional[str] = None,
    request: Request = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Set delivery state for GST calculation.
    
    - If state matches seller state: CGST + SGST
    - If state differs: IGST
    - GSTIN optional for B2B orders
    """
    user_id = current_user.get("user_id")
    cart_service = _get_cart_service(db)
    
    try:
        cart = cart_service.set_delivery_state(
            user_id=user_id,
            delivery_state=state,
            customer_gstin=gstin
        )
        return _enrich_cart_response(cart)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error setting delivery state: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set delivery state"
        )

"""
Commerce Service - Orders Routes

Order management endpoints:
- Order creation from cart
- Order listing and details
- Order status updates (admin)
- Order cancellation
- Order tracking
"""

import logging
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database.database import get_db
from models.order import Order, OrderStatus
from schemas.order import OrderCreate, OrderResponse, BulkOrderStatusUpdate, SetDeliveryState
from schemas.error import ErrorResponse, PaginatedResponse
from service.order_service import OrderService
from shared.auth_middleware import get_current_user, require_admin, require_staff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])


# ==================== Helper Functions ====================

def _get_order_service(db: Session) -> OrderService:
    """Get order service instance."""
    return OrderService(db)


def _enrich_order_response(order: Order) -> OrderResponse:
    """Enrich order ORM for response."""
    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        invoice_number=order.invoice_number,
        subtotal=order.subtotal,
        discount_applied=order.discount_applied,
        promo_code=order.promo_code,
        shipping_cost=order.shipping_cost,
        gst_amount=order.gst_amount,
        cgst_amount=order.cgst_amount,
        sgst_amount=order.sgst_amount,
        igst_amount=order.igst_amount,
        total_amount=order.total_amount,
        payment_method=order.payment_method,
        status=order.status,
        shipping_address=order.shipping_address,
        order_notes=order.order_notes,
        transaction_id=order.transaction_id,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=order.items,
        tracking=order.tracking if hasattr(order, 'tracking') else None
    )


# ==================== Customer Order Endpoints ====================

@router.post("", status_code=status.HTTP_201_CREATED, response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create order from user's cart.
    
    Requirements:
    - User must be authenticated
    - Cart must have items
    - Delivery state must be set
    - Payment must be verified (for online payments)
    """
    user_id = current_user.get("user_id")
    order_service = _get_order_service(db)
    
    try:
        order = order_service.create_order(
            user_id=user_id,
            shipping_address=order_data.shipping_address,
            address_id=order_data.address_id,
            promo_code=order_data.promo_code,
            order_notes=order_data.order_notes,
            transaction_id=order_data.transaction_id,
            payment_method=order_data.payment_method or "cashfree",
            cashfree_order_id=order_data.cashfree_order_id
        )
        return _enrich_order_response(order)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating order: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create order"
        )


@router.get("", response_model=PaginatedResponse)
async def get_my_orders(
    request: Request,
    status_filter: Optional[OrderStatus] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's orders with pagination."""
    user_id = current_user.get("user_id")
    order_service = _get_order_service(db)
    
    try:
        skip = (page - 1) * limit
        orders = order_service.get_user_orders(
            user_id=user_id,
            skip=skip,
            limit=limit
        )
        
        # Get total count
        query = db.query(Order).filter(Order.user_id == user_id)
        if status_filter:
            query = query.filter(Order.status == status_filter)
        total = query.count()
        
        return {
            "items": [_enrich_order_response(o) for o in orders],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error getting orders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve orders"
        )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get order details by ID."""
    user_id = current_user.get("user_id")
    order_service = _get_order_service(db)
    
    try:
        order = order_service.get_order_by_id(order_id, user_id=user_id)
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        return _enrich_order_response(order)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting order: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve order"
        )


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: int,
    reason: Optional[str] = None,
    request: Request = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel order and release inventory.
    
    Only allowed for CONFIRMED orders.
    """
    user_id = current_user.get("user_id")
    order_service = _get_order_service(db)
    
    try:
        order = order_service.cancel_order(
            order_id=order_id,
            user_id=user_id,
            reason=reason
        )
        return _enrich_order_response(order)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error cancelling order: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel order"
        )


# ==================== Admin Order Management ====================

@router.get("/admin/all", response_model=PaginatedResponse)
async def get_all_orders(
    request: Request,
    status_filter: Optional[OrderStatus] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Get all orders with optional status filter (admin/staff only)."""
    order_service = _get_order_service(db)
    
    try:
        skip = (page - 1) * limit
        orders = order_service.get_all_orders(
            status=status_filter,
            skip=skip,
            limit=limit
        )
        
        # Get total count
        query = db.query(Order)
        if status_filter:
            query = query.filter(Order.status == status_filter)
        total = query.count()
        
        return {
            "items": [_enrich_order_response(o) for o in orders],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error getting all orders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve orders"
        )


@router.post("/admin/bulk-update-status", status_code=status.HTTP_200_OK)
async def bulk_update_order_status(
    bulk_data: BulkOrderStatusUpdate,
    request: Request,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Bulk update order status (admin/staff only)."""
    order_service = _get_order_service(db)
    
    try:
        updated = order_service.bulk_update_order_status(
            order_ids=bulk_data.order_ids,
            new_status=bulk_data.new_status
        )
        return {
            "message": f"Updated {updated} orders",
            "updated_count": updated
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error bulk updating orders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update orders"
        )


@router.post("/{order_id}/set-delivery-state", response_model=OrderResponse)
async def set_order_delivery_state(
    order_id: int,
    delivery_state: SetDeliveryState,
    request: Request,
    current_user: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Set delivery state for order (admin only)."""
    order_service = _get_order_service(db)
    
    try:
        order = order_service.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Update delivery state (this would be implemented in order_service)
        # For now, this is a placeholder for the actual implementation
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Delivery state update not yet implemented"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting delivery state: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set delivery state"
        )

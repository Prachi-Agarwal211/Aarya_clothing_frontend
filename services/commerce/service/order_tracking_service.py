"""Order tracking service for managing order status history."""
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from models.order_tracking import OrderTracking
from models.order import Order, OrderStatus
from schemas.order_tracking import OrderTrackingCreate


class OrderTrackingService:
    """Service for order tracking/history operations."""
    
    def __init__(self, db: Session):
        """Initialize order tracking service."""
        self.db = db
    
    def get_order_tracking(self, order_id: int) -> List[OrderTracking]:
        """Get tracking history for an order."""
        return self.db.query(OrderTracking).filter(
            OrderTracking.order_id == order_id
        ).order_by(OrderTracking.created_at).all()
    
    def add_tracking_entry(
        self,
        order_id: int,
        status: OrderStatus,
        location: str = None,
        notes: str = None,
        updated_by: int = None
    ) -> OrderTracking:
        """
        Add tracking entry for order.
        Typically called when order status changes.
        """
        # Validate order exists
        order = self.db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        tracking = OrderTracking(
            order_id=order_id,
            status=status,
            location=location,
            notes=notes,
            updated_by=updated_by
        )
        
        self.db.add(tracking)
        self.db.commit()
        self.db.refresh(tracking)
        
        return tracking

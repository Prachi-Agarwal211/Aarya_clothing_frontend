"""Return request service for managing returns and refunds."""
from typing import List, Optional
import json
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status
from datetime import datetime, timezone
from decimal import Decimal

from models.return_request import ReturnRequest, ReturnStatus, ReturnReason, ReturnType
from models.order import Order, OrderStatus
from schemas.return_request import ReturnRequestCreate, ReturnRequestUpdate


class ReturnService:
    """Service for return/refund management operations."""
    
    def __init__(self, db: Session):
        """Initialize return service."""
        self.db = db
    
    def get_user_returns(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 50
    ) -> List[ReturnRequest]:
        """Get all return requests for a user."""
        return self.db.query(ReturnRequest).filter(
            ReturnRequest.user_id == user_id
        ).order_by(desc(ReturnRequest.requested_at)).offset(skip).limit(limit).all()
    
    def get_return_by_id(
        self,
        return_id: int,
        user_id: Optional[int] = None
    ) -> Optional[ReturnRequest]:
        """Get return request by ID with optional user validation."""
        query = self.db.query(ReturnRequest).filter(ReturnRequest.id == return_id)
        
        if user_id:
            query = query.filter(ReturnRequest.user_id == user_id)
        
        return query.first()
    
    def create_return(
        self,
        user_id: int,
        return_data: ReturnRequestCreate
    ) -> ReturnRequest:
        """
        Create return request.
        
        Validation:
        - Order exists and belongs to user
        - Order is delivered
        - No existing return request for this order
        """
        # Validate order
        order = self.db.query(Order).filter(
            Order.id == return_data.order_id,
            Order.user_id == user_id
        ).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Check order status
        if order.status not in [OrderStatus.DELIVERED, OrderStatus.SHIPPED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Can only return delivered/shipped orders. Current status: {order.status.value}"
            )
        
        # Check for existing return
        existing = self.db.query(ReturnRequest).filter(
            ReturnRequest.order_id == return_data.order_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Return request already exists for this order"
            )
        
        # Create return request
        return_request = ReturnRequest(
            order_id=return_data.order_id,
            user_id=user_id,
            reason=return_data.reason,
            type=return_data.type if return_data.type else ReturnType.RETURN,
            items=json.dumps(return_data.items) if return_data.items else None,
            description=return_data.description,
            status=ReturnStatus.REQUESTED,
            refund_amount=order.total_amount,  # Default to full refund
            # Enhanced fields
            exchange_preference=return_data.exchange_preference,
            video_url=return_data.video_url,
        )
        
        self.db.add(return_request)
        self.db.commit()
        self.db.refresh(return_request)
        
        return return_request
    
    def approve_return(
        self,
        return_id: int,
        approved_by: int,
        refund_amount: Optional[Decimal] = None
    ) -> ReturnRequest:
        """
        Approve return request (admin/staff).
        
        Sets:
        - Status to APPROVED
        - Approved by staff ID
        - Refund amount (if different)
        - Approved timestamp
        """
        return_request = self.get_return_by_id(return_id)
        
        if not return_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Return request not found"
            )
        
        if return_request.status != ReturnStatus.REQUESTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve return with status {return_request.status.value}"
            )
        
        return_request.status = ReturnStatus.APPROVED
        return_request.approved_by = approved_by
        return_request.approved_at = datetime.now(timezone.utc)
        
        if refund_amount is not None:
            return_request.refund_amount = refund_amount
        
        self.db.commit()
        self.db.refresh(return_request)
        
        return return_request
    
    def reject_return(
        self,
        return_id: int,
        approved_by: int,
        rejection_reason: str
    ) -> ReturnRequest:
        """Reject return request (admin/staff)."""
        return_request = self.get_return_by_id(return_id)
        
        if not return_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Return request not found"
            )
        
        if return_request.status != ReturnStatus.REQUESTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject return with status {return_request.status.value}"
            )
        
        return_request.status = ReturnStatus.REJECTED
        return_request.approved_by = approved_by
        return_request.rejection_reason = rejection_reason
        
        self.db.commit()
        self.db.refresh(return_request)
        
        return return_request
    
    def mark_item_received(
        self,
        return_id: int,
        tracking_number: Optional[str] = None
    ) -> ReturnRequest:
        """Mark return item as received (admin/staff)."""
        return_request = self.get_return_by_id(return_id)
        
        if not return_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Return request not found"
            )
        
        if return_request.status != ReturnStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Return must be approved before marking as received"
            )
        
        return_request.status = ReturnStatus.RECEIVED
        return_request.is_item_received = True
        return_request.received_at = datetime.now(timezone.utc)
        
        if tracking_number:
            return_request.return_tracking_number = tracking_number
        
        self.db.commit()
        self.db.refresh(return_request)
        
        return return_request
    
    def mark_refunded(
        self,
        return_id: int,
        refund_transaction_id: str
    ) -> ReturnRequest:
        """Mark return as refunded with transaction ID."""
        return_request = self.get_return_by_id(return_id)
        
        if not return_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Return request not found"
            )
        
        if return_request.status != ReturnStatus.RECEIVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Return item must be received before processing refund"
            )
        
        return_request.status = ReturnStatus.REFUNDED
        return_request.refund_transaction_id = refund_transaction_id
        return_request.refunded_at = datetime.now(timezone.utc)
        
        # Update order status
        order = self.db.query(Order).filter(Order.id == return_request.order_id).first()
        if order:
            order.status = OrderStatus.REFUNDED
        
        self.db.commit()
        self.db.refresh(return_request)
        
        return return_request
    
    def get_all_returns(
        self,
        status: Optional[ReturnStatus] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[ReturnRequest]:
        """Get all return requests with optional status filter (admin)."""
        query = self.db.query(ReturnRequest)
        
        if status:
            query = query.filter(ReturnRequest.status == status)
        
        return query.order_by(desc(ReturnRequest.requested_at)).offset(skip).limit(limit).all()

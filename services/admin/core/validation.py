"""Input validation utilities for admin service."""
from typing import Optional, List
from fastapi import HTTPException, status
from enum import Enum


class OrderStatus(str, Enum):
    """Valid order statuses. State machine: CONFIRMED → SHIPPED → DELIVERED, CONFIRMED → CANCELLED."""
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class UserRole(str, Enum):
    """Valid user roles."""
    CUSTOMER = "customer"
    ADMIN = "admin"
    STAFF = "staff"


class InventoryAdjustmentType(str, Enum):
    """Valid inventory adjustment types."""
    ADD = "add"
    REMOVE = "remove"
    ADJUST = "adjust"


def validate_order_status(status: Optional[str]) -> Optional[str]:
    """Validate order status parameter."""
    if status is None:
        return None
    
    valid_statuses = [s.value for s in OrderStatus]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status}'. Valid statuses: {', '.join(valid_statuses)}"
        )
    return status


def validate_user_role(role: Optional[str]) -> Optional[str]:
    """Validate user role parameter."""
    if role is None:
        return None
    
    valid_roles = [r.value for r in UserRole]
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{role}'. Valid roles: {', '.join(valid_roles)}"
        )
    return role


def validate_search_query(search: Optional[str]) -> Optional[str]:
    """Validate search query parameter."""
    if search is None:
        return None
    
    # Remove potentially dangerous characters
    sanitized = search.strip()
    if len(sanitized) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty"
        )
    
    if len(sanitized) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query too long (max 100 characters)"
        )
    
    return sanitized


def validate_pagination(page: int, limit: int) -> tuple[int, int]:
    """Validate pagination parameters."""
    if page < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page must be >= 1"
        )
    
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100"
        )
    
    return page, limit


def validate_inventory_adjustment_type(adjustment_type: str) -> str:
    """Validate inventory adjustment type."""
    valid_types = [t.value for t in InventoryAdjustmentType]
    if adjustment_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid adjustment type '{adjustment_type}'. Valid types: {', '.join(valid_types)}"
        )
    return adjustment_type


def validate_quantity(quantity: int) -> int:
    """Validate quantity parameter."""
    if quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be >= 0"
        )
    
    if quantity > 10000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity too large (max 10000)"
        )
    
    return quantity


def sanitize_order_updates(updates: dict) -> dict:
    """Sanitize and validate order update fields."""
    allowed_fields = {
        "status", "updated_at", "shipped_at", "delivered_at", 
        "cancelled_at", "cancellation_reason"
    }
    
    sanitized = {}
    for key, value in updates.items():
        if key not in allowed_fields:
            continue
        
        if key == "status":
            validate_order_status(value)
        
        sanitized[key] = value
    
    return sanitized

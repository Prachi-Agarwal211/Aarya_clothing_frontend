"""Address service for managing user addresses."""
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models.address import Address, AddressType
from schemas.address import AddressCreate, AddressUpdate


class AddressService:
    """Service for address management operations."""
    
    def __init__(self, db: Session):
        """Initialize address service."""
        self.db = db
    
    def get_user_addresses(self, user_id: int) -> List[Address]:
        """Get all addresses for a user."""
        return self.db.query(Address).filter(
            Address.user_id == user_id,
            Address.is_active == True
        ).all()
    
    def get_address_by_id(self, address_id: int, user_id: Optional[int] = None) -> Optional[Address]:
        """Get address by ID with optional user validation."""
        query = self.db.query(Address).filter(Address.id == address_id)
        
        if user_id:
            query = query.filter(Address.user_id == user_id)
        
        return query.first()
    
    def get_default_address(self, user_id: int, address_type: AddressType = AddressType.SHIPPING) -> Optional[Address]:
        """Get user's default address."""
        return self.db.query(Address).filter(
            Address.user_id == user_id,
            Address.address_type == address_type,
            Address.is_default == True,
            Address.is_active == True
        ).first()
    
    def create_address(self, user_id: int, address_data: AddressCreate) -> Address:
        """Create a new address."""
        # If this is set as default, unset other defaults
        if address_data.is_default:
            self.db.query(Address).filter(
                Address.user_id == user_id,
                Address.address_type == address_data.address_type
            ).update({Address.is_default: False})
        
        # Use JSON mode so enum values match the lowercase PostgreSQL enum literals.
        address = Address(
            user_id=user_id,
            **address_data.model_dump(mode="json")
        )
        
        self.db.add(address)
        self.db.commit()
        self.db.refresh(address)
        
        return address
    
    def update_address(self, address_id: int, user_id: int, address_data: AddressUpdate) -> Address:
        """Update an address."""
        address = self.db.query(Address).filter(
            Address.id == address_id,
            Address.user_id == user_id
        ).first()
        
        if not address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Address not found"
            )
        
        # If setting as default, unset other defaults
        if address_data.is_default:
            self.db.query(Address).filter(
                Address.user_id == user_id,
                Address.address_type == address.address_type,
                Address.id != address_id
            ).update({Address.is_default: False})
        
        update_data = address_data.model_dump(exclude_unset=True, mode="json")
        for field, value in update_data.items():
            setattr(address, field, value)
        
        self.db.commit()
        self.db.refresh(address)
        
        return address
    
    def delete_address(self, address_id: int, user_id: int) -> bool:
        """Delete an address (soft delete)."""
        address = self.db.query(Address).filter(
            Address.id == address_id,
            Address.user_id == user_id
        ).first()
        
        if not address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Address not found"
            )
        
        address.is_active = False
        self.db.commit()
        
        return True

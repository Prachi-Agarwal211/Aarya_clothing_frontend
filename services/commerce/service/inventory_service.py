"""Inventory service for stock management."""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlalchemy.exc import OperationalError
from fastapi import HTTPException, status

from models.inventory import Inventory
from models.product import Product
from models.stock_reservation import StockReservation, ReservationStatus
from schemas.inventory import InventoryCreate, InventoryUpdate, LowStockItem
import uuid
from datetime import datetime, timezone, timedelta


class InventoryService:
    """Service for inventory management operations."""
    
    def __init__(self, db: Session):
        """Initialize inventory service."""
        self.db = db
    
    def get_inventory_by_sku(self, sku: str) -> Optional[Inventory]:
        """Get inventory by SKU."""
        return self.db.query(Inventory).filter(Inventory.sku == sku).first()
    
    def get_inventory_by_sku_for_update(self, sku: str, nowait: bool = True) -> Optional[Inventory]:
        """Get inventory by SKU with pessimistic locking."""
        query = self.db.query(Inventory).filter(Inventory.sku == sku)
        if nowait:
            query = query.with_for_update(nowait=True)
        else:
            query = query.with_for_update()
        return query.first()
    
    def get_product_inventory(self, product_id: int) -> List[Inventory]:
        """Get all inventory for a product."""
        return self.db.query(Inventory).filter(Inventory.product_id == product_id).all()
    
    def create_inventory(self, inventory_data: InventoryCreate) -> Inventory:
        """Create new inventory record."""
        # Validate product exists
        product = self.db.query(Product).filter(Product.id == inventory_data.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {inventory_data.product_id} not found"
            )
        
        # Check SKU uniqueness
        existing = self.get_inventory_by_sku(inventory_data.sku)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inventory with SKU '{inventory_data.sku}' already exists"
            )
        
        inventory = Inventory(**inventory_data.model_dump())
        self.db.add(inventory)
        self.db.commit()
        self.db.refresh(inventory)
        return inventory
    
    def update_inventory(self, inventory_id: int, inventory_data: InventoryUpdate) -> Inventory:
        """Update inventory."""
        inventory = self.db.query(Inventory).filter(Inventory.id == inventory_id).first()
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found"
            )
        
        update_data = inventory_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(inventory, field, value)
        
        self.db.commit()
        self.db.refresh(inventory)
        return inventory
    
    def adjust_stock(self, sku: str, adjustment: int, reason: str = "") -> Inventory:
        """Adjust inventory stock with pessimistic locking to prevent race conditions."""
        try:
            inventory = self.get_inventory_by_sku_for_update(sku)
        except OperationalError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory is being updated by another process. Please retry."
            )
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with SKU '{sku}' not found"
            )

        new_quantity = inventory.quantity + adjustment
        if new_quantity < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock cannot go negative. Current: {inventory.quantity}, Adjustment: {adjustment}"
            )

        inventory.quantity = new_quantity
        self.db.commit()
        self.db.refresh(inventory)
        return inventory
    
    def reserve_stock(self, sku: str, quantity: int, user_id: int, expires_minutes: int = 15) -> str:
        """
        Reserve stock atomically using SELECT FOR UPDATE + savepoint.
        Prevents overselling under concurrent load.
        """
        if quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quantity must be greater than zero"
            )
        try:
            inventory = self.get_inventory_by_sku_for_update(sku)
        except OperationalError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory is being updated. Please retry in a moment."
            )
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with SKU '{sku}' not found"
            )

        if inventory.available_quantity < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock. Available: {inventory.available_quantity}, Requested: {quantity}"
            )

        res_id = f"res_{uuid.uuid4().hex[:12]}"
        try:
            with self.db.begin_nested():  # savepoint — atomic check+update
                inventory.reserved_quantity += quantity
                reservation = StockReservation(
                    reservation_id=res_id,
                    user_id=user_id,
                    sku=sku,
                    quantity=quantity,
                    status=ReservationStatus.PENDING,
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
                )
                self.db.add(reservation)
        except Exception:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Failed to reserve stock. Please retry."
            )
        self.db.commit()
        return res_id
    
    def release_stock(self, sku: str, quantity: int, user_id: int = None) -> bool:
        """Release reserved stock."""
        try:
            inventory = self.get_inventory_by_sku_for_update(sku)
        except OperationalError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory is being updated. Please retry."
            )
        if not inventory:
            return False
            
        # Find active reservations for this sku to release
        query = self.db.query(StockReservation).filter(
            StockReservation.sku == sku,
            StockReservation.status == ReservationStatus.PENDING
        )
        if user_id:
            query = query.filter(StockReservation.user_id == user_id)

        reservations = query.order_by(StockReservation.created_at.desc()).limit(500).all()
        
        released_qty = 0
        for res in reservations:
            if released_qty >= quantity:
                break
                
            qty_to_release = min(res.quantity, quantity - released_qty)
            released_qty += qty_to_release
            
            if qty_to_release == res.quantity:
                res.status = ReservationStatus.RELEASED
            else:
                res.quantity -= qty_to_release
        
        inventory.reserved_quantity = max(0, inventory.reserved_quantity - released_qty)
        self.db.commit()
        return True
    
    def confirm_reservation(self, sku: str, quantity: int, user_id: int = None, order_id: int = None) -> bool:
        """Confirm reservation and reduce actual stock."""
        try:
            inventory = self.get_inventory_by_sku_for_update(sku)
        except OperationalError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory is being updated. Please retry."
            )
        if not inventory:
            return False
        
        # Find and update the reservations
        query = self.db.query(StockReservation).filter(
            StockReservation.sku == sku,
            StockReservation.status == ReservationStatus.PENDING
        )
        if user_id:
            query = query.filter(StockReservation.user_id == user_id)
            
        reservations = query.order_by(StockReservation.created_at.asc()).limit(500).all()
        
        confirmed_qty = 0
        for res in reservations:
            if confirmed_qty >= quantity:
                break
            
            qty_to_confirm = min(res.quantity, quantity - confirmed_qty)
            confirmed_qty += qty_to_confirm
            
            if qty_to_confirm == res.quantity:
                # Full reservation confirmed
                res.status = ReservationStatus.CONFIRMED
                if order_id:
                    res.order_id = order_id
            else:
                # Partial confirm: shrink the PENDING row to the remainder,
                # create a new CONFIRMED row for the confirmed portion.
                res.quantity -= qty_to_confirm
                confirmed_row = StockReservation(
                    reservation_id=f"{res.reservation_id}_c{confirmed_qty}",
                    user_id=res.user_id,
                    sku=res.sku,
                    quantity=qty_to_confirm,
                    status=ReservationStatus.CONFIRMED,
                    expires_at=res.expires_at,
                    order_id=order_id,
                )
                self.db.add(confirmed_row)
        
        inventory.quantity -= confirmed_qty
        inventory.reserved_quantity -= confirmed_qty
        
        # Ensure no negative values
        inventory.quantity = max(0, inventory.quantity)
        inventory.reserved_quantity = max(0, inventory.reserved_quantity)
        
        self.db.commit()
        return True
    
    def deduct_stock_for_order(self, sku: str, quantity: int) -> bool:
        """
        Atomically deduct stock when an order is placed.
        Uses SELECT FOR UPDATE to prevent overselling under concurrent load.
        Does NOT commit — caller must commit the transaction.
        """
        try:
            inventory = self.get_inventory_by_sku_for_update(sku)
        except OperationalError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory is being updated. Please retry."
            )
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with SKU '{sku}' not found"
            )
        if inventory.quantity < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for {sku}. Available: {inventory.quantity}, Required: {quantity}"
            )
        inventory.quantity -= quantity
        inventory.reserved_quantity = max(0, inventory.reserved_quantity - quantity)
        return True

    def get_low_stock_items(self) -> List[LowStockItem]:
        """Get all low stock items."""
        low_stock = self.db.query(Inventory).filter(
            Inventory.quantity - Inventory.reserved_quantity <= Inventory.low_stock_threshold
        ).all()
        
        items = []
        for inv in low_stock:
            product = self.db.query(Product).filter(Product.id == inv.product_id).first()
            if product:
                items.append(LowStockItem(
                    product_id=inv.product_id,
                    product_name=product.name,
                    sku=inv.sku,
                    size=inv.size,
                    color=inv.color,
                    available_quantity=inv.available_quantity,
                    low_stock_threshold=inv.low_stock_threshold
                ))
        
        return items

"""Inventory service for stock management."""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlalchemy.exc import OperationalError
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

from models.inventory import Inventory
from models.product import Product
from schemas.inventory import InventoryCreate, InventoryUpdate, LowStockItem
from shared.time_utils import ist_naive


class InventoryService:
    """Service for inventory management operations."""

    def __init__(self, db: Session):
        """Initialize inventory service."""
        self.db = db

    def get_inventory_by_sku(self, sku: str) -> Optional[Inventory]:
        """Get inventory by SKU."""
        return self.db.query(Inventory).filter(Inventory.sku == sku).first()

    def get_inventory_by_sku_for_update(
        self, sku: str, skip_locked: bool = True
    ) -> Optional[Inventory]:
        """Get inventory by SKU with pessimistic locking.

        Uses skip_locked=True (instead of nowait=True) so concurrent
        transactions wait briefly rather than failing immediately.
        This reduces unnecessary OperationalError retries under load.
        """
        query = self.db.query(Inventory).filter(Inventory.sku == sku)
        if skip_locked:
            query = query.with_for_update(skip_locked=True)
        else:
            query = query.with_for_update()
        return query.first()

    def get_product_inventory(self, product_id: int) -> List[Inventory]:
        """Get all inventory for a product."""
        return self.db.query(Inventory).filter(Inventory.product_id == product_id).all()

    def create_inventory(self, inventory_data: InventoryCreate) -> Inventory:
        """Create new inventory record."""
        # Validate product exists
        product = (
            self.db.query(Product)
            .filter(Product.id == inventory_data.product_id)
            .first()
        )
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {inventory_data.product_id} not found",
            )

        # Check SKU uniqueness
        existing = self.get_inventory_by_sku(inventory_data.sku)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inventory with SKU '{inventory_data.sku}' already exists",
            )

        inventory = Inventory(**inventory_data.model_dump())
        self.db.add(inventory)
        self.db.commit()
        self.db.refresh(inventory)
        return inventory

    def update_inventory(
        self, inventory_id: int, inventory_data: InventoryUpdate
    ) -> Inventory:
        """Update inventory."""
        inventory = (
            self.db.query(Inventory).filter(Inventory.id == inventory_id).first()
        )
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        update_data = inventory_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(inventory, field, value)

        self.db.commit()
        self.db.refresh(inventory)
        return inventory

    def adjust_stock(self, sku: str, adjustment: int, reason: str = "", movement_type: str = "manual") -> Inventory:
        """Adjust inventory stock with pessimistic locking to prevent race conditions.

        Creates an InventoryMovement audit trail entry for every adjustment.
        """
        try:
            inventory = self.get_inventory_by_sku_for_update(sku)
        except OperationalError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory is being updated by another process. Please retry.",
            )
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with SKU '{sku}' not found",
            )

        new_quantity = inventory.quantity + adjustment
        if new_quantity < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock cannot go negative. Current: {inventory.quantity}, Adjustment: {adjustment}",
            )

        old_quantity = inventory.quantity
        inventory.quantity = new_quantity

        # Sync product.total_stock (denormalized) using delta — efficient O(1)
        try:
            product = self.db.query(Product).filter(Product.id == inventory.product_id).first()
            if product:
                product.total_stock = max(0, (product.total_stock or 0) + adjustment)
        except Exception as e:
            logger.warning(f"Failed to sync product.total_stock for product {inventory.product_id}: {e}")

        # Audit trail: record every stock adjustment
        try:
            from models.inventory_movement import InventoryMovement
            movement = InventoryMovement(
                inventory_id=inventory.id,
                product_id=inventory.product_id,
                quantity_change=adjustment,
                movement_type=movement_type,
                notes=reason or f"Stock adjusted from {old_quantity} to {new_quantity}",
            )
            self.db.add(movement)
        except Exception as e:
            logger.warning(f"Failed to create inventory movement audit trail for SKU {sku}: {e}")

        self.db.commit()
        self.db.refresh(inventory)
        return inventory

    def deduct_stock_for_order(self, sku: str, quantity: int) -> bool:
        """
        Atomically deduct stock when an order is placed.
        Uses SELECT FOR UPDATE to prevent overselling under concurrent load.
        Uses available_quantity (quantity - reserved_quantity) to prevent overselling.
        Does NOT commit — caller must commit the transaction.

        NOTE: Uses skip_locked=False so concurrent transactions WAIT for the
        row lock rather than skipping it. This prevents the misleading 404
        "Inventory not found" error when two orders race for the same SKU.
        """
        try:
            inventory = self.get_inventory_by_sku_for_update(sku, skip_locked=False)
        except OperationalError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory is being updated. Please retry.",
            )
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with SKU '{sku}' not found",
            )
        if inventory.available_quantity < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for {sku}. Available: {inventory.available_quantity}, Required: {quantity}",
            )
        inventory.quantity -= quantity

        # Sync product.total_stock (denormalized) to keep it accurate
        try:
            product = self.db.query(Product).filter(Product.id == inventory.product_id).first()
            if product:
                product.total_stock = max(0, (product.total_stock or 0) - quantity)
        except Exception as e:
            logger.warning(f"Failed to sync product.total_stock for product {inventory.product_id}: {e}")

        return True

    def reserve_stock(
        self, sku: str, quantity: int, user_id: int, reservation_id: str,
        ttl_minutes: int = 30,
    ) -> bool:
        """
        Atomically reserve stock for a pending checkout (pre-payment).

        Uses SELECT FOR UPDATE to serialize concurrent reservations for the
        same SKU.  Increments ``reserved_quantity`` on the inventory row and
        inserts a ``StockReservation`` record with an expiry timestamp.

        Returns True on success.  Raises HTTPException (400) if insufficient
        available stock, or (409) on lock contention.

        NOTE: Does NOT commit — caller must commit the transaction.
        """
        from datetime import timedelta
        from models.stock_reservation import StockReservation, ReservationStatus

        try:
            inventory = self.get_inventory_by_sku_for_update(sku, skip_locked=False)
        except OperationalError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Inventory locked by another process. Please retry.",
            )
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with SKU '{sku}' not found",
            )
        if inventory.available_quantity < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for {sku}. "
                    f"Available: {inventory.available_quantity}, Required: {quantity}"
                ),
            )

        inventory.reserved_quantity += quantity

        # Create reservation tracking record
        reservation = StockReservation(
            reservation_id=reservation_id,
            user_id=user_id,
            sku=sku,
            quantity=quantity,
            status=ReservationStatus.PENDING,
            expires_at=ist_naive() + timedelta(minutes=ttl_minutes),
        )
        self.db.add(reservation)

        logger.info(
            f"RESERVE_STOCK: sku={sku} qty={quantity} user={user_id} "
            f"reserved_new={inventory.reserved_quantity} avail={inventory.available_quantity}"
        )
        return True

    def confirm_reservation(self, reservation_id: str) -> bool:
        """
        Confirm a reservation: deduct the reserved quantity permanently.

        Called after payment succeeds.  Reduces both ``reserved_quantity``
        and ``quantity`` so the stock is permanently consumed.
        Does NOT commit — caller must commit.
        """
        from models.stock_reservation import StockReservation, ReservationStatus

        reservation = (
            self.db.query(StockReservation)
            .filter(StockReservation.reservation_id == reservation_id)
            .first()
        )
        if not reservation:
            logger.warning(f"RESERVATION_NOT_FOUND: {reservation_id}")
            return False
        if reservation.status != ReservationStatus.PENDING:
            logger.info(
                f"RESERVATION_ALREADY_{reservation.status.value.upper()}: {reservation_id}"
            )
            return True  # Idempotent — already processed

        inventory = self.get_inventory_by_sku_for_update(reservation.sku, skip_locked=False)
        if not inventory:
            logger.error(f"INVENTORY_MISSING_FOR_RESERVATION: sku={reservation.sku}")
            return False

        qty = reservation.quantity
        # Safety: never drive physical quantity negative even if reserved_quantity drifted
        if inventory.quantity < qty:
            logger.error(
                f"CONFIRM_RESERVATION_INSUFFICIENT: sku={reservation.sku} "
                f"qty={qty} on_hand={inventory.quantity} reserved={inventory.reserved_quantity}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient on-hand stock for {reservation.sku} while confirming "
                    f"reservation (have {inventory.quantity}, need {qty})."
                ),
            )

        # Permanent deduction: reduce both reserved and total quantity
        inventory.reserved_quantity = max(0, inventory.reserved_quantity - qty)
        inventory.quantity -= qty

        reservation.status = ReservationStatus.CONFIRMED
        # order_id set by caller when known

        # Sync product.total_stock
        try:
            product = self.db.query(Product).filter(Product.id == inventory.product_id).first()
            if product:
                product.total_stock = max(0, (product.total_stock or 0) - qty)
        except Exception as e:
            logger.warning(f"Failed to sync product.total_stock: {e}")

        logger.info(
            f"CONFIRM_RESERVATION: sku={reservation.sku} qty={qty} "
            f"remaining_qty={inventory.quantity}"
        )
        return True

    def release_reservation(self, reservation_id: str) -> bool:
        """
        Release a reservation: return stock to available pool.

        Called when payment fails, expires, or is cancelled.  Decrements
        ``reserved_quantity`` without touching ``quantity``.
        Does NOT commit — caller must commit.
        """
        from models.stock_reservation import StockReservation, ReservationStatus

        reservation = (
            self.db.query(StockReservation)
            .filter(StockReservation.reservation_id == reservation_id)
            .first()
        )
        if not reservation:
            logger.warning(f"RESERVATION_NOT_FOUND_FOR_RELEASE: {reservation_id}")
            return False
        if reservation.status != ReservationStatus.PENDING:
            logger.info(
                f"RESERVATION_ALREADY_{reservation.status.value.upper()}_FOR_RELEASE: {reservation_id}"
            )
            return True  # Idempotent

        inventory = self.get_inventory_by_sku_for_update(reservation.sku, skip_locked=True)
        if inventory:
            inventory.reserved_quantity = max(0, inventory.reserved_quantity - reservation.quantity)
        else:
            logger.error(f"INVENTORY_MISSING_FOR_RELEASE: sku={reservation.sku}")

        reservation.status = ReservationStatus.RELEASED

        logger.info(
            f"RELEASE_RESERVATION: sku={reservation.sku} qty={reservation.quantity} user={reservation.user_id}"
        )
        return True

    def expire_stale_reservations(self, max_age_minutes: int = 30) -> int:
        """
        Release all PENDING reservations older than ``max_age_minutes``.

        Background job calls this periodically to prevent stock from being
        locked indefinitely when users abandon checkout.
        Returns the number of released reservations.
        """
        from models.stock_reservation import StockReservation, ReservationStatus

        # CRITICAL FIX: Use ist_naive() to match the timezone used by expires_at
        # (which is set via ist_naive() in reserve_stock). Using utcnow() caused
        # reservations to expire ~5.5 hours late.
        cutoff = ist_naive()
        stale = (
            self.db.query(StockReservation)
            .filter(
                StockReservation.status == ReservationStatus.PENDING,
                StockReservation.expires_at <= cutoff,
            )
            .all()
        )

        released = 0
        for res in stale:
            try:
                inventory = self.get_inventory_by_sku_for_update(res.sku, skip_locked=True)
                if inventory:
                    inventory.reserved_quantity = max(
                        0, inventory.reserved_quantity - res.quantity
                    )
                res.status = ReservationStatus.EXPIRED
                released += 1
                logger.info(
                    f"EXPIRED_RESERVATION: id={res.reservation_id} sku={res.sku} "
                    f"qty={res.quantity} user={res.user_id}"
                )
            except Exception as e:
                logger.error(f"Failed to expire reservation {res.reservation_id}: {e}")

        if released > 0:
            self.db.commit()
            logger.info(f"EXPIRED_STALE_RESERVATIONS: released={released}")
        return released

    def get_low_stock_items(self) -> List[LowStockItem]:
        """Get all low stock items."""
        low_stock = (
            self.db.query(Inventory)
            .filter(
                Inventory.quantity - Inventory.reserved_quantity
                <= Inventory.low_stock_threshold
            )
            .all()
        )

        items = []
        for inv in low_stock:
            product = (
                self.db.query(Product).filter(Product.id == inv.product_id).first()
            )
            if product:
                items.append(
                    LowStockItem(
                        product_id=inv.product_id,
                        product_name=product.name,
                        sku=inv.sku,
                        size=inv.size,
                        color=inv.color,
                        available_quantity=inv.available_quantity,
                        low_stock_threshold=inv.low_stock_threshold,
                    )
                )

        return items

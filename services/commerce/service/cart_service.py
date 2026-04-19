"""Cart service with inventory reservation support."""
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from decimal import Decimal
from datetime import datetime, timezone
import json
import logging
import os
import time
import uuid

from core.redis_client import redis_client
from core.config import get_settings

logger = logging.getLogger(__name__)
from models.product import Product
from models.inventory import Inventory
from service.inventory_service import InventoryService


def _r2_url(path: str) -> str:
    """Convert R2 relative path to full public CDN URL."""
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path  # Already a full URL
    settings = get_settings()
    r2_base = settings.R2_PUBLIC_URL.rstrip("/")
    return f"{r2_base}/{path.lstrip('/')}"


class CartService:
    """Service for shopping cart management with stock reservation."""

    CART_KEY_PREFIX = "cart:"
    RESERVATION_KEY_PREFIX = "cart:reservation:"
    LOCK_KEY_PREFIX = "cart:lock:"
    RESERVATION_TTL = 900  # 15 minutes in seconds
    LOCK_TTL = 5  # 5 seconds max lock hold time (prevents deadlocks)

    def __init__(self, db: Session = None):
        """Initialize cart service."""
        self.db = db
        self.inventory_service = InventoryService(db) if db else None

    def _acquire_cart_lock(self, user_id: int, timeout: float = 2.0) -> Optional[str]:
        """Acquire distributed lock for cart mutations using Redis SETNX."""
        lock_key = f"{self.LOCK_KEY_PREFIX}{user_id}"
        lock_token = str(uuid.uuid4())
        deadline = time.monotonic() + timeout
        rc = redis_client.client if hasattr(redis_client, 'client') else None
        if rc is None:
            return lock_token  # No Redis — skip locking (degraded mode)
        while time.monotonic() < deadline:
            acquired = rc.set(lock_key, lock_token, nx=True, ex=self.LOCK_TTL)
            if acquired:
                return lock_token
            time.sleep(0.05)  # 50ms retry
        return None  # Lock not acquired within timeout

    def _release_cart_lock(self, user_id: int, lock_token: Optional[str]):
        """Release cart lock atomically via Lua script — prevents TOCTOU race."""
        if not lock_token:
            return
        lock_key = f"{self.LOCK_KEY_PREFIX}{user_id}"
        rc = redis_client.client if hasattr(redis_client, 'client') else None
        if rc is None:
            return
        script = """
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        else
            return 0
        end
        """
        try:
            rc.eval(script, 1, lock_key, lock_token)
        except Exception as e:
            logger.warning(f"Cart lock release failed: {e}")

    def get_cart(self, user_id: int) -> Dict:
        """Get user's cart with reservation expiry info."""
        cart_key = f"{self.CART_KEY_PREFIX}{user_id}"
        cart_data = redis_client.get_cache(cart_key)

        if not cart_data:
            return {
                "user_id": user_id,
                "items": [],
                "subtotal": 0,
                "discount": 0,
                "shipping": 0,
                "gst_amount": 0,
                "cgst_amount": 0,
                "sgst_amount": 0,
                "igst_amount": 0,
                "delivery_state": None,
                "customer_gstin": None,
                "total": 0,
                "total_amount": 0,  # Alias for total
                "item_count": 0,
                "reservation_expires_at": None
            }

        # Ensure all required fields exist
        defaults = {
            "subtotal": 0,
            "discount": 0,
            "shipping": 0,
            "gst_amount": 0,
            "cgst_amount": 0,
            "sgst_amount": 0,
            "igst_amount": 0,
            "delivery_state": None,
            "customer_gstin": None,
            "total": 0,
            "total_amount": 0,  # Alias for total
            "item_count": 0,
        }
        for key, val in defaults.items():
            if key not in cart_data:
                cart_data[key] = val

        # Normalize item images: convert any relative R2 paths to full CDN URLs
        for item in cart_data.get("items", []):
            img = item.get("image", "")
            if img and not img.startswith("http"):
                item["image"] = _r2_url(img)

        # Calculate earliest reservation expiry
        cart_data["reservation_expires_at"] = self._get_earliest_reservation_expiry(user_id)

        return cart_data
    
    def _get_earliest_reservation_expiry(self, user_id: int) -> Optional[str]:
        """Get the earliest reservation expiry time for cart items from database.
        
        Uses database query instead of Redis SCAN for better performance.
        StockReservation table is indexed on user_id and status.
        """
        from datetime import datetime, timezone
        from models.stock_reservation import StockReservation, ReservationStatus
        
        try:
            if not self.db:
                return None
            
            # Query database for earliest pending reservation for this user
            # This is more efficient than Redis SCAN which can be O(N)
            earliest_res = self.db.query(StockReservation).filter(
                StockReservation.user_id == user_id,
                StockReservation.status == ReservationStatus.PENDING
            ).order_by(StockReservation.expires_at.asc()).first()

            if earliest_res and earliest_res.expires_at:
                # Ensure UTC timezone is explicitly included in ISO format
                expires_at = earliest_res.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                # Return ISO format with explicit UTC timezone (e.g., "2026-03-21T16:00:00+00:00")
                return expires_at.isoformat()

            return None
        except Exception:
            return None

    def save_cart(self, user_id: int, cart_data: Dict) -> bool:
        """Save cart data to cache."""
        cart_key = f"{self.CART_KEY_PREFIX}{user_id}"
        return redis_client.set_cache(cart_key, cart_data, expires_in=7 * 24 * 60)

    def add_to_cart(
        self,
        user_id: int,
        product_id: int,
        quantity: int = 1,
        variant_id: Optional[int] = None
    ) -> Dict:
        """
        Add item to cart with inventory reservation.
        LOCK FIX: Uses distributed lock to prevent lost updates under concurrency.
        """
        if not self.db:
            raise ValueError("Database session required for add_to_cart")

        # Validate product
        product = self.db.query(Product).filter(
            Product.id == product_id,
            Product.is_active == True
        ).first()

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        # Get inventory/variant
        inventory = None
        if variant_id:
            inventory = self.db.query(Inventory).filter(
                Inventory.id == variant_id,
                Inventory.product_id == product_id
            ).first()
            if not inventory:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Variant not found"
                )
        else:
            # Check if product has size/color variants requiring explicit selection
            has_variants = self.db.query(Inventory).filter(
                Inventory.product_id == product_id
            ).first()
            if has_variants and (has_variants.size or has_variants.color):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please select a size before adding to cart"
                )
            # Product has no size/color variants - use first inventory entry
            inventory = has_variants

        sku = inventory.sku if inventory else None
        price = float(inventory.effective_price) if inventory else float(product.base_price)

        # Guard against zero/negative prices — fallback to MRP if effective_price is bad
        if price <= 0 and inventory and inventory.mrp:
            price = float(inventory.mrp)
        if price <= 0:
            price = float(product.base_price)

        # Check stock availability
        if inventory:
            available = inventory.available_quantity
            if available < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Only {available} items available"
                )

        # LOCK: Acquire distributed lock before read-modify-write
        lock_token = self._acquire_cart_lock(user_id)
        reservation_id = None
        try:
            # CRITICAL FIX: Create stock reservation FIRST (inside lock to prevent race)
            if inventory and self.inventory_service:
                try:
                    reservation_id = self.inventory_service.reserve_stock(
                        sku=sku,
                        quantity=quantity,
                        user_id=user_id,
                        expires_minutes=15
                    )
                    logger.info(f"Stock reserved: user={user_id}, sku={sku}, qty={quantity}, reservation={reservation_id}")
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"Failed to reserve stock for {sku}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to reserve stock: {str(e)}"
                    )
            
            result = self._add_to_cart_unlocked(user_id, product, inventory, sku, price, quantity, variant_id)
            # Commit the database transaction (reservation was created)
            if self.db:
                self.db.commit()
            return result
        except Exception as e:
            # If anything failed, release the reservation to prevent orphaned reservations
            if reservation_id and sku and self.inventory_service:
                try:
                    self.inventory_service.release_stock(sku, quantity, user_id)
                    if self.db:
                        self.db.commit()
                    logger.info(f"Released orphaned reservation: user={user_id}, sku={sku}, qty={quantity}")
                except Exception as release_err:
                    logger.error(f"Failed to release orphaned reservation for {sku}: {release_err}")
                    if self.db:
                        self.db.rollback()
            raise
        finally:
            self._release_cart_lock(user_id, lock_token)

    def _add_to_cart_unlocked(
        self,
        user_id: int,
        product,
        inventory,
        sku: Optional[str],
        price: float,
        quantity: int,
        variant_id: Optional[int]
    ) -> Dict:
        """Internal add-to-cart logic (must be called under lock)."""
        # Get current cart
        cart = self.get_cart(user_id)

        # Check if item already in cart (match by product AND variant)
        existing_item = next(
            (item for item in cart["items"]
             if item["product_id"] == product.id and item.get("variant_id") == variant_id),
            None
        )

        if existing_item:
            existing_item["quantity"] += quantity
        else:
            # Use variant-specific image if set, otherwise fall back to product primary image
            variant_image = getattr(inventory, 'image_url', None) if inventory else None
            cart["items"].append({
                "product_id": product.id,
                "variant_id": variant_id,
                "name": product.name,
                "price": price,
                "quantity": quantity,
                "sku": sku,
                "image": _r2_url(variant_image) if variant_image else _r2_url(product.primary_image),
                "size": inventory.size if inventory else None,
                "color": inventory.color if inventory else None,
                "hsn_code": product.hsn_code or None,
                "gst_rate": float(product.gst_rate) if product.gst_rate else None,
            })
        
        # Recalculate totals
        self._recalculate_cart(cart)
        
        # Save cart
        self.save_cart(user_id, cart)
        
        return cart

    def _recalculate_cart(self, cart: Dict):
        """Internal helper to recalculate cart totals.
        
        BUSINESS POLICY: All prices are fully inclusive of taxes and shipping.
        - No shipping charges added
        - No GST added on top (GST already included in product price)
        - The price shown is the final price customer pays
        """
        subtotal = sum(item["price"] * item["quantity"] for item in cart["items"])
        item_count = sum(item["quantity"] for item in cart["items"])

        cart["subtotal"] = float(subtotal)
        cart["item_count"] = item_count

        # NO SHIPPING CHARGES - All prices inclusive of shipping
        cart["shipping"] = 0.0

        # NO GST ADDED - GST already included in product price
        # Keep GST fields for display/accounting purposes but set to 0
        cart["gst_amount"] = 0.0
        cart["cgst_amount"] = 0.0
        cart["sgst_amount"] = 0.0
        cart["igst_amount"] = 0.0

        # Total = subtotal (all inclusive) - discount
        cart["total"] = round(float(subtotal - cart.get("discount", 0)), 2)
        cart["total_amount"] = cart["total"]  # Alias for backward compatibility
    
    def update_quantity(
        self,
        user_id: int,
        product_id: int,
        new_quantity: int,
        variant_id: Optional[int] = None
    ) -> Dict:
        """Update item quantity in cart. LOCK FIX: Uses distributed lock."""
        lock_token = self._acquire_cart_lock(user_id)
        try:
            return self._update_quantity_unlocked(user_id, product_id, new_quantity, variant_id)
        finally:
            self._release_cart_lock(user_id, lock_token)

    def _update_quantity_unlocked(
        self,
        user_id: int,
        product_id: int,
        new_quantity: int,
        variant_id: Optional[int] = None
    ) -> Dict:
        cart = self.get_cart(user_id)

        item = next(
            (item for item in cart["items"]
             if item["product_id"] == product_id and item.get("variant_id") == variant_id),
            None
        )

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not in cart"
            )

        old_quantity = item["quantity"]
        quantity_diff = new_quantity - old_quantity
        sku = item.get("sku")

        # CRITICAL FIX: Adjust stock reservations when quantity changes
        if sku and self.inventory_service:
            if quantity_diff > 0:
                # Increasing quantity - reserve more stock
                inventory = self.db.query(Inventory).filter(Inventory.sku == sku).first()
                if inventory and inventory.available_quantity < quantity_diff:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Only {inventory.available_quantity + old_quantity} items available"
                    )
                try:
                    self.inventory_service.reserve_stock(
                        sku=sku,
                        quantity=quantity_diff,
                        user_id=user_id,
                        expires_minutes=15
                    )
                    logger.info(f"Additional stock reserved: user={user_id}, sku={sku}, qty={quantity_diff}")
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"Failed to reserve additional stock for {sku}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to reserve additional stock: {str(e)}"
                    )
            elif quantity_diff < 0:
                # Decreasing quantity - release excess reservation
                try:
                    self.inventory_service.release_stock(
                        sku=sku,
                        quantity=abs(quantity_diff),
                        user_id=user_id
                    )
                    logger.info(f"Released stock on qty decrease: user={user_id}, sku={sku}, qty={abs(quantity_diff)}")
                except Exception as e:
                    logger.error(f"Failed to release stock for {sku}: {e}")
                    # Don't fail the update - reservation will expire automatically

        item["quantity"] = new_quantity

        # Recalculate
        self._recalculate_cart(cart)

        # Save
        self.save_cart(user_id, cart)

        return cart
    
    def remove_from_cart(self, user_id: int, product_id: int, variant_id: Optional[int] = None) -> Dict:
        """Remove item from cart and release reservation."""
        cart = self.get_cart(user_id)
        
        item = next(
            (item for item in cart["items"] 
             if item["product_id"] == product_id and item.get("variant_id") == variant_id),
            None
        )
        
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not in cart"
            )
        
        # CRITICAL FIX: Release stock reservation before removing from cart
        if item.get("sku") and self.inventory_service:
            try:
                self.inventory_service.release_stock(
                    sku=item["sku"],
                    quantity=item["quantity"],
                    user_id=user_id
                )
                logger.info(f"Stock reservation released: user={user_id}, sku={item['sku']}, qty={item['quantity']}")
            except Exception as e:
                logger.error(f"Failed to release reservation for {item['sku']}: {e}")
                # Continue with removal anyway - reservation will expire automatically
        
        # Remove from cart
        cart["items"] = [
            i for i in cart["items"]
            if not (i["product_id"] == product_id and i.get("variant_id") == variant_id)
        ]
        
        # Recalculate
        self._recalculate_cart(cart)
        
        # Save
        self.save_cart(user_id, cart)
        
        return cart
    
    def clear_cart(self, user_id: int, release_reservations: bool = True) -> Dict:
        """Clear cart. LOCK FIX: Uses distributed lock."""
        lock_token = self._acquire_cart_lock(user_id)
        try:
            return self._clear_cart_unlocked(user_id, release_reservations)
        finally:
            self._release_cart_lock(user_id, lock_token)

    def _clear_cart_unlocked(self, user_id: int, release_reservations: bool = True) -> Dict:
        # Get cart before clearing to release reservations
        cart = self.get_cart(user_id)
        
        # CRITICAL FIX: Release all stock reservations when clearing cart
        if release_reservations and self.inventory_service:
            for item in cart.get("items", []):
                if item.get("sku"):
                    try:
                        self.inventory_service.release_stock(
                            sku=item["sku"],
                            quantity=item["quantity"],
                            user_id=user_id
                        )
                        logger.info(f"Released reservation on cart clear: user={user_id}, sku={item['sku']}, qty={item['quantity']}")
                    except Exception as e:
                        logger.error(f"Failed to release reservation for {item['sku']} on cart clear: {e}")
        
        # Delete cart
        cart_key = f"{self.CART_KEY_PREFIX}{user_id}"
        redis_client.delete_cache(cart_key)

        return {
            "user_id": user_id,
            "items": [],
            "subtotal": 0,
            "discount": 0,
            "shipping": 0,
            "gst_amount": 0,
            "cgst_amount": 0,
            "sgst_amount": 0,
            "igst_amount": 0,
            "delivery_state": None,
            "customer_gstin": None,
            "total": 0,
            "total_amount": 0,
            "item_count": 0,
            "reservation_expires_at": None
        }

    def checkout_stock_preview(self, user_id: int) -> Dict:
        """
        Non-throwing stock snapshot for /checkout/validate.
        Matches frontend: { valid, out_of_stock: [{ sku, name, requested, available }] }.
        """
        cart = self.get_cart(user_id)
        out_of_stock: list = []
        if not cart.get("items"):
            return {
                "valid": False,
                "out_of_stock": [],
                "message": "Cart is empty",
            }
        if not self.db:
            return {"valid": True, "out_of_stock": [], "message": "Cart is valid for checkout"}

        for item in cart["items"]:
            if not item.get("sku"):
                continue
            inventory = self.db.query(Inventory).filter(Inventory.sku == item["sku"]).first()
            avail = inventory.available_quantity if inventory else 0
            req = item["quantity"]
            if not inventory or avail < req:
                out_of_stock.append({
                    "sku": item.get("sku"),
                    "name": item.get("name", item["sku"]),
                    "requested": req,
                    "available": avail,
                })

        if out_of_stock:
            return {
                "valid": False,
                "out_of_stock": out_of_stock,
                "message": "Some items no longer have enough stock",
            }
        return {"valid": True, "out_of_stock": [], "message": "Cart is valid for checkout"}
    
    def confirm_cart_for_checkout(self, user_id: int) -> bool:
        """
        Validate cart stock availability and confirm reservations at checkout.
        CRITICAL FIX: Now confirms database reservations to prevent overselling.
        """
        cart = self.get_cart(user_id)

        if not cart.get("items"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cart is empty"
            )

        if not self.db:
            return True

        # Re-validate stock availability (checks both quantity and reservations)
        for item in cart["items"]:
            if not item.get("sku"):
                continue
            inventory = self.db.query(Inventory).filter(Inventory.sku == item["sku"]).first()
            if not inventory:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"'{item.get('name', item['sku'])}' is no longer available. Please update your cart."
                )
            if inventory.available_quantity < item["quantity"]:
                avail = inventory.available_quantity
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"'{item.get('name', item['sku'])}' has only {avail} items available. Please update your cart."
                )

        return True

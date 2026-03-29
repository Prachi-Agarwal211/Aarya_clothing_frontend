"""Cart service with inventory reservation support."""
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from decimal import Decimal
from datetime import datetime, timezone
import json
import logging
import os

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
    RESERVATION_TTL = 900  # 15 minutes in seconds
    
    def __init__(self, db: Session = None):
        """Initialize cart service."""
        self.db = db
        self.inventory_service = InventoryService(db) if db else None
    
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
                "promo_code": None,
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
            "promo_code": None
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
        Reserves stock for 15 minutes.
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
            # Get first available inventory if no variant specified
            inventory = self.db.query(Inventory).filter(
                Inventory.product_id == product_id
            ).first()
        
        sku = inventory.sku if inventory else None
        price = inventory.effective_price if inventory else float(product.price)
        
        # Check stock availability
        if inventory:
            available = inventory.available_quantity
            if available < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Only {available} items available"
                )
            
            # Reserve stock
            try:
                self.inventory_service.reserve_stock(inventory.sku, quantity, user_id=user_id)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e)
                )

            # Note: Redis reservation tracking removed - DB reservation is authoritative source
        
        # Get current cart
        cart = self.get_cart(user_id)
        
        # Check if item already in cart (match by product AND variant)
        existing_item = next(
            (item for item in cart["items"] 
             if item["product_id"] == product_id and item.get("variant_id") == variant_id),
            None
        )
        
        if existing_item:
            # Stock was already reserved for the quantity already in cart.
            # reserve_stock was called above for `quantity` (the delta being added).
            existing_item["quantity"] += quantity
        else:
            cart["items"].append({
                "product_id": product_id,
                "variant_id": variant_id,
                "name": product.name,
                "price": price,
                "quantity": quantity,
                "sku": sku,
                "image": _r2_url(product.primary_image),
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
        """Update item quantity in cart."""
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
        
        # Update reservation if needed
        if item.get("sku") and quantity_diff != 0:
            try:
                if quantity_diff > 0:
                    self.inventory_service.reserve_stock(item["sku"], quantity_diff, user_id=user_id)
                else:
                    self.inventory_service.release_stock(item["sku"], abs(quantity_diff), user_id=user_id)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e)
                )
        
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
        
        # Release reservation
        if item.get("sku"):
            try:
                self.inventory_service.release_stock(item["sku"], item["quantity"], user_id=user_id)
            except (ValueError, KeyError) as e:
                # Expected errors - log at debug level
                logger.debug(f"Expected error releasing stock for SKU {item['sku']}: {e}")
            except Exception as e:
                # Unexpected error - log at warning level but don't fail the cart operation
                logger.warning(f"Unexpected error releasing stock for SKU {item['sku']}: {e}", exc_info=True)

        # Note: Redis reservation tracking removed - DB reservation is authoritative source

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
        """Clear cart and optionally release all reservations."""
        if release_reservations:
            cart = self.get_cart(user_id)

            # Release all reservations
            for item in cart["items"]:
                if item.get("sku"):
                    try:
                        self.inventory_service.release_stock(item["sku"], item["quantity"], user_id=user_id)
                    except (ValueError, KeyError, Exception):
                        pass  # Best effort release

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
            "promo_code": None,
            "reservation_expires_at": None
        }
    
    def apply_promotion(self, user_id: int, promo_code: str, discount_amount: Decimal) -> Dict:
        """Apply promotion code to cart."""
        cart = self.get_cart(user_id)
        
        cart["promo_code"] = promo_code
        cart["discount"] = float(discount_amount)
        
        # Recalculate all totals consistently (total = subtotal - discount)
        self._recalculate_cart(cart)
        
        # Save
        self.save_cart(user_id, cart)
        
        return cart
    
    def confirm_cart_for_checkout(self, user_id: int) -> bool:
        """
        Validate cart and confirm all reservations are still valid.
        Should be called during checkout.
        Raises HTTPException if any item cannot be reserved.
        """
        cart = self.get_cart(user_id)

        if not cart.get("items"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cart is empty"
            )

        for item in cart["items"]:
            if not item.get("sku"):
                continue

            # Check DB reservation is still PENDING (authoritative source)
            from models.stock_reservation import StockReservation, ReservationStatus
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            db_reservation = self.db.query(StockReservation).filter(
                StockReservation.sku == item["sku"],
                StockReservation.user_id == user_id,
                StockReservation.status == ReservationStatus.PENDING,
                StockReservation.expires_at > now
            ).first()

            if not db_reservation:
                # DB reservation expired or missing — release any stale rows then re-reserve
                try:
                    self.inventory_service.release_stock(item["sku"], item["quantity"], user_id=user_id)
                except Exception:
                    pass
                # This will raise HTTPException if stock is gone — let it propagate
                self.inventory_service.reserve_stock(item["sku"], item["quantity"], user_id=user_id)
                # Note: Redis reservation tracking removed - DB reservation is authoritative source

        return True

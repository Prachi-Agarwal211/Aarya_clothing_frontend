"""Cart service with inventory reservation support."""
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from decimal import Decimal
import json
import logging
import os

from core.redis_client import redis_client

logger = logging.getLogger(__name__)
from models.product import Product
from models.inventory import Inventory
from service.inventory_service import InventoryService


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
                "total": 0,
                "item_count": 0,
                "promo_code": None,
                "reservation_expires_at": None
            }
        
        # Ensure all required fields exist
        defaults = {
            "subtotal": 0,
            "discount": 0,
            "shipping": 0,
            "total": 0,
            "item_count": 0,
            "promo_code": None
        }
        for key, val in defaults.items():
            if key not in cart_data:
                cart_data[key] = val
        
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
                return earliest_res.expires_at.isoformat()
            
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
            
            # Set reservation expiry
            reservation_key = f"{self.RESERVATION_KEY_PREFIX}{user_id}:{product_id}:{variant_id or 0}"
            redis_client.set_cache(
                reservation_key,
                {"sku": inventory.sku, "quantity": quantity},
                expires_in=int(self.RESERVATION_TTL / 60)
            )
        
        # Get current cart
        cart = self.get_cart(user_id)
        
        # Check if item already in cart (match by product AND variant)
        existing_item = next(
            (item for item in cart["items"] 
             if item["product_id"] == product_id and item.get("variant_id") == variant_id),
            None
        )
        
        if existing_item:
            existing_item["quantity"] += quantity
        else:
            cart["items"].append({
                "product_id": product_id,
                "variant_id": variant_id,
                "name": product.name,
                "price": price,
                "quantity": quantity,
                "sku": sku,
                "image": product.primary_image,
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
        """Internal helper to recalculate cart totals including GST."""
        subtotal = sum(item["price"] * item["quantity"] for item in cart["items"])
        item_count = sum(item["quantity"] for item in cart["items"])
        
        cart["subtotal"] = float(subtotal)
        cart["item_count"] = item_count
        
        # Shipping: free above ₹999, else ₹100
        if subtotal > 0 and subtotal < 1000:
            cart["shipping"] = 100.0
        else:
            cart["shipping"] = 0.0
        
        # GST calculation per item
        # Uses item-level gst_rate if present, else defaults:
        # ≤₹1000 → 5%, >₹1000 → 12% (apparel GST slabs)
        cgst = 0.0
        sgst = 0.0
        igst = 0.0
        delivery_state = cart.get("delivery_state", "")
        # Seller's registered state from environment (default: Rajasthan)
        seller_state = os.getenv("SELLER_STATE", "Rajasthan")
        
        for item in cart["items"]:
            item_total = item["price"] * item["quantity"]
            rate = item.get("gst_rate") or (5.0 if item["price"] <= 1000 else 12.0)
            gst_on_item = item_total * rate / 100
            
            if delivery_state and delivery_state != seller_state:
                igst += gst_on_item
            else:
                cgst += gst_on_item / 2
                sgst += gst_on_item / 2
        
        total_gst = cgst + sgst + igst
        cart["gst_amount"] = round(total_gst, 2)
        cart["cgst_amount"] = round(cgst, 2)
        cart["sgst_amount"] = round(sgst, 2)
        cart["igst_amount"] = round(igst, 2)
            
        cart["total"] = round(float(subtotal + total_gst + cart.get("shipping", 0) - cart.get("discount", 0)), 2)
    
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
        
        # Remove reservation key
        reservation_key = f"{self.RESERVATION_KEY_PREFIX}{user_id}:{product_id}:{variant_id or 0}"
        redis_client.delete_cache(reservation_key)
        
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
            "promo_code": None,
            "total": 0
        }
    
    def apply_promotion(self, user_id: int, promo_code: str, discount_amount: Decimal) -> Dict:
        """Apply promotion code to cart."""
        cart = self.get_cart(user_id)
        
        cart["promo_code"] = promo_code
        cart["discount"] = float(discount_amount)
        cart["total"] = max(0, cart["subtotal"] - cart["discount"])
        
        # Save
        cart_key = f"{self.CART_KEY_PREFIX}{user_id}"
        redis_client.set_cache(cart_key, cart, expires_in=7 * 24 * 60)
        
        return cart
    
    def confirm_cart_for_checkout(self, user_id: int) -> bool:
        """
        Validate cart and confirm all reservations are still valid.
        Should be called during checkout.
        """
        cart = self.get_cart(user_id)
        
        for item in cart["items"]:
            if item.get("sku"):
                # Check reservation still valid
                reservation_key = f"{self.RESERVATION_KEY_PREFIX}{user_id}:{item['product_id']}:{item.get('variant_id') or 0}"
                reservation = redis_client.get_cache(reservation_key)
                
                if not reservation:
                    # Reservation expired, try to re-reserve
                    try:
                        # Release any stale reservation before re-reserving (best effort)
                        try:
                            self.inventory_service.release_stock(item["sku"], item["quantity"], user_id=user_id)
                        except Exception:
                            pass
                        self.inventory_service.reserve_stock(item["sku"], item["quantity"], user_id=user_id)
                        redis_client.set_cache(
                            reservation_key,
                            {"sku": item["sku"], "quantity": item["quantity"]},
                            expires_in=int(self.RESERVATION_TTL / 60)
                        )
                    except (ValueError, KeyError, Exception):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Product '{item['name']}' is no longer available"
                        )
        
        return True

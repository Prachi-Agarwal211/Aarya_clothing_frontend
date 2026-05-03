"""Cart service with inventory reservation support."""

from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from decimal import Decimal
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
    # RESERVATION_TTL removed - stock is checked and deducted immediately at checkout
    # No reservation delays. If stock available → deduct immediately.
    LOCK_TTL = 5  # 5 seconds max lock hold time (prevents deadlocks)

    def __init__(self, db: Optional[Session] = None):
        """Initialize cart service."""
        self.db = db
        self.inventory_service = InventoryService(db) if db is not None else None

    def _acquire_cart_lock(self, user_id: int, timeout: float = 2.0) -> Optional[str]:
        """Acquire distributed lock for cart mutations using Redis SETNX."""
        lock_key = f"{self.LOCK_KEY_PREFIX}{user_id}"
        lock_token = str(uuid.uuid4())
        deadline = time.monotonic() + timeout
        rc = redis_client.client if hasattr(redis_client, "client") else None
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
        rc = redis_client.client if hasattr(redis_client, "client") else None
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
                "shipping_address": "",
                "reservation_expires_at": None,
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
            "shipping_address": "",
        }
        for key, val in defaults.items():
            if key not in cart_data:
                cart_data[key] = val

        # Normalize item images: convert any relative R2 paths to full CDN URLs
        for item in cart_data.get("items", []):
            img = item.get("image", "")
            if img and not img.startswith("http"):
                item["image"] = _r2_url(img)

        # No reservation system - stock checked at checkout
        cart_data["reservation_expires_at"] = None

        return cart_data

    def _get_earliest_reservation_expiry(self, user_id: int) -> Optional[str]:
        """No reservation system - always returns None."""
        return None

    def save_cart(self, user_id: int, cart_data: Dict) -> bool:
        """Save cart data to cache."""
        cart_key = f"{self.CART_KEY_PREFIX}{user_id}"
        return redis_client.set_cache(cart_key, cart_data, expires_in=7 * 24 * 60)

    def update_shipping_address(self, user_id: int, shipping_address: str) -> Dict:
        """Update shipping address in cart."""
        cart = self.get_cart(user_id)
        cart["shipping_address"] = shipping_address
        self.save_cart(user_id, cart)
        return cart

    def add_to_cart(
        self,
        user_id: int,
        product_id: int,
        quantity: int = 1,
        variant_id: Optional[int] = None,
    ) -> Dict:
        """
        Add item to cart.
        LOCK FIX: Uses distributed lock to prevent lost updates under concurrency.
        SIMPLE: No stock reservation - availability checked at checkout.
        """
        if not self.db:
            raise ValueError("Database session required for add_to_cart")

        # Validate product
        product = (
            self.db.query(Product)
            .filter(Product.id == product_id, Product.is_active == True)
            .first()
        )

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
            )

        # Get inventory/variant
        inventory = None
        if variant_id:
            inventory = (
                self.db.query(Inventory)
                .filter(Inventory.id == variant_id, Inventory.product_id == product_id)
                .first()
            )
            if not inventory:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found"
                )
        else:
            # Check if product has size/color variants requiring explicit selection
            has_variants = (
                self.db.query(Inventory)
                .filter(Inventory.product_id == product_id)
                .first()
            )
            # Handle case where has_variants might be a Column object
            has_variants_bool = has_variants is not None
            if has_variants_bool:
                # Check if size or color attributes exist and are not None
                size_attr = getattr(has_variants, "size", None)
                color_attr = getattr(has_variants, "color", None)
                if size_attr or color_attr:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Please select a size before adding to cart",
                    )
            # Product has no size/color variants - use first inventory entry
            inventory = has_variants

        # Safely extract values from SQLAlchemy model attributes
        sku_value = inventory.sku if inventory else None
        price_value = None
        if inventory and inventory.effective_price is not None:
            try:
                price_value = float(inventory.effective_price)
            except (TypeError, ValueError):
                price_value = None
        if price_value is None:
            price_value = float(product.base_price)

        # Guard against zero/negative prices — fallback to MRP if effective_price is bad
        if price_value <= 0 and inventory and inventory.mrp is not None:
            try:
                price_value = float(inventory.mrp)
            except (TypeError, ValueError):
                price_value = float(product.base_price)
        if price_value <= 0:
            price_value = float(product.base_price)

        sku = sku_value
        price = price_value

        # Check stock availability
        if inventory:
            available = inventory.available_quantity
            if available < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Only {available} items available",
                )

        # LOCK: Acquire distributed lock before read-modify-write
        lock_token = self._acquire_cart_lock(user_id)
        try:
            result = self._add_to_cart_unlocked(
                user_id, product, inventory, sku, price, quantity, variant_id
            )
            # Commit the database transaction
            if self.db:
                self.db.commit()
            return result
        except Exception as e:
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
        variant_id: Optional[int],
    ) -> Dict:
        """Internal add-to-cart logic (must be called under lock)."""
        # Get current cart
        cart = self.get_cart(user_id)

        # Check if item already in cart (match by product AND variant)
        existing_item = next(
            (
                item
                for item in cart["items"]
                if item["product_id"] == product.id
                and item.get("variant_id") == variant_id
            ),
            None,
        )

        if existing_item:
            existing_item["quantity"] += quantity
        else:
            # Use variant-specific image if set, otherwise fall back to product primary image
            variant_image = getattr(inventory, "image_url", None) if inventory else None
            cart["items"].append(
                {
                    "product_id": product.id,
                    "variant_id": variant_id,
                    "name": product.name,
                    "price": price,
                    "quantity": quantity,
                    "sku": sku,
                    "image": _r2_url(variant_image)
                    if variant_image
                    else _r2_url(product.primary_image),
                    "size": inventory.size if inventory is not None else None,
                    "color": inventory.color if inventory is not None else None,
                    "hsn_code": product.hsn_code or None,
                    "gst_rate": product.gst_rate
                    if product.gst_rate is not None
                    else None,
                }
            )

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

        # Total = subtotal (no additional charges; prices are tax-inclusive)
        cart["total"] = float(subtotal)
        cart["total_amount"] = float(subtotal)

    def update_quantity(
        self,
        user_id: int,
        product_id: int,
        new_quantity: int,
        variant_id: Optional[int] = None,
    ) -> Dict:
        """Update item quantity in cart. LOCK FIX: Uses distributed lock."""
        lock_token = self._acquire_cart_lock(user_id)
        try:
            return self._update_quantity_unlocked(
                user_id, product_id, new_quantity, variant_id
            )
        finally:
            self._release_cart_lock(user_id, lock_token)

    def _update_quantity_unlocked(
        self,
        user_id: int,
        product_id: int,
        new_quantity: int,
        variant_id: Optional[int] = None,
    ) -> Dict:
        cart = self.get_cart(user_id)

        item = next(
            (
                item
                for item in cart["items"]
                if item["product_id"] == product_id
                and item.get("variant_id") == variant_id
            ),
            None,
        )

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not in cart"
            )

        old_quantity = item["quantity"]
        quantity_diff = new_quantity - old_quantity
        sku = item.get("sku")

        # Validate stock availability for quantity increase
        if quantity_diff > 0 and self.db is not None:
            inventory = self.db.query(Inventory).filter(Inventory.sku == sku).first()
            # Safely check inventory availability
            if inventory is not None:
                avail_qty = getattr(inventory, "available_quantity", 0)
                if avail_qty is not None and avail_qty < quantity_diff:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Only {avail_qty + old_quantity} items available",
                    )
        # Decreasing quantity - no action needed, stock adjusted at checkout

        item["quantity"] = new_quantity

        # Recalculate
        self._recalculate_cart(cart)

        # Save
        self.save_cart(user_id, cart)

        return cart

    def remove_from_cart(
        self, user_id: int, product_id: int, variant_id: Optional[int] = None
    ) -> Dict:
        """Remove item from cart. No reservation to release - stock adjusted at checkout."""
        cart = self.get_cart(user_id)

        item = next(
            (
                item
                for item in cart["items"]
                if item["product_id"] == product_id
                and item.get("variant_id") == variant_id
            ),
            None,
        )

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not in cart"
            )

        # SIMPLE: No reservation to release - stock adjusted only at checkout

        # Remove from cart
        cart["items"] = [
            i
            for i in cart["items"]
            if not (i["product_id"] == product_id and i.get("variant_id") == variant_id)
        ]

        # Recalculate
        self._recalculate_cart(cart)

        # Save
        self.save_cart(user_id, cart)

        return cart

    def clear_cart(self, user_id: int, release_reservations: bool = True) -> Dict:
        """Clear cart. No reservations to release."""
        lock_token = self._acquire_cart_lock(user_id)
        try:
            return self._clear_cart_unlocked(user_id, release_reservations)
        finally:
            self._release_cart_lock(user_id, lock_token)

    def _clear_cart_unlocked(
        self, user_id: int, release_reservations: bool = True
    ) -> Dict:
        # Get cart before clearing
        cart = self.get_cart(user_id)

        # SIMPLE: No reservations to release

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
            "reservation_expires_at": None,
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
            return {
                "valid": True,
                "out_of_stock": [],
                "message": "Cart is valid for checkout",
            }

        for item in cart["items"]:
            if not item.get("sku"):
                continue
            inventory = (
                self.db.query(Inventory).filter(Inventory.sku == item["sku"]).first()
            )
            avail = inventory.available_quantity if inventory else 0
            req = item["quantity"]
            if not inventory or avail < req:
                out_of_stock.append(
                    {
                        "sku": item.get("sku"),
                        "name": item.get("name", item["sku"]),
                        "requested": req,
                        "available": avail,
                    }
                )

        if out_of_stock:
            return {
                "valid": False,
                "out_of_stock": out_of_stock,
                "message": "Some items no longer have enough stock",
            }
        return {
            "valid": True,
            "out_of_stock": [],
            "message": "Cart is valid for checkout",
        }

    def confirm_cart_for_checkout(self, user_id: int) -> bool:
        """
        Validate cart stock availability at checkout.
        SIMPLE: No reservations - just check availability.
        """
        cart = self.get_cart(user_id)

        if not cart.get("items"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty"
            )

        if not self.db:
            return True

        # Validate stock availability (checks both quantity)
        for item in cart["items"]:
            if not item.get("sku"):
                continue
            inventory = (
                self.db.query(Inventory).filter(Inventory.sku == item["sku"]).first()
            )
            if not inventory:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"'{item.get('name', item['sku'])}' is no longer available. Please update your cart.",
                )
            # Safely check inventory quantity
            if inventory is not None:
                inventory_qty = getattr(inventory, "quantity", 0)
                if inventory_qty is not None and inventory_qty < item["quantity"]:
                    avail = inventory_qty if inventory_qty is not None else 0
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"'{item.get('name', item['sku'])}' has only {avail} items available. Please update your cart.",
                    )

        return True

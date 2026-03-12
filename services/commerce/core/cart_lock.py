"""Distributed locking for cart operations to prevent race conditions."""
import time
import uuid
import logging
from typing import Optional, Any, Callable
from contextlib import contextmanager
from fastapi import HTTPException, status
from core.redis_client import redis_client

logger = logging.getLogger(__name__)


class CartLock:
    """Distributed lock implementation for cart operations."""
    
    def __init__(self, user_id: int, timeout: int = 5, retry_delay: float = 0.1):
        self.user_id = user_id
        self.lock_key = f"cart_lock:{user_id}"
        self.timeout = timeout
        self.retry_delay = retry_delay
        self.identifier = None
        
    def acquire(self, blocking: bool = True, timeout: Optional[float] = None) -> bool:
        """Acquire the cart lock using SETNX with a UUID fencing token."""
        if timeout is None:
            timeout = self.timeout

        # UUID-based fencing token — stronger than timestamp
        identifier = str(uuid.uuid4())
        end_time = time.time() + timeout

        while time.time() < end_time:
            try:
                # Atomic SET NX EX — only succeeds if no existing lock
                if redis_client.client.set(self.lock_key, identifier, nx=True, ex=self.timeout):
                    self.identifier = identifier
                    return True
            except Exception as e:
                logger.error(f"Redis error in CartLock.acquire: {e}")
                # Fail open if Redis is down
                return True

            if not blocking:
                return False

            time.sleep(self.retry_delay)

        return False
    
    def release(self) -> bool:
        """Release the cart lock."""
        if not self.identifier:
            return False
            
        # Lua script for atomic release
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        
        try:
            result = redis_client.client.eval(lua_script, 1, self.lock_key, self.identifier)
            if not result:
                logger.warning(f"CartLock.release failed for {self.lock_key}: identifier mismatch or expired")
            return bool(result)
        except Exception as e:
            logger.error(f"Redis error in CartLock.release: {e}")
            return False
    
    def __enter__(self):
        """Context manager entry."""
        if not self.acquire():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Cart is being updated by another request. Please try again."
            )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.release()


@contextmanager
def cart_operation_lock(user_id: int, timeout: int = 5, blocking: bool = False):
    """Context manager for cart operation locking."""
    lock = CartLock(user_id, timeout=timeout)
    try:
        if not lock.acquire(blocking=blocking, timeout=timeout):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Cart is busy, please try again"
            )
        yield lock
    finally:
        lock.release()


def locked_cart_operation(user_id: int, operation_func: Callable, *args, **kwargs):
    """
    Execute a cart operation with distributed locking.
    
    Args:
        user_id: User ID whose cart is being operated on
        operation_func: Function to execute with cart lock
        *args, **kwargs: Arguments to pass to operation_func
    
    Returns:
        Result of operation_func
    """
    with cart_operation_lock(user_id):
        return operation_func(*args, **kwargs)


class CartConcurrencyManager:
    """Manages cart concurrency and prevents race conditions."""
    
    @staticmethod
    def add_to_cart_locked(user_id: int, item_data: dict, db_session):
        """Add item to cart with distributed locking."""
        with cart_operation_lock(user_id):
            from service.cart_service import CartService
            
            cart_service = CartService(db=db_session)
            return cart_service.add_to_cart(
                user_id=user_id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                variant_id=item_data.get("variant_id")
            )
    
    @staticmethod
    def update_cart_item_locked(user_id: int, product_id: int, quantity: int, db_session, variant_id: int = None):
        """Update cart item quantity with distributed locking."""
        with cart_operation_lock(user_id):
            from service.cart_service import CartService
            
            cart_service = CartService(db=db_session)
            return cart_service.update_quantity(
                user_id=user_id,
                product_id=product_id,
                new_quantity=quantity,
                variant_id=variant_id
            )
    
    @staticmethod
    def remove_from_cart_locked(user_id: int, product_id: int, db_session, variant_id: int = None):
        """Remove item from cart with distributed locking."""
        with cart_operation_lock(user_id):
            from service.cart_service import CartService
            
            cart_service = CartService(db=db_session)
            return cart_service.remove_from_cart(
                user_id=user_id,
                product_id=product_id,
                variant_id=variant_id
            )
    
    @staticmethod
    def clear_cart_locked(user_id: int, db_session):
        """Clear cart with distributed locking."""
        with cart_operation_lock(user_id):
            from service.cart_service import CartService
            
            cart_service = CartService(db=db_session)
            return cart_service.clear_cart(user_id)
    
    @staticmethod
    def merge_carts_locked(user_id: int, guest_cart: dict, db_session):
        """Merge guest cart with user cart with distributed locking."""
        with cart_operation_lock(user_id):
            from service.cart_service import CartService
            
            cart_service = CartService(db=db_session)
            user_cart = cart_service.get_cart(user_id) or {"items": [], "total": 0}
            
            # Merge items
            for guest_item in guest_cart.get("items", []):
                # Check if item already exists in user cart
                existing_item = None
                for i, user_item in enumerate(user_cart["items"]):
                    if (user_item["product_id"] == guest_item["product_id"] and 
                        user_item.get("variant_id") == guest_item.get("variant_id")):
                        existing_item = user_item
                        item_index = i
                        break
                
                if existing_item:
                    # Update existing item quantity
                    user_cart["items"][item_index]["quantity"] += guest_item["quantity"]
                else:
                    # Add new item
                    user_cart["items"].append(guest_item)
            
            # Recalculate total
            user_cart["total"] = sum(
                item["price"] * item["quantity"] for item in user_cart["items"]
            )
            
            # Save merged cart
            cart_service.save_cart(user_id, user_cart)
            
            # Clear guest cart
            cart_service.clear_cart(f"guest_{guest_cart.get('session_id')}")
            
            return user_cart


# Utility function to check if cart is locked
def is_cart_locked(user_id: int) -> bool:
    """Check if cart is currently locked."""
    lock_key = f"cart_lock:{user_id}"
    return redis_client.client.exists(lock_key)


# Utility function to get cart lock TTL
def get_cart_lock_ttl(user_id: int) -> int:
    """Get remaining TTL for cart lock."""
    lock_key = f"cart_lock:{user_id}"
    return redis_client.client.ttl(lock_key)

"""Commerce models - clean nested product schema.

Hierarchy:
    Collection -> Product -> ProductImage (gallery)
                          -> ProductVariant (size + color + image + qty)
                                          -> InventoryMovement (audit)
"""
from .collection         import Collection
from .product            import Product
from .product_image      import ProductImage
from .product_variant    import ProductVariant
from .inventory_movement import InventoryMovement
from .order              import Order, OrderItem, OrderStatus
from .address            import Address, AddressType
from .review             import Review
from .order_tracking     import OrderTracking
from .return_request     import ReturnRequest, ReturnReason, ReturnStatus
from .audit_log          import AuditLog
from .user               import User, UserProfile, UserRole
from .stock_reservation  import StockReservation, ReservationStatus
from .chat               import ChatSession, ChatMessage

# Back-compat aliases (deprecated - remove after callers migrated)
Category  = Collection
Inventory = ProductVariant


__all__ = [
    "Collection", "Category",
    "Product", "ProductImage", "ProductVariant", "Inventory",
    "InventoryMovement",
    "Order", "OrderItem", "OrderStatus",
    "Address", "AddressType", "Review",
    "OrderTracking", "ReturnRequest", "ReturnReason", "ReturnStatus",
    "AuditLog", "User", "UserProfile", "UserRole",
    "StockReservation", "ReservationStatus",
    "ChatSession", "ChatMessage",
]

"""Commerce models module."""
from .collection import Collection
from .category import Category  # backward-compat alias for Collection
from .product import Product
from .order import Order, OrderItem, OrderStatus
from .product_image import ProductImage
from .inventory import Inventory
from .wishlist import Wishlist
from .promotion import Promotion, PromotionUsage
from .address import Address, AddressType
from .review import Review
from .order_tracking import OrderTracking
from .return_request import ReturnRequest, ReturnReason, ReturnStatus
from .audit_log import AuditLog
from .user import User, UserProfile, UserRole
from .stock_reservation import StockReservation, ReservationStatus
from .chat import ChatSession, ChatMessage


__all__ = [
    "Collection", "Category",  # Collection is canonical; Category is compat alias
    "Product", "Order", "OrderItem", "OrderStatus",
    "ProductImage", "Inventory",
    "Wishlist", "Promotion", "PromotionUsage",
    "Address", "AddressType", "Review",
    "OrderTracking", "ReturnRequest", "ReturnReason", "ReturnStatus",
    "AuditLog", "User", "UserProfile", "UserRole",
    "StockReservation", "ReservationStatus",
    "ChatSession", "ChatMessage"
]

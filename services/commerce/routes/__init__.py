"""
Commerce Service - Routes Package

Route modules for better code organization:
- products: Product catalog management
- categories: Collection/category management
- orders: Order processing and management
- cart: Shopping cart operations
- inventory: Stock management
- addresses: User addresses
- reviews: Product reviews
- wishlist: Wishlist management
- promotions: Coupon/promotion management
- returns: Return/refund requests
- size_guide: Size charts and recommendations
"""

from .products import router as products_router
from .categories import router as categories_router
from .orders import router as orders_router
from .cart import router as cart_router
from .addresses import router as addresses_router
from .size_guide import router as size_guide_router

__all__ = [
    "products_router",
    "categories_router",
    "orders_router",
    "cart_router",
    "addresses_router",
    "size_guide_router",
]

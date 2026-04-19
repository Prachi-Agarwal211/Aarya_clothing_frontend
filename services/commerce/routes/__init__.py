"""
Commerce Service - Routes Package

Route modules:
- products: Product catalog management (ACTIVE - registered in main.py)
- orders: DISABLED - order endpoints defined inline in main.py
- addresses: User addresses (ACTIVE - registered in main.py)
- size_guide: Size charts (ACTIVE - registered in main.py)

The cart router was removed when wishlist + promotions were dropped; the
canonical cart endpoints live inline in main.py with proper
CartConcurrencyManager integration.
"""

from .products import router as products_router
from .orders import router as orders_router
from .addresses import router as addresses_router
from .size_guide import router as size_guide_router

__all__ = [
    "products_router",
    "orders_router",
    "addresses_router",
    "size_guide_router",
]

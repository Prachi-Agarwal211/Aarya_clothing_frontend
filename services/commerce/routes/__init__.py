"""
Commerce Service - Routes Package

Route modules:
- products: Product catalog (ACTIVE - registered in main.py)
- orders: DISABLED - order endpoints defined inline in main.py
- addresses: User addresses (ACTIVE - registered in main.py)
- size_guide: Size charts (ACTIVE - registered in main.py)
- chat: Customer support chat (ACTIVE - registered in main.py)

The cart router was removed when wishlist + promotions were dropped; the
canonical cart endpoints live inline in main.py with proper
CartConcurrencyManager integration.
"""

from .addresses import router as addresses_router
from .chat import router as chat_router
from .internal import router as internal_router
from .landing import router as landing_router
from .orders import router as orders_router
from .products import router as products_router
from .size_guide import router as size_guide_router

__all__ = [
    "products_router",
    "orders_router",
    "addresses_router",
    "size_guide_router",
    "chat_router",
    "landing_router",
    "internal_router",
]

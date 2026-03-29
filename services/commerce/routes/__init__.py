"""
Commerce Service - Routes Package

Route modules for better code organization:
- products: Product catalog management (ACTIVE - registered in main.py)
- orders: DISABLED - order endpoints defined inline in main.py
- cart: DISABLED - cart endpoints defined inline in main.py  
- addresses: User addresses (ACTIVE - registered in main.py)
- size_guide: Size charts (ACTIVE - registered in main.py)

IMPORTANT: The following routers are DISABLED in main.py to avoid route conflicts:
- cart_router: All cart endpoints are defined inline in main.py (lines 783-1180)
  with proper CartConcurrencyManager integration
- orders_router: All order endpoints are defined inline in main.py (lines 1555-1821)
  with proper order service integration
"""

from .products import router as products_router
# NOTE: categories_router removed — main.py has canonical collection routes
# with proper R2 URL enrichment. The modular router was conflicting.
# NOTE: orders_router and cart_router are imported but NOT registered in main.py
# to avoid route conflicts with inline implementations.
from .orders import router as orders_router
from .cart import router as cart_router
from .addresses import router as addresses_router
from .size_guide import router as size_guide_router

__all__ = [
    "products_router",
    "orders_router",      # Imported but NOT registered (use inline routes)
    "cart_router",        # Imported but NOT registered (use inline routes)
    "addresses_router",
    "size_guide_router",
]

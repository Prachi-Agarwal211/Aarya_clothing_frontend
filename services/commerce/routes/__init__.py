"""
Commerce service — route registry.

Each module owns a cohesive slice of the public API and is wired into the
FastAPI app from ``main.py``. Adding a new router here is a two-step change:
import it in this file and include it in ``main.py``.
"""

from .addresses import router as addresses_router
from .cart import router as cart_router
from .chat import router as chat_router
from .internal import router as internal_router
from .landing import router as landing_router
from .orders import router as orders_router
from .products import router as products_router
from .returns import router as returns_router
from .reviews import router as reviews_router
from .size_guide import router as size_guide_router

__all__ = [
    "addresses_router",
    "cart_router",
    "chat_router",
    "internal_router",
    "landing_router",
    "orders_router",
    "products_router",
    "returns_router",
    "reviews_router",
    "size_guide_router",
]

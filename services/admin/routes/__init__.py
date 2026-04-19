"""
Admin service — route registry.

Each module owns a cohesive slice of the admin/staff API. New routers should
be imported here and included in ``main.py`` so the registration story stays
in one obvious place.
"""

from .ai import router as ai_router
from .analytics import router as analytics_router
from .backup import router as backup_router
from .chat import router as chat_router
from .collections import router as collections_router
from .dashboard import router as dashboard_router
from .excel import router as excel_router
from .inventory import router as inventory_router
from .landing_admin import router as landing_admin_router
from .landing_public import router as landing_public_router
from .orders import router as orders_router
from .products import router as products_router
from .returns import router as returns_router
from .reviews import router as reviews_router
from .site_config import router as site_config_router
from .staff_access_control import router as staff_access_control_router
from .staff_ai_dashboard import router as staff_ai_dashboard_router
from .staff_management import router as staff_management_router
from .staff_ops import router as staff_ops_router
from .uploads import router as uploads_router
from .users import router as users_router

__all__ = [
    "ai_router",
    "analytics_router",
    "backup_router",
    "chat_router",
    "collections_router",
    "dashboard_router",
    "excel_router",
    "inventory_router",
    "landing_admin_router",
    "landing_public_router",
    "orders_router",
    "products_router",
    "returns_router",
    "reviews_router",
    "site_config_router",
    "staff_access_control_router",
    "staff_ai_dashboard_router",
    "staff_management_router",
    "staff_ops_router",
    "uploads_router",
    "users_router",
]

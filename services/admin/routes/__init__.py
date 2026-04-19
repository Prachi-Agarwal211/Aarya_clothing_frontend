"""
Admin service — route registry.

Each module owns a cohesive slice of the admin/staff API. New routers should
be imported here and included in ``main.py`` so the registration story stays
in one obvious place.
"""

from .backup import router as backup_router
from .chat import router as chat_router
from .dashboard import router as dashboard_router
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
    "backup_router",
    "chat_router",
    "dashboard_router",
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

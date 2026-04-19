"""
Admin service — route registry.

Each module owns a cohesive slice of the admin/staff API. New routers should
be imported here and included in ``main.py`` so the registration story stays
in one obvious place.
"""

from .backup import router as backup_router
from .dashboard import router as dashboard_router
from .returns import router as returns_router
from .reviews import router as reviews_router
from .staff_access_control import router as staff_access_control_router
from .staff_ai_dashboard import router as staff_ai_dashboard_router
from .staff_management import router as staff_management_router
from .staff_ops import router as staff_ops_router

__all__ = [
    "backup_router",
    "dashboard_router",
    "returns_router",
    "reviews_router",
    "staff_access_control_router",
    "staff_ai_dashboard_router",
    "staff_management_router",
    "staff_ops_router",
]

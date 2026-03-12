"""Authentication middleware for Payment service - uses shared middleware."""

# Import from shared middleware for consistency across all services
from shared.auth_middleware import (
    get_current_user,
    get_current_user_optional,
    require_admin,
    require_staff,
    initialize_auth_middleware,
)

from core.config import settings
from core.redis_client import redis_client

# Initialize the shared auth middleware with Payment service settings
initialize_auth_middleware(
    secret_key=settings.SECRET_KEY,
    algorithm=settings.ALGORITHM,
    redis_client=redis_client
)

# Re-export for convenience
__all__ = [
    'get_current_user',
    'get_current_user_optional',
    'require_admin',
    'require_staff',
]
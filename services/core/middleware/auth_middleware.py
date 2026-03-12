"""
Authentication middleware for Core service - uses shared middleware.

This module provides authentication middleware for the Core service by
importing and initializing the shared auth middleware with Core service settings.
"""

# Import from shared middleware for consistency across all services
from shared.auth_middleware import (
    get_current_user,
    get_current_user_optional,
    require_admin,
    require_staff,
    require_customer,
    check_user_ownership,
    require_ownership,
    initialize_auth_middleware,
    initialize_token_manager,
    get_token_manager,
    TokenManager,
)

from core.config import get_settings
from core.redis_client import get_redis_client


def init_auth():
    """Initialize the auth middleware with Core service settings."""
    settings = get_settings()
    redis_client = get_redis_client()
    
    # Initialize the shared auth middleware
    initialize_auth_middleware(
        secret_key=settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
        redis_client=redis_client
    )
    
    # Initialize the token manager for token creation
    initialize_token_manager(
        secret_key=settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


# Re-export for backward compatibility
__all__ = [
    'get_current_user',
    'get_current_user_optional',
    'require_admin',
    'require_staff',
    'require_customer',
    'check_user_ownership',
    'require_ownership',
    'init_auth',
    'get_token_manager',
    'TokenManager',
]

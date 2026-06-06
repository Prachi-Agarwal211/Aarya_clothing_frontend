"""Global exception handler for core service.

Keeps service-specific exception classes. The actual handler registration
delegates to shared/base_exception_handler.py to eliminate duplication.
"""
import logging
import time

logger = logging.getLogger(__name__)


# ==================== Service-Specific Exceptions ====================

class CoreServiceException(Exception):
    """Base exception for core service."""
    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class AuthenticationException(CoreServiceException):
    """Authentication related exceptions."""
    pass


class AuthorizationException(CoreServiceException):
    """Authorization related exceptions."""
    pass


class ValidationException(CoreServiceException):
    """Validation related exceptions."""
    pass


class DatabaseException(CoreServiceException):
    """Database related exceptions."""
    pass


# Status code mapping for the base handler
CORE_STATUS_MAPPING = {
    CoreServiceException: 500,
    ValidationException: 400,
    AuthenticationException: 401,
    AuthorizationException: 403,
    DatabaseException: 500,
}


def setup_exception_handlers(app):
    """Setup global exception handlers for the FastAPI app.

    Delegates to shared/base_exception_handler.py for all standard handlers
    and registers the core-specific exception mapping.
    """
    from shared.base_exception_handler import (
        setup_exception_handlers as setup_base,
    )
    setup_base(app, CoreServiceException, CORE_STATUS_MAPPING)


# ==================== Security & Auth Event Logging ====================

def log_security_event(event_type: str, details: dict, user: dict = None):
    """Log security-related events."""
    security_data = {
        "event_type": event_type,
        "details": details,
        "user_id": user.get("id") if user else None,
        "username": user.get("username") if user else None,
        "timestamp": time.time(),
    }
    logger.warning("SECURITY EVENT: %s", security_data)


def log_authentication_event(event_type: str, details: dict, email: str = None):
    """Log authentication-related events."""
    auth_data = {
        "event_type": event_type,
        "details": details,
        "email": email,
        "timestamp": time.time(),
    }
    logger.info("AUTH EVENT: %s", auth_data)

"""Global exception handler for commerce service.

Keeps service-specific exception classes. The actual handler registration
delegates to shared/base_exception_handler.py to eliminate duplication.
"""
import logging
import time

logger = logging.getLogger(__name__)


# ==================== Service-Specific Exceptions ====================

class CommerceServiceException(Exception):
    """Base exception for commerce service."""
    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class ValidationException(CommerceServiceException):
    """Validation related exceptions."""
    pass


class InventoryException(CommerceServiceException):
    """Inventory related exceptions."""
    pass


class CartException(CommerceServiceException):
    """Cart related exceptions."""
    pass


class OrderException(CommerceServiceException):
    """Order related exceptions."""
    pass


class PaymentException(CommerceServiceException):
    """Payment related exceptions."""
    pass


class DatabaseException(CommerceServiceException):
    """Database related exceptions."""
    pass


# Status code mapping for the base handler
COMMERCE_STATUS_MAPPING = {
    CommerceServiceException: 500,
    ValidationException: 400,
    InventoryException: 409,
    CartException: 400,
    OrderException: 400,
    PaymentException: 402,
    DatabaseException: 500,
}


def setup_exception_handlers(app):
    """Setup global exception handlers for the FastAPI app.

    Delegates to shared/base_exception_handler.py for all standard handlers
    and registers the commerce-specific exception mapping.
    """
    from shared.base_exception_handler import (
        setup_exception_handlers as setup_base,
    )
    setup_base(app, CommerceServiceException, COMMERCE_STATUS_MAPPING)


# ==================== Business Event Logging ====================

def log_business_event(event_type: str, details: dict, user: dict = None):
    """Log business-related events."""
    business_data = {
        "event_type": event_type,
        "details": details,
        "user_id": user.get("id") if user else None,
        "timestamp": time.time(),
    }
    logger.info("BUSINESS EVENT: %s", business_data)


def log_inventory_event(event_type: str, details: dict, product_id: int = None):
    """Log inventory-related events."""
    inventory_data = {
        "event_type": event_type,
        "details": details,
        "product_id": product_id,
        "timestamp": time.time(),
    }
    logger.info("INVENTORY EVENT: %s", inventory_data)

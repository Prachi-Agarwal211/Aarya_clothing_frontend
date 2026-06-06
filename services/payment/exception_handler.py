"""Global exception handler for payment service.

Keeps service-specific exception classes and the JSON sanitizer.
The actual handler registration delegates to shared/base_exception_handler.py
to eliminate duplication.
"""
import logging
import time
from decimal import Decimal

logger = logging.getLogger(__name__)


# ==================== Service-Specific Exceptions ====================

class PaymentServiceException(Exception):
    """Base exception for payment service."""
    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class PaymentGatewayException(PaymentServiceException):
    """Payment gateway related exceptions."""
    pass


class TransactionException(PaymentServiceException):
    """Transaction related exceptions."""
    pass


class WebhookException(PaymentServiceException):
    """Webhook related exceptions."""
    pass


class DatabaseException(PaymentServiceException):
    """Database related exceptions."""
    pass


class InvalidSignatureError(PaymentServiceException):
    """Raised when payment HMAC signature verification fails."""
    def __init__(self, message: str = "Invalid payment signature"):
        super().__init__(message, error_code="INVALID_SIGNATURE")


class TransactionNotFoundError(TransactionException):
    """Raised when a transaction cannot be found."""
    def __init__(self, transaction_id: str = None):
        msg = f"Transaction not found: {transaction_id}" if transaction_id else "Transaction not found"
        super().__init__(msg, error_code="TRANSACTION_NOT_FOUND")


class OrderCreationError(PaymentGatewayException):
    """Raised when order creation via commerce service fails."""
    def __init__(self, message: str = "Failed to create order from webhook"):
        super().__init__(message, error_code="ORDER_CREATION_FAILED")


# Status code mapping for the base handler
PAYMENT_STATUS_MAPPING = {
    PaymentServiceException: 500,
    PaymentGatewayException: 502,
    InvalidSignatureError: 402,
    TransactionNotFoundError: 404,
    TransactionException: 400,
    WebhookException: 502,
    DatabaseException: 500,
}


def _sanitize_for_json(obj):
    """Recursively convert non-JSON-serializable types (Decimal, bytes) to safe values."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(item) for item in obj]
    return obj


def setup_exception_handlers(app):
    """Setup global exception handlers for the FastAPI app.

    Delegates to shared/base_exception_handler.py for all standard handlers
    and registers the payment-specific exception mapping.
    """
    from shared.base_exception_handler import (
        setup_exception_handlers as setup_base,
    )
    setup_base(app, PaymentServiceException, PAYMENT_STATUS_MAPPING)

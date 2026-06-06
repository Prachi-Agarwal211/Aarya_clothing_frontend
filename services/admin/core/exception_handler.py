"""Global exception handler for admin service."""
import logging
import traceback
from typing import Union
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError
from pydantic import ValidationError
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AdminServiceException(Exception):
    """Base exception for admin service."""
    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class DatabaseException(AdminServiceException):
    """Database related exceptions."""
    pass


class ValidationException(AdminServiceException):
    """Validation related exceptions."""
    pass


class AuthorizationException(AdminServiceException):
    """Authorization related exceptions."""
    pass


class CacheException(AdminServiceException):
    """Cache related exceptions."""
    pass


# Status code mapping for the base handler
ADMIN_STATUS_MAPPING = {
    AdminServiceException: 500,
    ValidationException: 400,
    AuthorizationException: 403,
    CacheException: 503,
    DatabaseException: 500,
}


def setup_exception_handlers(app: FastAPI):
    """Setup global exception handlers for the FastAPI app.

    Delegates to shared/base_exception_handler.py for all standard handlers
    and registers the admin-specific exception mapping.
    """
    from shared.base_exception_handler import (
        setup_exception_handlers as setup_base,
    )
    setup_base(app, AdminServiceException, ADMIN_STATUS_MAPPING)


def log_security_event(event_type: str, details: dict, user: dict = None):
    """Log security-related events."""
    security_data = {
        "event_type": event_type,
        "details": details,
        "user_id": user.get("id") if user else None,
        "username": user.get("username") if user else None,
        "timestamp": time.time()
    }
    
    logger.warning(f"SECURITY EVENT: {security_data}")


def log_business_event(event_type: str, details: dict, user: dict = None):
    """Log business-related events."""
    business_data = {
        "event_type": event_type,
        "details": details,
        "user_id": user.get("id") if user else None,
        "username": user.get("username") if user else None,
        "timestamp": time.time()
    }
    
    logger.info(f"BUSINESS EVENT: {business_data}")

"""Global exception handler for commerce service."""
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


def setup_exception_handlers(app: FastAPI):
    """Setup global exception handlers for the FastAPI app."""
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions with consistent format."""
        logger.warning(f"HTTP {exc.status_code}: {exc.detail} - Path: {request.url.path}")
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "type": "http_error",
                    "message": exc.detail,
                    "status_code": exc.status_code,
                    "path": request.url.path,
                    "timestamp": time.time()
                }
            }
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle FastAPI validation errors."""
        logger.warning(f"Validation error: {exc.errors()} - Path: {request.url.path}")
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "type": "validation_error",
                    "message": "Invalid request data",
                    "details": exc.errors(),
                    "status_code": 422,
                    "path": request.url.path,
                    "timestamp": time.time()
                }
            }
        )
    
    @app.exception_handler(ValidationError)
    async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
        """Handle Pydantic validation errors."""
        logger.warning(f"Pydantic validation error: {exc.errors()} - Path: {request.url.path}")
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "type": "validation_error",
                    "message": "Data validation failed",
                    "details": exc.errors(),
                    "status_code": 422,
                    "path": request.url.path,
                    "timestamp": time.time()
                }
            }
        )
    
    @app.exception_handler(IntegrityError)
    async def database_integrity_handler(request: Request, exc: IntegrityError):
        """Handle database integrity errors."""
        logger.error(f"Database integrity error: {str(exc)} - Path: {request.url.path}")
        
        # Check for specific integrity errors
        error_msg = str(exc).lower()
        if "foreign key" in error_msg:
            message = "Referenced record does not exist"
        elif "unique" in error_msg:
            message = "Record already exists"
        elif "not null" in error_msg:
            message = "Required field is missing"
        else:
            message = "Database constraint violation"
        
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "type": "database_error",
                    "message": message,
                    "status_code": 400,
                    "path": request.url.path,
                    "timestamp": time.time()
                }
            }
        )
    
    @app.exception_handler(OperationalError)
    async def database_operational_handler(request: Request, exc: OperationalError):
        """Handle database operational errors."""
        logger.error(f"Database operational error: {str(exc)} - Path: {request.url.path}")
        
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": {
                    "type": "database_error",
                    "message": "Database service temporarily unavailable",
                    "status_code": 503,
                    "path": request.url.path,
                    "timestamp": time.time()
                }
            }
        )
    
    @app.exception_handler(SQLAlchemyError)
    async def database_general_handler(request: Request, exc: SQLAlchemyError):
        """Handle general SQLAlchemy errors."""
        logger.error(f"Database error: {str(exc)} - Path: {request.url.path}")
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "type": "database_error",
                    "message": "Internal database error",
                    "status_code": 500,
                    "path": request.url.path,
                    "timestamp": time.time()
                }
            }
        )
    
    @app.exception_handler(CommerceServiceException)
    async def commerce_service_handler(request: Request, exc: CommerceServiceException):
        """Handle custom commerce service exceptions."""
        logger.error(f"Commerce service error: {exc.message} - Path: {request.url.path}")
        
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        
        if isinstance(exc, ValidationException):
            status_code = status.HTTP_400_BAD_REQUEST
        elif isinstance(exc, InventoryException):
            status_code = status.HTTP_409_CONFLICT
        elif isinstance(exc, CartException):
            status_code = status.HTTP_400_BAD_REQUEST
        elif isinstance(exc, OrderException):
            status_code = status.HTTP_400_BAD_REQUEST
        elif isinstance(exc, PaymentException):
            status_code = status.HTTP_402_PAYMENT_REQUIRED
        elif isinstance(exc, DatabaseException):
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        
        return JSONResponse(
            status_code=status_code,
            content={
                "error": {
                    "type": exc.__class__.__name__.lower(),
                    "message": exc.message,
                    "error_code": exc.error_code,
                    "status_code": status_code,
                    "path": request.url.path,
                    "timestamp": time.time()
                }
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle all other unexpected exceptions."""
        logger.error(f"Unexpected error: {str(exc)} - Path: {request.url.path}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "type": "internal_server_error",
                    "message": "An unexpected error occurred",
                    "status_code": 500,
                    "path": request.url.path,
                    "timestamp": time.time()
                }
            }
        )


def log_business_event(event_type: str, details: dict, user: dict = None):
    """Log business-related events."""
    business_data = {
        "event_type": event_type,
        "details": details,
        "user_id": user.get("id") if user else None,
        "timestamp": time.time()
    }
    
    logger.info(f"BUSINESS EVENT: {business_data}")


def log_inventory_event(event_type: str, details: dict, product_id: int = None):
    """Log inventory-related events."""
    inventory_data = {
        "event_type": event_type,
        "details": details,
        "product_id": product_id,
        "timestamp": time.time()
    }
    
    logger.info(f"INVENTORY EVENT: {inventory_data}")

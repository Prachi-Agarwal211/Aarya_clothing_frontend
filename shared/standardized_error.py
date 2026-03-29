"""
Standardized Error Handling for Aarya Clothing

Consistent error response format across all services.
Usage:
    from shared.standardized_error import StandardizedError, handle_standardized_error
    
    # Raise standardized error
    raise StandardizedError(
        message="Product not found",
        code="PRODUCT_NOT_FOUND",
        status_code=404
    )
    
    # Register error handler in FastAPI app
    handle_standardized_error(app)
"""

from typing import Optional, Dict, Any
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import logging

logger = logging.getLogger(__name__)


class StandardizedError(Exception):
    """Base class for all standardized errors."""
    
    def __init__(
        self,
        message: str,
        code: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary."""
        return {
            "error": {
                "message": self.message,
                "code": self.code,
                "status_code": self.status_code,
                "details": self.details,
            }
        }


# ==================== Business Logic Errors ====================

class NotFoundError(StandardizedError):
    """Resource not found."""
    def __init__(self, resource: str = "Resource", details: Optional[Dict] = None):
        super().__init__(
            message=f"{resource} not found",
            code=f"{resource.upper().replace(' ', '_')}_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details=details
        )


class ValidationError(StandardizedError):
    """Business validation failed."""
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details
        )


class UnauthorizedError(StandardizedError):
    """Authentication required."""
    def __init__(self, message: str = "Authentication required", details: Optional[Dict] = None):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details
        )


class ForbiddenError(StandardizedError):
    """Insufficient permissions."""
    def __init__(self, message: str = "Insufficient permissions", details: Optional[Dict] = None):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
            details=details
        )


class ConflictError(StandardizedError):
    """Resource conflict (e.g., duplicate)."""
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=status.HTTP_409_CONFLICT,
            details=details
        )


class RateLimitError(StandardizedError):
    """Rate limit exceeded."""
    def __init__(self, message: str = "Too many requests", details: Optional[Dict] = None):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details
        )


class ServiceUnavailableError(StandardizedError):
    """Service temporarily unavailable."""
    def __init__(self, message: str = "Service temporarily unavailable", details: Optional[Dict] = None):
        super().__init__(
            message=message,
            code="SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details
        )


# ==================== Error Handler Registration ====================

def handle_standardized_error(app: FastAPI):
    """Register standardized error handlers with FastAPI app."""
    
    @app.exception_handler(StandardizedError)
    async def standardized_error_handler(request: Request, exc: StandardizedError):
        """Handle standardized business errors."""
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
            headers={
                "X-Request-ID": getattr(request.state, 'request_id', 'unknown'),
                "X-Error-Code": exc.code,
            }
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle Pydantic validation errors."""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "message": "Validation failed",
                    "code": "VALIDATION_ERROR",
                    "status_code": 422,
                    "details": {
                        "errors": exc.errors()
                    }
                }
            },
            headers={
                "X-Request-ID": getattr(request.state, 'request_id', 'unknown'),
            }
        )
    
    @app.exception_handler(ValidationError)
    async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
        """Handle Pydantic validation errors."""
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "message": str(exc),
                    "code": "VALIDATION_ERROR",
                    "status_code": 400,
                    "details": {}
                }
            },
            headers={
                "X-Request-ID": getattr(request.state, 'request_id', 'unknown'),
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle unexpected errors."""
        logger.error(f"Unexpected error: {exc}", exc_info=True)
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "message": "An unexpected error occurred",
                    "code": "INTERNAL_ERROR",
                    "status_code": 500,
                    "details": {}
                }
            },
            headers={
                "X-Request-ID": getattr(request.state, 'request_id', 'unknown'),
            }
        )
    
    logger.info("Standardized error handlers registered")


# ==================== Helper Functions ====================

def create_error_response(
    message: str,
    code: str,
    status_code: int,
    details: Optional[Dict] = None,
    request: Optional[Request] = None
) -> JSONResponse:
    """Create a standardized error response."""
    error = StandardizedError(message, code, status_code, details)
    
    headers = {}
    if request:
        headers["X-Request-ID"] = getattr(request.state, 'request_id', 'unknown')
    
    return JSONResponse(
        status_code=status_code,
        content=error.to_dict(),
        headers=headers
    )


def raise_not_found(resource: str = "Resource"):
    """Raise a standardized not found error."""
    raise NotFoundError(resource)


def raise_validation_error(message: str):
    """Raise a standardized validation error."""
    raise ValidationError(message)


def raise_unauthorized(message: str = "Authentication required"):
    """Raise a standardized unauthorized error."""
    raise UnauthorizedError(message)


def raise_forbidden(message: str = "Insufficient permissions"):
    """Raise a standardized forbidden error."""
    raise ForbiddenError(message)

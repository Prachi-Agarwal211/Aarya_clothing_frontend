"""
Shared Base Exception Handler for all backend services.

Eliminates ~400 lines of duplicated exception handling code across
commerce, core, and payment services. Each service provides its own
custom exception class and status mapping; this module handles the
standard FastAPI/SQLAlchemy/Pydantic handlers.

Usage in a service's exception_handler.py:

    from shared.base_exception_handler import setup_exception_handlers

    # Service-specific exceptions (keep these local)
    class MyServiceException(Exception):
        ...

    # Register handlers on the app
    setup_exception_handlers(app, MyServiceException, {
        MyValidationException: 400,
        MyAuthException: 401,
    })
"""

import logging
import traceback
import time
from typing import Optional, Type, Dict

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError
from pydantic import ValidationError

logger = logging.getLogger(__name__)


def _error_response(
    status_code: int,
    error_type: str,
    message: str,
    path: str,
    details: Optional[dict] = None,
) -> JSONResponse:
    """Build a standardized error JSON response."""
    content = {
        "error": {
            "type": error_type,
            "message": message,
            "status_code": status_code,
            "path": path,
            "timestamp": time.time(),
        }
    }
    if details:
        content["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=content)


def setup_exception_handlers(
    app: FastAPI,
    custom_exception_class: Optional[Type[Exception]] = None,
    custom_status_mapping: Optional[Dict[Type[Exception], int]] = None,
):
    """
    Register all standard exception handlers on a FastAPI app.

    Handles: HTTPException, RequestValidationError, Pydantic ValidationError,
    IntegrityError, OperationalError, SQLAlchemyError, and a generic catch-all.

    If custom_exception_class is provided, also registers a handler that maps
    it (and its subclasses) to HTTP status codes via custom_status_mapping.

    Args:
        app: The FastAPI application instance.
        custom_exception_class: Service-specific base exception class.
        custom_status_mapping: Dict mapping exception subclasses -> HTTP status codes.
    """
    custom_status_mapping = custom_status_mapping or {}

    # -- HTTPException --
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logger.warning(
            "HTTP %s: %s - Path: %s", exc.status_code, exc.detail, request.url.path
        )
        return _error_response(
            status_code=exc.status_code,
            error_type="http_error",
            message=exc.detail,
            path=request.url.path,
        )

    # -- RequestValidationError --
    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError):
        logger.warning("Validation error: %s - Path: %s", exc.errors(), request.url.path)
        return _error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_type="validation_error",
            message="Invalid request data",
            path=request.url.path,
            details=exc.errors(),
        )

    # -- Pydantic ValidationError --
    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(request: Request, exc: ValidationError):
        logger.warning(
            "Pydantic validation error: %s - Path: %s", exc.errors(), request.url.path
        )
        return _error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_type="validation_error",
            message="Data validation failed",
            path=request.url.path,
            details={"errors": exc.errors()},
        )

    # -- IntegrityError --
    @app.exception_handler(IntegrityError)
    async def database_integrity_handler(request: Request, exc: IntegrityError):
        logger.error("Database integrity error: %s - Path: %s", exc, request.url.path)
        error_msg = str(exc).lower()
        if "foreign key" in error_msg:
            message = "Referenced record does not exist"
        elif "unique" in error_msg:
            message = "Record already exists"
        elif "not null" in error_msg:
            message = "Required field is missing"
        else:
            message = "Database constraint violation"
        return _error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_type="database_error",
            message=message,
            path=request.url.path,
        )

    # -- OperationalError --
    @app.exception_handler(OperationalError)
    async def database_operational_handler(request: Request, exc: OperationalError):
        logger.error("Database operational error: %s - Path: %s", exc, request.url.path)
        return _error_response(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_type="database_error",
            message="Database service temporarily unavailable",
            path=request.url.path,
        )

    # -- General SQLAlchemyError --
    @app.exception_handler(SQLAlchemyError)
    async def database_general_handler(request: Request, exc: SQLAlchemyError):
        logger.error("Database error: %s - Path: %s", exc, request.url.path)
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_type="database_error",
            message="Internal database error",
            path=request.url.path,
        )

    # -- Service-specific exceptions --
    if custom_exception_class and custom_status_mapping:

        @app.exception_handler(custom_exception_class)
        async def custom_service_handler(request: Request, exc: custom_exception_class):
            logger.error(
                "Service error [%s]: %s - Path: %s",
                exc.__class__.__name__,
                getattr(exc, "message", str(exc)),
                request.url.path,
            )
            # Walk the MRO to find the most specific matching status code
            mapped_status = status.HTTP_500_INTERNAL_SERVER_ERROR
            for cls in type(exc).__mro__:
                if cls in custom_status_mapping:
                    mapped_status = custom_status_mapping[cls]
                    break

            return JSONResponse(
                status_code=mapped_status,
                content={
                    "error": {
                        "type": exc.__class__.__name__.lower(),
                        "message": getattr(exc, "message", str(exc)),
                        "error_code": getattr(exc, "error_code", None),
                        "status_code": mapped_status,
                        "path": request.url.path,
                        "timestamp": time.time(),
                    }
                },
            )

    # -- Catch-all --
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error("Unexpected error: %s - Path: %s", exc, request.url.path)
        logger.error("Traceback: %s", traceback.format_exc())
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_type="internal_server_error",
            message="An unexpected error occurred",
            path=request.url.path,
        )

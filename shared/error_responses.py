"""
Standardized error response format for all Aarya Clothing microservices.
Ensures consistent error shape across Core, Commerce, Payment, Admin services.
"""
import json
import logging
import traceback
from typing import Any, Optional
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError

logger = logging.getLogger(__name__)


# ── Standard error payload ────────────────────────────────────────────────────

def error_response(
    error_type: str,
    message: str,
    status_code: int,
    path: str = "",
    details: Optional[Any] = None,
) -> dict:
    """Build a standard error response payload."""
    import time
    payload = {
        "error": {
            "type": error_type,
            "message": message,
            "status_code": status_code,
            "path": path,
            "timestamp": time.time(),
        }
    }
    if details:
        payload["error"]["details"] = details
    return payload


# ── FastAPI exception handlers ────────────────────────────────────────────────

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Consistent JSON format for HTTPException."""
    if isinstance(exc.detail, dict):
        # Extract a human-readable message from structured error details
        message = exc.detail.get("message", str(exc.detail))
        details = exc.detail
    else:
        message = str(exc.detail)
        details = None
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(
            error_type=_status_to_type(exc.status_code),
            message=message,
            status_code=exc.status_code,
            path=str(request.url.path),
            details=details,
        ),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Consistent JSON format for Pydantic validation errors."""
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err.get("loc", []))
        errors.append({"field": field, "message": err.get("msg", ""), "type": err.get("type", "")})
    
    logger.warning(f"Validation failed on {request.url.path}: {errors}")
    
    return JSONResponse(
        status_code=422,
        content=error_response(
            error_type="validation_error",
            message="Request validation failed",
            status_code=422,
            path=str(request.url.path),
            details=errors,
        ),
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Consistent JSON format for database errors — hides internals."""
    logger.error(f"Database error: {exc} - Path: {request.url.path}")

    if isinstance(exc, IntegrityError):
        message = "Data integrity violation. The record may already exist or reference an invalid ID."
        error_type = "integrity_error"
    elif isinstance(exc, OperationalError):
        message = "Database temporarily unavailable. Please retry."
        error_type = "database_unavailable"
    else:
        message = "Internal database error"
        error_type = "database_error"

    return JSONResponse(
        status_code=500,
        content=error_response(
            error_type=error_type,
            message=message,
            status_code=500,
            path=str(request.url.path),
        ),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler — never exposes stack traces to clients."""
    logger.error(f"Unhandled exception on {request.url.path}: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content=error_response(
            error_type="internal_server_error",
            message="An unexpected error occurred. Please try again.",
            status_code=500,
            path=str(request.url.path),
        ),
    )


# ── Registration helper ───────────────────────────────────────────────────────

def register_error_handlers(app) -> None:
    """
    Register all standard error handlers on a FastAPI app.

    Usage (in service main.py):
        from shared.error_responses import register_error_handlers
        register_error_handlers(app)
    """
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _status_to_type(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        410: "gone",
        422: "validation_error",
        429: "rate_limit_exceeded",
        500: "internal_server_error",
        502: "bad_gateway",
        503: "service_unavailable",
    }.get(status_code, "error")

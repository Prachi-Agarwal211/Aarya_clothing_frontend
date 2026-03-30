"""CSRF protection middleware."""
import secrets
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request
from typing import Callable

logger = logging.getLogger(__name__)


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection using double-submit cookie pattern.

    NOTE: Raising HTTPException inside BaseHTTPMiddleware bypasses FastAPI's
    exception handlers and results in a 500.  Always use JSONResponse returns.
    """

    # Routes that don't need CSRF protection
    EXEMPT_ROUTES = [
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/logout-all",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/verify-email",
        "/api/v1/auth/send-verification-otp",
        "/api/v1/auth/verify-otp-registration",
        "/api/v1/auth/forgot-password-otp",
        "/api/v1/auth/verify-reset-otp",
        "/api/v1/auth/reset-password-with-otp",
        "/api/v1/auth/change-password",
        "/api/v1/users",
        "/api/vitals",
        "/api/v1/site",
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
    ]

    # Methods that don't need CSRF protection
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

    async def dispatch(self, request: Request, call_next: Callable):
        # Skip CSRF for safe methods
        if request.method in self.SAFE_METHODS:
            return await call_next(request)

        # Skip CSRF for exempt routes
        if any(request.url.path.startswith(route) for route in self.EXEMPT_ROUTES):
            return await call_next(request)

        # Skip CSRF for webhook endpoints (they have their own verification)
        if "/webhooks/" in request.url.path:
            return await call_next(request)

        # API clients sending Authorization header or X-Requested-With are not
        # browser form submissions; HttpOnly+SameSite cookies already prevent CSRF
        # for same-origin API requests.  Skip CSRF validation for these clients.
        if (request.headers.get("Authorization") or
                request.headers.get("X-Requested-With") or
                request.cookies.get("access_token")):
            return await call_next(request)

        # Full browser form submission without token — validate double-submit
        csrf_header = request.headers.get("X-CSRF-Token")
        csrf_cookie = request.cookies.get("csrf_token")

        if not csrf_header or not csrf_cookie:
            logger.warning(f"CSRF token missing for {request.method} {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"error": {"type": "forbidden", "message": "CSRF token missing", "status_code": 403}},
            )

        if not secrets.compare_digest(csrf_header, csrf_cookie):
            logger.warning(f"CSRF token invalid for {request.method} {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"error": {"type": "forbidden", "message": "CSRF token invalid", "status_code": 403}},
            )

        return await call_next(request)


def generate_csrf_token() -> str:
    """Generate a secure CSRF token."""
    return secrets.token_urlsafe(32)

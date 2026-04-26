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

    # Routes that don't need CSRF protection (mostly purely public or internal)
    EXEMPT_ROUTES = [
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/register",
        "/api/v1/auth/login-otp-request",
        "/api/v1/auth/send-verification-otp",
        "/api/v1/auth/resend-verification",
        "/api/vitals",
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

        # CSRF check is required for any request using cookie-based auth
        has_auth_cookie = request.cookies.get("access_token") or request.cookies.get("session_id")
        
        if not has_auth_cookie:
            # If no cookies are sent, the request is not vulnerable to CSRF
            # (e.g. mobile app using Bearer header only)
            if request.headers.get("Authorization"):
                return await call_next(request)

        # Enforce double-submit cookie validation
        csrf_header = request.headers.get("X-CSRF-Token")
        csrf_cookie = request.cookies.get("csrf_token")

        if not csrf_header or not csrf_cookie:
            logger.warning(f"CSRF token missing for {request.method} {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"error": {"type": "forbidden", "message": "CSRF token missing. Please refresh the page.", "status_code": 403}},
            )

        if not secrets.compare_digest(csrf_header, csrf_cookie):
            logger.warning(f"CSRF token invalid for {request.method} {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"error": {"type": "forbidden", "message": "CSRF token invalid. Please refresh the page.", "status_code": 403}},
            )

        return await call_next(request)


def generate_csrf_token() -> str:
    """Generate a secure CSRF token."""
    return secrets.token_urlsafe(32)

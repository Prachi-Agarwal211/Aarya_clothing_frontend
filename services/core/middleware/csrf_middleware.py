"""CSRF protection middleware."""
import secrets
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection using double-submit cookie pattern."""
    
    # Routes that don't need CSRF protection
    EXEMPT_ROUTES = [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc"
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
        
        # Get CSRF token from header and cookie
        csrf_header = request.headers.get("X-CSRF-Token")
        csrf_cookie = request.cookies.get("csrf_token")
        
        # Validate CSRF token
        # Note: In a real production env, you'd enforce this. 
        # For now, if no cookie/header is present, we might want to be lenient during migration 
        # or strictly enforce it. The plan says "Add CSRF Protection", so we assume enforcement.
        
        if not csrf_header or not csrf_cookie:
            # For now, let's log warning and allow if strictly required, but usually we raise 403
            # We will follow the plan's strict implementation
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing"
            )
        
        if not secrets.compare_digest(csrf_header, csrf_cookie):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token invalid"
            )
        
        return await call_next(request)


def generate_csrf_token() -> str:
    """Generate a secure CSRF token."""
    return secrets.token_urlsafe(32)

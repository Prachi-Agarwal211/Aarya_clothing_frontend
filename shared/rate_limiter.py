"""
Shared rate limiter for all Aarya Clothing microservices.
Redis-backed sliding-window rate limiting with FastAPI dependency support.
"""

import time
import logging
from typing import Optional, Callable
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

# ── Default limits (per window) ──────────────────────────────────────────────

LIMITS = {
    "auth_login": (10, 300),  # 10 attempts / 5 min
    "auth_register": (5, 3600),  # 5 registrations / 1 hr
    "auth_password_reset": (5, 3600),  # 5 resets / 1 hr
    "auth_otp": (6, 600),  # 6 OTP attempts / 10 min
    "search": (60, 60),  # 60 searches / 1 min
    "cart_write": (30, 60),  # 30 cart mutations / 1 min
    "review_create": (10, 3600),  # 10 reviews / 1 hr (was 3)
    "default": (120, 60),  # 120 requests / 1 min
}


class RateLimiter:
    """
    Redis sliding-window rate limiter.
    Keys are namespaced as: rate:{endpoint}:{client_id}:{window_bucket}
    """

    def __init__(self, redis_client=None):
        self._redis = redis_client

    @property
    def redis(self):
        if self._redis is None:
            try:
                from shared.unified_redis_client import get_redis_client

                self._redis = get_redis_client()
            except Exception:
                pass
        return self._redis

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """
        Check rate limit. Returns (allowed: bool, current_count: int).
        Falls back to allowed=False if Redis is unavailable (fail-closed for security).
        """
        if not self.redis:
            logger.warning(
                "Redis unavailable - rate limiter failing closed (denying requests)"
            )
            return False, 0

        now = int(time.time())
        bucket = now // window_seconds
        redis_key = f"rate:{key}:{bucket}"

        try:
            pipe = self.redis.client.pipeline()
            pipe.incr(redis_key)
            pipe.expire(redis_key, window_seconds * 2)
            results = pipe.execute()
            count = results[0]
            return count <= limit, count
        except Exception as e:
            logger.warning(f"RateLimiter Redis error (failing closed): {e}")
            return False, 0

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        """Raise HTTP 429 if rate limit exceeded."""
        allowed, count = self.is_allowed(key, limit, window_seconds)
        if not allowed:
            retry_after = window_seconds - (int(time.time()) % window_seconds)
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit_exceeded",
                    "message": f"Too many requests. Retry after {retry_after}s.",
                    "retry_after_seconds": retry_after,
                    "limit": limit,
                    "window_seconds": window_seconds,
                },
                headers={"Retry-After": str(retry_after)},
            )

    def get_client_id(self, request: Request, user_id: Optional[int] = None) -> str:
        """Derive a stable client identifier (user_id preferred, then IP)."""
        if user_id:
            return f"user:{user_id}"
        forwarded = request.headers.get("X-Forwarded-For")
        ip = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else "unknown")
        )
        return f"ip:{ip}"


# ── Singleton ─────────────────────────────────────────────────────────────────

_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


# ── FastAPI dependency factories ──────────────────────────────────────────────


def rate_limit(
    endpoint_key: str, limit: Optional[int] = None, window: Optional[int] = None
) -> Callable:
    """
    Returns a FastAPI dependency that enforces rate limiting.

    Usage:
        @app.post("/login")
        async def login(request: Request, _=Depends(rate_limit("auth_login"))):
            ...
    """
    default_limit, default_window = LIMITS.get(endpoint_key, LIMITS["default"])
    _limit = limit or default_limit
    _window = window or default_window

    async def _dep(request: Request):
        rl = get_rate_limiter()
        client_id = rl.get_client_id(request)
        rl.check(f"{endpoint_key}:{client_id}", _limit, _window)

    return _dep


def rate_limit_user(
    endpoint_key: str, limit: Optional[int] = None, window: Optional[int] = None
) -> Callable:
    """
    Rate limit by authenticated user_id (falls back to IP for guests).
    Requires that the route passes `current_user: dict` as a dependency BEFORE this.
    Usage: embed in route as a secondary Depends.
    """
    default_limit, default_window = LIMITS.get(endpoint_key, LIMITS["default"])
    _limit = limit or default_limit
    _window = window or default_window

    async def _dep(request: Request):
        rl = get_rate_limiter()
        client_id = rl.get_client_id(request)
        rl.check(f"{endpoint_key}:{client_id}", _limit, _window)

    return _dep

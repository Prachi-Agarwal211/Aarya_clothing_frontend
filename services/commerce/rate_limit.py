"""
Per-endpoint rate limiting backed by Redis.

Single source of truth so main.py and individual routers all use the same
rules instead of forking their own copies. Local dev/test loopback traffic is
allowed to bypass limits so smoke tests can run repeatedly.
"""
from __future__ import annotations

import ipaddress
import logging
from typing import Optional

from fastapi import Request

from core.config import settings
from core.redis_client import redis_client

logger = logging.getLogger(__name__)

LOCAL_TEST_IPS = {"127.0.0.1", "::1", "localhost", "testclient"}


def get_client_ip(request: Request) -> str:
    """Best-effort client IP, honoring proxy headers when present."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first_hop = forwarded_for.split(",")[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else "unknown"


def should_bypass_local_rate_limit(request: Request) -> bool:
    """
    Keep rate limiting for deployed traffic while letting local dev/test
    automation from loopback or private addresses replay flows freely.
    """
    if not settings.is_development:
        return False

    client_ip = get_client_ip(request)
    if client_ip in LOCAL_TEST_IPS:
        return True

    try:
        parsed_ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    return parsed_ip.is_loopback or parsed_ip.is_private


def check_rate_limit(
    request: Request,
    endpoint: str,
    limit: int,
    window: int = 60,
    user_identifier: Optional[str] = None,
) -> bool:
    """
    Sliding-window rate check for *endpoint*.

    Uses *user_identifier* when provided (per-customer) and falls back to the
    client IP for unauthenticated endpoints. Failing open on Redis errors is
    intentional — losing a rate limit beats a hard outage.
    """
    if should_bypass_local_rate_limit(request):
        return True

    try:
        rate_id = user_identifier if user_identifier else get_client_ip(request)
        limit_key = f"rate_limit:{endpoint}:{rate_id}"
        count = redis_client.get_cache(limit_key) or 0

        if int(count) >= limit:
            return False

        redis_client.set_cache(limit_key, int(count) + 1, ttl=window)
        return True
    except Exception as exc:
        logger.warning(f"Rate limit check error (failing open): {exc}")
        return True

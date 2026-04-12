"""Signed, opaque tokens for public guest order tracking URLs (no DB column)."""
from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Optional

from core.config import settings


def create_guest_tracking_token(order_id: int) -> str:
    """Return URL-safe token proving access to track this order (HMAC-SHA256)."""
    if not settings.SECRET_KEY:
        raise ValueError("SECRET_KEY must be set for guest tracking links")
    msg = str(int(order_id)).encode("utf-8")
    sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    combined = f"{order_id}:{sig}"
    raw = base64.urlsafe_b64encode(combined.encode("utf-8")).decode("ascii")
    return raw.rstrip("=")


def parse_guest_tracking_token(token: str) -> Optional[int]:
    """Validate token and return order_id, or None if invalid."""
    if not settings.SECRET_KEY:
        return None
    if not token or not isinstance(token, str):
        return None
    try:
        pad = "=" * (-len(token) % 4)
        combined = base64.urlsafe_b64decode((token + pad).encode("ascii")).decode("utf-8")
        order_id_str, sig = combined.split(":", 1)
        order_id = int(order_id_str)
        expected = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            str(order_id).encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        return order_id
    except Exception:
        return None

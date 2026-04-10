"""
Redis-backed queue for OTP emails so registration/forgot-password APIs return quickly
under concurrent load; a background worker sends via SMTP with retries.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from core.config import settings
from core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

OTP_EMAIL_QUEUE_KEY = "core:email:otp_queue"


def try_enqueue_otp_email(to_email: str, otp_code: str, purpose: str) -> bool:
    """
    Push OTP email job to Redis. Returns False if queue disabled or Redis unavailable
    (caller should send synchronously).
    """
    if not settings.EMAIL_OTP_USE_QUEUE:
        return False
    if not settings.email_enabled:
        return False
    try:
        rc = get_redis_client()
        if not rc.is_connected():
            return False
        payload = json.dumps(
            {"to": to_email, "code": otp_code, "purpose": purpose or "verification"},
            separators=(",", ":"),
        )
        rc.client.rpush(OTP_EMAIL_QUEUE_KEY, payload)
        logger.info("[EmailQueue] OTP email queued for %s", to_email)
        return True
    except Exception as e:
        logger.warning("[EmailQueue] enqueue failed (will use sync send): %s", e)
        return False


def otp_email_queue_length() -> Optional[int]:
    """LLEN for monitoring; None if Redis unavailable."""
    try:
        rc = get_redis_client()
        if not rc.is_connected():
            return None
        n = rc.client.llen(OTP_EMAIL_QUEUE_KEY)
        return int(n) if n is not None else 0
    except Exception:
        return None


async def run_otp_email_worker() -> None:
    """Background task: BLPOP jobs and send OTP emails."""
    from service.email_service import email_service

    try:
        rc = get_redis_client()
    except Exception:
        logger.error("[EmailQueue] worker: cannot get Redis client")
        return

    if not rc.is_connected():
        logger.warning("[EmailQueue] worker not started: Redis unavailable")
        return

    redis_sync = rc.client
    logger.info("[EmailQueue] OTP email worker started")

    while True:
        try:
            item: Any = await asyncio.to_thread(redis_sync.blpop, OTP_EMAIL_QUEUE_KEY, 5)
            if not item:
                continue
            _, raw = item
            data = json.loads(raw)
            to_email = data.get("to")
            code = data.get("code")
            purpose = data.get("purpose", "verification")
            if not to_email or not code:
                logger.error("[EmailQueue] bad payload: %s", raw)
                continue
            ok = email_service.send_otp_email(to_email, code, purpose)
            if not ok:
                logger.error("[EmailQueue] SMTP failed for queued OTP to %s", to_email)
        except asyncio.CancelledError:
            logger.info("[EmailQueue] OTP email worker cancelled")
            raise
        except Exception:
            logger.exception("[EmailQueue] worker loop error")
            await asyncio.sleep(1)

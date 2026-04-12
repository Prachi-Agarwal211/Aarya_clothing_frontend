"""
Redis-backed queue for OTP emails so registration/forgot-password APIs return quickly
under concurrent load; a background worker sends via SMTP with retries.

Uses redis.asyncio for BLPOP — sync blpop + asyncio.to_thread can leave the sync
Redis client in a broken state after socket timeouts under load.

Multi-parallel: up to SMTP_CONCURRENCY emails sent simultaneously to handle burst load.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from core.config import settings

logger = logging.getLogger(__name__)

OTP_EMAIL_QUEUE_KEY = "core:email:otp_queue"
# How many SMTP sends can run in parallel (each takes ~2-3s).
# Must not exceed EmailService._executor max_workers (2) — otherwise tasks queue
# on the thread pool and gain nothing from higher concurrency.
SMTP_CONCURRENCY = 2


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
        from core.redis_client import get_redis_client

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
        from core.redis_client import get_redis_client

        rc = get_redis_client()
        if not rc.is_connected():
            return None
        n = rc.client.llen(OTP_EMAIL_QUEUE_KEY)
        return int(n) if n is not None else 0
    except Exception:
        return None


def _build_async_redis():
    """Dedicated async Redis client for the OTP worker (same URL/DB as sync client)."""
    import redis.asyncio as redis_async

    return redis_async.from_url(
        settings.REDIS_URL,
        db=settings.REDIS_DB,
        decode_responses=True,
        socket_connect_timeout=10,
        socket_timeout=30,
        retry_on_timeout=True,
        health_check_interval=30,
    )


async def _send_one_email(to_email: str, code: str, purpose: str, semaphore: asyncio.Semaphore) -> None:
    """Send a single OTP email, bounded by the concurrency semaphore."""
    from service.email_service import email_service

    async with semaphore:
        ok = await asyncio.to_thread(email_service.send_otp_email, to_email, code, purpose)
        if ok:
            logger.info("[EmailQueue] Sent OTP to %s", to_email)
        else:
            logger.error("[EmailQueue] SMTP failed for queued OTP to %s", to_email)


async def run_otp_email_worker() -> None:
    """Background task: BLPOP jobs and send OTP emails via async Redis.

    Dispatches each email to a semaphore-bounded task so up to SMTP_CONCURRENCY
    emails are sent in parallel (critical for 1000-user signup bursts).
    """
    if not settings.EMAIL_OTP_USE_QUEUE:
        logger.info("[EmailQueue] OTP queue disabled — worker not started")
        return
    if not settings.email_enabled:
        logger.warning("[EmailQueue] Email disabled — worker not started")
        return

    logger.info("[EmailQueue] OTP email worker starting (async Redis, concurrency=%d)", SMTP_CONCURRENCY)

    r: Any = None
    retry_streak = 0
    semaphore = asyncio.Semaphore(SMTP_CONCURRENCY)
    active_tasks: set[asyncio.Task] = set()

    while True:
        try:
            if r is None:
                r = _build_async_redis()
                await r.ping()
                retry_streak = 0
                logger.info("[EmailQueue] async Redis connected")

            result = await r.blpop(OTP_EMAIL_QUEUE_KEY, timeout=5)
            if result is None:
                continue

            _, raw = result
            data = json.loads(raw)
            to_email = data.get("to")
            code = data.get("code")
            purpose = data.get("purpose", "verification")
            if not to_email or not code:
                logger.error("[EmailQueue] bad payload: %s", raw)
                continue

            task = asyncio.create_task(_send_one_email(to_email, code, purpose, semaphore))
            active_tasks.add(task)
            task.add_done_callback(active_tasks.discard)

            # Clean up completed tasks periodically
            if len(active_tasks) > SMTP_CONCURRENCY * 4:
                done = {t for t in active_tasks if t.done()}
                active_tasks -= done

        except asyncio.CancelledError:
            logger.info("[EmailQueue] OTP email worker cancelled")
            # Wait for in-flight emails to finish
            if active_tasks:
                await asyncio.gather(*active_tasks, return_exceptions=True)
            if r is not None:
                try:
                    await r.aclose()
                except Exception:
                    pass
            raise

        except Exception as e:
            retry_streak += 1
            logger.exception("[EmailQueue] worker error (retry %s): %s", retry_streak, e)
            if r is not None:
                try:
                    await r.aclose()
                except Exception:
                    pass
                r = None
            delay = min(2 ** min(retry_streak, 5), 30)
            await asyncio.sleep(delay)

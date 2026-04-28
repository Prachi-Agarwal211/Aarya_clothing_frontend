"""
Email Worker
============
Background worker that processes email outbox queue.
Runs as separate thread/process, sends emails via Core SMTP with retry logic.

Integration:
- Called by main.py lifespan startup (commerce service)
- Or run as separate worker process (recommended for scale)

Design:
- Polls email_outbox for PENDING/RETRYING records where next_retry_at <= now
- Sends email via Core service HTTP
- On success: mark SENT
- On failure: increment attempts, schedule next_retry per backoff, mark RETRYING or FAILED
"""

import logging
import time
import json
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from database.database import get_db_context
from models.email_outbox import EmailOutbox, EmailStatus
from service.core_notification_client import _post as core_notify_post
from shared.time_utils import now_ist

logger = logging.getLogger(__name__)


# Retry backoff: attempt → delay minutes
RETRY_DELAYS = [0, 1, 5, 30, 120]  # minutes
MAX_ATTEMPTS = 5

# HTTP timeout for Core service — short to avoid blocking
CORE_TIMEOUT = 10.0  # seconds (reduced from 45s)


def calculate_next_retry(attempt: int) -> datetime:
    """Calculate next retry timestamp based on attempt number."""
    if attempt < len(RETRY_DELAYS):
        delay_minutes = RETRY_DELAYS[attempt]
    else:
        # After scheduled retries exhausted, wait 24 hours before final attempt
        delay_minutes = 24 * 60
    return now_ist() + timedelta(minutes=delay_minutes)


def process_email_outbox(batch_size: int = 50) -> dict:
    """
    Process a batch of pending emails.

    Called by:
    1. Commerce service background thread (runs every 60 seconds)
    2. Standalone worker process (RQ/Celery) — preferred for production

    Args:
        batch_size: Max emails to process in one run

    Returns:
        Dict with stats: {processed, sent, failed, retrying}
    """
    stats = {"processed": 0, "sent": 0, "failed": 0, "retrying": 0}

    with get_db_context() as db:
        try:
            # Fetch emails ready to send (status = PENDING or RETRYING, next_retry_at <= now)
            # Order by attempts ascending (send oldest first) and next_retry_at
            emails = (
                db.query(EmailOutbox)
                .filter(
                    and_(
                        EmailOutbox.status.in_(
                            [EmailStatus.PENDING.value, EmailStatus.RETRYING.value]
                        ),
                        EmailOutbox.next_retry_at <= now_ist(),
                    )
                )
                .order_by(EmailOutbox.attempts.asc(), EmailOutbox.next_retry_at.asc())
                .limit(batch_size)
                .all()
            )

            if not emails:
                return stats

            logger.info(f"Email worker: processing {len(emails)} emails")

            for email in emails:
                stats["processed"] += 1
                try:
                    # Mark as retrying to prevent other workers from picking it up
                    email.status = EmailStatus.RETRYING.value
                    email.attempts += 1
                    email.last_attempt_at = now_ist()
                    db.commit()

                    # Send via Core service internal endpoint
                    payload = {
                        "to_email": email.to_email,
                        "subject": email.subject,
                        "body_html": email.body_html,
                        "body_text": email.body_text,
                    }
                    success = core_notify_post(
                        f"/internal/email/send",  # Or /internal/notifications/email-direct
                        payload,
                    )

                    if success:
                        # Mark as sent
                        email.status = EmailStatus.SENT.value
                        email.sent_at = now_ist()
                        email.next_retry_at = None
                        email.error_message = None
                        stats["sent"] += 1
                        logger.info(
                            f"✓ Email sent: id={email.id} type={email.email_type} order={email.order_id}"
                        )
                    else:
                        # Core service returned non-200
                        raise Exception("Core service returned failure")

                    db.commit()

                except Exception as e:
                    db.rollback()
                    stats["failed"] += 1
                    logger.error(
                        f"✗ Email failed: id={email.id} order={email.order_id} error={str(e)[:200]}"
                    )

                    # Check if we should retry
                    if email.attempts >= MAX_ATTEMPTS:
                        # Final failure
                        email.status = EmailStatus.FAILED.value
                        email.error_message = str(e)[:500]
                        logger.error(
                            f"Email permanently failed after {MAX_ATTEMPTS} attempts: id={email.id}"
                        )
                    else:
                        # Schedule retry with backoff
                        email.status = EmailStatus.RETRYING.value
                        email.next_retry_at = calculate_next_retry(email.attempts)
                        stats["retrying"] += 1
                        logger.info(
                            f"Email scheduled for retry: id={email.id} attempt={email.attempts} next_at={email.next_retry_at}"
                        )

                    db.commit()

        except Exception as e:
            db.rollback()
            logger.error(f"Email worker batch failed: {e}", exc_info=True)

    return stats


def start_worker(stop_event=None, poll_interval: int = 60):
    """
    Start email worker loop.

    Args:
        stop_event: threading.Event for graceful shutdown
        poll_interval: Seconds to wait between batches
    """
    logger.info(f"Email worker starting — poll_interval={poll_interval}s")
    try:
        while not stop_event or not stop_event.is_set():
            try:
                stats = process_email_outbox()
                if stats["processed"] > 0:
                    logger.info(f"Email worker batch: {stats}")
            except Exception as e:
                logger.error(f"Worker loop error: {e}", exc_info=True)

            # Sleep in small increments to check stop_event
            if stop_event:
                waited = 0
                while waited < poll_interval and not stop_event.is_set():
                    time.sleep(1)
                    waited += 1
            else:
                time.sleep(poll_interval)
    except KeyboardInterrupt:
        logger.info("Email worker shutting down")


# Entry point for standalone worker process
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start_worker(poll_interval=60)

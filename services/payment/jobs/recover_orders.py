"""
Payment Recovery Job
====================
Finds completed payments that never got an order created (orphan payments)
and creates orders via the commerce service API.

Runs as a periodic background task inside the RQ worker (every 5 minutes).

This is the reliability safety net: if the frontend's register_payment()
fails or the user never reaches the confirm page after paying, the recovery
worker ensures the order is still created within 5 minutes.

Usage (standalone test):
    python -c "from jobs.recover_orders import run_recovery_cycle; run_recovery_cycle()"
"""
import json
import logging
import os
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from core.redis_client import redis_client

import httpx
from sqlalchemy.orm import Session

from database.database import SessionLocal
from models.payment import PaymentTransaction
from shared.time_utils import ist_naive

logger = logging.getLogger(__name__)

RECOVERY_INTERVAL_MINUTES = 5
PAYMENT_LOOKBACK_HOURS = 72  # Only recover payments from last 72 hours
MAX_RECOVERY_ATTEMPTS = 10  # Stop retrying after this many attempts per payment
MAX_RECOVERED_PER_CYCLE = 20  # Cap per-cycle recoveries to prevent runaway loops

# ── Thread-local shared HTTP client ──
# Avoids creating a new TCP connection per recovery attempt.
# httpx.Client is NOT thread-safe, so we use threading.local().
_http_thread_local = threading.local()

def _get_http_client() -> httpx.Client:
    """Get or create a thread-local shared HTTP client.

    Uses threading.local() so each worker thread gets its own httpx.Client
    instance, avoiding thread-safety issues. Reuses TCP connections via
    HTTP keepalive to reduce latency and connection overhead.
    """
    client = getattr(_http_thread_local, 'client', None)
    if client is None or client.is_closed:
        client = httpx.Client(
            timeout=httpx.Timeout(30.0, connect=5.0),
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=30,
            ),
        )
        _http_thread_local.client = client
    return client


# Recovery attempt tracker (Redis-backed to survive restarts).
# Key: recovery_attempt:{payment_key} → value: count (int)
# TTL: 72 hours (matches PAYMENT_LOOKBACK_HOURS). Max attempts before
# giving up on a payment is MAX_RECOVERY_ATTEMPTS (10).

_RECOVERY_TTL = 72 * 60 * 60  # 72 hours in seconds

def _get_attempts(payment_key: str) -> int:
    """Get the current retry count for a payment key from Redis."""
    try:
        key = f"recovery_attempt:{payment_key}"
        val = redis_client.get_cache(key)
        return int(val) if val is not None else 0
    except Exception:
        return 0

def _incr_attempts(payment_key: str) -> int:
    """Increment retry count in Redis and return new count."""
    try:
        key = f"recovery_attempt:{payment_key}"
        rc = getattr(redis_client, "client", None)
        if rc:
            new_val = rc.incr(key)
            rc.expire(key, _RECOVERY_TTL)
            return new_val
        return 0
    except Exception:
        return 0

def _clear_attempts(payment_key: str) -> None:
    """Remove retry count for a successfully recovered payment."""
    try:
        key = f"recovery_attempt:{payment_key}"
        redis_client.delete_cache(key)
    except Exception:
        pass


def _get_commerce_payload(transaction: PaymentTransaction) -> Optional[Dict[str, Any]]:
    """
    Build the commerce order-creation payload from a payment transaction.

    Tries these strategies in order:
    1. Extract pending_order_id from gateway_response → uses create-from-pending
    2. Build pending_order_data from stored cart snapshot + address → uses create-from-data
    3. Return None if no data available (cannot recover)
    """
    gateway = transaction.gateway_response or {}

    if not isinstance(gateway, dict):
        return None

    # ── Strategy 1: Find pending_order_id ──
    pending_order_id = None

    # Direct field (set during checkout initiation)
    pending_order_id = gateway.get("pending_order_id")

    # _checkout_meta (preserved by _preserve_checkout_meta across webhook events)
    if not pending_order_id:
        checkout_meta = gateway.get("_checkout_meta", {})
        if isinstance(checkout_meta, dict):
            pending_order_id = checkout_meta.get("pending_order_id")
            # Also check nested _checkout_meta (2+ handler overwrites) — safety
            if not pending_order_id:
                nested_meta = checkout_meta.get("_checkout_meta", {})
                if isinstance(nested_meta, dict):
                    pending_order_id = nested_meta.get("pending_order_id")

    # Razorpay payment notes (in various locations)
    if not pending_order_id:
        for notes_source in [
            gateway.get("notes", {}),
            gateway.get("payload", {}).get("payment", {}).get("entity", {}).get("notes", {}),
            gateway.get("payload", {}).get("order", {}).get("entity", {}).get("notes", {}),
        ]:
            if isinstance(notes_source, dict):
                poid = notes_source.get("pending_order_id")
                if poid:
                    pending_order_id = poid
                    break
            elif isinstance(notes_source, str):
                try:
                    notes_parsed = json.loads(notes_source)
                    poid = notes_parsed.get("pending_order_id")
                    if poid:
                        pending_order_id = poid
                        break
                except Exception:
                    pass

    # ── Strategy 2: Build pending_order_data from stored metadata ──
    pending_order_data = {}

    # Try multiple locations for cart_snapshot and shipping_address
    cart_snapshot = None
    shipping_address = None
    
    for source in [
        gateway.get("_checkout_meta", {}),
        gateway.get("_checkout_meta", {}).get("_checkout_meta", {}),  # nested (safety)
        gateway,
    ]:
        if isinstance(source, dict):
            cs = source.get("cart_snapshot", [])
            sa = source.get("shipping_address", "")
            if cs and sa:
                cart_snapshot = cs
                shipping_address = sa
                break

    if cart_snapshot and shipping_address:
        pending_order_data = {
            "cart_snapshot": cart_snapshot,
            "shipping_address": shipping_address,
            "total_amount": float(transaction.amount),
            "subtotal": float(transaction.amount),
            "shipping_cost": 0,
            "payment_method": transaction.payment_method or "razorpay",
        }

    # ── Strategy 3: Try to find a pending_order by razorpay_order_id ──
    if not pending_order_id and not pending_order_data.get("cart_snapshot"):
        razorpay_oid = transaction.razorpay_order_id
        if razorpay_oid:
            try:
                recovery_db = SessionLocal()
                try:
                    from sqlalchemy import text as _text
                    pending = recovery_db.execute(
                        _text(
                            "SELECT id, cart_snapshot, shipping_address, total_amount "
                            "FROM pending_orders "
                            "WHERE razorpay_order_id = :roid AND user_id = :uid "
                            "ORDER BY created_at DESC LIMIT 1"
                        ),
                        {"roid": razorpay_oid, "uid": transaction.user_id}
                    ).fetchone()
                    if pending:
                        pending_order_id = pending[0]
                        logger.info(f"RECOVERY: Found pending_order {pending_order_id} by razorpay_order_id")
                finally:
                    recovery_db.close()
            except Exception as e:
                logger.warning(f"RECOVERY: Failed to find pending_order by razorpay_order_id: {e}")

    # ── Strategy 4: Match pending by user_id + amount (QR orphans) ──
    # STRICT: only when EXACTLY one open pending exists for this user+amount
    # and it was created near the payment time (±6h). Multiple pendings = refuse
    # (ambiguous cart under concurrent checkouts for popular price points).
    if not pending_order_id and not pending_order_data.get("cart_snapshot"):
        try:
            recovery_db = SessionLocal()
            try:
                from sqlalchemy import text as _text
                rows = recovery_db.execute(
                    _text(
                        "SELECT id, created_at FROM pending_orders "
                        "WHERE user_id = :uid AND total_amount = :amt "
                        "  AND status IN ('pending', 'payment_confirmed') "
                        "  AND order_id IS NULL "
                        "ORDER BY created_at DESC"
                    ),
                    {"uid": transaction.user_id, "amt": float(transaction.amount)},
                ).fetchall()
                if len(rows) == 1:
                    pid, pcreated = rows[0][0], rows[0][1]
                    txn_created = transaction.created_at
                    # Time-box: pending should be from same checkout session window
                    if pcreated and txn_created:
                        try:
                            delta = abs((txn_created - pcreated.replace(tzinfo=None)
                                         if getattr(pcreated, "tzinfo", None)
                                         else txn_created - pcreated).total_seconds())
                        except Exception:
                            delta = 0
                        if delta <= 6 * 3600:
                            pending_order_id = pid
                            logger.info(
                                f"RECOVERY: unique pending={pid} user={transaction.user_id} "
                                f"amount={transaction.amount} delta_s={delta:.0f}"
                            )
                        else:
                            logger.warning(
                                f"RECOVERY: pending={pid} too far from txn "
                                f"delta_s={delta:.0f} — skip amount match"
                            )
                    else:
                        pending_order_id = pid
                elif len(rows) > 1:
                    logger.warning(
                        f"RECOVERY: AMBIGUOUS {len(rows)} pendings for "
                        f"user={transaction.user_id} amount={transaction.amount} "
                        f"— refuse amount match to avoid wrong cart"
                    )
            finally:
                recovery_db.close()
        except Exception as e:
            logger.warning(f"RECOVERY: user+amount pending lookup failed: {e}")

    # ── If we have nothing useful, skip ──
    if not pending_order_id and not pending_order_data:
        logger.warning(
            f"Cannot recover transaction {transaction.transaction_id}: "
            f"no pending_order_id or cart snapshot available"
        )
        return None

    payload = {
        "user_id": transaction.user_id,
        "payment_id": transaction.razorpay_payment_id,
        "razorpay_order_id": transaction.razorpay_order_id or "",
        "payment_signature": transaction.razorpay_signature or "",
    }

    if pending_order_id:
        payload["pending_order_id"] = pending_order_id
    elif pending_order_data:
        payload["pending_order_data"] = pending_order_data

    return payload


def recover_single_transaction(
    transaction: PaymentTransaction,
    commerce_url: str,
    internal_secret: str,
) -> Optional[int]:
    """
    Attempt to create an order for one orphan payment.

    Uses a shared HTTP client (reuses TCP connections across calls within
    the same recovery cycle). Returns the order_id if order was created
    (or already existed), None if recovery failed.
    """
    # Circuit breaker: skip if we've already retried too many times
    payment_key = transaction.razorpay_payment_id or f"txn_{transaction.transaction_id}"
    retry_count = _get_attempts(payment_key)
    if retry_count >= MAX_RECOVERY_ATTEMPTS:
        logger.warning(
            f"CIRCUIT_BREAKER: Skipping {payment_key} "
            f"— exceeded {MAX_RECOVERY_ATTEMPTS} recovery attempts"
        )
        return None

    # Increment attempt counter
    _incr_attempts(payment_key)

    payload = _get_commerce_payload(transaction)
    if not payload:
        return None

    try:
        # FIX: Use shared HTTP client instead of creating a new one per call.
        # This reuses TCP connections (keepalive) and avoids connection-pool
        # exhaustion under load.
        client = _get_http_client()
        response = client.post(
            f"{commerce_url}/api/v1/orders/internal/orders/create-from-payment",
            json=payload,
            headers={"X-Internal-Secret": internal_secret},
        )

        if response.status_code == 200:
            result = response.json()
            order_id = result.get("order_id")
            if order_id:
                logger.info(
                    f"✓ RECOVERED: payment={transaction.razorpay_payment_id} "
                    f"user={transaction.user_id} → order_id={order_id}"
                )
                return order_id

            logger.warning(
                f"⚠ RECOVERY_NO_ID: payment={transaction.razorpay_payment_id} "
                f"resp={response.text[:200]}"
            )
            return None

        elif response.status_code == 409:
            # Lock contention — another process (webhook, frontend) is handling it
            logger.info(
                f"⏳ RECOVERY_LOCKED: payment={transaction.razorpay_payment_id} "
                f"— retry next cycle"
            )
            return None
        else:
            logger.error(
                f"✗ RECOVERY_FAILED: payment={transaction.razorpay_payment_id} "
                f"status={response.status_code} resp={response.text[:300]}"
            )
            return None

    except httpx.TimeoutException:
        logger.error(f"✗ RECOVERY_TIMEOUT: payment={transaction.razorpay_payment_id}")
        return None
    except Exception as e:
        logger.error(
            f"✗ RECOVERY_ERROR: payment={transaction.razorpay_payment_id} "
            f"error={e}"
        )
        return None


def scan_and_recover_orders(db: Session) -> int:
    """
    Find completed payments without orders and attempt recovery.

    Uses a distributed Redis lock to prevent two concurrent recovery cycles
    from both trying to recover the same payment (which creates duplicate orders).

    Returns count of successfully recovered orders.
    """
    commerce_url = os.getenv("COMMERCE_SERVICE_URL", "http://commerce:5002")
    internal_secret = os.getenv("INTERNAL_SERVICE_SECRET", "")

    if not internal_secret:
        logger.error("INTERNAL_SERVICE_SECRET not configured — cannot recover orders")
        return 0

    # Acquire a distributed lock so only one recovery cycle runs at a time.
    # This prevents the race where cycle A fetches orphans, cycle B also fetches
    # the same orphans (before A saved order_ids), and both create orders.
    #
    # SAFETY: lock_token is initialized outside the try block to ensure it's
    # always defined for the finally-block release, even if an exception occurs
    # during lock acquisition.
    lock_key = "recovery:cycle-lock"
    lock_token = None
    lock_acquired = False
    try:
        from core.redis_client import redis_client
        import uuid as _uuid
        import time as _time

        rc = getattr(redis_client, "client", None)
        if rc:
            lock_token = str(_uuid.uuid4())
            acquired = rc.set(lock_key, lock_token, nx=True, ex=30)  # 30s TTL
            if acquired:
                lock_acquired = True
                logger.info("RECOVERY_LOCK_ACQUIRED: Starting recovery cycle")
        else:
            # No Redis — degraded mode, proceed without lock
            lock_acquired = True
    except Exception as e:
        logger.warning(f"RECOVERY_LOCK_FAILED (proceeding without lock): {e}")
        lock_acquired = True  # Allow through in degraded mode

    if not lock_acquired:
        logger.info("RECOVERY_SKIPPED: Another recovery cycle is running")
        return 0

    try:
        # Find completed payments without order_id, within lookback window
        # Use ist_naive() to match the timezone of stored completed_at timestamps
        lookback = ist_naive() - timedelta(hours=PAYMENT_LOOKBACK_HOURS)

        orphan_transactions = (
            db.query(PaymentTransaction)
            .filter(
                PaymentTransaction.status == "completed",
                PaymentTransaction.order_id.is_(None),
                PaymentTransaction.razorpay_payment_id.isnot(None),
                PaymentTransaction.razorpay_payment_id != "",
                PaymentTransaction.completed_at >= lookback,
            )
            .order_by(PaymentTransaction.completed_at.asc())
            .all()
        )

        if not orphan_transactions:
            logger.info("No orphan payments found — all completed payments have orders")
            return 0

        logger.info(
            f"Found {len(orphan_transactions)} orphan payment(s) needing recovery"
        )

        recovered_count = 0
        for txn in orphan_transactions:
            if recovered_count >= MAX_RECOVERED_PER_CYCLE:
                logger.warning(f"Reached max recoveries per cycle ({MAX_RECOVERED_PER_CYCLE}) — stopping")
                break

            logger.info(
                f"Attempting recovery: payment={txn.razorpay_payment_id} "
                f"user={txn.user_id} amount={txn.amount}"
            )

            order_id = recover_single_transaction(txn, commerce_url, internal_secret)
            if order_id:
                # Successful recovery — clear circuit breaker counter
                payment_key = txn.razorpay_payment_id or f"txn_{txn.transaction_id}"
                _clear_attempts(payment_key)
                # Save order_id back to prevent re-processing this payment.
                # Only set if not already set (prevents overwriting by race).
                if txn.order_id and txn.order_id != order_id:
                    logger.warning(
                        f"RECOVERY_ORDER_ID_MISMATCH: txn={txn.transaction_id} "
                        f"existing={txn.order_id} new={order_id} — not overwriting"
                    )
                else:
                    try:
                        txn.order_id = order_id
                        db.commit()
                        logger.info(
                            f"✓ ORDER_ID_SAVED: transaction={txn.transaction_id} "
                            f"order_id={order_id}"
                        )
                        recovered_count += 1
                    except Exception as e:
                        db.rollback()
                        logger.warning(
                            f"⚠ Failed to save order_id for {txn.transaction_id}: {e}"
                        )

        return recovered_count
    finally:
        # Release the distributed lock (only if we actually acquired it)
        if lock_acquired and lock_token is not None:
            try:
                from core.redis_client import redis_client
                rc = getattr(redis_client, "client", None)
                if rc:
                    script = """
                    if redis.call('GET', KEYS[1]) == ARGV[1] then
                        return redis.call('DEL', KEYS[1])
                    else
                        return 0
                    end
                    """
                    rc.eval(script, 1, lock_key, lock_token)
            except Exception:
                pass


def expire_stale_reservations(commerce_url: str, internal_secret: str) -> int:
    """
    Release stock reservations older than 30 minutes (abandoned checkouts).

    Called from the same worker that does payment recovery.
    The commerce service handles the actual SELECT FOR UPDATE + release.
    Returns the number of expired reservations.

    Uses shared HTTP client to reuse TCP connections.
    """
    try:
        client = _get_http_client()
        resp = client.post(
            f"{commerce_url}/api/v1/internal/orders/expire-reservations",
            headers={"X-Internal-Secret": internal_secret},
        )
        if resp.status_code == 200:
            result = resp.json()
            expired = result.get("expired", 0)
            if expired > 0:
                logger.info(f"✓ EXPIRED_STALE_RESERVATIONS: count={expired}")
            return expired
        else:
            logger.warning(f"Expire reservations failed: status={resp.status_code}")
            return 0
    except Exception as e:
        logger.error(f"Expire reservations error: {e}")
        return 0


def _cleanup_orphan_razorpay_orders():
    """Log orphan Razorpay orders for manual review.

    H3 fix (transaction failure is now fatal) prevents new orphans.
    Existing orphans are unpaid and auto-expire at Razorpay.
    """
    try:
        db = SessionLocal()
        try:
            from sqlalchemy import text as _text
            orphans = db.execute(
                _text(
                    "SELECT razorpay_order_id, user_id, amount "
                    "FROM payment_transactions "
                    "WHERE order_id IS NULL "
                    "AND razorpay_order_id IS NOT NULL "
                    "AND razorpay_order_id != '' "
                    "AND status = 'pending' "
                    "AND created_at < NOW() - INTERVAL '1 hour'"
                )
            ).fetchall()

            for row in orphans:
                logger.warning(
                    f"ORPHAN_RAZORPAY_ORDER: id={row.razorpay_order_id} "
                    f"user={row.user_id} amount={row.amount} — "
                    f"unpaid, will auto-expire"
                )
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"ORPHAN_RAZORPAY_CLEANUP_ERROR: {e}")


def run_recovery_cycle():
    """
    Run one full recovery cycle with its own DB session.

    Called periodically from the worker's background thread.
    Now also expires stale stock reservations (abandoned checkouts).
    """
    logger.info("Starting payment recovery cycle...")
    start = datetime.utcnow()

    commerce_url = os.getenv("COMMERCE_SERVICE_URL", "http://commerce:5002")
    internal_secret = os.getenv("INTERNAL_SERVICE_SECRET", "")

    try:
        db = SessionLocal()
        try:
            # 1. Recover orphan payments (existing logic)
            recovered = scan_and_recover_orders(db)

            # 2. Expire stale stock reservations (prevents locked inventory)
            if internal_secret:
                expire_stale_reservations(commerce_url, internal_secret)

            # 3. Cleanup orphaned Razorpay orders (H3 fix handles new ones,
            #    this cleans up historical orphans created before the fix)
            _cleanup_orphan_razorpay_orders()

            elapsed = (datetime.utcnow() - start).total_seconds()
            if recovered > 0:
                logger.info(
                    f"✓ Recovery cycle complete: {recovered} order(s) "
                    f"recovered in {elapsed:.1f}s"
                )
            else:
                logger.info(
                    f"Recovery cycle complete: no orders needed recovery "
                    f"({elapsed:.1f}s)"
                )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Recovery cycle failed: {e}", exc_info=True)

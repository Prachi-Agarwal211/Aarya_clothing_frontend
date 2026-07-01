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
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import httpx
from sqlalchemy.orm import Session

from database.database import SessionLocal
from models.payment import PaymentTransaction
from shared.time_utils import ist_naive

logger = logging.getLogger(__name__)

RECOVERY_INTERVAL_MINUTES = 5
PAYMENT_LOOKBACK_HOURS = 72  # Only recover payments from last 72 hours


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
            # Also check nested _checkout_meta (2+ handler overwrites)
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
        gateway.get("_checkout_meta", {}).get("_checkout_meta", {}),  # nested
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

    Returns the order_id if order was created (or already existed),
    None if recovery failed.
    """
    payload = _get_commerce_payload(transaction)
    if not payload:
        return None

    try:
        with httpx.Client(timeout=30.0) as client:
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

    Returns count of successfully recovered orders.
    """
    commerce_url = os.getenv("COMMERCE_SERVICE_URL", "http://commerce:5002")
    internal_secret = os.getenv("INTERNAL_SERVICE_SECRET", "")

    if not internal_secret:
        logger.error("INTERNAL_SERVICE_SECRET not configured — cannot recover orders")
        return 0

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
        logger.info(
            f"Attempting recovery: payment={txn.razorpay_payment_id} "
            f"user={txn.user_id} amount={txn.amount}"
        )

        order_id = recover_single_transaction(txn, commerce_url, internal_secret)
        if order_id:
            # Save order_id back to prevent re-processing this payment
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


def run_recovery_cycle():
    """
    Run one full recovery cycle with its own DB session.

    Called periodically from the worker's background thread.
    """
    logger.info("Starting payment recovery cycle...")
    start = datetime.utcnow()

    try:
        db = SessionLocal()
        try:
            recovered = scan_and_recover_orders(db)
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

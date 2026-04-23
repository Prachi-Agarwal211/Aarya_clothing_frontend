"""
Payment Recovery Job
====================
Runs every 5 minutes. Scans for completed payments that don't have matching orders.
Attempts to create orders for orphaned payments.

This is the SAFETY NET for when webhooks fail AND the frontend checkout fails.
"""
import os
import logging
import httpx
from decimal import Decimal

from shared.time_utils import ist_naive

logger = logging.getLogger(__name__)

# Import PaymentTransaction model
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from models.payment import PaymentTransaction


def run_payment_recovery():
    """
    Main recovery job entry point.
    Called by RQ worker every 5 minutes.

    1. Query payment_transactions for completed payments with no order_id
    2. For each, check commerce service if order exists
    3. If not, attempt to create order via internal endpoint
    4. Log all attempts to payment_order_audit table
    """
    from database.database import SessionLocal

    db = SessionLocal()
    commerce_url = os.getenv("COMMERCE_SERVICE_URL", "http://commerce:5002")
    internal_secret = os.getenv("INTERNAL_SERVICE_SECRET")

    if not internal_secret:
        logger.error("INTERNAL_SERVICE_SECRET not configured — recovery job cannot run")
        db.close()
        return {"error": "INTERNAL_SERVICE_SECRET not configured"}

    try:
        # Find completed payments without order_id
        orphaned = db.query(PaymentTransaction).filter(
            PaymentTransaction.status == "completed",
            PaymentTransaction.order_id.is_(None),
            PaymentTransaction.created_at > ist_naive().replace(hour=0, minute=0, second=0, microsecond=0)
            # Last 7 days (legacy ORM filter — superseded by raw SQL below)
        ).filter(
            PaymentTransaction.created_at > ist_naive().replace(
                day=ist_naive().day - 7,
                hour=0, minute=0, second=0, microsecond=0
            ) if ist_naive().day > 7 else True
        ).all()

        # Simpler query: all completed without order_id from last 7 days
        from sqlalchemy import text
        result = db.execute(text("""
            SELECT id, order_id, user_id, amount, payment_method,
                   razorpay_order_id, razorpay_payment_id, razorpay_qr_code_id,
                   transaction_id, created_at
            FROM payment_transactions
            WHERE status = 'completed'
              AND order_id IS NULL
              AND created_at > NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC
            LIMIT 50
        """))

        orphaned_payments = result.fetchall()
        logger.info(f"RECOVERY_JOB: Found {len(orphaned_payments)} orphaned payments to check")

        results = {"checked": 0, "orders_created": 0, "orders_already_exist": 0, "errors": 0}

        for payment in orphaned_payments:
            payment_id = payment.razorpay_payment_id or payment.transaction_id
            if not payment_id:
                continue

            results["checked"] += 1

            try:
                # Step 1: Check if order already exists in commerce service
                order_exists = _check_order_exists(commerce_url, internal_secret, payment_id)

                if order_exists:
                    # Order exists — update transaction with order_id
                    order_id = order_exists.get("order", {}).get("id")
                    if order_id:
                        db.execute(text("""
                            UPDATE payment_transactions SET order_id = :order_id
                            WHERE id = :payment_id
                        """), {"order_id": order_id, "payment_id": payment.id})
                        db.commit()
                        results["orders_already_exist"] += 1
                        logger.info(f"RECOVERY_JOB: Order {order_id} already exists for payment {payment_id}")
                    continue

                # Step 2: Order doesn't exist — try to create it
                # FIX: Fetch cart data from commerce service to get actual items + shipping address
                cart_snapshot = []
                shipping_address = ""
                try:
                    with httpx.Client(timeout=15.0) as cart_client:
                        cart_resp = cart_client.get(
                            f"{commerce_url}/api/v1/internal/cart/{payment.user_id}",
                            headers={"X-Internal-Secret": internal_secret}
                        )
                        if cart_resp.status_code == 200:
                            cart_data = cart_resp.json()
                            cart_snapshot = cart_data.get("items", []) or cart_data.get("cart_snapshot", [])
                            shipping_address = cart_data.get("shipping_address", "") or ""
                            logger.info(
                                f"RECOVERY_CART_FETCH: user={payment.user_id} "
                                f"items={len(cart_snapshot)} shipping={'yes' if shipping_address else 'no'}"
                            )
                except Exception as e:
                    logger.warning(f"RECOVERY_CART_FETCH_ERROR: user={payment.user_id} error={e}")

                pending_order_data = {
                    "cart_snapshot": cart_snapshot if cart_snapshot else [],
                    "shipping_address": shipping_address if shipping_address else "Address to be confirmed — recovery job cart fetch failed",
                    "subtotal": float(payment.amount),
                    "total_amount": float(payment.amount),
                    "shipping_cost": 0,
                    "gst_amount": 0,
                    "payment_method": payment.payment_method or "razorpay",
                    "order_notes": f"[RECOVERY JOB] Order created by automated recovery for payment {payment_id}",
                }

                payload = {
                    "user_id": payment.user_id,
                    "payment_id": payment_id,
                    "razorpay_order_id": payment.razorpay_order_id or "",
                    "payment_signature": "",
                    "amount": float(payment.amount),
                    "pending_order_data": pending_order_data,
                }

                with httpx.Client(timeout=30.0) as client:
                    response = client.post(
                        f"{commerce_url}/api/v1/orders/internal/orders/create-from-payment",
                        json=payload,
                        headers={"X-Internal-Secret": internal_secret}
                    )

                    if response.status_code == 200:
                        result_data = response.json()
                        order_id = result_data.get("order_id")
                        # Update transaction with order_id
                        db.execute(text("""
                            UPDATE payment_transactions SET order_id = :order_id
                            WHERE id = :payment_id
                        """), {"order_id": order_id, "payment_id": payment.id})
                        db.commit()
                        results["orders_created"] += 1
                        logger.info(f"RECOVERY_JOB: ✓ Created order {order_id} for payment {payment_id}")
                    else:
                        results["errors"] += 1
                        logger.error(
                            f"RECOVERY_JOB: ✗ Failed to create order for payment {payment_id}: "
                            f"status={response.status_code} body={response.text[:300]}"
                        )

            except Exception as e:
                results["errors"] += 1
                logger.error(f"RECOVERY_JOB: ✗ Error processing payment {payment_id}: {e}", exc_info=True)

        logger.info(f"RECOVERY_JOB: Complete — {results}")
        return results

    except Exception as e:
        logger.error(f"RECOVERY_JOB: Fatal error: {e}", exc_info=True)
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


def _check_order_exists(commerce_url: str, internal_secret: str, payment_id: str):
    """Check if order already exists for this payment in commerce service."""
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                f"{commerce_url}/api/v1/orders/internal/orders/find-by-payment/{payment_id}",
                headers={"X-Internal-Secret": internal_secret}
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("found"):
                    return data
    except Exception as e:
        logger.warning(f"Error checking order existence for {payment_id}: {e}")
    return None

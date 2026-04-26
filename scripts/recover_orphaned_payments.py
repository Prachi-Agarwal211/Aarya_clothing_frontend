#!/usr/bin/env python3
"""
Manual Payment Recovery Script
==============================
Triggers the recovery process for all completed payments that lack a matching order.
Useful for recovering from the 'Failed to confirm stock' bug.
"""
import os
import sys
import logging
import httpx
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Config
DATABASE_URL = os.getenv("DATABASE_URL")
# Handle potential pgbouncer URL or internal docker URLs
if not DATABASE_URL:
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
    DATABASE_URL = f"postgresql://postgres:{POSTGRES_PASSWORD}@localhost:5432/aarya_clothing"

COMMERCE_SERVICE_URL = "http://localhost:5002"  # Adjust if running outside docker or use internal if inside
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET")

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def recover_payments():
    if not INTERNAL_SERVICE_SECRET:
        logger.error("INTERNAL_SERVICE_SECRET not found in environment")
        return

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Find orphaned payments from the last 30 days
        query = """
            SELECT id, user_id, amount, razorpay_payment_id, razorpay_order_id, transaction_id
            FROM payment_transactions
            WHERE status = 'completed'
              AND order_id IS NULL
              AND created_at > NOW() - INTERVAL '30 days'
            ORDER BY created_at DESC
        """
        cur.execute(query)
        orphaned = cur.fetchall()
        
        logger.info(f"Found {len(orphaned)} orphaned payments to recover")
        
        headers = {"X-Internal-Secret": INTERNAL_SERVICE_SECRET}
        recovered_count = 0
        failed_count = 0
        
        for payment in orphaned:
            payment_id = payment['razorpay_payment_id'] or payment['transaction_id']
            user_id = payment['user_id']
            
            logger.info(f"Attempting recovery for payment {payment_id} (user={user_id})")
            
            # Use the internal scheduler's logic by hitting the payment service's internal recovery or 
            # hitting commerce directly. Since we fixed the commerce service, we can hit it directly.
            
            # The commerce endpoint expects a specific payload
            payload = {
                "user_id": user_id,
                "payment_id": payment_id,
                "razorpay_order_id": payment['razorpay_order_id'] or "",
                "payment_signature": "",
                "pending_order_data": {
                    "cart_snapshot": [], # Commerce service will fetch from Redis if available
                    "shipping_address": "",
                    "subtotal": float(payment['amount']),
                    "total_amount": float(payment['amount']),
                    "order_notes": "[MANUAL RECOVERY] Fixed stock confirmation bug",
                }
            }
            
            try:
                # We hit the internal endpoint in commerce service
                # Note: 'commerce' hostname might not work from host, using localhost:5002
                # But inside docker environment (where this might run), 'commerce' is correct.
                # Let's try to detect if we're in docker or use a provided arg.
                url = f"{COMMERCE_SERVICE_URL}/api/v1/orders/internal/orders/create-from-payment"
                
                with httpx.Client(timeout=30.0) as client:
                    response = client.post(url, json=payload, headers=headers)
                    
                    if response.status_code == 200:
                        data = response.json()
                        order_id = data.get("order_id")
                        logger.info(f"✓ SUCCESSFULLY RECOVERED: Order {order_id} created for payment {payment_id}")
                        
                        # Update the payment_transaction in DB
                        cur.execute(
                            "UPDATE payment_transactions SET order_id = %s WHERE id = %s",
                            (order_id, payment['id'])
                        )
                        conn.commit()
                        recovered_count += 1
                    else:
                        logger.error(f"✗ FAILED to recover payment {payment_id}: {response.status_code} - {response.text}")
                        failed_count += 1
            except Exception as e:
                logger.error(f"✗ ERROR during recovery for payment {payment_id}: {e}")
                failed_count += 1
                
        logger.info(f"Recovery complete. Recovered: {recovered_count}, Failed: {failed_count}")
        
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Fatal error in recovery script: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        COMMERCE_SERVICE_URL = sys.argv[1]
    
    logger.info(f"Using Commerce URL: {COMMERCE_SERVICE_URL}")
    recover_payments()

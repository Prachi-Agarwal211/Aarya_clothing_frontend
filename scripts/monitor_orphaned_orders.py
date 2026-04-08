#!/usr/bin/env python3
"""
Monitor Script: Detect Orphaned Orders and Payments
====================================================
This script checks for:
1. Orders without payment_transactions records
2. Completed payments without linked orders
3. Data integrity issues in the order-payment flow

Run this as a cron job every 5-10 minutes to catch issues early.

Usage:
    python scripts/monitor_orphaned_orders.py [--send-alert] [--fix]
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import List, Dict, Any

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/tmp/orphaned_orders_monitor.log')
    ]
)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    # Try to construct from individual env vars
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '6001')
    db_name = os.getenv('DB_NAME', 'aarya_clothing')
    db_user = os.getenv('DB_USER', 'postgres')
    db_pass = os.getenv('DB_PASSWORD', '')
    DATABASE_URL = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


def get_db_connection():
    """Get database connection."""
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(1)


def check_orphaned_orders(conn) -> List[Dict[str, Any]]:
    """Find orders without payment_transactions records."""
    query = """
        SELECT 
            o.id as order_id,
            o.user_id,
            o.total_amount,
            o.transaction_id,
            o.razorpay_order_id,
            o.razorpay_payment_id,
            o.payment_method,
            o.status as order_status,
            o.created_at
        FROM orders o
        LEFT JOIN payment_transactions pt ON o.id = pt.order_id
        WHERE pt.id IS NULL 
          AND o.payment_method IN ('razorpay', 'cashfree')
          AND o.status IN ('confirmed', 'paid', 'processing', 'shipped', 'delivered')
        ORDER BY o.created_at DESC;
    """
    
    with conn.cursor() as cur:
        cur.execute(query)
        results = cur.fetchall()
    
    return results


def check_orphaned_payments(conn) -> List[Dict[str, Any]]:
    """Find completed payments without linked orders."""
    query = """
        SELECT 
            pt.id as payment_id,
            pt.user_id,
            pt.amount,
            pt.transaction_id,
            pt.razorpay_payment_id,
            pt.razorpay_qr_code_id,
            pt.status as payment_status,
            pt.created_at
        FROM payment_transactions pt
        LEFT JOIN orders o ON pt.order_id = o.id
        WHERE pt.status = 'completed' 
          AND o.id IS NULL
        ORDER BY pt.created_at DESC;
    """
    
    with conn.cursor() as cur:
        cur.execute(query)
        results = cur.fetchall()
    
    return results


def fix_orphaned_orders(conn, orphaned_orders: List[Dict[str, Any]]) -> int:
    """Backfill payment_transactions for orphaned orders."""
    fixed_count = 0
    
    for order in orphaned_orders:
        try:
            query = """
                INSERT INTO payment_transactions (
                    order_id, user_id, amount, currency, payment_method,
                    razorpay_order_id, razorpay_payment_id, razorpay_signature,
                    status, created_at, completed_at, transaction_id
                ) VALUES (
                    %(order_id)s, %(user_id)s, %(total_amount)s, 'INR', %(payment_method)s,
                    %(razorpay_order_id)s, %(razorpay_payment_id)s, '',
                    'completed', %(created_at)s, %(created_at)s, %(transaction_id)s
                )
                ON CONFLICT (transaction_id) DO UPDATE 
                    SET 
                        order_id = EXCLUDED.order_id,
                        status = 'completed',
                        updated_at = NOW();
            """
            
            with conn.cursor() as cur:
                cur.execute(query, order)
            
            conn.commit()
            fixed_count += 1
            logger.info(f"✓ Fixed order {order['order_id']}: payment_transactions record created")
            
        except Exception as e:
            logger.error(f"✗ Failed to fix order {order['order_id']}: {e}")
            conn.rollback()
    
    return fixed_count


def send_alert(orphaned_orders: List[Dict], orphaned_payments: List[Dict]):
    """Send alert to ops team (Slack, Email, etc.)."""
    
    alert_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "orphaned_orders_count": len(orphaned_orders),
        "orphaned_payments_count": len(orphaned_payments),
        "orphaned_orders": [dict(o) for o in orphaned_orders],
        "orphaned_payments": [dict(p) for p in orphaned_payments]
    }
    
    # Option 1: Log to file
    alert_file = f"/tmp/orphaned_alert_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(alert_file, 'w') as f:
        json.dump(alert_data, f, indent=2, default=str)
    logger.info(f"Alert written to: {alert_file}")
    
    # Option 2: Send to Slack (if webhook configured)
    slack_webhook = os.getenv('SLACK_ALERTS_WEBHOOK')
    if slack_webhook and (orphaned_orders or orphaned_payments):
        try:
            import requests
            message = f"🚨 DATA INTEGRITY ALERT\n"
            message += f"Orphaned Orders: {len(orphaned_orders)}\n"
            message += f"Orphaned Payments: {len(orphaned_payments)}\n"
            message += f"Timestamp: {alert_data['timestamp']}"
            
            requests.post(slack_webhook, json={
                "text": message,
                "username": "Database Monitor",
                "icon_emoji": ":warning:"
            })
            logger.info("Slack alert sent")
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")
    
    # Option 3: Send email (if SMTP configured)
    # ... implement email sending logic


def main():
    """Main monitoring function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Monitor orphaned orders and payments')
    parser.add_argument('--send-alert', action='store_true', help='Send alert if issues found')
    parser.add_argument('--fix', action='store_true', help='Automatically fix orphaned orders')
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("Starting Orphaned Orders & Payments Monitor")
    logger.info("=" * 60)
    
    conn = get_db_connection()
    
    try:
        # Check for orphaned orders
        logger.info("Checking for orders without payment_transactions...")
        orphaned_orders = check_orphaned_orders(conn)
        
        if orphaned_orders:
            logger.warning(f"🚨 Found {len(orphaned_orders)} orphaned orders:")
            for order in orphaned_orders:
                logger.warning(
                    f"  Order {order['order_id']}: "
                    f"User={order['user_id']}, "
                    f"Amount=₹{order['total_amount']}, "
                    f"PaymentID={order.get('razorpay_payment_id') or order.get('transaction_id')}"
                )
        else:
            logger.info("✓ No orphaned orders found")
        
        # Check for orphaned payments
        logger.info("Checking for completed payments without orders...")
        orphaned_payments = check_orphaned_payments(conn)
        
        if orphaned_payments:
            logger.warning(f"🚨 Found {len(orphaned_payments)} orphaned payments:")
            for payment in orphaned_payments:
                logger.warning(
                    f"  Payment {payment['payment_id']}: "
                    f"User={payment['user_id']}, "
                    f"Amount=₹{payment['amount']}, "
                    f"QRCode={payment.get('razorpay_qr_code_id') or 'N/A'}"
                )
        else:
            logger.info("✓ No orphaned payments found")
        
        # Auto-fix if requested
        if args.fix and orphaned_orders:
            logger.info(f"\nAttempting to fix {len(orphaned_orders)} orphaned orders...")
            fixed = fix_orphaned_orders(conn, orphaned_orders)
            logger.info(f"✓ Fixed {fixed}/{len(orphaned_orders)} orders")
        
        # Send alerts if issues found
        if args.send_alert and (orphaned_orders or orphaned_payments):
            logger.info("\nSending alert...")
            send_alert(orphaned_orders, orphaned_payments)
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("MONITORING SUMMARY")
        logger.info(f"  Orphaned Orders: {len(orphaned_orders)}")
        logger.info(f"  Orphaned Payments: {len(orphaned_payments)}")
        logger.info("=" * 60)
        
        # Exit with error code if issues found
        if orphaned_orders or orphaned_payments:
            sys.exit(1)
        else:
            logger.info("✓ All data integrity checks passed!")
            sys.exit(0)
    
    except Exception as e:
        logger.error(f"Monitor failed with error: {e}", exc_info=True)
        sys.exit(2)
    
    finally:
        conn.close()


if __name__ == '__main__':
    main()

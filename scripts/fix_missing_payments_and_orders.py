#!/usr/bin/env python3
"""
Emergency Fix Script: Create Missing Payment Transactions and Orders
====================================================================

This script:
1. Identifies all payment.captured webhooks without payment_transactions records
2. Creates payment_transactions records for each missing payment
3. Identifies orders without payment_transactions
4. Links orders to payment_transactions where possible
5. Generates a report of all fixes applied

Usage:
    python scripts/fix_missing_payments_and_orders.py

Note: This script should be run after committing the fixes in payment_service.py
"""

import os
import sys
import json
import logging
from datetime import datetime
from decimal import Decimal

# Database connection
import psycopg2
from psycopg2.extras import RealDictCursor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration
DB_HOST = os.getenv('DB_HOST', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'aarya_clothing')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres123')

DATABASE_URL = f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'

def get_db_connection():
    """Get database connection."""
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        conn.autocommit = False
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(1)

def fix_missing_payments():
    """Find and create missing payment_transactions from webhook events."""
    conn = get_db_connection()
    results = {
        'total_missing': 0,
        'created': 0,
        'skipped_no_user': 0,
        'errors': 0,
        'details': []
    }
    
    try:
        # Get all payment.captured webhooks without matching payment_transactions
        with conn.cursor() as cur:
            cur.execute("""
                WITH captured_payments AS (
                  SELECT 
                    (payload->'payload'->'payment'->'entity'->>'id') as payment_id,
                    (payload->'payload'->'payment'->'entity'->>'order_id') as razorpay_order_id,
                    (payload->'payload'->'payment'->'entity'->>'amount') as amount,
                    (payload->'payload'->'payment'->'entity'->>'email') as email,
                    (payload->'payload'->'payment'->'entity'->>'contact') as contact,
                    (payload->'payload'->'payment'->'entity'->>'method') as method,
                    (payload->'payload'->'payment'->'entity'->>'status') as status,
                    (payload->'payload'->'payment'->'entity'->>'fee') as fee,
                    (payload->'payload'->'payment'->'entity'->>'tax') as tax,
                    created_at as webhook_created,
                    payload
                  FROM webhook_events 
                  WHERE event_type = 'payment.captured'
                )
                SELECT 
                  cp.payment_id,
                  cp.razorpay_order_id,
                  cp.amount,
                  cp.email,
                  cp.contact,
                  cp.method,
                  cp.status,
                  cp.webhook_created,
                  u.id as user_id,
                  u.email as user_email
                FROM captured_payments cp
                LEFT JOIN users u ON u.email = cp.email
                LEFT JOIN payment_transactions pt ON 
                  (pt.razorpay_payment_id = cp.payment_id OR pt.transaction_id = cp.payment_id)
                WHERE pt.id IS NULL
                ORDER BY cp.webhook_created DESC;
            """)
            missing_payments = cur.fetchall()
            results['total_missing'] = len(missing_payments)
            
            logger.info(f"Found {results['total_missing']} missing payments to process")
            
            for payment in missing_payments:
                payment_id = payment['payment_id']
                razorpay_order_id = payment['razorpay_order_id']
                amount = Decimal(payment['amount']) / 100 if payment['amount'] else 0
                email = payment.get('email', '')
                contact = payment.get('contact', '')
                method = payment.get('method', 'upi')
                user_id = payment.get('user_id')
                
                # Check if payment already exists (race condition)
                cur.execute("""
                    SELECT id FROM payment_transactions 
                    WHERE razorpay_payment_id = %s OR transaction_id = %s
                """, (payment_id, payment_id))
                existing = cur.fetchone()
                
                if existing:
                    logger.warning(f"Payment {payment_id} already exists, skipping")
                    results['details'].append({
                        'payment_id': payment_id,
                        'status': 'already_exists',
                        'user_id': user_id
                    })
                    continue
                
                # Try to find user by email or phone
                if not user_id and email:
                    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
                    user = cur.fetchone()
                    if user:
                        user_id = user['id']
                
                if not user_id and contact:
                    # Try to find user by phone (if stored in customer_phone)
                    cur.execute("SELECT id FROM users WHERE id IN (SELECT user_id FROM payment_transactions WHERE customer_phone = %s LIMIT 1)", (contact,))
                    user = cur.fetchone()
                    if user:
                        user_id = user['id']
                
                if not user_id:
                    logger.warning(f"Cannot find user for payment {payment_id} email={email} contact={contact}")
                    results['skipped_no_user'] += 1
                    results['details'].append({
                        'payment_id': payment_id,
                        'status': 'no_user_found',
                        'email': email,
                        'contact': contact,
                        'amount': str(amount)
                    })
                    continue
                
                try:
                    # Create payment transaction
                    cur.execute("""
                        INSERT INTO payment_transactions (
                            user_id, amount, currency, payment_method,
                            razorpay_payment_id, transaction_id, status,
                            customer_email, customer_phone,
                            razorpay_order_id, completed_at, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        RETURNING id, transaction_id
                    """, (
                        user_id,
                        amount,
                        'INR',
                        method,
                        payment_id,
                        payment_id,
                        'completed',
                        email,
                        contact,
                        razorpay_order_id
                    ))
                    new_txn = cur.fetchone()
                    logger.info(f"✓ Created payment transaction {new_txn['id']} for {payment_id} user={user_id}")
                    results['created'] += 1
                    results['details'].append({
                        'payment_id': payment_id,
                        'status': 'created',
                        'user_id': user_id,
                        'amount': str(amount),
                        'transaction_id': new_txn['transaction_id'],
                        'txn_db_id': new_txn['id']
                    })
                    
                except Exception as e:
                    logger.error(f"Error creating payment {payment_id}: {e}")
                    conn.rollback()
                    results['errors'] += 1
                    results['details'].append({
                        'payment_id': payment_id,
                        'status': 'error',
                        'error': str(e)
                    })
                    continue
            
            # Commit all successful inserts
            conn.commit()
            
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        conn.rollback()
        results['errors'] += 1
    finally:
        conn.close()
    
    return results

def fix_orphaned_orders():
    """Link orders to payment_transactions where possible."""
    conn = get_db_connection()
    results = {
        'total_orphaned': 0,
        'linked': 0,
        'errors': 0,
        'details': []
    }
    
    try:
        with conn.cursor() as cur:
            # Find orders without payment_transactions
            cur.execute("""
                SELECT o.id as order_id, o.user_id, o.transaction_id, 
                       o.razorpay_order_id, o.razorpay_payment_id, o.total_amount
                FROM orders o
                WHERE o.transaction_id IS NULL OR o.transaction_id = ''
                ORDER BY o.created_at DESC
            """)
            orders = cur.fetchall()
            results['total_orphaned'] = len(orders)
            
            logger.info(f"Found {results['total_orphaned']} orders without payment transactions")
            
            for order in orders:
                order_id = order['order_id']
                user_id = order['user_id']
                
                # Try to find matching payment by user_id and amount
                if user_id:
                    cur.execute("""
                        SELECT id, transaction_id, razorpay_payment_id, amount
                        FROM payment_transactions
                        WHERE user_id = %s 
                          AND amount = %s
                          AND status = 'completed'
                          AND order_id IS NULL
                        ORDER BY created_at DESC
                        LIMIT 1
                    """, (user_id, order['total_amount']))
                    payment = cur.fetchone()
                    
                    if payment:
                        # Link the payment to the order
                        cur.execute("""
                            UPDATE payment_transactions 
                            SET order_id = %s 
                            WHERE id = %s
                        """, (order_id, payment['id']))
                        
                        # Also update the order with transaction_id
                        cur.execute("""
                            UPDATE orders 
                            SET transaction_id = %s,
                                razorpay_payment_id = %s
                            WHERE id = %s
                        """, (payment['transaction_id'], payment['razorpay_payment_id'], order_id))
                        
                        logger.info(f"✓ Linked order {order_id} to payment {payment['id']} txn={payment['transaction_id']}")
                        results['linked'] += 1
                        results['details'].append({
                            'order_id': order_id,
                            'payment_id': payment['id'],
                            'transaction_id': payment['transaction_id']
                        })
                else:
                    logger.warning(f"Order {order_id} has no user_id, cannot auto-link")
            
            conn.commit()
            
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        conn.rollback()
        results['errors'] += 1
    finally:
        conn.close()
    
    return results

def generate_report(missing_payments_results, orphaned_orders_results):
    """Generate a comprehensive report."""
    print("\n" + "="*80)
    print("PAYMENT & ORDER RECOVERY REPORT")
    print("="*80)
    
    print("\n📊 MISSING PAYMENTS:")
    print("-" * 80)
    print(f"Total missing payments in webhooks: {missing_payments_results['total_missing']}")
    print(f"✓ Successfully created: {missing_payments_results['created']}")
    print(f"⚠ Skipped (no user found): {missing_payments_results['skipped_no_user']}")
    print(f"✗ Errors: {missing_payments_results['errors']}")
    
    print("\n📦 ORPHANED ORDERS:")
    print("-" * 80)
    print(f"Total orders without payment transactions: {orphaned_orders_results['total_orphaned']}")
    print(f"✓ Successfully linked: {orphaned_orders_results['linked']}")
    print(f"✗ Errors: {orphaned_orders_results['errors']}")
    
    print("\n🎯 SONIA'S CASE:")
    print("-" * 80)
    for detail in missing_payments_results['details']:
        if 'soniya' in detail.get('email', '').lower() or 'soniyakhanna' in detail.get('email', '').lower():
            print(f"Payment ID: {detail.get('payment_id')}")
            print(f"Status: {detail.get('status')}")
            print(f"User ID: {detail.get('user_id')}")
            print(f"Amount: ₹{detail.get('amount')}")
            if detail.get('status') == 'created':
                print(f"✓ FIXED: Transaction ID {detail.get('transaction_id')} created")
    
    print("\n" + "="*80)
    print("RECOMMENDATIONS:")
    print("="*80)
    print("1. COMMIT the fixes in services/payment/service/payment_service.py IMMEDIATELY")
    print("2. COMMIT the recovery job in services/payment/main.py")
    print("3. Run the sync_missing_orders.py script to handle remaining cases")
    print("4. For payments without user emails, manually match using phone numbers")
    print("5. Set up monitoring for payment-transaction-order data integrity")
    print("="*80)

if __name__ == '__main__':
    print("Starting Payment & Order Recovery...")
    print("="*80)
    
    # Step 1: Create missing payment transactions
    print("\n[Step 1] Fixing missing payment transactions...")
    missing_payments = fix_missing_payments()
    
    # Step 2: Link orphaned orders
    print("\n[Step 2] Linking orphaned orders...")
    orphaned_orders = fix_orphaned_orders()
    
    # Step 3: Generate report
    generate_report(missing_payments, orphaned_orders)
    
    print("\n✓ Recovery process complete!")

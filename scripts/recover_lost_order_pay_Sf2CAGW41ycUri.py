#!/usr/bin/env python3
"""
Emergency Recovery Script: Recover Lost Order pay_Sf2CAGW41ycUri
==================================================================

This script:
1. Checks if payment pay_Sf2CAGW41ycUri exists in webhook_events
2. Checks if payment transaction exists for this payment
3. Finds the user by email (kirtisumi.1991@gmail.com) or phone (+91 7717 759940)
4. Gets the cart snapshot from Redis or audit logs
5. Creates the payment transaction if missing
6. Creates the order in orders table
7. Creates order_items from cart
8. Outputs what the customer bought

Usage:
    python scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
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
DB_HOST = os.getenv('DB_HOST', 'pgbouncer')
DB_PORT = os.getenv('DB_PORT', '6432')
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
        return None


def find_user_by_email_or_phone(conn, email, phone):
    """Find user by email or phone."""
    try:
        with conn.cursor() as cur:
            # Try by email first
            cur.execute("SELECT id, email, phone, username FROM users WHERE email = %s", (email,))
            user = cur.fetchone()
            if user:
                return user
            
            # Try by phone (might be stored with country code variations)
            phone_patterns = [
                phone,  # +91 7717 759940
                phone.replace(' ', ''),  # +917717759940
                phone.replace('+', ''),  # 91 7717 759940
                phone.replace('+', '').replace(' ', ''),  # 917717759940
            ]
            
            for phone_pattern in phone_patterns:
                cur.execute("SELECT id, email, phone, username FROM users WHERE phone = %s", (phone_pattern,))
                user = cur.fetchone()
                if user:
                    return user
                    
            return None
    except Exception as e:
        logger.error(f"Error finding user: {e}")
        return None


def get_webhook_event(conn, payment_id):
    """Get webhook event for this payment."""
    try:
        with conn.cursor() as cur:
            # Check payload->payment->entity->id
            cur.execute("""
                SELECT * FROM webhook_events
                WHERE payload->'payload'->'payment'->'entity'->>'id' = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (payment_id,))
            event = cur.fetchone()
            
            if not event:
                # Try without entity nesting (old format)
                cur.execute("""
                    SELECT * FROM webhook_events
                    WHERE payload->'payload'->'payment'->>'id' = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (payment_id,))
                event = cur.fetchone()
            
            return event
    except Exception as e:
        logger.error(f"Error getting webhook event: {e}")
        return None


def get_existing_transaction(conn, payment_id):
    """Check if payment transaction exists."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM payment_transactions
                WHERE razorpay_payment_id = %s OR transaction_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (payment_id, payment_id))
            return cur.fetchone()
    except Exception as e:
        logger.error(f"Error getting transaction: {e}")
        return None


def get_existing_order(conn, payment_id):
    """Check if order exists for this payment."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT o.* FROM orders o
                WHERE o.razorpay_payment_id = %s
                OR o.transaction_id = %s
                ORDER BY o.created_at DESC
                LIMIT 1
            """, (payment_id, payment_id))
            return cur.fetchone()
    except Exception as e:
        logger.error(f"Error getting order: {e}")
        return None


def get_user_cart_snapshot(conn, user_id):
    """Get cart snapshot from payment_order_audit."""
    try:
        with conn.cursor() as cur:
            # Get most recent cart snapshot for this user
            cur.execute("""
                SELECT cart_snapshot, shipping_address, created_at
                FROM payment_order_audit
                WHERE user_id = %s AND cart_snapshot IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
            """, (user_id,))
            audit = cur.fetchone()
            return audit
    except Exception as e:
        logger.error(f"Error getting cart snapshot: {e}")
        return None


def get_recent_orders_for_user(conn, user_id):
    """Get recent orders for user to infer cart."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT o.*, oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.price
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = %s
                ORDER BY o.created_at DESC
                LIMIT 5
            """, (user_id,))
            return cur.fetchall()
    except Exception as e:
        logger.error(f"Error getting recent orders: {e}")
        return None


def create_payment_transaction(conn, user_id, payment_id, razorpay_order_id, amount, email, phone, method='upi'):
    """Create payment transaction if it doesn't exist."""
    try:
        with conn.cursor() as cur:
            # Check if already exists
            cur.execute("""
                SELECT id FROM payment_transactions
                WHERE razorpay_payment_id = %s OR transaction_id = %s
            """, (payment_id, payment_id))
            existing = cur.fetchone()
            
            if existing:
                logger.info(f"Payment transaction already exists: {existing['id']}")
                return existing['id']
            
            # Create new transaction
            transaction_id = f"txn_recovered_{payment_id}"
            amount_decimal = Decimal(str(amount)) / Decimal('100')
            
            cur.execute("""
                INSERT INTO payment_transactions (
                    user_id, amount, currency, payment_method,
                    razorpay_payment_id, transaction_id, status,
                    customer_email, customer_phone,
                    razorpay_order_id, completed_at, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING id
            """, (
                user_id,
                amount_decimal,
                'INR',
                method,
                payment_id,
                transaction_id,
                'completed',
                email,
                phone,
                razorpay_order_id
            ))
            
            txn = cur.fetchone()
            conn.commit()
            logger.info(f"✓ Created payment transaction: {txn['id']}")
            return txn['id']
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating payment transaction: {e}")
        return None


def generate_invoice_number(conn):
    """Generate unique invoice number."""
    try:
        with conn.cursor() as cur:
            # Get current year and count
            year = datetime.now().strftime('%Y')
            cur.execute("""
                SELECT COUNT(*) + 1 as count FROM orders
                WHERE created_at >= %s
            """, (f"{year}-01-01",))
            count = cur.fetchone()['count']
            
            invoice_number = f"INV-{year}-{count:06d}"
            
            # Check if exists (race condition)
            cur.execute("SELECT id FROM orders WHERE invoice_number = %s", (invoice_number,))
            if cur.fetchone():
                # Try again with incremented count
                invoice_number = f"INV-{year}-{count+1:06d}"
            
            return invoice_number
    except Exception as e:
        logger.error(f"Error generating invoice: {e}")
        return f"INV-RECOV-{datetime.now().strftime('%Y%m%d%H%M%S')}"


def create_order(conn, user_id, payment_id, amount, cart_items=None, shipping_address=None, email=None, phone=None):
    """Create order for recovered payment."""
    try:
        with conn.cursor() as cur:
            # Check if order already exists
            cur.execute("""
                SELECT id FROM orders
                WHERE razorpay_payment_id = %s OR transaction_id = %s
            """, (payment_id, payment_id))
            existing = cur.fetchone()
            
            if existing:
                logger.info(f"Order already exists: {existing['id']}")
                return existing['id']
            
            invoice_number = generate_invoice_number(conn)
            amount_decimal = Decimal(str(amount)) / Decimal('100')
            
            # Insert order
            cur.execute("""
                INSERT INTO orders (
                    user_id, total_amount, subtotal, payment_method,
                    transaction_id, razorpay_payment_id, invoice_number,
                    shipping_address, order_notes, status,
                    created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING id
            """, (
                user_id,
                amount_decimal,
                amount_decimal,
                'upi',
                payment_id,
                payment_id,
                invoice_number,
                shipping_address or '',
                f'Order recovered from payment webhook - pay_Sf2CAGW41ycUri',
                'confirmed'
            ))
            
            order = cur.fetchone()
            order_id = order['id']
            
            # Create order items if cart items available
            if cart_items and len(cart_items) > 0:
                for item in cart_items:
                    product_name = item.get('name', item.get('product_name', 'Unknown Product'))
                    product_id = item.get('id', item.get('product_id'))
                    quantity = item.get('quantity', 1)
                    unit_price = item.get('price', item.get('unit_price', amount_decimal))
                    
                    # Ensure unit_price is Decimal
                    if isinstance(unit_price, str):
                        unit_price = Decimal(unit_price)
                    
                    total_price = unit_price * Decimal(str(quantity))
                    
                    cur.execute("""
                        INSERT INTO order_items (
                            order_id, product_id, product_name, quantity,
                            unit_price, price, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        order_id,
                        product_id,
                        product_name,
                        quantity,
                        unit_price,
                        total_price
                    ))
                
                logger.info(f"✓ Created {len(cart_items)} order items for order {order_id}")
            else:
                logger.warning(f"No cart items found for order {order_id} - order created without items")
            
            conn.commit()
            logger.info(f"✓ Created order: {order_id} with invoice {invoice_number}")
            return order_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating order: {e}")
        raise


def update_transaction_with_order(conn, txn_id, order_id):
    """Update payment transaction with order_id."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE payment_transactions
                SET order_id = %s
                WHERE id = %s
            """, (order_id, txn_id))
            conn.commit()
            logger.info(f"✓ Updated transaction {txn_id} with order_id {order_id}")
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating transaction: {e}")


def main():
    """Main recovery process."""
    logger.info("=" * 80)
    logger.info("RECOVERY SCRIPT: Lost Order pay_Sf2CAGW41ycUri")
    logger.info("=" * 80)
    
    # Payment details from user
    PAYMENT_ID = "pay_Sf2CAGW41ycUri"
    AMOUNT_PAISA = 59900  # ₹599.00 in paise
   razorpay_order_id = "order_" + PAYMENT_ID.replace("pay_", "")  # Common Razorpay pattern
    EMAIL = "kirtisumi.1991@gmail.com"
    PHONE = "+91 7717 759940"
    
    conn = get_db_connection()
    if not conn:
        logger.error("Failed to connect to database. Check DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD")
        return
    
    try:
        logger.info(f"\n1. Looking for webhook event with payment_id: {PAYMENT_ID}")
        webhook_event = get_webhook_event(conn, PAYMENT_ID)
        if webhook_event:
            logger.info(f"   ✓ Found webhook event ID: {webhook_event['id']}")
            logger.info(f"   Event type: {webhook_event.get('event_type')}")
            
            # Extract details from webhook payload
            payload = webhook_event.get('payload', {})
            payment_entity = payload.get('payment', {}).get('entity', payload.get('payment', {}))
            email_from_webhook = payment_entity.get('email', '') or payload.get('email', '')
            phone_from_webhook = payment_entity.get('contact', '') or payload.get('contact', '')
            razorpay_order_id_from_webhook = payment_entity.get('order_id', '') or payload.get('order_id', '')
            amount_from_webhook = payment_entity.get('amount', AMOUNT_PAISA)
            
            if email_from_webhook:
                EMAIL = email_from_webhook
            if phone_from_webhook:
                PHONE = phone_from_webhook
            if razorpay_order_id_from_webhook:
                razorpay_order_id = razorpay_order_id_from_webhook
            if amount_from_webhook:
                AMOUNT_PAISA = int(amount_from_webhook)
        else:
            logger.warning(f"   ✗ No webhook event found for payment_id: {PAYMENT_ID}")
        
        logger.info(f"\n2. Looking for user by email/phone: {EMAIL} / {PHONE}")
        user = find_user_by_email_or_phone(conn, EMAIL, PHONE)
        if user:
            logger.info(f"   ✓ Found user: ID={user['id']}, Email={user['email']}, Phone={user.get('phone', 'N/A')}")
            user_id = user['id']
        else:
            logger.error(f"   ✗ User not found! Cannot create order without user.")
            logger.error("   Try: Manually create user or check email/phone in database")
            return
        
        logger.info(f"\n3. Checking for existing payment transaction")
        transaction = get_existing_transaction(conn, PAYMENT_ID)
        if transaction:
            logger.info(f"   ✓ Found transaction: ID={transaction['id']}, Status={transaction['status']}")
            txn_id = transaction['id']
            
            # Check if order already exists
            existing_order = get_existing_order(conn, PAYMENT_ID)
            if existing_order:
                logger.info(f"   ✓ Order already exists: ID={existing_order['id']}")
                logger.info(f"   Transaction ID: {existing_order['transaction_id']}")
                logger.info(f"   Amount: ₹{existing_order['total_amount']}")
                return
        else:
            logger.info(f"   ✗ No transaction found - will create new one")
        
        logger.info(f"\n4. Getting cart snapshot from audit logs")
        cart_audit = get_user_cart_snapshot(conn, user_id)
        cart_items = []
        shipping_address = None
        
        if cart_audit and cart_audit.get('cart_snapshot'):
            cart_items = cart_audit['cart_snapshot']
            shipping_address = cart_audit.get('shipping_address')
            logger.info(f"   ✓ Found {len(cart_items)} items in cart snapshot")
            for item in cart_items:
                logger.info(f"      - {item.get('name', item.get('product_name', 'Unknown'))} x {item.get('quantity', 1)}")
        else:
            logger.warning(f"   ✗ No cart snapshot found in audit logs")
            
            # Try to get from recent orders
            recent_orders = get_recent_orders_for_user(conn, user_id)
            if recent_orders:
                logger.info(f"   Recent orders found: {len(recent_orders)}")
                # Use items from most recent order as a template
                for order in recent_orders:
                    if order.get('product_name'):
                        cart_items.append({
                            'product_name': order['product_name'],
                            'product_id': order['product_id'],
                            'quantity': order['quantity'], 
                            'unit_price': float(order['unit_price']) if order['unit_price'] else None,
                            'price': float(order['price']) if order['price'] else None
                        })
                        logger.info(f"      - {order['product_name']} x {order['quantity']} @ ₹{order['unit_price']}")
        
        logger.info(f"\n5. Creating payment transaction")
        if transaction:
            txn_id = transaction['id']
            logger.info(f"   Using existing transaction: {txn_id}")
        else:
            txn_id = create_payment_transaction(
                conn, user_id, PAYMENT_ID, razorpay_order_id,
                AMOUNT_PAISA, EMAIL, PHONE, 'upi'
            )
            if not txn_id:
                logger.error("   ✗ Failed to create payment transaction")
                return
        
        logger.info(f"\n6. Creating order")
        order_id = create_order(
            conn, user_id, PAYMENT_ID, AMOUNT_PAISA,
            cart_items, shipping_address, EMAIL, PHONE
        )
        
        if order_id:
            logger.info(f"   ✓ Order created: ID={order_id}")
            
            # Update transaction with order_id
            update_transaction_with_order(conn, txn_id, order_id)
            
            # Mark webhook as processed
            if webhook_event:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE webhook_events
                        SET processed = TRUE, processed_at = NOW()
                        WHERE id = %s
                    """, (webhook_event['id'],))
                    conn.commit()
                    logger.info(f"   ✓ Marked webhook as processed")
            
            logger.info("\n" + "=" * 80)
            logger.info("RECOVERY SUMMARY")
            logger.info("=" * 80)
            logger.info(f"Payment ID: {PAYMENT_ID}")
            logger.info(f"Razorpay Order ID: {razorpay_order_id}")
            logger.info(f"Amount: ₹{AMOUNT_PAISA / 100}")
            logger.info(f"Customer: {EMAIL} / {PHONE}")
            logger.info(f"Order ID: {order_id}")
            logger.info(f"Transaction ID: {txn_id}")
            
            if cart_items:
                logger.info(f"\nItems Purchased ({len(cart_items)}):")
                total_value = Decimal('0')
                for item in cart_items:
                    name = item.get('name', item.get('product_name', 'Unknown Product'))
                    qty = item.get('quantity', 1)
                    price = Decimal(str(item.get('price', item.get('unit_price', 0))))
                    total_value += price * Decimal(str(qty))
                    logger.info(f"  • {name} x {qty} = ₹{float(price * Decimal(str(qty))):.2f}")
                logger.info(f"  Total: ₹{float(total_value):.2f}")
            else:
                logger.warning(f"\nWARNING: Order created WITHOUT items!")
                logger.warning(f"Customer: {EMAIL} / {PHONE}")
                logger.warning(f"Amount: ₹{AMOUNT_PAISA / 100}")
                logger.warning(f"Action: Manually add items to order {order_id}")
            
            logger.info("\n" + "=" * 80)
            logger.info("RECOVERY COMPLETE!")
            logger.info("=" * 80)
        else:
            logger.error("   ✗ Failed to create order")
    
    except Exception as e:
        logger.error(f"\n✗ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()

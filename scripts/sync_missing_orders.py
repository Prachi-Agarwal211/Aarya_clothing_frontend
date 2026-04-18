#!/usr/bin/env python3
"""
Emergency Recovery Script: Sync Missing Orders from Razorpay
==============================================================

This script:
1. Finds all completed payments without matching orders
2. Attempts to create orders for each using the internal API
3. Handles QR code payments, regular payments, and missing transactions

Usage:
    python scripts/sync_missing_orders.py

Note: Requires INTERNAL_SERVICE_SECRET to be set in environment
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import httpx

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal, init_db
from models.payment import PaymentTransaction
from models.order import Order

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

COMMERCE_URL = os.getenv("COMMERCE_SERVICE_URL", "http://commerce:5002")
INTERNAL_SECRET = os.getenv("INTERNAL_SERVICE_SECRET")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def fetch_cart_data(user_id, commerce_url=COMMERCE_URL, secret=INTERNAL_SECRET):
    """Fetch cart data from commerce service."""
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                f"{commerce_url}/api/v1/internal/cart/{user_id}",
                headers={"X-Internal-Secret": secret}
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.warning(f"Failed to fetch cart for user {user_id}: {e}")
    return None

def create_order_from_payment(payment, commerce_url=COMMERCE_url, secret=INTERNAL_SECRET):
    """Create order from payment transaction using internal API."""
    try:
        # Get cart data
        cart_data = fetch_cart_data(payment.user_id, commerce_url, secret)
        cart_snapshot = []
        shipping_address = ""
        
        if cart_data:
            cart_snapshot = cart_data.get("items", []) or cart_data.get("cart_snapshot", [])
            shipping_address = cart_data.get("shipping_address", "") or ""
        
        if not cart_snapshot:
            # Create minimal cart item
            cart_snapshot = [{
                "product_id": None,
                "name": "Order recovered from payment",
                "price": float(payment.amount),
                "quantity": 1,
                "unit_price": float(payment.amount),
                "sku": None,
                "size": None,
                "color": None,
                "hsn_code": None,
                "gst_rate": None,
            }]
            logger.warning(f"Using minimal cart for payment {payment.transaction_id}")
        
        if not shipping_address:
            shipping_address = "Address to be confirmed"
        
        pending_order_data = {
            "cart_snapshot": cart_snapshot,
            "shipping_address": shipping_address,
            "subtotal": float(payment.amount),
            "total_amount": float(payment.amount),
            "shipping_cost": 0,
            "gst_amount": 0,
            "discount_applied": 0,
            "payment_method": payment.payment_method or "razorpay",
            "order_notes": f"[RECOVERY] Order created by sync script for payment {payment.transaction_id}",
        }
        
        payload = {
            "user_id": payment.user_id,
            "payment_id": payment.razorpay_payment_id or payment.transaction_id,
            "razorpay_order_id": payment.razorpay_order_id or "",
            "payment_signature": "",
            "amount": float(payment.amount),
            "pending_order_data": pending_order_data,
        }
        
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{commerce_url}/api/v1/orders/internal/orders/create-from-payment",
                json=payload,
                headers={"X-Internal-Secret": secret}
            )
            
            if response.status_code == 200:
                result = response.json()
                order_id = result.get("order_id")
                return order_id
            else:
                logger.error(
                    f"Failed to create order: status={response.status_code} "
                    f"body={response.text[:500]}"
                )
                return None
    
    except Exception as e:
        logger.error(f"Error creating order: {e}", exc_info=True)
        return None

def sync_missing_orders(days_back=7):
    """Find and sync all missing orders from the last N days."""
    if not INTERNAL_SECRET:
        logger.error("INTERNAL_SERVICE_SECRET not set! Cannot create orders.")
        return
    
    db = SessionLocal()
    
    try:
        # Find completed payments without orders
        from sqlalchemy import text
        
        # Query for payments with no matching order
        result = db.execute(text("""
            SELECT pt.id, pt.user_id, pt.transaction_id, pt.razorpay_payment_id,
                   pt.razorpay_order_id, pt.razorpay_qr_code_id, pt.amount,
                   pt.payment_method, pt.status, pt.created_at
            FROM payment_transactions pt
            WHERE pt.status = 'completed'
              AND pt.order_id IS NULL
              AND pt.created_at > NOW() - INTERVAL ':days days'
            ORDER BY pt.created_at DESC
        """), {"days": days_back})
        
        payments = result.fetchall()
        logger.info(f"Found {len(payments)} completed payments without orders")
        
        results = {"total": len(payments), "created": 0, "already_exist": 0, "errors": 0, "details": []}
        
        for payment in payments:
            payment_dict = {
                "id": payment.id,
                "user_id": payment.user_id,
                "transaction_id": payment.transaction_id,
                "razorpay_payment_id": payment.razorpay_payment_id,
                "amount": float(payment.amount),
                "payment_method": payment.payment_method,
                "created_at": payment.created_at
            }
            
            try:
                # Check if order already exists
                existing = db.query(Order).filter(
                    Order.user_id == payment.user_id,
                    Order.transaction_id == payment.transaction_id
                ).first()
                
                if existing:
                    # Update transaction with order_id
                    payment_obj = db.query(PaymentTransaction).get(payment.id)
                    if payment_obj:
                        payment_obj.order_id = existing.id
                        db.commit()
                    results["already_exist"] += 1
                    logger.info(f"✓ Order already exists: txn={payment.transaction_id} order={existing.id}")
                    results["details"].append({
                        "payment_id": payment.transaction_id,
                        "status": "already_exists",
                        "order_id": existing.id
                    })
                    continue
                
                # Create order
                logger.info(f"Creating order for payment: txn={payment.transaction_id} user={payment.user_id}")
                order_id = create_order_from_payment(
                    PaymentTransaction(
                        id=payment.id,
                        user_id=payment.user_id,
                        transaction_id=payment.transaction_id,
                        razorpay_payment_id=payment.razorpay_payment_id,
                        razorpay_order_id=payment.razorpay_order_id,
                        amount=payment.amount,
                        payment_method=payment.payment_method,
                        status=payment.status
                    ),
                    COMMERCE_URL,
                    INTERNAL_SECRET
                )
                
                if order_id:
                    # Update transaction with order_id
                    payment_obj = db.query(PaymentTransaction).get(payment.id)
                    if payment_obj:
                        payment_obj.order_id = order_id
                        db.commit()
                    results["created"] += 1
                    logger.info(f"✓ Created order {order_id} for payment {payment.transaction_id}")
                    results["details"].append({
                        "payment_id": payment.transaction_id,
                        "status": "created",
                        "order_id": order_id
                    })
                else:
                    results["errors"] += 1
                    results["details"].append({
                        "payment_id": payment.transaction_id,
                        "status": "failed",
                        "error": "Could not create order"
                    })
            
            except Exception as e:
                results["errors"] += 1
                logger.error(f"Error processing payment {payment.transaction_id}: {e}", exc_info=True)
                results["details"].append({
                    "payment_id": payment.transaction_id,
                    "status": "failed",
                    "error": str(e)
                })
        
        # Print summary
        print("\n" + "="*60)
        print("RECOVERY SCRIPT RESULTS")
        print("="*60)
        print(f"Total payments checked: {results['total']}")
        print(f"✓ Orders already existed: {results['already_exist']}")
        print(f"✓ Orders created: {results['created']}")
        print(f"✗ Errors: {results['errors']}")
        
        if results["created"] > 0:
            print(f"\nCreated orders: {results['created']}")
            for d in results["details"]:
                if d["status"] == "created":
                    print(f"  - Payment {d['payment_id']} → Order {d['order_id']}")
        
        return results
    
    finally:
        db.close()

def check_razorpay_payments():
    """Check Razorpay API for payments not in our database."""
    try:
        from core.razorpay_client import get_razorpay_client
        razorpay = get_razorpay_client()
        
        # Get all captured payments from last 7 days
        from datetime import datetime, timedelta
        seven_days_ago = int((datetime.now() - timedelta(days=7)).timestamp())
        
        payments = []
        try:
            all_payments = razorpay.client.payments.all({"captured": True, "from": seven_days_ago})
            payments = list(all_payments)
            logger.info(f"Found {len(payments)} captured payments in Razorpay")
        except Exception as e:
            logger.warning(f"Could not fetch Razorpay payments: {e}")
            return []
        
        return payments
    except Exception as e:
        logger.warning(f"Razorpay client error: {e}")
        return []

if __name__ == "__main__":
    print("="*60)
    print("RAZORPAY ORDER SYNC SCRIPT")
    print("="*60)
    print("This script will:")
    print("1. Find completed payments without orders")
    print("2. Create missing orders")
    print("")
    
    # Initialize database
    init_db()
    
    # Run sync
    results = sync_missing_orders(days_back=7)
    
    # Check Razorpay for any payments we missed
    print("\n" + "="*60)
    print("checking Razorpay for payments not in our DB...")
    print("="*60)
    razorpay_payments = check_razorpay_payments()
    
    if razorpay_payments:
        # Check which Razorpay payments don't have transactions
        db = SessionLocal()
        try:
            missing_in_db = []
            for rp_payment in razorpay_payments:
                payment_id = rp_payment.get("id")
                order_id = rp_payment.get("order_id")
                
                # Check if we have this payment
                txn = db.query(PaymentTransaction).filter(
                    PaymentTransaction.razorpay_payment_id == payment_id
                ).first()
                
                if not txn:
                    # Also check by order_id
                    txn = db.query(PaymentTransaction).filter(
                        PaymentTransaction.razorpay_order_id == order_id
                    ).first()
                
                if not txn:
                    missing_in_db.append(rp_payment)
                    logger.warning(f"⚠ Razorpay payment {payment_id} not found in our DB!")
            
            logger.info(f"Found {len(missing_in_db)} payments in Razorpay not in our database")
            
            if missing_in_db:
                logger.warning("These payments need manual investigation:")
                for rp in missing_in_db:
                    logger.warning(f"  - Payment: {rp.get('id')} Amount: ₹{rp.get('amount', 0)/100} Order: {rp.get('order_id')} Email: {rp.get('email')}")
        finally:
            db.close()
    
    print("\n" + "="*60)
    print("SCRIPT COMPLETE")
    print("="*60)

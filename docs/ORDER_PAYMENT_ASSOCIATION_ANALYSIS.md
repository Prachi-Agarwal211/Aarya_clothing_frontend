# Order-Payment Association Analysis & Prevention Plan

**Date:** April 8, 2026  
**Status:** 🔴 CRITICAL - Requires Immediate Fix  
**Impact:** 6 out of 8 orders have NO payment transaction records  

---

## Executive Summary

### The Problem
Users successfully paid money through Razorpay, orders were created in the database, but the **payment_transactions** audit trail records were **never inserted** for 6 out of 8 orders. This means:
- ✅ Money was captured from customers
- ✅ Orders were created and confirmed
- ❌ **NO payment audit trail exists** for these transactions
- ❌ Cannot trace which payment gateway response corresponds to which order
- ❌ Webhook reconciliation is broken for these orders

### Current Database State

| Order ID | User | Amount | Payment ID | Has payment_transactions Record? |
|----------|------|--------|------------|----------------------------------|
| 17 | 1 | ₹299 | pay_SahcyAY78aDaTB | ❌ **NO** |
| 13 | 326 | ₹850 | pay_SaaeymzeDIldYe | ❌ **NO** |
| 14 | 66 | ₹299 | pay_SaVzrppVV26q3c | ❌ **NO** |
| 15 | 82 | ₹475 | pay_Sa5ojo7Vq6EWd4 | ❌ **NO** |
| 16 | 78 | ₹900 | pay_SZq90iBpCHjz2P | ❌ **NO** |
| 5 | 78 | ₹475 | pay_Sa2NLB3yeIh79Z | ❌ **NO** |
| 11 | 282 | ₹299 | (QR payment) | ✅ YES |
| 12 | 337 | ₹299 | (QR payment) | ✅ YES |

**Additionally:** 2 completed QR payments with NO order created:
- tx_id 14: User 283, ₹500, qr_SaN2QmGg044n8P, status=completed, **order_id=NULL**
- tx_id 15: User 282, ₹1, qr_SaN2qo7ZNQtn3V, status=completed, **order_id=NULL**

---

## Root Cause Analysis

### Primary Issue: Silent INSERT Failure in Order Service

**Location:** `/opt/Aarya_clothing_frontend/services/commerce/service/order_service.py`, lines 427-467

**The Code:**
```python
# Line 427-467
if payment_method == "razorpay" and transaction_id:
    try:
        from sqlalchemy import text as _text
        logger.info(...)
        
        self.db.execute(
            _text("""
                INSERT INTO payment_transactions (
                    order_id, user_id, amount, currency, payment_method,
                    razorpay_order_id, razorpay_payment_id, razorpay_signature,
                    status, created_at, completed_at, transaction_id
                ) VALUES (
                    :order_id, :user_id, :amount, 'INR', 'razorpay',
                    :razorpay_order_id, :razorpay_payment_id, :signature,
                    'completed', NOW(), NOW(), :transaction_id
                )
                ON CONFLICT (transaction_id) DO NOTHING
            """),
            {...params}
        )
        self.db.commit()
        logger.info("✓ PAYMENT_TRANSACTION_CREATED...")
    except Exception as payment_err:
        # ⚠️ CRITICAL: Error is logged but SILENTLY ignored
        logger.error(f"⚠ FAILED to create payment transaction for order {order.id}: {payment_err}")
        # Don't rollback - order is already committed successfully
```

### Why This Failed (3 Likely Scenarios):

#### Scenario 1: Schema Column Mismatch ⭐ MOST LIKELY
The `payment_transactions` table schema has evolved over time. The INSERT statement assumes these columns exist:
- `razorpay_signature`
- `razorpay_qr_code_id` (not in the INSERT but exists in schema)
- Other columns

**If any column name changed or was added/removed**, the raw SQL INSERT would fail with a column-not-found error.

**Evidence:** PostgreSQL logs show:
```
2026-04-07 07:43:53.365 UTC [33100] ERROR:  column "order_number" does not exist
```
This proves schema mismatches have occurred.

#### Scenario 2: ON CONFLICT DO NOTHING Masking Real Issues
The `ON CONFLICT (transaction_id) DO NOTHING` clause means:
- If a record with the same `transaction_id` already exists → **silently skip**
- No error is raised, no warning is logged
- The code thinks it succeeded, but 0 rows were inserted

**This could happen if:**
- Webhooks created the payment_transactions record before this code ran
- Race condition during payment confirmation
- Previous failed order attempt left a partial record

#### Scenario 3: Database Session State Issue
After `self.db.commit()` on line 421 (order creation), the session might be in a state where:
- The transaction is committed
- A new transaction starts for the payment INSERT
- If any constraint violation occurs, it's caught but not properly handled

### Why No Error Logs?

1. **LOG_LEVEL might be INFO or higher** - ERROR logs might not be persisted
2. **Docker logs are ephemeral** - If containers restarted, logs are lost
3. **The try/except silently swallows the error** - Only logs to logger.error() which might not be visible

---

## Secondary Issues Found

### Issue 1: QR Payment Without Order Creation
**2 completed QR payments have NO order linked:**
- Users scanned QR codes and paid successfully
- Payment status changed to "completed"
- But order creation step **never happened or failed**

**Root Cause:** The QR payment flow in `/checkout/confirm/page.js` calls `POST /api/v1/orders` AFTER payment completes. If:
- User closes browser before confirm page loads
- Network error during order creation
- Payment succeeds but user doesn't complete checkout

**Impact:** Money collected but no order created → customer service nightmare

### Issue 2: Orders 11 & 12 Have Empty transaction_id
These QR payment orders have:
- ✅ payment_transactions record (correctly linked)
- ❌ Empty `transaction_id` field in the orders table

**Root Cause:** The order creation code doesn't backfill `transaction_id` from the QR payment record.

### Issue 3: No Foreign Key Enforcement
The `payment_transactions.order_id` column is defined as:
```sql
order_id INTEGER NOT NULL,
```

**BUT** there's NO foreign key constraint to the `orders` table! This allows:
- Orphaned payment records (order_id points to non-existent order)
- No CASCADE DELETE behavior
- Data integrity issues

---

## Why Didn't We Catch This Earlier?

### 1. No Automated Tests
There are no integration tests that verify:
```python
assert payment_transactions_record_exists_for(order.id)
```

### 2. Silent Error Handling
The code uses "fail gracefully" pattern but doesn't:
- Alert anyone
- Retry the operation
- Mark the order for manual review

### 3. No Monitoring/Alerting
No alerts fire when:
- Orders are created without payment_transactions
- Payment status doesn't match order status
- Orphaned payment records exist

### 4. Logs Not Persisted
Docker containers don't persist logs across restarts, so historical errors are lost.

---

## Immediate Fixes Required

### Fix 1: Backfill Missing Payment Transactions
Run this SQL to create payment_transactions for the 6 orphaned orders:

```sql
-- File: migrations/fix_orphaned_orders_payment_transactions.sql
INSERT INTO payment_transactions (
    order_id, user_id, amount, currency, payment_method,
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    status, created_at, completed_at, transaction_id
)
SELECT 
    o.id, o.user_id, o.total_amount, 'INR', o.payment_method,
    o.razorpay_order_id, o.razorpay_payment_id, '',
    'completed', o.created_at, o.created_at, o.transaction_id
FROM orders o
WHERE o.payment_method = 'razorpay'
  AND o.transaction_id IS NOT NULL
  AND o.transaction_id != ''
  AND o.id NOT IN (
      SELECT order_id FROM payment_transactions 
      WHERE order_id IS NOT NULL
  )
ON CONFLICT (transaction_id) DO UPDATE 
    SET order_id = EXCLUDED.order_id,
        status = 'completed',
        updated_at = NOW();
```

### Fix 2: Investigate 2 Completed QR Payments Without Orders
These need manual investigation:
- Check Razorpay dashboard for payments qr_SaN2QmGg044n8P and qr_SaN2qo7ZNQtn3V
- Contact customers (users 283 and 282)
- Create orders manually or refund if no order was intended

### Fix 3: Add Order Recovery Endpoint
The codebase already has:
- `POST /api/v1/orders/recover-from-payment` (for end-users)
- `POST /api/v1/orders/admin/force-create` (for admins)
- `/admin/payments/recovery` (admin UI)

Use these to fix the 2 orphaned QR payments.

---

## Permanent Prevention Plan

### 1. Code Changes

#### A. Remove Silent Failure Pattern
**Before:**
```python
except Exception as payment_err:
    logger.error(f"⚠ FAILED...")
    # Don't rollback
```

**After:**
```python
except Exception as payment_err:
    logger.critical(
        f"🚨 CRITICAL: Payment transaction creation FAILED for order {order.id}. "
        f"This is a DATA INTEGRITY issue. Error: {payment_err}",
        exc_info=True
    )
    # Mark order for manual review
    order.requires_payment_review = True
    order.payment_error = str(payment_err)
    self.db.commit()
    
    # Send alert to ops team
    send_alert(
        level="CRITICAL",
        message=f"Order {order.id} created without payment transaction record",
        context={"order_id": order.id, "error": str(payment_err)}
    )
    
    # Retry once
    try:
        retry_payment_transaction_creation(order.id)
    except Exception as retry_err:
        logger.critical(f"Retry also failed: {retry_err}")
```

#### B. Add Database Constraint
```sql
-- Add foreign key constraint
ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_payment_transactions_order 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- Add NOT NULL constraint after fixing existing NULL values
-- UPDATE payment_transactions SET order_id = 0 WHERE order_id IS NULL;
-- ALTER TABLE payment_transactions ALTER COLUMN order_id SET NOT NULL;
```

#### C. Add Validation Hook
```python
# In order_service.py, after order creation
def validate_order_payment_trail(self, order_id: int):
    """Validate that payment_transactions record exists for an order."""
    from sqlalchemy import text
    result = self.db.execute(
        text("SELECT COUNT(*) FROM payment_transactions WHERE order_id = :order_id"),
        {"order_id": order_id}
    )
    count = result.scalar()
    if count == 0:
        logger.critical(f"DATA INTEGRITY VIOLATION: Order {order_id} has NO payment_transactions record!")
        # Trigger alert, mark for review, etc.
```

### 2. Add Automated Tests

```python
# tests/integration/test_order_payment_trail.py
def test_order_creates_payment_transaction():
    """Verify that creating an order also creates a payment_transactions record."""
    order = create_test_order(...)
    payment_record = db.query(PaymentTransaction).filter_by(order_id=order.id).first()
    assert payment_record is not None, "Payment transaction record must exist"
    assert payment_record.status == "completed"
    assert payment_record.amount == order.total_amount

def test_qr_payment_creates_order():
    """Verify that completing a QR payment triggers order creation."""
    qr_payment = create_qr_payment(...)
    complete_qr_payment(qr_payment.qr_code_id)
    order = db.query(Order).filter_by(user_id=qr_payment.user_id).order_by(Order.created_at.desc()).first()
    assert order is not None, "Order must be created after QR payment"
```

### 3. Add Monitoring & Alerts

```python
# Scheduled job (run every 5 minutes)
def check_orphaned_orders():
    """Alert if orders exist without payment_transactions."""
    orphaned = db.execute(text("""
        SELECT o.id, o.total_amount, o.transaction_id 
        FROM orders o 
        LEFT JOIN payment_transactions pt ON o.id = pt.order_id 
        WHERE pt.id IS NULL AND o.payment_method = 'razorpay'
    """))
    
    if orphaned.rowcount > 0:
        send_critical_alert(
            f"Found {orphaned.rowcount} orders without payment transaction records!",
            data=orphaned.fetchall()
        )

def check_orphaned_payments():
    """Alert if completed payments exist without orders."""
    orphaned = db.execute(text("""
        SELECT pt.id, pt.amount, pt.razorpay_qr_code_id
        FROM payment_transactions pt
        LEFT JOIN orders o ON pt.order_id = o.id
        WHERE pt.status = 'completed' AND o.id IS NULL
    """))
    
    if orphaned.rowcount > 0:
        send_critical_alert(
            f"Found {orphaned.rowcount} completed payments without orders!",
            data=orphaned.fetchall()
        )
```

### 4. Add Log Persistence

**docker-compose.yml:**
```yaml
services:
  commerce:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
        tag: "{{.Name}}"
    volumes:
      - commerce-logs:/app/logs

volumes:
  commerce-logs:
```

**order_service.py:**
```python
# Add file handler for critical logs
import logging
file_handler = logging.FileHandler('/app/logs/payment_transactions.log')
file_handler.setLevel(logging.CRITICAL)
logger.addHandler(file_handler)
```

### 5. Add Database Migration Tracking

Use Alembic or similar to track schema changes and ensure raw SQL queries are always in sync with the actual schema.

---

## Action Items Priority

| Priority | Action | Estimated Impact |
|----------|--------|------------------|
| 🔴 **P0** | Backfill 6 orphaned orders with payment_transactions | Immediate data integrity fix |
| 🔴 **P0** | Investigate 2 completed QR payments without orders | Customer money at risk |
| 🟠 **P1** | Add foreign key constraint to payment_transactions.order_id | Prevent future orphans |
| 🟠 **P1** | Add critical alerting for payment transaction failures | Catch issues immediately |
| 🟡 **P2** | Add integration tests for order-payment trail | Prevent regressions |
| 🟡 **P2** | Add scheduled job to detect orphaned records | Ongoing monitoring |
| 🟢 **P3** | Persist Docker logs to volumes | Better debugging |
| 🟢 **P3** | Add order.requires_payment_review flag | Manual review workflow |

---

## How to Verify Fix Worked

After implementing all fixes:

```sql
-- All orders should have payment_transactions
SELECT 
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT pt.order_id) as orders_with_payment,
    COUNT(DISTINCT CASE WHEN pt.id IS NULL THEN o.id END) as orphaned_orders
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE o.payment_method = 'razorpay';

-- Expected result: orphaned_orders = 0

-- All completed payments should have orders
SELECT 
    COUNT(*) as completed_payments,
    COUNT(pt.order_id) as payments_with_orders,
    COUNT(*) - COUNT(pt.order_id) as orphaned_payments
FROM payment_transactions pt
WHERE pt.status = 'completed';

-- Expected result: orphaned_payments = 0
```

---

## Lessons Learned

1. **Never use `ON CONFLICT DO NOTHING` without logging whether a row was actually inserted**
2. **Silent error handling in financial transactions is a recipe for data loss**
3. **Database constraints are your friend - don't skip foreign keys**
4. **Always test the full order-payment-refund flow end-to-end**
5. **Logs must be persisted - ephemeral logs are useless for debugging**
6. **Automated tests must verify data integrity, not just happy paths**
7. **Monitoring must alert on data inconsistencies, not just system errors**

---

## References

- Original fix attempt: `/opt/Aarya_clothing_frontend/docs/PAYMENT_TRANSACTION_FIX_SUMMARY.md`
- Backfill migration: `/opt/Aarya_clothing_frontend/migrations/backfill_payment_transactions.sql`
- Order service code: `/opt/Aarya_clothing_frontend/services/commerce/service/order_service.py`
- Payment model: `/opt/Aarya_clothing_frontend/services/payment/models/payment.py`

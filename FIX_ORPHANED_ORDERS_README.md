# How to Fix Orphaned Orders & Prevent Future Issues

**Created:** April 8, 2026  
**Status:** Ready to Execute  
**Risk:** Low (all changes are backward compatible)

---

## Quick Summary

**Problem:** 6 out of 8 orders have NO payment transaction records in the database.  
**Root Cause:** Silent INSERT failures in `order_service.py` with `ON CONFLICT DO NOTHING` masking errors.  
**Impact:** No audit trail for payments, can't reconcile orders with payment gateway.

---

## Step-by-Step Fix Guide

### Step 1: Backup Database (SAFETY FIRST)

```bash
# Create a backup before making any changes
docker exec aarya_postgres pg_dump -U postgres aarya_clothing > /tmp/aarya_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup was created
ls -lh /tmp/aarya_backup_*.sql | tail -1
```

### Step 2: Run the Backfill Migration

This will create payment_transactions records for the 6 orphaned orders (IDs: 5, 13, 14, 15, 16, 17).

```bash
# Run the migration
docker exec -i aarya_postgres psql -U postgres -d aarya_clothing < /opt/Aarya_clothing_frontend/migrations/fix_orphaned_orders_backfill.sql

# Expected output:
# - 6 rows inserted/updated in payment_transactions
# - orphaned_orders = 0
# - Orders 11 & 12 now have transaction_id populated
```

### Step 3: Verify the Fix

```bash
# Connect to database
docker exec -it aarya_postgres psql -U postgres -d aarya_clothing

# Run this query:
SELECT 
    o.id as order_id,
    o.user_id,
    o.total_amount,
    o.transaction_id,
    pt.id as payment_id,
    pt.status as payment_status,
    CASE 
        WHEN pt.id IS NULL THEN '❌ ORPHANED'
        ELSE '✓ LINKED'
    END as status
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE o.payment_method = 'razorpay'
ORDER BY o.id;

# Expected result: ALL orders should show "✓ LINKED"
# Exit with \q
```

### Step 4: Run the Monitor Script

This checks for any remaining issues:

```bash
# Install dependencies (if needed)
pip install psycopg2-binary

# Run monitor (read-only check)
python /opt/Aarya_clothing_frontend/scripts/monitor_orphaned_orders.py

# Expected: "✓ All data integrity checks passed!"
```

### Step 5: Setup Automated Monitoring (Cron Job)

Run the monitor every 5 minutes to catch issues early:

```bash
# Edit crontab
crontab -e

# Add this line:
*/5 * * * * /usr/bin/python3 /opt/Aarya_clothing_frontend/scripts/monitor_orphaned_orders.py --send-alert >> /var/log/orphaned_orders_monitor.log 2>&1

# Save and exit
```

### Step 6: Apply Code Fix to order_service.py

**Option A: Manual Update (Recommended)**

1. Open `/opt/Aarya_clothing_frontend/services/commerce/service/order_service.py`
2. Find lines 427-467 (the payment transaction creation block)
3. Replace with the improved code from `/opt/Aarya_clothing_frontend/docs/order_service_payment_fix.py`
4. Key changes:
   - Changed `ON CONFLICT DO NOTHING` to `ON CONFLICT DO UPDATE`
   - Added rowcount check to verify insertion
   - Added order marking for failed payments
   - Added retry logic
   - Added alerting

**Option B: Use the reference implementation**

```bash
# Backup the current file
cp /opt/Aarya_clothing_frontend/services/commerce/service/order_service.py \
   /opt/Aarya_clothing_frontend/services/commerce/service/order_service.py.backup

# Review the diff (after applying changes)
git diff services/commerce/service/order_service.py
```

### Step 7: Add Database Constraints

This prevents future orphaned records at the database level:

```bash
# Run constraint additions
docker exec -i aarya_postgres psql -U postgres -d aarya_clothing << 'EOF'

-- Add foreign key constraint
ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_payment_transactions_order 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- Add performance index
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id 
ON payment_transactions(order_id);

-- Verify constraints
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'payment_transactions'
  AND tc.constraint_type = 'FOREIGN KEY';

EOF
```

### Step 8: Rebuild and Restart Services

```bash
# Rebuild commerce service with new code
cd /opt/Aarya_clothing_frontend
docker-compose build commerce

# Restart commerce service
docker-compose restart commerce

# Verify service is running
docker ps | grep commerce

# Check logs for errors
docker logs aarya_commerce_1 --tail 50
```

### Step 9: Test the Fix

Create a test order to verify the fix works:

```bash
# Option 1: Use the admin UI
# Navigate to: https://your-domain.com/admin/orders
# Create a test order manually

# Option 2: Use the API
curl -X POST https://your-domain.com/api/v1/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "test_'"$(date +%s)"'",
    "razorpay_order_id": "order_test_'"$(date +%s)"'",
    "razorpay_payment_id": "pay_test_'"$(date +%s)"'",
    "payment_method": "razorpay"
  }'

# Verify payment_transactions was created
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  SELECT o.id, o.transaction_id, pt.id as payment_id 
  FROM orders o 
  LEFT JOIN payment_transactions pt ON o.id = pt.order_id 
  WHERE o.transaction_id LIKE 'test_%' 
  ORDER BY o.id DESC LIMIT 1;
"
```

---

## Files Created

| File | Purpose |
|------|---------|
| `/docs/ORDER_PAYMENT_ASSOCIATION_ANALYSIS.md` | Detailed root cause analysis |
| `/migrations/fix_orphaned_orders_backfill.sql` | SQL migration to fix orphaned orders |
| `/scripts/monitor_orphaned_orders.py` | Automated monitoring script |
| `/docs/order_service_payment_fix.py` | Improved code with proper error handling |
| `/FIX_ORPHANED_ORDERS_README.md` | This file |

---

## Rollback Plan (If Something Goes Wrong)

```bash
# Step 1: Restore from backup
docker exec -i aarya_postgres psql -U postgres -d aarya_clothing < /tmp/aarya_backup_YYYYMMDD_HHMMSS.sql

# Step 2: Restore order_service.py
cp /opt/Aarya_clothing_frontend/services/commerce/service/order_service.py.backup \
   /opt/Aarya_clothing_frontend/services/commerce/service/order_service.py

# Step 3: Restart services
docker-compose restart commerce
```

---

## Monitoring Dashboard Queries

Add these to your Grafana/Datadog dashboard:

### Query 1: Orphaned Orders Count
```sql
SELECT COUNT(*) as orphaned_orders
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE pt.id IS NULL 
  AND o.payment_method IN ('razorpay', 'cashfree')
  AND o.status NOT IN ('cancelled', 'failed');
```

### Query 2: Orphaned Payments Count
```sql
SELECT COUNT(*) as orphaned_payments
FROM payment_transactions pt
LEFT JOIN orders o ON pt.order_id = o.id
WHERE pt.status = 'completed' AND o.id IS NULL;
```

### Query 3: Order-Payment Linkage Rate
```sql
SELECT 
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT pt.order_id) as linked_orders,
    ROUND(
        COUNT(DISTINCT pt.order_id)::numeric / NULLIF(COUNT(DISTINCT o.id), 0)::numeric * 100, 
        2
    ) as linkage_percentage
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE o.payment_method IN ('razorpay', 'cashfree')
  AND o.created_at > NOW() - INTERVAL '30 days';
```

---

## Next Steps After Fix

1. ✅ Verify all orders are linked (Step 3)
2. ✅ Setup cron monitoring (Step 5)
3. ✅ Apply code changes (Step 6)
4. ✅ Add database constraints (Step 7)
5. ✅ Test end-to-end flow (Step 9)
6. 📊 Add monitoring dashboard (queries above)
7. 🧪 Add integration tests (see below)
8. 📝 Update runbook with this process

---

## Integration Tests to Add

Create `/opt/Aarya_clothing_frontend/tests/integration/test_order_payment_trail.py`:

```python
import pytest
from sqlalchemy import text

class TestOrderPaymentTrail:
    """Ensure orders always have payment_transactions records."""
    
    def test_razorpay_order_creates_payment_transaction(self, db_session, mock_razorpay):
        """Verify Razorpay order creates payment_transactions record."""
        # Arrange
        order_data = {
            "user_id": 1,
            "transaction_id": f"test_txn_{int(time.time())}",
            "razorpay_order_id": "order_test_123",
            "razorpay_payment_id": "pay_test_123",
            "payment_method": "razorpay"
        }
        
        # Act
        order = order_service.create_order(**order_data)
        
        # Assert
        result = db_session.execute(
            text("SELECT COUNT(*) FROM payment_transactions WHERE order_id = :order_id"),
            {"order_id": order.id}
        )
        count = result.scalar()
        assert count == 1, f"Expected 1 payment_transactions record, got {count}"
        
        # Verify data integrity
        result = db_session.execute(
            text("""
                SELECT order_id, status, amount, transaction_id 
                FROM payment_transactions 
                WHERE order_id = :order_id
            """),
            {"order_id": order.id}
        )
        pt = result.fetchone()
        assert pt.order_id == order.id
        assert pt.status == "completed"
        assert pt.amount == order.total_amount
        assert pt.transaction_id == order_data["transaction_id"]
    
    def test_qr_payment_links_to_order(self, db_session, mock_razorpay_qr):
        """Verify QR payment completion links to order."""
        # Arrange
        qr_code_id = f"qr_test_{int(time.time())}"
        
        # Act - Simulate QR payment completion
        order = order_service.create_order(
            user_id=1,
            qr_code_id=qr_code_id,
            payment_method="razorpay"
        )
        
        # Assert
        result = db_session.execute(
            text("""
                SELECT COUNT(*) 
                FROM payment_transactions 
                WHERE order_id = :order_id 
                  AND status = 'completed'
            """),
            {"order_id": order.id}
        )
        count = result.scalar()
        assert count >= 1, "QR payment must be linked to order"
```

---

## Questions?

- **Why did this happen?** → See `/docs/ORDER_PAYMENT_ASSOCIATION_ANALYSIS.md`
- **How to prevent in future?** → See "Permanent Prevention Plan" section in analysis doc
- **What about the 2 QR payments without orders?** → Investigate manually via Razorpay dashboard, then use `/admin/payments/recovery` to create orders or refund

---

## Contacts

- Database issues: Check PostgreSQL logs: `docker logs aarya_postgres`
- Commerce service issues: `docker logs aarya_commerce_1`
- Payment service issues: `docker logs aarya_payment_1` (if exists)

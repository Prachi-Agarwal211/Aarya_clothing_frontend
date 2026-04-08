-- ============================================================================
-- FIX: Backfill Missing Payment Transactions for Orphaned Orders
-- Date: April 8, 2026
-- Issue: 6 orders have NO payment_transactions records
-- ============================================================================

-- Step 1: Show current orphaned orders
SELECT 
    'BEFORE FIX' as stage,
    o.id as order_id,
    o.user_id,
    o.total_amount,
    o.transaction_id,
    o.razorpay_order_id,
    o.razorpay_payment_id,
    pt.id as payment_transaction_id
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE o.payment_method = 'razorpay'
  AND pt.id IS NULL
ORDER BY o.id;

-- Expected: 6 rows (orders 5, 13, 14, 15, 16, 17)

-- Step 2: Backfill missing payment transactions
-- Using ON CONFLICT DO UPDATE to handle existing records
INSERT INTO payment_transactions (
    order_id, 
    user_id, 
    amount, 
    currency, 
    payment_method,
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature,
    status, 
    created_at, 
    completed_at, 
    transaction_id
)
SELECT 
    o.id, 
    o.user_id, 
    o.total_amount, 
    'INR', 
    o.payment_method,
    o.razorpay_order_id, 
    o.razorpay_payment_id, 
    '',  -- signature not available from orders table
    'completed', 
    o.created_at, 
    o.created_at, 
    o.transaction_id
FROM orders o
WHERE o.payment_method = 'razorpay'
  AND o.transaction_id IS NOT NULL
  AND o.transaction_id != ''
  AND o.id NOT IN (
      SELECT order_id 
      FROM payment_transactions 
      WHERE order_id IS NOT NULL
  )
ON CONFLICT (transaction_id) DO UPDATE 
    SET 
        order_id = EXCLUDED.order_id,
        status = 'completed',
        updated_at = NOW(),
        completed_at = COALESCE(payment_transactions.completed_at, EXCLUDED.completed_at);

-- Step 3: Verify the fix
SELECT 
    'AFTER FIX' as stage,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT pt.order_id) as orders_with_payment,
    COUNT(DISTINCT CASE WHEN pt.id IS NULL THEN o.id END) as orphaned_orders
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE o.payment_method = 'razorpay';

-- Expected: orphaned_orders = 0

-- Step 4: Show all payment transactions for Razorpay orders
SELECT 
    o.id as order_id,
    o.user_id,
    o.total_amount,
    pt.id as payment_id,
    pt.transaction_id,
    pt.razorpay_order_id,
    pt.razorpay_payment_id,
    pt.status,
    pt.created_at
FROM orders o
JOIN payment_transactions pt ON o.id = pt.order_id
WHERE o.payment_method = 'razorpay'
ORDER BY o.id;

-- Step 5: Show any remaining issues (should be 0 rows)
SELECT 
    o.id as order_id,
    o.transaction_id,
    'MISSING payment_transactions record' as issue
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE pt.id IS NULL 
  AND o.payment_method = 'razorpay'
  AND o.transaction_id IS NOT NULL
  AND o.transaction_id != '';

-- Step 6: Also fix orders 11 & 12 (QR payments) - backfill transaction_id
-- These orders have payment_transactions but empty transaction_id in orders table
UPDATE orders o
SET transaction_id = pt.transaction_id
FROM payment_transactions pt
WHERE o.id = pt.order_id
  AND (o.transaction_id IS NULL OR o.transaction_id = '')
  AND pt.status = 'completed'
  AND pt.razorpay_qr_code_id IS NOT NULL;

-- Verify QR payment orders now have transaction_id
SELECT 
    o.id as order_id,
    o.user_id,
    o.total_amount,
    o.transaction_id,
    pt.id as payment_id,
    pt.transaction_id as payment_transaction_id,
    pt.razorpay_qr_code_id
FROM orders o
JOIN payment_transactions pt ON o.id = pt.order_id
WHERE pt.razorpay_qr_code_id IS NOT NULL
ORDER BY o.id;

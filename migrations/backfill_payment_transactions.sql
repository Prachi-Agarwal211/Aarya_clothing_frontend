-- Backfill payment_transactions for existing Razorpay orders
-- This migration creates payment transaction records for all existing orders
-- that have Razorpay payment details but no corresponding payment transaction.

-- Step 1: Check current state
SELECT 
    'Before Backfill' as stage,
    COUNT(*) as total_orders,
    COUNT(DISTINCT o.id) as orders_with_razorpay,
    COUNT(DISTINCT pt.order_id) as orders_with_payment_transaction
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE o.payment_method = 'razorpay';

-- Step 2: Insert missing payment transactions
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
    'razorpay',
    o.razorpay_order_id,
    o.razorpay_payment_id,
    NULL,  -- signature not available from orders table
    'completed',
    o.created_at,
    o.created_at,
    COALESCE(o.razorpay_payment_id, o.razorpay_order_id, CONCAT('backfill_', o.id))
FROM orders o
WHERE o.payment_method = 'razorpay'
AND o.razorpay_payment_id IS NOT NULL
AND o.id NOT IN (
    SELECT order_id 
    FROM payment_transactions 
    WHERE order_id IS NOT NULL
)
ON CONFLICT (transaction_id) DO NOTHING;

-- Step 3: Verify backfill results
SELECT 
    'After Backfill' as stage,
    COUNT(*) as total_orders,
    COUNT(DISTINCT o.id) as orders_with_razorpay,
    COUNT(DISTINCT pt.order_id) as orders_with_payment_transaction,
    COUNT(DISTINCT CASE WHEN pt.id IS NOT NULL THEN o.id END) as backfilled_count
FROM orders o
LEFT JOIN payment_transactions pt ON o.id = pt.order_id
WHERE o.payment_method = 'razorpay';

-- Step 4: Show newly created payment transactions
SELECT 
    pt.id as payment_transaction_id,
    pt.order_id,
    pt.user_id,
    pt.amount,
    pt.razorpay_order_id,
    pt.razorpay_payment_id,
    pt.status,
    pt.created_at
FROM payment_transactions pt
WHERE pt.transaction_id LIKE 'backfill_%'
   OR pt.transaction_id LIKE 'pay_%'
ORDER BY pt.created_at DESC
LIMIT 20;

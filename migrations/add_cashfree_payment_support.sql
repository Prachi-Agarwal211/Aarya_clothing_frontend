-- Migration: Add Cashfree Payment Support
-- Date: 2026-03-27
-- Description: Add Cashfree payment gateway fields to support dual payment gateway integration

-- ==================== Payment Service ====================

-- Add Cashfree columns to payment_transactions
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS cashfree_reference_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS cashfree_session_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS cashfree_signature VARCHAR(500);

-- Add indexes for Cashfree fields
CREATE INDEX IF NOT EXISTS idx_cashfree_order ON payment_transactions(cashfree_order_id);
CREATE INDEX IF NOT EXISTS idx_cashfree_reference ON payment_transactions(cashfree_reference_id);

-- ==================== Commerce Service ====================

-- Add Cashfree and Razorpay columns to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS cashfree_reference_id VARCHAR(100);

-- Add indexes for payment fields
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment ON orders(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_cashfree_order ON orders(cashfree_order_id);

-- ==================== Comments ====================

COMMENT ON COLUMN payment_transactions.cashfree_order_id IS 'Cashfree order ID from API';
COMMENT ON COLUMN payment_transactions.cashfree_reference_id IS 'Cashfree reference ID for payment';
COMMENT ON COLUMN payment_transactions.cashfree_session_id IS 'Cashfree payment session ID';
COMMENT ON COLUMN payment_transactions.cashfree_signature IS 'Cashfree payment signature';

COMMENT ON COLUMN orders.razorpay_order_id IS 'Razorpay order ID (order_xxx)';
COMMENT ON COLUMN orders.razorpay_payment_id IS 'Razorpay payment ID (pay_xxx)';
COMMENT ON COLUMN orders.cashfree_order_id IS 'Cashfree order ID';
COMMENT ON COLUMN orders.cashfree_reference_id IS 'Cashfree reference ID';

-- ==================== Verification ====================

-- Verify columns were added
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('payment_transactions', 'orders')
    AND column_name LIKE '%cashfree%' OR column_name LIKE '%razorpay%'
ORDER BY table_name, column_name;

-- Migration: Add order recovery support and improve constraints
-- Date: 2026-03-30
-- Purpose: Support order recovery from successful payments and add better indexing

-- Add index on transaction_id for faster order recovery lookups
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);

-- Add index on razorpay_payment_id for payment reconciliation
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON orders(razorpay_payment_id);

-- Add index on razorpay_order_id for payment reconciliation
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id);

-- Add column for order recovery tracking (if payment succeeded but order creation failed)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS recovered_from_payment BOOLEAN DEFAULT FALSE;

-- Add column to store recovery timestamp
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMP WITH TIME ZONE;

-- Add column to store original payment verification response (for debugging)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_verification_response JSONB;

-- Create sequence for invoice numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;

-- Add comment to explain the sequence
COMMENT ON SEQUENCE invoice_number_seq IS 'Sequential invoice number generator for orders';

-- Create view for payment reconciliation (helps identify orphaned payments)
CREATE OR REPLACE VIEW v_payment_reconciliation AS
SELECT 
    o.id AS order_id,
    o.user_id,
    o.transaction_id,
    o.razorpay_payment_id,
    o.razorpay_order_id,
    o.total_amount,
    o.status,
    o.created_at,
    o.recovered_from_payment,
    o.recovered_at,
    CASE 
        WHEN o.transaction_id IS NOT NULL AND o.id IS NOT NULL THEN 'linked'
        WHEN o.transaction_id IS NOT NULL AND o.id IS NULL THEN 'orphaned_payment'
        ELSE 'unknown'
    END AS reconciliation_status
FROM orders o
WHERE o.created_at > NOW() - INTERVAL '30 days';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON v_payment_reconciliation TO admin;
-- GRANT SELECT ON v_payment_reconciliation TO support;

COMMENT ON VIEW v_payment_reconciliation IS 'View for identifying orphaned payments and order reconciliation';

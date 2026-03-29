-- Migration: Add unique constraint to prevent duplicate orders
-- Date: 2026-03-25
-- Issue: ORDER_CREATION_ISSUES - Fix #1
-- Description: Prevents duplicate orders from being created with the same user_id and transaction_id

-- Add unique constraint to orders table
-- This prevents the same payment from being used to create multiple orders
ALTER TABLE orders 
ADD CONSTRAINT uq_order_user_transaction UNIQUE (user_id, transaction_id);

-- Create index to support the unique constraint (if not already exists)
-- Note: The unique constraint automatically creates an index, but we add explicit 
-- naming for clarity and to ensure optimal query performance
CREATE INDEX IF NOT EXISTS ix_orders_user_transaction 
ON orders(user_id, transaction_id);

-- Add comment to document the constraint purpose
COMMENT ON CONSTRAINT uq_order_user_transaction ON orders IS 
'Prevents duplicate orders from same payment transaction - critical for idempotency';

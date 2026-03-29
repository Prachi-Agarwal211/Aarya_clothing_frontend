-- Migration: Remove Guest Checkout Columns
-- Date: March 25, 2026
-- Purpose: Clean up unused guest checkout columns from orders table
-- Impact: Guest checkout fully removed (code + database)

-- Start transaction
BEGIN;

-- Remove guest_email column
ALTER TABLE orders 
DROP COLUMN IF EXISTS guest_email;

-- Remove guest_token column  
ALTER TABLE orders
DROP COLUMN IF EXISTS guest_token;

-- Add comment to document the change
COMMENT ON TABLE orders IS 'Orders table - registered users only (guest checkout removed March 2026)';

-- Verify changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('guest_email', 'guest_token');

-- Should return 0 rows

-- Commit transaction
COMMIT;

-- Log the migration
SELECT 'Migration completed: Guest checkout columns removed' AS status;

-- Migration: Remove guest order support from orders table
-- Date: 2026-03-25
-- Reason: Guest checkout removed - all users must now create account and login

BEGIN;

-- Remove guest order columns
DO $$
BEGIN
    -- Drop guest_email column
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'orders' AND column_name = 'guest_email') THEN
        DROP INDEX IF EXISTS idx_orders_guest_email;
        ALTER TABLE orders DROP COLUMN guest_email;
        RAISE NOTICE 'Removed guest_email column from orders table';
    END IF;

    -- Drop guest_token column
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'orders' AND column_name = 'guest_token') THEN
        DROP INDEX IF EXISTS idx_orders_guest_token;
        ALTER TABLE orders DROP COLUMN guest_token;
        RAISE NOTICE 'Removed guest_token column from orders table';
    END IF;
END $$;

COMMIT;

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('guest_email', 'guest_token')
ORDER BY ordinal_position;

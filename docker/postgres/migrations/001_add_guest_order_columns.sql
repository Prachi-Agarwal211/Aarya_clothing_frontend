-- Migration: Add guest order support to orders table
-- Date: 2026-03-23
-- Issue: Commerce service expects guest_email and guest_token columns

BEGIN;

-- Add guest order columns if they don't exist
DO $$ 
BEGIN
    -- Add guest_email column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'guest_email') THEN
        ALTER TABLE orders ADD COLUMN guest_email VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_orders_guest_email ON orders(guest_email);
        RAISE NOTICE 'Added guest_email column to orders table';
    END IF;

    -- Add guest_token column  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'guest_token') THEN
        ALTER TABLE orders ADD COLUMN guest_token VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_orders_guest_token ON orders(guest_token);
        RAISE NOTICE 'Added guest_token column to orders table';
    END IF;
END $$;

COMMIT;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name IN ('guest_email', 'guest_token')
ORDER BY ordinal_position;

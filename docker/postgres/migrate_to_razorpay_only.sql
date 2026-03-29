-- ============================================
-- RAZORPAY-ONLY MIGRATION SCRIPT
-- Aarya Clothing Payment System Migration
-- ============================================
-- Purpose: Migrate existing database from multi-payment gateway to Razorpay-only
-- WARNING: Backup your database before running this script!
-- ============================================

-- Step 1: Backup existing payment methods (optional but recommended)
-- ============================================
-- CREATE TABLE payment_methods_backup AS SELECT * FROM payment_methods;

-- Step 2: Convert existing orders to Razorpay
-- ============================================
-- Convert all Cashfree and COD orders to Razorpay
UPDATE orders 
SET payment_method = 'razorpay' 
WHERE payment_method IN ('cashfree', 'cod', 'easebuzz', 'upi', 'bank_transfer', 'wallet');

-- Convert all payment transactions to Razorpay
UPDATE payment_transactions 
SET payment_method = 'razorpay' 
WHERE payment_method IN ('cashfree', 'cod', 'easebuzz', 'upi', 'bank_transfer', 'wallet');

-- Step 3: Update payment methods table
-- ============================================
-- Activate Razorpay
UPDATE payment_methods 
SET is_active = TRUE, 
    display_name = 'Razorpay (UPI/Cards/NetBanking)',
    config = '{}'::jsonb
WHERE name = 'razorpay';

-- Deactivate other payment methods
UPDATE payment_methods 
SET is_active = FALSE 
WHERE name IN ('cashfree', 'cod', 'easebuzz', 'upi', 'bank_transfer', 'wallet');

-- Optionally, delete other payment methods entirely
-- DELETE FROM payment_methods WHERE name IN ('cashfree', 'cod', 'easebuzz', 'upi', 'bank_transfer', 'wallet');

-- Step 4: Clean up Cashfree-specific columns (optional - columns will remain but unused)
-- ============================================
-- Note: We don't drop columns to preserve historical data
-- If you want to drop them, uncomment the following:

-- ALTER TABLE payment_transactions DROP COLUMN IF EXISTS cashfree_order_id;
-- ALTER TABLE payment_transactions DROP COLUMN IF EXISTS cashfree_payment_id;
-- ALTER TABLE payment_transactions DROP COLUMN IF EXISTS cf_payment_session_id;

-- Step 5: Update constraints
-- ============================================
-- Drop old constraints if they exist
DO $$ BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_payment_method;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS chk_payment_transactions_payment_method;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Add new Razorpay-only constraints
DO $$ BEGIN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_method
        CHECK (payment_method IS NULL OR payment_method IN ('razorpay'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE payment_transactions ADD CONSTRAINT chk_payment_transactions_payment_method
        CHECK (payment_method IS NULL OR payment_method IN ('razorpay'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 6: Drop Cashfree indexes (optional - improves write performance)
-- ============================================
DROP INDEX IF EXISTS idx_payment_cashfree;

-- Step 7: Verify migration
-- ============================================
-- Check that all orders are now Razorpay
SELECT payment_method, COUNT(*) as count
FROM orders
GROUP BY payment_method;

-- Check that all transactions are now Razorpay
SELECT payment_method, COUNT(*) as count
FROM payment_transactions
GROUP BY payment_method;

-- Check payment methods status
SELECT name, is_active, display_name
FROM payment_methods
ORDER BY name;

-- Step 8: Log migration completion
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Razorpay-only migration completed successfully!';
    RAISE NOTICE 'All orders and transactions have been converted to Razorpay.';
    RAISE NOTICE 'Other payment methods have been deactivated.';
END $$;

-- ============================================
-- ROLLBACK SCRIPT (Use only if migration fails)
-- ============================================
-- Run this ONLY if you need to revert the migration:

/*
-- Rollback: Reactivate all payment methods
UPDATE payment_methods SET is_active = TRUE WHERE name IN ('cashfree', 'cod', 'easebuzz', 'upi', 'bank_transfer', 'wallet');

-- Rollback: Restore original payment methods (if you have backup data)
-- This requires manual intervention based on your backup strategy

-- Rollback: Drop new constraints
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_payment_method;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS chk_payment_transactions_payment_method;

-- Rollback: Recreate old constraints
ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_method
    CHECK (payment_method IS NULL OR payment_method IN ('cashfree', 'razorpay', 'easebuzz', 'upi', 'bank_transfer', 'wallet', 'cod'));

ALTER TABLE payment_transactions ADD CONSTRAINT chk_payment_transactions_payment_method
    CHECK (payment_method IS NULL OR payment_method IN ('cashfree', 'razorpay', 'easebuzz', 'upi', 'bank_transfer', 'wallet', 'cod'));
*/

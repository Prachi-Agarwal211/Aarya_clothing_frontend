-- 0007_razorpay_legacy_cleanup.sql
-- Final cleanup after Razorpay-only migration:
-- - remove legacy cashfree columns/indexes from payment_transactions
-- - keep only razorpay row in payment_methods
-- - enforce razorpay-only constraints

BEGIN;

-- Deduplicate method rows by name, then enforce uniqueness.
DELETE FROM payment_methods pm
USING payment_methods dup
WHERE pm.name = dup.name
  AND pm.id > dup.id;

ALTER TABLE payment_methods
  DROP CONSTRAINT IF EXISTS uq_payment_methods_name;
ALTER TABLE payment_methods
  ADD CONSTRAINT uq_payment_methods_name UNIQUE (name);

-- Ensure Razorpay method exists and is active.
UPDATE payment_methods
SET
  display_name = 'Razorpay (UPI/Cards/NetBanking)',
  is_active = TRUE,
  config = '{}'::jsonb,
  updated_at = NOW()
WHERE name = 'razorpay';

INSERT INTO payment_methods (name, display_name, is_active, config)
SELECT 'razorpay', 'Razorpay (UPI/Cards/NetBanking)', TRUE, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM payment_methods WHERE name = 'razorpay'
);

-- Remove non-razorpay payment method rows entirely.
DELETE FROM payment_methods
WHERE name <> 'razorpay';

-- Normalize method values just before constraints.
UPDATE orders
SET payment_method = 'razorpay'
WHERE payment_method IS NOT NULL AND payment_method <> 'razorpay';

UPDATE payment_transactions
SET payment_method = 'razorpay'
WHERE payment_method IS NOT NULL AND payment_method <> 'razorpay';

-- Recreate strict method constraints.
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS chk_orders_payment_method;
ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS chk_payment_transactions_payment_method;

ALTER TABLE orders
  ADD CONSTRAINT chk_orders_payment_method
  CHECK (payment_method IS NULL OR payment_method IN ('razorpay'));

ALTER TABLE payment_transactions
  ADD CONSTRAINT chk_payment_transactions_payment_method
  CHECK (payment_method IS NULL OR payment_method IN ('razorpay'));

-- Drop legacy indexes if present.
DROP INDEX IF EXISTS idx_cashfree_order;
DROP INDEX IF EXISTS idx_orders_cashfree_order;
DROP INDEX IF EXISTS idx_payment_cashfree;

-- Drop legacy Cashfree columns from payments table.
ALTER TABLE payment_transactions
  DROP COLUMN IF EXISTS cashfree_order_id,
  DROP COLUMN IF EXISTS cashfree_payment_id,
  DROP COLUMN IF EXISTS cashfree_reference_id,
  DROP COLUMN IF EXISTS cashfree_session_id,
  DROP COLUMN IF EXISTS cashfree_signature,
  DROP COLUMN IF EXISTS cf_payment_session_id;

COMMIT;

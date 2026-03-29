-- ============================================================
-- ORDER STATE MIGRATION
-- Migrate legacy order states to new simplified 4-state machine:
--   CONFIRMED → SHIPPED (with POD) → DELIVERED
--   CONFIRMED → CANCELLED
--
-- Removed states:
--   pending    → converted to confirmed (order was already reserved)
--   processing → converted to confirmed (admin will re-ship from confirmed)
--   returned   → these remain for historical data, handled by Returns module
--   refunded   → these remain for historical data, handled by Returns module
-- ============================================================

BEGIN;

-- Show count before migration
SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY status;

-- 1. Convert pending → confirmed
UPDATE orders
SET status = 'confirmed', updated_at = NOW()
WHERE status = 'pending';

-- 2. Convert processing → confirmed
--    (Admin will re-ship these with POD numbers from confirmed state)
UPDATE orders
SET status = 'confirmed', updated_at = NOW()
WHERE status = 'processing';

-- 3. Add tracking entries for migrated orders (audit trail)
INSERT INTO order_tracking (order_id, status, notes, created_at)
SELECT id, 'confirmed', 'Status migrated: legacy pending/processing → confirmed (automated migration)', NOW()
FROM orders
WHERE status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM order_tracking ot
    WHERE ot.order_id = orders.id
      AND ot.notes LIKE '%automated migration%'
  );

-- Show count after migration
SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY status;

COMMIT;

-- 0008_add_inventory_color_hex.sql
-- Ensure inventory table stores explicit variant hex colors selected in admin.

BEGIN;

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);

-- Backfill when old rows stored literal hex in `color`.
UPDATE inventory
SET color_hex = UPPER(color)
WHERE color_hex IS NULL
  AND color ~ '^#[0-9a-fA-F]{6}$';

COMMIT;

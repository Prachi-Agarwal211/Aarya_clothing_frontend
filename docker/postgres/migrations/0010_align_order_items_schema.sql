BEGIN;

-- Align order_items with current commerce model naming.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id INTEGER,
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS line_total NUMERIC(10, 2);

-- Backfill compatibility fields from legacy columns where possible.
UPDATE order_items
SET variant_id = inventory_id
WHERE variant_id IS NULL AND inventory_id IS NOT NULL;

UPDATE order_items
SET line_total = price
WHERE line_total IS NULL AND price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_variant_id
  ON order_items (variant_id);

COMMIT;

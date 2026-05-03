-- Add color_hex column to order_items for visual color swatch display
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);

-- Backfill: join order_items with inventory to get color_hex for existing orders
UPDATE order_items oi
SET color_hex = iv.color_hex
FROM inventory iv
WHERE oi.variant_id = iv.id
  AND oi.color_hex IS NULL
  AND iv.color_hex IS NOT NULL;

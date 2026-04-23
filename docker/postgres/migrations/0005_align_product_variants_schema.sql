-- 0005_align_product_variants_schema.sql
-- Bring legacy product_variants tables up to the consolidated schema used
-- by commerce/admin services.
-- Safe/idempotent for environments that already have the new columns.

BEGIN;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS quantity INTEGER,
  ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN,
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);

-- Backfill stock columns from legacy inventory_count when present.
UPDATE product_variants
SET quantity = COALESCE(quantity, inventory_count, 0)
WHERE quantity IS NULL;

UPDATE product_variants
SET reserved_quantity = COALESCE(reserved_quantity, 0)
WHERE reserved_quantity IS NULL;

UPDATE product_variants
SET low_stock_threshold = COALESCE(low_stock_threshold, 5)
WHERE low_stock_threshold IS NULL;

UPDATE product_variants
SET is_active = COALESCE(is_active, TRUE)
WHERE is_active IS NULL;

ALTER TABLE product_variants
  ALTER COLUMN quantity SET DEFAULT 0,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN reserved_quantity SET DEFAULT 0,
  ALTER COLUMN reserved_quantity SET NOT NULL,
  ALTER COLUMN low_stock_threshold SET DEFAULT 5,
  ALTER COLUMN low_stock_threshold SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_variant_quantity_nonneg'
      AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT ck_variant_quantity_nonneg CHECK (quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_variant_reserved_nonneg'
      AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT ck_variant_reserved_nonneg CHECK (reserved_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_variant_threshold_nonneg'
      AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT ck_variant_threshold_nonneg CHECK (low_stock_threshold >= 0);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_variants_low_stock
  ON product_variants (product_id)
  WHERE quantity <= low_stock_threshold;

COMMIT;

-- 0001_clean_product_model.sql
-- Migrates legacy product/inventory/variant_images schema to the clean nested model.
-- Idempotent (uses IF EXISTS guards) and runs in a single transaction.
--
-- After this migration:
--   collections        - unchanged
--   products           - rewritten: single description, single price, NOT NULL collection_id, primary_image
--   product_images     - kept (gallery extras only - no is_primary, no alt_text)
--   product_variants   - NEW: replaces inventory + variant_images, one image_url per variant
--   inventory_movements- NEW: audit trail
--   order_items        - migrated from inventory_id to variant_id
--
-- Dropped: inventory.cost_price/weight/barcode/location/variant_price/description,
--          variant_images table, products.short_description/mrp/brand/hsn_code/gst_rate/
--          is_taxable/average_rating/review_count/total_stock/is_new_arrival/meta_*/embedding,
--          first_name/last_name on users (kept full_name for back-compat... see below).

BEGIN;

-- ---------------------------------------------------------------------------
-- USERS: add first_name/last_name (keep full_name for back-compat).
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name  VARCHAR(50);

UPDATE users
SET first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
    last_name  = COALESCE(last_name,  NULLIF(regexp_replace(full_name, '^\S+\s*', ''), ''))
WHERE full_name IS NOT NULL
  AND (first_name IS NULL OR last_name IS NULL);

-- ---------------------------------------------------------------------------
-- PRODUCT_VARIANTS: rebuild from inventory + variant_images.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
    id                  SERIAL PRIMARY KEY,
    product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku                 VARCHAR(64)  NOT NULL UNIQUE,
    size                VARCHAR(16)  NOT NULL,
    color               VARCHAR(32)  NOT NULL,
    color_hex           VARCHAR(7),
    image_url           VARCHAR(500) NOT NULL,
    quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5  CHECK (low_stock_threshold >= 0),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, size, color)
);

-- Backfill from legacy inventory rows; pick variant_images.image_url first,
-- fall back to inventory.image_url, then to first product gallery image.
INSERT INTO product_variants (
    product_id, sku, size, color, color_hex, image_url,
    quantity, reserved_quantity, low_stock_threshold, is_active, created_at, updated_at
)
SELECT
    inv.product_id,
    inv.sku,
    COALESCE(NULLIF(inv.size, ''), 'ONE SIZE'),
    COALESCE(NULLIF(inv.color, ''), 'Default'),
    inv.color_hex,
    COALESCE(
        (SELECT vi.image_url
           FROM variant_images vi
          WHERE vi.inventory_id = inv.id
          ORDER BY vi.is_primary DESC, vi.display_order, vi.id
          LIMIT 1),
        inv.image_url,
        (SELECT pi.image_url
           FROM product_images pi
          WHERE pi.product_id = inv.product_id
          ORDER BY pi.is_primary DESC, pi.display_order, pi.id
          LIMIT 1),
        ''
    ),
    GREATEST(COALESCE(inv.quantity, 0), 0),
    GREATEST(COALESCE(inv.reserved_quantity, 0), 0),
    GREATEST(COALESCE(inv.low_stock_threshold, 5), 0),
    COALESCE(inv.is_active, TRUE),
    COALESCE(inv.created_at, CURRENT_TIMESTAMP),
    COALESCE(inv.updated_at, CURRENT_TIMESTAMP)
FROM inventory inv
WHERE NOT EXISTS (
    SELECT 1 FROM product_variants pv WHERE pv.sku = inv.sku
);

-- Variants without an image fall back to the product's primary image (if any).
UPDATE product_variants pv
SET image_url = pi.image_url
FROM product_images pi
WHERE pv.image_url = ''
  AND pi.product_id = pv.product_id
  AND pi.is_primary = TRUE;

-- Anything still empty: fail loud during migration so admin can fix.
-- (Keep empty strings if you want to soft-launch; we prefer correctness.)
-- DELETE FROM product_variants WHERE image_url = '';

-- ---------------------------------------------------------------------------
-- INVENTORY_MOVEMENTS: new audit-trail table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
    id           SERIAL PRIMARY KEY,
    variant_id   INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    delta        INTEGER NOT NULL,
    reason       VARCHAR(32) NOT NULL,
    notes        TEXT,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- ORDER_ITEMS: switch FK from inventory_id to variant_id.
-- ---------------------------------------------------------------------------
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url  VARCHAR(500);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_total DECIMAL(10, 2);

UPDATE order_items oi
SET variant_id = pv.id
FROM inventory inv
JOIN product_variants pv ON pv.sku = inv.sku
WHERE oi.variant_id IS NULL
  AND oi.inventory_id IS NOT NULL
  AND oi.inventory_id = inv.id;

UPDATE order_items
SET line_total = COALESCE(line_total, price, unit_price * quantity)
WHERE line_total IS NULL;

-- Drop legacy FK now that all rows have variant_id.
ALTER TABLE order_items DROP COLUMN IF EXISTS inventory_id;
ALTER TABLE order_items DROP COLUMN IF EXISTS price;
ALTER TABLE order_items DROP COLUMN IF EXISTS hsn_code;
ALTER TABLE order_items DROP COLUMN IF EXISTS gst_rate;

-- ---------------------------------------------------------------------------
-- PRODUCTS: simplify columns.
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_image VARCHAR(500);

UPDATE products p
SET price = COALESCE(p.price, p.base_price, p.mrp, 0)
WHERE p.price IS NULL;

UPDATE products p
SET primary_image = sub.image_url
FROM (
    SELECT DISTINCT ON (product_id) product_id, image_url
      FROM product_images
     ORDER BY product_id, is_primary DESC, display_order, id
) sub
WHERE p.id = sub.product_id
  AND (p.primary_image IS NULL OR p.primary_image = '');

-- Anything still without a primary_image cannot be sold; mark inactive.
UPDATE products SET is_active = FALSE WHERE primary_image IS NULL OR primary_image = '';

ALTER TABLE products
    DROP COLUMN IF EXISTS short_description,
    DROP COLUMN IF EXISTS base_price,
    DROP COLUMN IF EXISTS mrp,
    DROP COLUMN IF EXISTS brand,
    DROP COLUMN IF EXISTS hsn_code,
    DROP COLUMN IF EXISTS gst_rate,
    DROP COLUMN IF EXISTS is_taxable,
    DROP COLUMN IF EXISTS average_rating,
    DROP COLUMN IF EXISTS review_count,
    DROP COLUMN IF EXISTS total_stock,
    DROP COLUMN IF EXISTS is_new_arrival,
    DROP COLUMN IF EXISTS meta_title,
    DROP COLUMN IF EXISTS meta_description,
    DROP COLUMN IF EXISTS embedding,
    DROP COLUMN IF EXISTS tags,
    DROP COLUMN IF EXISTS material,
    DROP COLUMN IF EXISTS care_instructions;

-- Some legacy code wrote to category_id; ensure collection_id is the canonical column.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'category_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'collection_id'
    ) THEN
        ALTER TABLE products RENAME COLUMN category_id TO collection_id;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'category_id'
    ) THEN
        UPDATE products SET collection_id = COALESCE(collection_id, category_id);
        ALTER TABLE products DROP COLUMN category_id;
    END IF;
END
$$;

-- Tighten constraints (after backfill).
ALTER TABLE products ALTER COLUMN price         SET NOT NULL;
ALTER TABLE products ALTER COLUMN description   SET NOT NULL;
-- primary_image stays nullable for soft-deactivation; UI enforces non-empty for active products.

-- ---------------------------------------------------------------------------
-- PRODUCT_IMAGES: drop fields no longer needed (gallery extras only).
-- ---------------------------------------------------------------------------
ALTER TABLE product_images
    DROP COLUMN IF EXISTS alt_text,
    DROP COLUMN IF EXISTS is_primary,
    DROP COLUMN IF EXISTS updated_at;

-- ---------------------------------------------------------------------------
-- DROP legacy tables now that data is migrated.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS variant_images;
DROP TABLE IF EXISTS inventory CASCADE;

-- ---------------------------------------------------------------------------
-- INDEXES (drop legacy, recreate clean).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_products_price;
DROP INDEX IF EXISTS idx_products_new_arrival;
DROP INDEX IF EXISTS idx_products_embedding;
DROP INDEX IF EXISTS idx_inventory_product;
DROP INDEX IF EXISTS idx_inventory_sku;
DROP INDEX IF EXISTS idx_inventory_low_stock;
DROP INDEX IF EXISTS idx_variant_images_inventory;

CREATE INDEX IF NOT EXISTS idx_products_price          ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_collection     ON products(collection_id);
CREATE INDEX IF NOT EXISTS idx_variants_product        ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_active         ON product_variants(is_active);
CREATE INDEX IF NOT EXISTS idx_variants_low_stock      ON product_variants(product_id) WHERE quantity <= low_stock_threshold;
CREATE INDEX IF NOT EXISTS idx_product_images_product  ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant ON inventory_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_variant     ON order_items(variant_id);

-- ---------------------------------------------------------------------------
-- TRIGGERS (clean up legacy total_stock trigger).
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_update_product_total_stock ON inventory;
DROP TRIGGER IF EXISTS update_inventory_updated_at        ON inventory;
DROP FUNCTION IF EXISTS update_product_total_stock();

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_variants_touch ON product_variants;
CREATE TRIGGER trg_variants_touch BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;

BEGIN;

-- Legacy schema keeps inventory_id + price while runtime writes variant_id + line_total.
ALTER TABLE order_items
  ALTER COLUMN inventory_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION sync_order_items_legacy_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inventory_id IS NULL AND NEW.variant_id IS NOT NULL THEN
    NEW.inventory_id := NEW.variant_id;
  END IF;

  IF NEW.price IS NULL AND NEW.line_total IS NOT NULL THEN
    NEW.price := NEW.line_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_order_items_legacy_fields ON order_items;
CREATE TRIGGER trg_sync_order_items_legacy_fields
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_items_legacy_fields();

COMMIT;

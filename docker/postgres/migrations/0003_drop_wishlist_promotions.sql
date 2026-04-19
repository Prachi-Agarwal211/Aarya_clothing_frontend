-- 0003_drop_wishlist_promotions.sql
--
-- Wishlist, promotions and coupons are out of scope for the Aarya Clothing
-- production build. Drop the tables, supporting types, indexes, triggers and
-- the orders.discount_applied / orders.promo_code columns.
--
-- Order matters: drop dependent tables first.

BEGIN;

DROP TRIGGER IF EXISTS trg_promotions_touch ON promotions;

DROP TABLE IF EXISTS promotion_usage CASCADE;
DROP TABLE IF EXISTS promotions      CASCADE;
DROP TABLE IF EXISTS wishlist        CASCADE;

DROP TYPE IF EXISTS discount_type;

ALTER TABLE orders DROP COLUMN IF EXISTS discount_applied;
ALTER TABLE orders DROP COLUMN IF EXISTS promo_code;

ALTER TABLE pending_orders DROP COLUMN IF EXISTS discount_applied;
ALTER TABLE pending_orders DROP COLUMN IF EXISTS promo_code;

COMMIT;

-- Applied after init.sql on fresh databases. Existing DBs: run manually if needed.
-- Composite / partial indexes for common hot paths (additive only).

-- Orders: profile orders sorted by date (most common customer query)
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- Orders: admin dashboard status counts
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Variants: quickly find items with reservations.
-- (The legacy `inventory` table was renamed to `product_variants` — this used
-- to reference `inventory.reserved_quantity` which no longer exists, so the
-- index would fail to create on a fresh DB.)
CREATE INDEX IF NOT EXISTS idx_variants_reserved_positive ON product_variants(reserved_quantity)
  WHERE reserved_quantity > 0;

-- Stock reservations: fast expiry sweep for the cron worker (Phase 4)
CREATE INDEX IF NOT EXISTS idx_stock_reservations_pending_expires
  ON stock_reservations(expires_at)
  WHERE status = 'pending';

-- Payment transactions: user payment history
CREATE INDEX IF NOT EXISTS idx_payment_user_created ON payment_transactions(user_id, created_at DESC);

-- Payment transactions: monitoring + recovery queries by status
CREATE INDEX IF NOT EXISTS idx_payment_status_created ON payment_transactions(status, created_at DESC);

-- Payment transactions: webhook lookup by razorpay_order_id (already indexed but ensure composite exists)
CREATE INDEX IF NOT EXISTS idx_payment_razorpay_order_status ON payment_transactions(razorpay_order_id, status)
  WHERE razorpay_order_id IS NOT NULL;

-- Products: active products by created_at (homepage/new arrivals)
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at DESC)
  WHERE is_active = true;

-- Product images: primary image lookup
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(product_id, is_primary DESC)
  WHERE is_primary = true;

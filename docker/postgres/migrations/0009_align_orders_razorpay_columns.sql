BEGIN;

-- Keep runtime model fields in sync with legacy databases.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS courier_tracking_url VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON orders (razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id
  ON orders (razorpay_payment_id);

COMMIT;

-- 0004_align_auth_core_schema.sql
-- Aligns runtime DB schema with current core auth models.
-- Safe/idempotent for existing environments.

BEGIN;

-- ---------------------------------------------------------------------------
-- users: columns expected by core + commerce user models
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(101),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NULL;

-- ---------------------------------------------------------------------------
-- orders: consolidated model expects order_number
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

UPDATE orders
SET order_number = COALESCE(order_number, invoice_number, CONCAT('ORD-', id::text))
WHERE order_number IS NULL;

-- ---------------------------------------------------------------------------
-- verification_tokens: expected by OTP service
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(6) NOT NULL,
  token_type VARCHAR(50) NOT NULL,
  delivery_method VARCHAR(20),
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_type
  ON verification_tokens (user_id, token_type, verified_at);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at
  ON verification_tokens (expires_at);

COMMIT;

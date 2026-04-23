-- 0006_seed_privileged_accounts.sql
-- Enforce canonical privileged accounts for local/dev environments.
-- Requested contract:
--   - super_admin / admin123  -> role super_admin
--   - admin       / admin123  -> role admin
-- Idempotent and safe to rerun.

BEGIN;

-- bcrypt hash for "admin123"
-- Generated with cost factor 12.
-- NOTE: reused for deterministic local bootstrap accounts.
DO $$
DECLARE
  v_hash TEXT := '$2b$12$1jw6vTostduYzRG5u/ry..LlgJrs9W/LAYdV763lPwE4ERzJ6JxO.';
BEGIN
  -- Ensure admin account exists and has admin role.
  UPDATE users
  SET
    role = 'admin',
    hashed_password = v_hash,
    is_active = TRUE,
    email_verified = TRUE,
    updated_at = CURRENT_TIMESTAMP
  WHERE username = 'admin';

  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
    INSERT INTO users (email, username, hashed_password, role, is_active, email_verified, phone, first_name, last_name)
    VALUES ('admin@aarya.com', 'admin', v_hash, 'admin', TRUE, TRUE, '9999999999', 'System', 'Admin');
  END IF;

  -- Ensure super_admin account exists and has super_admin role.
  UPDATE users
  SET
    role = 'super_admin',
    hashed_password = v_hash,
    is_active = TRUE,
    email_verified = TRUE,
    updated_at = CURRENT_TIMESTAMP
  WHERE username = 'super_admin';

  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'super_admin') THEN
    INSERT INTO users (email, username, hashed_password, role, is_active, email_verified, phone, first_name, last_name)
    VALUES ('super_admin@aarya.com', 'super_admin', v_hash, 'super_admin', TRUE, TRUE, '9999999998', 'System', 'Super Admin');
  END IF;
END $$;

COMMIT;

-- Phase 1: device-trust groundwork + IST persistence.
-- Apply on existing DBs that were initialised before init.sql added trusted_devices.
-- Idempotent: safe to re-run.

-- Persist IST so func.now() / NOW() defaults are IST on every connection.
ALTER DATABASE aarya_clothing SET timezone TO 'Asia/Kolkata';

CREATE TABLE IF NOT EXISTS trusted_devices (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fingerprint   VARCHAR(128) NOT NULL,
    device_name   VARCHAR(120),
    last_ip       VARCHAR(64),
    user_agent    VARCHAR(512),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at    TIMESTAMP,
    UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fp   ON trusted_devices(fingerprint);

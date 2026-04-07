-- Migration: Add color_hex column to inventory table
-- Date: 2026-04-05
-- Purpose: Support paint-style color picker (commit 88c81724)
-- Note: init.sql already includes this column for fresh installs

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);

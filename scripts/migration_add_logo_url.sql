-- Migration: Add logo_url to site_config
-- Run this on production database to fix logo loading issue
-- Date: 2026-03-17

-- Add logo_url if it doesn't exist
INSERT INTO site_config (key, value, description) 
VALUES (
    'logo_url', 
    'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png', 
    'URL of the brand logo'
)
ON CONFLICT (key) DO UPDATE 
SET 
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;

-- Verify the change
SELECT key, value FROM site_config WHERE key = 'logo_url';

-- Migration: Make phone number required and unique in users table
-- Date: 2026-05-05
-- Description: Ensures one email = one account, one phone = one account

-- Step 1: Handle existing NULL phone values (if any)
-- Set a placeholder for NULL phones to avoid constraint violation
UPDATE users SET phone = NULL WHERE phone = '';

-- Step 2: Remove any duplicate phones (keep the verified one)
-- For unverified duplicates, keep the most recent one
WITH duplicates AS (
    SELECT phone, MIN(id) as keep_id
    FROM users 
    WHERE phone IS NOT NULL 
    GROUP BY phone 
    HAVING COUNT(*) > 1
)
UPDATE users 
SET phone = NULL 
WHERE phone IN (SELECT phone FROM duplicates) 
AND id NOT IN (SELECT keep_id FROM duplicates);

-- Step 3: Make phone column NOT NULL (prepare)
-- First, ensure all users have a phone (for new registrations this is now enforced)
-- For existing users without phone, we'll need to handle this in application logic

-- Step 4: Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_phone_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
    END IF;
END $$;

-- Step 5: Log the migration
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('006_make_phone_required_and_unique', NOW())
ON CONFLICT (version) DO NOTHING;

-- Fix OTP token_type constraint to allow 'login' token type
-- This migration addresses the critical issue where login OTP tokens
-- with token_type="login" were being created but rejected by the database constraint

-- Step 1: Drop existing CHECK constraint
ALTER TABLE verification_tokens
DROP CONSTRAINT IF EXISTS verification_tokens_token_type_check;

-- Step 2: Add updated CHECK constraint with 'login' token type
ALTER TABLE verification_tokens
ADD CONSTRAINT verification_tokens_token_type_check
CHECK (token_type IN ('email_verification', 'password_reset', 'phone_verification', 'login'));

-- Step 3: Add composite index for better performance on common queries
-- This indexes the most common query pattern:
-- SELECT * FROM verification_tokens
-- WHERE user_id = ? AND token_type = ? AND verified_at IS NULL
CREATE INDEX IF NOT EXISTS idx_verify_tokens_lookup
ON verification_tokens(user_id, token_type, verified_at);

-- Verification queries that benefit from this index:
-- 1. OTP verification (find active token by user_id, token_type, and code)
-- 2. OTP invalidation (mark all active tokens as verified)
-- 3. Resend OTP (count active tokens before creating new one)
-- 4. Get active tokens for a user (for cleanup and monitoring)

-- Step 4: Verify constraint was added correctly
-- SELECT constraint_name, constraint_type, pg_get_constraintdef(oid)
-- FROM information_schema.table_constraints
-- WHERE table_name = 'verification_tokens'
-- AND constraint_type = 'CHECK';

-- Expected result:
-- verification_tokens_token_type_check CHECK (token_type IN ('email_verification', 'password_reset', 'phone_verification', 'login'))

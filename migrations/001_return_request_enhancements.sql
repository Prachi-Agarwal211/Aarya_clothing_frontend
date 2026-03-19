-- ============================================
-- Migration: Return Request Enhancements
-- Migration ID: 001
-- Date: 2026-03-18
-- Author: QA Engineering
-- ============================================
-- 
-- PURPOSE:
-- Add support for enhanced return/exchange requests including:
-- - Return type (return vs exchange)
-- - Multiple return items with details
-- - Video upload for defect proof
-- - Exchange preferences
--
-- IMPACT:
-- - Modifies: return_requests table
-- - Adds: 4 new columns
-- - Adds: 2 new indexes
-- - Breaking: No (all new columns have defaults)
--
-- PREREQUISITES:
-- - PostgreSQL 13+
-- - pgvector extension (already installed)
-- - Backup completed
--
-- ROLLBACK:
-- See rollback section at end of file
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Create return_type ENUM
-- ============================================
-- This enum distinguishes between returns (refund) and exchanges

DO $$ BEGIN
    CREATE TYPE return_type AS ENUM ('return', 'exchange');
EXCEPTION 
    WHEN duplicate_object THEN 
        RAISE NOTICE 'return_type enum already exists, skipping';
END $$;

-- Verify enum was created
DO $$
DECLARE
    enum_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'return_type'
    ) INTO enum_exists;
    
    IF NOT enum_exists THEN
        RAISE EXCEPTION 'Failed to create return_type enum';
    END IF;
END $$;


-- ============================================
-- STEP 2: Add New Columns to return_requests
-- ============================================

-- 2.1: Return type (return or exchange)
ALTER TABLE return_requests 
    ADD COLUMN IF NOT EXISTS type return_type DEFAULT 'return';

-- 2.2: Return items as JSONB array
-- Format: [{item_id: number, quantity: number, reason: string}, ...]
ALTER TABLE return_requests 
    ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2.3: Video URL (Cloudflare R2 storage)
ALTER TABLE return_requests 
    ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 2.4: Exchange preference (customer's preference for exchange)
ALTER TABLE return_requests 
    ADD COLUMN IF NOT EXISTS exchange_preference VARCHAR(255);


-- ============================================
-- STEP 3: Add Indexes for Performance
-- ============================================

-- 3.1: Index on return type for filtering
CREATE INDEX IF NOT EXISTS idx_return_requests_type 
    ON return_requests(type);

-- 3.2: Partial index on video_url for admin review
-- Only indexes rows that have videos (most efficient)
CREATE INDEX IF NOT EXISTS idx_return_requests_video 
    ON return_requests(video_url) 
    WHERE video_url IS NOT NULL;


-- ============================================
-- STEP 4: Add Documentation Comments
-- ============================================

COMMENT ON COLUMN return_requests.type IS 
    'Type of request: return for refund or exchange for different item';

COMMENT ON COLUMN return_requests.items IS 
    'JSON array of return items: [{item_id, quantity, reason, ...}, ...]';

COMMENT ON COLUMN return_requests.video_url IS 
    'Cloudflare R2 URL for unboxing/defect video proof';

COMMENT ON COLUMN return_requests.exchange_preference IS 
    'Customer preference for exchange (e.g., "Exchange for size L", "Different color: blue")';


-- ============================================
-- STEP 5: Verification Queries
-- ============================================
-- Run these to verify migration succeeded

DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'return_requests'
      AND column_name IN ('type', 'items', 'video_url', 'exchange_preference');
    
    IF col_count != 4 THEN
        RAISE EXCEPTION 'Migration failed: expected 4 new columns, found %', col_count;
    END IF;
    
    RAISE NOTICE 'Migration verification passed: all 4 columns added successfully';
END $$;


-- ============================================
-- OPTIONAL: Update Existing Records
-- ============================================
-- If you have existing return requests, you may want to set default values

-- Set all existing returns to type 'return' (most common case)
UPDATE return_requests 
SET type = 'return' 
WHERE type IS NULL;

-- Note: items, video_url, and exchange_preference will remain NULL/empty
-- as they are new features not applicable to historical data


-- ============================================
-- ROLLBACK SCRIPT (DO NOT RUN UNLESS NEEDED)
-- ============================================
-- Uncomment and run this section to rollback the migration
-- WARNING: This will permanently delete all video URLs and exchange preferences
--
-- ROLLBACK SECTION:
/*
BEGIN;

-- Drop indexes
DROP INDEX IF EXISTS idx_return_requests_type;
DROP INDEX IF EXISTS idx_return_requests_video;

-- Drop columns
ALTER TABLE return_requests 
    DROP COLUMN IF EXISTS type,
    DROP COLUMN IF EXISTS items,
    DROP COLUMN IF EXISTS video_url,
    DROP COLUMN IF EXISTS exchange_preference;

-- Drop enum (only if no other tables use it)
DROP TYPE IF EXISTS return_type;

COMMIT;
*/


-- ============================================
-- COMMIT MIGRATION
-- ============================================

COMMIT;


-- ============================================
-- POST-MIGRATION VERIFICATION
-- ============================================
-- Run these queries after migration to verify success:

-- 1. Check column count
-- SELECT COUNT(*) FROM information_schema.columns 
-- WHERE table_name = 'return_requests';

-- 2. Check new columns exist
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'return_requests'
--   AND column_name IN ('type', 'items', 'video_url', 'exchange_preference');

-- 3. Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'return_requests'
--   AND indexname LIKE 'idx_return_requests%';

-- 4. Test insert with new fields
-- INSERT INTO return_requests (order_id, user_id, reason, type, items, video_url, exchange_preference)
-- VALUES (1, 1, 'defective', 'exchange', '[{"item_id": 1, "quantity": 1}]', 'https://example.com/video.mp4', 'Size L, blue color')
-- RETURNING id, type, items, video_url, exchange_preference;

-- Aarya Clothing - Database Indexes Migration
-- Adds missing indexes for improved authentication and query performance
-- Run: psql -U postgres -d aarya_clothing -f docker/postgres/add_indexes.sql

-- ============================================
-- AUTHENTICATION INDEXES
-- ============================================

-- Index on email_verified for login queries (filters unverified users)
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Index on is_active for login queries (filters inactive accounts)
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Composite index for common login query pattern (active + verified)
CREATE INDEX IF NOT EXISTS idx_users_active_verified ON users(is_active, email_verified);

-- ============================================
-- ROLE-BASED ACCESS INDEXES
-- ============================================

-- Index on role for admin dashboard queries (filter by role)
-- Note: Already exists from init.sql, but ensuring it's present
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- ADMIN DASHBOARD QUERY INDEXES
-- ============================================

-- Index for customer count queries
CREATE INDEX IF NOT EXISTS idx_users_role_customer ON users(role) WHERE role = 'customer';

-- Index for admin/staff count queries
CREATE INDEX IF NOT EXISTS idx_users_role_admin ON users(role) WHERE role IN ('admin', 'super_admin');

-- ============================================
-- USER PROFILES INDEXES
-- ============================================

-- Index on phone for login by phone number
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);

-- ============================================
-- USER SECURITY INDEXES
-- ============================================

-- Index for account lockout checks
CREATE INDEX IF NOT EXISTS idx_user_security_locked ON user_security(locked_until) WHERE locked_until IS NOT NULL;

-- ============================================
-- EMAIL VERIFICATIONS INDEXES
-- ============================================

-- Partial index for unverified tokens (most common query)
CREATE INDEX IF NOT EXISTS idx_email_verifications_unverified ON email_verifications(verified_at) WHERE verified_at IS NULL;

-- ============================================
-- OTP INDEXES
-- ============================================

-- Partial index for unused OTPs (active verifications)
CREATE INDEX IF NOT EXISTS idx_otps_unused ON otps(is_used) WHERE NOT is_used;

-- Index for OTP verification by code and type
CREATE INDEX IF NOT EXISTS idx_otps_code_type ON otps(otp_code, otp_type);

-- ============================================
-- PERFORMANCE MONITORING
-- ============================================

-- Analyze tables to update query planner statistics
ANALYZE users;
ANALYZE user_profiles;
ANALYZE user_security;
ANALYZE email_verifications;
ANALYZE otps;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify indexes were created:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users' ORDER BY indexname;

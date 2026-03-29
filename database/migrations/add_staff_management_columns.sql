-- Migration: Add staff management columns to users table
-- Required for staff account management endpoints

-- Add full_name column to users table (staff don't have user_profiles)
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);

-- Add phone column directly on users (for staff — not relying on user_profiles)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Add department column for staff organization
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Add custom_role_id for granular permission overrides
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role_id INTEGER REFERENCES custom_roles(id) ON DELETE SET NULL;

-- Add last_login tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Add password_hash alias column name support (some queries use password_hash, others use hashed_password)
-- We use hashed_password as the canonical name - no column change needed, queries must use hashed_password

-- Create custom_roles table if not exists (in case init_db hasn't run yet)
CREATE TABLE IF NOT EXISTS custom_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_active ON custom_roles(is_active);

-- Create staff_audit_logs table if not exists
CREATE TABLE IF NOT EXISTS staff_audit_logs (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_staff_action ON staff_audit_logs(staff_id, action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON staff_audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON staff_audit_logs(created_at);

-- Create staff_2fa table if not exists
CREATE TABLE IF NOT EXISTS staff_2fa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    secret VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    backup_codes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP
);

-- Create staff_sessions table if not exists
CREATE TABLE IF NOT EXISTS staff_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_user_active ON staff_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_expires ON staff_sessions(expires_at);

-- Create staff_tasks table if not exists
CREATE TABLE IF NOT EXISTS staff_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned ON staff_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_status ON staff_tasks(status);

-- Create ai_pending_actions table if not exists
CREATE TABLE IF NOT EXISTS ai_pending_actions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    params JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_by_ai BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    executed_at TIMESTAMP,
    rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_status ON ai_pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_session ON ai_pending_actions(session_id);

-- Create permission_presets table if not exists
CREATE TABLE IF NOT EXISTS permission_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create staff_ip_restrictions table if not exists
CREATE TABLE IF NOT EXISTS staff_ip_restrictions (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_addresses TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create staff_time_access table if not exists
CREATE TABLE IF NOT EXISTS staff_time_access (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    days_of_week INTEGER[] NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

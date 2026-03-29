-- ============================================
-- Staff Permissions & AI Dashboard Migration
-- Aarya Clothing Platform
-- Date: March 16, 2026
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Custom Roles Table
-- ============================================
CREATE TABLE IF NOT EXISTS custom_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSON DEFAULT '[]'::json,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for custom_roles
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_active ON custom_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_roles_created_by ON custom_roles(created_by);

-- Add custom_role_id to users table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'custom_role_id'
    ) THEN
        ALTER TABLE users ADD COLUMN custom_role_id INTEGER REFERENCES custom_roles(id) ON DELETE SET NULL;
        CREATE INDEX idx_users_custom_role_id ON users(custom_role_id);
    END IF;
END $$;

-- ============================================
-- 2. Permission Presets Table
-- ============================================
CREATE TABLE IF NOT EXISTS permission_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default permission presets
INSERT INTO permission_presets (name, description, permissions) VALUES
('staff', 'Default staff permissions - view access for most modules', 
 '[{"module": "products", "actions": ["view"]}, 
   {"module": "orders", "actions": ["view", "edit"]}, 
   {"module": "customers", "actions": ["view"]}, 
   {"module": "inventory", "actions": ["view"]}, 
   {"module": "analytics", "actions": ["view"]}]'::json),
('admin', 'Admin permissions - full access except super admin features', 
 '[{"module": "products", "actions": ["view", "create", "edit", "delete", "bulk_operations"]}, 
   {"module": "orders", "actions": ["view", "create", "edit", "delete", "bulk_operations", "approve"]}, 
   {"module": "customers", "actions": ["view", "create", "edit", "delete"]}, 
   {"module": "inventory", "actions": ["view", "create", "edit", "delete", "bulk_operations"]}, 
   {"module": "analytics", "actions": ["view", "export"]}, 
   {"module": "staff", "actions": ["view", "create", "edit"]}, 
   {"module": "settings", "actions": ["view", "edit"]}]'::json)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. Staff IP Restrictions Table
-- ============================================
CREATE TABLE IF NOT EXISTS staff_ip_restrictions (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    ip_addresses VARCHAR[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_ip_restrictions_staff_id ON staff_ip_restrictions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_ip_restrictions_active ON staff_ip_restrictions(is_active);

-- ============================================
-- 4. Staff Time-Based Access Table
-- ============================================
CREATE TABLE IF NOT EXISTS staff_time_access (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    days_of_week INTEGER[] NOT NULL,  -- 0=Monday, 6=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_time_access_staff_id ON staff_time_access(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_time_access_active ON staff_time_access(is_active);

-- ============================================
-- 5. Staff Two-Factor Authentication Table
-- ============================================
CREATE TABLE IF NOT EXISTS staff_2fa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    secret VARCHAR(255) NOT NULL,  -- Encrypted TOTP secret
    enabled BOOLEAN DEFAULT FALSE,
    backup_codes JSON,  -- Encrypted backup codes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_2fa_user_id ON staff_2fa(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_2fa_enabled ON staff_2fa(enabled);

-- ============================================
-- 6. Staff Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS staff_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token_hash VARCHAR(255) NOT NULL,  -- Hashed JWT token
    ip_address VARCHAR(45),  -- IPv6 compatible
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_sessions_token_hash ON staff_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_user_id ON staff_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_user_active ON staff_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_expires ON staff_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_active ON staff_sessions(is_active);

-- ============================================
-- 7. Staff Audit Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS staff_audit_logs (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    action_type VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE, VIEW, EXPORT, LOGIN, LOGOUT
    module VARCHAR(50) NOT NULL,  -- products, orders, customers, etc.
    description TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,  -- Additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_staff_id ON staff_audit_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_action_type ON staff_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_module ON staff_audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_created_at ON staff_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_staff_action ON staff_audit_logs(staff_id, action_type);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_staff_module ON staff_audit_logs(staff_id, module);

-- ============================================
-- 8. Staff Tasks Table
-- ============================================
CREATE TABLE IF NOT EXISTS staff_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, in_progress, completed, cancelled
    priority VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, urgent
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,  -- Completion notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned_to ON staff_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned_by ON staff_tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_status ON staff_tasks(status);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_priority ON staff_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_due_date ON staff_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned_status ON staff_tasks(assigned_to, status);

-- ============================================
-- 9. AI Pending Actions Table
-- ============================================
CREATE TABLE IF NOT EXISTS ai_pending_actions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,  -- ship_order, adjust_inventory, update_price, etc.
    params JSON NOT NULL,  -- Action parameters
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, executed
    created_by_ai BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_session_id ON ai_pending_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_status ON ai_pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_reviewed_by ON ai_pending_actions(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_created_at ON ai_pending_actions(created_at);

-- ============================================
-- 10. Add department to users table (if not exists)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'department'
    ) THEN
        ALTER TABLE users ADD COLUMN department VARCHAR(100);
    END IF;
END $$;

-- ============================================
-- 11. Add last_login to users table (if not exists)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login'
    ) THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ============================================
-- 12. Create helper function for updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to custom_roles
DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON custom_roles;
CREATE TRIGGER update_custom_roles_updated_at
    BEFORE UPDATE ON custom_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to staff_tasks
DROP TRIGGER IF EXISTS update_staff_tasks_updated_at ON staff_tasks;
CREATE TRIGGER update_staff_tasks_updated_at
    BEFORE UPDATE ON staff_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 13. Create view for audit logs with staff details
-- ============================================
CREATE OR REPLACE VIEW audit_logs_with_staff AS
SELECT 
    al.id,
    al.staff_id,
    u.email AS staff_email,
    u.username AS staff_username,
    u.full_name AS staff_name,
    u.role AS staff_role,
    al.action_type,
    al.module,
    al.description,
    al.ip_address,
    al.user_agent,
    al.metadata,
    al.created_at
FROM staff_audit_logs al
LEFT JOIN users u ON al.staff_id = u.id
ORDER BY al.created_at DESC;

-- ============================================
-- 14. Create view for staff dashboard stats
-- ============================================
CREATE OR REPLACE VIEW staff_dashboard_stats AS
SELECT 
    u.id AS staff_id,
    u.email,
    u.full_name,
    u.role,
    u.department,
    u.is_active,
    -- Task stats
    (SELECT COUNT(*) FROM staff_tasks WHERE assigned_to = u.id AND status = 'pending') AS pending_tasks,
    (SELECT COUNT(*) FROM staff_tasks WHERE assigned_to = u.id AND status = 'completed' AND DATE(completed_at) = CURRENT_DATE) AS completed_tasks_today,
    (SELECT COUNT(*) FROM staff_tasks WHERE assigned_to = u.id AND status IN ('pending', 'in_progress') AND due_date < NOW()) AS overdue_tasks,
    -- Order stats
    (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND status NOT IN ('cancelled', 'pending')) AS orders_processed_today,
    -- Session stats
    (SELECT COUNT(*) FROM staff_sessions WHERE user_id = u.id AND is_active = TRUE AND expires_at > NOW()) AS active_sessions,
    -- Last login
    u.last_login,
    -- 2FA status
    COALESCE(two.enabled, FALSE) AS two_factor_enabled
FROM users u
LEFT JOIN staff_2fa two ON u.id = two.user_id
WHERE u.role IN ('admin', 'staff', 'super_admin');

-- ============================================
-- 15. Create view for staff accounts with permissions
-- ============================================
CREATE OR REPLACE VIEW staff_accounts_with_roles AS
SELECT 
    u.id,
    u.email,
    u.username,
    u.full_name,
    u.role,
    u.custom_role_id,
    cr.name AS custom_role_name,
    cr.permissions AS custom_permissions,
    u.phone,
    u.department,
    u.is_active,
    u.created_at,
    u.last_login,
    COALESCE(two.enabled, FALSE) AS two_factor_enabled,
    (SELECT COUNT(*) FROM staff_sessions WHERE user_id = u.id AND is_active = TRUE) AS active_session_count
FROM users u
LEFT JOIN custom_roles cr ON u.custom_role_id = cr.id
LEFT JOIN staff_2fa two ON u.id = two.user_id
WHERE u.role IN ('admin', 'staff', 'super_admin')
ORDER BY u.created_at DESC;

-- ============================================
-- 16. Grant permissions (adjust as needed)
-- ============================================
-- Note: Adjust role names based on your database setup
DO $$
BEGIN
    -- Grant access to application user
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarya_user') THEN
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aarya_user;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aarya_user;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO aarya_user;
    END IF;
END $$;

-- ============================================
-- 17. Insert sample custom roles (optional)
-- ============================================
INSERT INTO custom_roles (name, description, permissions, created_by) VALUES
('Inventory Manager', 'Full access to inventory and products, view-only for orders', 
 '[{"module": "products", "actions": ["view", "create", "edit"]}, 
   {"module": "inventory", "actions": ["view", "create", "edit", "delete", "bulk_operations"]}, 
   {"module": "orders", "actions": ["view"]}, 
   {"module": "analytics", "actions": ["view"]}]'::json,
 NULL),
('Order Processor', 'Full access to orders, view-only for customers and inventory', 
 '[{"module": "orders", "actions": ["view", "create", "edit", "approve"]}, 
   {"module": "customers", "actions": ["view"]}, 
   {"module": "inventory", "actions": ["view"]}, 
   {"module": "analytics", "actions": ["view"]}]'::json,
 NULL),
('Customer Support', 'Access to customers, orders, and chat', 
 '[{"module": "customers", "actions": ["view", "edit"]}, 
   {"module": "orders", "actions": ["view", "edit"]}, 
   {"module": "chat", "actions": ["view", "create", "edit"]}, 
   {"module": "returns", "actions": ["view", "edit"]}]'::json,
 NULL)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Migration Complete
-- ============================================

-- Verification queries
-- Run these to verify the migration was successful:

-- SELECT COUNT(*) FROM custom_roles;
-- SELECT COUNT(*) FROM permission_presets;
-- SELECT COUNT(*) FROM staff_audit_logs;
-- SELECT COUNT(*) FROM staff_tasks;
-- SELECT COUNT(*) FROM ai_pending_actions;

-- View all new tables:
-- \dt staff_*
-- \dt custom_roles
-- \dt permission_presets
-- \dt ai_pending_actions

-- View all new views:
-- \dv *staff*
-- \dv *audit*

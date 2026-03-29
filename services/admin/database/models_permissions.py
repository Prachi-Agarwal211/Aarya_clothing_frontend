"""Database models for Staff Account Management and Granular Permissions."""
from datetime import datetime, time
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Time, ARRAY, JSON, Index
from sqlalchemy.orm import declarative_base  # noqa: relationship removed (cross-Base refs)

Base = declarative_base()


# ==================== Custom Roles & Permissions ====================

class CustomRole(Base):
    """Custom roles with granular permissions."""
    __tablename__ = 'custom_roles'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(Text)
    permissions = Column(JSON, default=list)  # List of {module, actions}
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer)
    
    __table_args__ = (
        Index('idx_custom_roles_active', 'is_active'),
    )


class PermissionPreset(Base):
    """Pre-defined permission presets for common roles."""
    __tablename__ = 'permission_presets'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)  # e.g., 'inventory_manager', 'order_processor'
    description = Column(Text)
    permissions = Column(JSON, nullable=False)  # List of {module, actions}
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ==================== Staff Access Control ====================

class IPRestriction(Base):
    """IP address restrictions for staff accounts."""
    __tablename__ = 'staff_ip_restrictions'
    
    id = Column(Integer, primary_key=True)
    staff_id = Column(Integer, nullable=False)
    ip_addresses = Column(ARRAY(String), nullable=False)  # List of IP addresses/CIDR
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    

class TimeBasedAccess(Base):
    """Time-based access restrictions for staff accounts."""
    __tablename__ = 'staff_time_access'
    
    id = Column(Integer, primary_key=True)
    staff_id = Column(Integer, nullable=False)
    days_of_week = Column(ARRAY(Integer), nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    timezone = Column(String(50), default='Asia/Kolkata')
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    

class TwoFactorAuth(Base):
    """Two-factor authentication configuration for staff."""
    __tablename__ = 'staff_2fa'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, unique=True, nullable=False)
    secret = Column(String(255), nullable=False)  # Encrypted TOTP secret
    enabled = Column(Boolean, default=False)
    backup_codes = Column(JSON)  # Encrypted backup codes
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime)
    

class StaffSession(Base):
    """Active staff sessions for session management."""
    __tablename__ = 'staff_sessions'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)  # Hashed JWT token
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_activity = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    __table_args__ = (
        Index('idx_staff_sessions_expires', 'expires_at'),
    )


# ==================== Audit Logging ====================

class AuditLog(Base):
    """Audit log for all staff actions."""
    __tablename__ = 'staff_audit_logs'
    
    id = Column(Integer, primary_key=True)
    staff_id = Column(Integer, nullable=False)
    action_type = Column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, VIEW, EXPORT, LOGIN, LOGOUT
    module = Column(String(50), nullable=False)  # products, orders, customers, etc.
    description = Column(Text, nullable=False)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    extra_data = Column(JSON)  # Additional context (e.g., affected record IDs)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index('idx_audit_logs_staff_action', 'staff_id', 'action_type'),
        Index('idx_audit_logs_module', 'module'),
        Index('idx_audit_logs_created', 'created_at'),
    )


# ==================== Task Management ====================

class StaffTask(Base):
    """Tasks assigned to staff members."""
    __tablename__ = 'staff_tasks'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    assigned_to = Column(Integer, nullable=False)
    assigned_by = Column(Integer, nullable=False)
    status = Column(String(20), default='pending')  # pending, in_progress, completed, cancelled
    priority = Column(String(20), default='medium')  # low, medium, high, urgent
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    notes = Column(Text)  # Completion notes
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_staff_tasks_assigned', 'assigned_to'),
        Index('idx_staff_tasks_status', 'status'),
        Index('idx_staff_tasks_due', 'due_date'),
    )


# ==================== AI Dashboard Pending Actions ====================

class AIPendingAction(Base):
    """Pending actions created by AI for admin confirmation."""
    __tablename__ = 'ai_pending_actions'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String(255), nullable=False)
    action_type = Column(String(50), nullable=False)  # ship_order, adjust_inventory, update_price, etc.
    params = Column(JSON, nullable=False)  # Action parameters
    status = Column(String(20), default='pending')  # pending, approved, rejected, executed
    created_by_ai = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)
    reviewed_by = Column(Integer)
    executed_at = Column(DateTime)
    rejection_reason = Column(Text)
    
    __table_args__ = (
        Index('idx_ai_pending_actions_status', 'status'),
        Index('idx_ai_pending_actions_session', 'session_id'),
    )

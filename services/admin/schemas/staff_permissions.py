"""Schemas for Staff Account Management and Granular Permissions."""
from datetime import datetime, time
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any, Set
from enum import Enum


# ==================== Permission System ====================

class PermissionModule(str, Enum):
    """Available modules for permission control."""
    PRODUCTS = "products"
    ORDERS = "orders"
    CUSTOMERS = "customers"
    INVENTORY = "inventory"
    ANALYTICS = "analytics"
    STAFF = "staff"
    SETTINGS = "settings"
    LANDING = "landing"
    COLLECTIONS = "collections"
    CHAT = "chat"
    RETURNS = "returns"
    AI_DASHBOARD = "ai_dashboard"
    AI_MONITORING = "ai_monitoring"
    AI_SETTINGS = "ai_settings"


class PermissionAction(str, Enum):
    """Available actions for each module."""
    VIEW = "view"
    CREATE = "create"
    EDIT = "edit"
    DELETE = "delete"
    EXPORT = "export"
    BULK_OPERATIONS = "bulk_operations"
    APPROVE = "approve"  # For AI actions, returns, etc.


class PermissionGrant(BaseModel):
    """A single permission grant for a module."""
    module: PermissionModule
    actions: Set[PermissionAction] = Field(default_factory=set)
    
    class Config:
        use_enum_values = True


class CustomRoleCreate(BaseModel):
    """Create a new custom role with granular permissions."""
    name: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    permissions: List[PermissionGrant] = Field(default_factory=list)
    is_active: bool = True


class CustomRoleUpdate(BaseModel):
    """Update an existing custom role."""
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = None
    permissions: Optional[List[PermissionGrant]] = None
    is_active: Optional[bool] = None


class CustomRoleResponse(BaseModel):
    """Custom role with permissions."""
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[Dict[str, Any]] = []
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    
    class Config:
        from_attributes = True


# ==================== Staff Account Management ====================

class StaffAccountCreate(BaseModel):
    """Create a new staff account."""
    email: str = Field(..., email=True)
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8)
    role: str = Field(..., pattern="^(admin|staff|super_admin)$")
    custom_role_id: Optional[int] = None  # If using custom role
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class StaffAccountUpdate(BaseModel):
    """Update staff account details."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    custom_role_id: Optional[int] = None
    is_active: Optional[bool] = None


class StaffAccountResponse(BaseModel):
    """Staff account with role and permissions."""
    id: int
    email: str
    username: str
    full_name: str
    role: str
    custom_role_id: Optional[int] = None
    custom_role_name: Optional[str] = None
    permissions: List[Dict[str, Any]] = []
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: bool
    two_factor_enabled: bool = False
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by: Optional[int] = None
    
    class Config:
        from_attributes = True


# ==================== Access Control ====================

class IPRestrictionCreate(BaseModel):
    """Create IP restriction for staff account."""
    staff_id: int
    ip_addresses: List[str] = Field(..., min_length=1)
    description: Optional[str] = None
    is_active: bool = True


class IPRestrictionResponse(BaseModel):
    """IP restriction details."""
    id: int
    staff_id: int
    ip_addresses: List[str]
    description: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TimeBasedAccessCreate(BaseModel):
    """Create time-based access restriction."""
    staff_id: int
    days_of_week: List[int] = Field(..., description="0=Monday, 6=Sunday")
    start_time: time
    end_time: time
    timezone: str = "Asia/Kolkata"
    description: Optional[str] = None
    is_active: bool = True


class TimeBasedAccessResponse(BaseModel):
    """Time-based access restriction details."""
    id: int
    staff_id: int
    days_of_week: List[int]
    start_time: time
    end_time: time
    timezone: str
    description: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TwoFactorAuthSetup(BaseModel):
    """Setup 2FA for staff account."""
    staff_id: int
    enable: bool = True


class TwoFactorAuthVerify(BaseModel):
    """Verify 2FA code."""
    staff_id: int
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorAuthResponse(BaseModel):
    """2FA setup response with QR code."""
    staff_id: int
    enabled: bool
    qr_code_url: Optional[str] = None
    secret: Optional[str] = None
    backup_codes: Optional[List[str]] = None


class SessionManagementResponse(BaseModel):
    """Active session details."""
    id: int
    user_id: int
    token_hash: str
    ip_address: str
    user_agent: str
    created_at: datetime
    expires_at: datetime
    last_activity: datetime
    is_active: bool


# ==================== Audit Logging ====================

class AuditLogFilter(BaseModel):
    """Filter options for audit log queries."""
    staff_id: Optional[int] = None
    action_type: Optional[str] = None
    module: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    ip_address: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Audit log entry."""
    id: int
    staff_id: int
    staff_email: str
    staff_name: str
    action_type: str
    module: str
    description: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Staff Dashboard ====================

class TaskAssignment(BaseModel):
    """Task assigned to staff member."""
    id: int
    title: str
    description: Optional[str] = None
    assigned_to: int
    assigned_by: int
    status: str = "pending"  # pending, in_progress, completed, cancelled
    priority: str = "medium"  # low, medium, high, urgent
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class TaskCreate(BaseModel):
    """Create a new task."""
    title: str
    description: Optional[str] = None
    assigned_to: int
    priority: str = "medium"
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    """Update task status."""
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class StaffDashboardStats(BaseModel):
    """Staff dashboard statistics."""
    pending_tasks: int
    completed_tasks_today: int
    overdue_tasks: int
    orders_processed_today: int
    recent_activities: List[Dict[str, Any]] = []


class ActivityTimelineEntry(BaseModel):
    """Activity timeline entry."""
    id: int
    action_type: str
    description: str
    module: Optional[str] = None
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None

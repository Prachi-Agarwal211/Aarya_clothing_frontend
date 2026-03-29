"""
Staff Permissions Service — Granular Access Control
Handles role-based permissions, access control, and audit logging.
"""
import logging
import hashlib
import secrets
from datetime import datetime, timedelta, time
from typing import Optional, List, Dict, Any, Set
from sqlalchemy.orm import Session
from sqlalchemy import text, and_
from sqlalchemy.exc import IntegrityError

from database.models_permissions import (
    CustomRole, PermissionPreset, IPRestriction, TimeBasedAccess,
    TwoFactorAuth, StaffSession, AuditLog, StaffTask, AIPendingAction
)

logger = logging.getLogger(__name__)


# ── Permission Constants ─────────────────────────────────────────────────────

DEFAULT_PERMISSIONS = {
    "staff": [
        {"module": "products", "actions": ["view"]},
        {"module": "orders", "actions": ["view", "edit"]},
        {"module": "customers", "actions": ["view"]},
        {"module": "inventory", "actions": ["view"]},
        {"module": "analytics", "actions": ["view"]},
    ],
    "admin": [
        {"module": "products", "actions": ["view", "create", "edit", "delete", "bulk_operations"]},
        {"module": "orders", "actions": ["view", "create", "edit", "delete", "bulk_operations", "approve"]},
        {"module": "customers", "actions": ["view", "create", "edit", "delete"]},
        {"module": "inventory", "actions": ["view", "create", "edit", "delete", "bulk_operations"]},
        {"module": "analytics", "actions": ["view", "export"]},
        {"module": "staff", "actions": ["view", "create", "edit"]},
        {"module": "settings", "actions": ["view", "edit"]},
    ],
    "super_admin": [
        {"module": "products", "actions": ["view", "create", "edit", "delete", "bulk_operations", "approve"]},
        {"module": "orders", "actions": ["view", "create", "edit", "delete", "bulk_operations", "approve"]},
        {"module": "customers", "actions": ["view", "create", "edit", "delete", "bulk_operations"]},
        {"module": "inventory", "actions": ["view", "create", "edit", "delete", "bulk_operations", "approve"]},
        {"module": "analytics", "actions": ["view", "export"]},
        {"module": "staff", "actions": ["view", "create", "edit", "delete", "approve"]},
        {"module": "settings", "actions": ["view", "edit", "delete"]},
        {"module": "landing", "actions": ["view", "create", "edit", "delete"]},
        {"module": "collections", "actions": ["view", "create", "edit", "delete"]},
        {"module": "chat", "actions": ["view", "create", "edit", "delete"]},
        {"module": "returns", "actions": ["view", "edit", "approve"]},
        {"module": "ai_dashboard", "actions": ["view", "create", "edit", "delete", "approve"]},
        {"module": "ai_monitoring", "actions": ["view", "export"]},
        {"module": "ai_settings", "actions": ["view", "edit"]},
    ]
}


# ── Custom Role Management ───────────────────────────────────────────────────

def create_custom_role(
    db: Session,
    name: str,
    permissions: List[Dict[str, Any]],
    description: Optional[str] = None,
    created_by: Optional[int] = None
) -> CustomRole:
    """Create a new custom role."""
    try:
        # Convert permissions to serializable format
        serialized_permissions = [
            {"module": p.module if hasattr(p, 'module') else p["module"],
             "actions": list(p.actions) if hasattr(p, 'actions') else p["actions"]}
            for p in permissions
        ]
        
        role = CustomRole(
            name=name,
            description=description,
            permissions=serialized_permissions,
            created_by=created_by
        )
        
        db.add(role)
        db.commit()
        db.refresh(role)
        
        log_audit_action(
            db=db,
            staff_id=created_by,
            action_type="CREATE",
            module="staff",
            description=f"Created custom role: {name}",
            metadata={"role_id": role.id}
        )
        
        return role
    except IntegrityError:
        db.rollback()
        raise ValueError(f"Role with name '{name}' already exists")


def update_custom_role(
    db: Session,
    role_id: int,
    name: Optional[str] = None,
    permissions: Optional[List[Dict[str, Any]]] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
    updated_by: Optional[int] = None
) -> CustomRole:
    """Update an existing custom role."""
    role = db.query(CustomRole).filter(CustomRole.id == role_id).first()
    if not role:
        raise ValueError(f"Custom role {role_id} not found")
    
    if name:
        role.name = name
    if description is not None:
        role.description = description
    if permissions is not None:
        role.permissions = [
            {"module": p["module"], "actions": list(p["actions"])}
            for p in permissions
        ]
    if is_active is not None:
        role.is_active = is_active
    
    role.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(role)
    
    log_audit_action(
        db=db,
        staff_id=updated_by,
        action_type="UPDATE",
        module="staff",
        description=f"Updated custom role: {name or role.name}",
        metadata={"role_id": role_id}
    )
    
    return role


def delete_custom_role(db: Session, role_id: int, deleted_by: int) -> bool:
    """Delete a custom role."""
    role = db.query(CustomRole).filter(CustomRole.id == role_id).first()
    if not role:
        raise ValueError(f"Custom role {role_id} not found")
    
    # Check if any users have this role
    users_with_role = db.execute(
        text("SELECT COUNT(*) FROM users WHERE custom_role_id = :role_id"),
        {"role_id": role_id}
    ).scalar()
    
    if users_with_role > 0:
        raise ValueError(f"Cannot delete role: {users_with_role} users still have this role")
    
    db.delete(role)
    db.commit()
    
    log_audit_action(
        db=db,
        staff_id=deleted_by,
        action_type="DELETE",
        module="staff",
        description=f"Deleted custom role: {role.name}",
        metadata={"role_id": role_id}
    )
    
    return True


def get_custom_role(db: Session, role_id: int) -> Optional[CustomRole]:
    """Get a custom role by ID."""
    return db.query(CustomRole).filter(CustomRole.id == role_id).first()


def list_custom_roles(db: Session, active_only: bool = False) -> List[CustomRole]:
    """List all custom roles."""
    query = db.query(CustomRole)
    if active_only:
        query = query.filter(CustomRole.is_active == True)
    return query.order_by(CustomRole.name).all()


# ── Permission Checking ──────────────────────────────────────────────────────

def get_user_permissions(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Get all permissions for a user based on their role."""
    user = db.execute(
        text("SELECT role, custom_role_id FROM users WHERE id = :user_id"),
        {"user_id": user_id}
    ).first()
    
    if not user:
        return []
    
    role, custom_role_id = user
    
    # Check if user has custom role
    if custom_role_id:
        custom_role = db.query(CustomRole).filter(CustomRole.id == custom_role_id).first()
        if custom_role and custom_role.is_active:
            return custom_role.permissions or []
    
    # Return default permissions for role
    return DEFAULT_PERMISSIONS.get(role, [])


def has_permission(
    db: Session,
    user_id: int,
    module: str,
    action: str
) -> bool:
    """Check if user has specific permission."""
    permissions = get_user_permissions(db, user_id)
    
    for perm in permissions:
        if perm["module"] == module and action in perm["actions"]:
            return True
    
    return False


def check_module_access(
    db: Session,
    user_id: int,
    module: str
) -> Dict[str, bool]:
    """Check all actions a user can perform on a module."""
    permissions = get_user_permissions(db, user_id)
    
    actions = {
        "view": False,
        "create": False,
        "edit": False,
        "delete": False,
        "export": False,
        "bulk_operations": False,
        "approve": False
    }
    
    for perm in permissions:
        if perm["module"] == module:
            for action in perm["actions"]:
                if action in actions:
                    actions[action] = True
    
    return actions


# ── Access Control ───────────────────────────────────────────────────────────

def check_ip_access(db: Session, user_id: int, ip_address: str) -> bool:
    """Check if IP address is allowed for user."""
    restrictions = db.query(IPRestriction).filter(
        and_(
            IPRestriction.staff_id == user_id,
            IPRestriction.is_active == True
        )
    ).all()
    
    if not restrictions:
        return True  # No restrictions
    
    for restriction in restrictions:
        if ip_address in restriction.ip_addresses:
            return True
    
    return False


def check_time_access(db: Session, user_id: int, current_time: Optional[datetime] = None) -> bool:
    """Check if current time is within allowed access hours."""
    if current_time is None:
        current_time = datetime.utcnow()
    
    restrictions = db.query(TimeBasedAccess).filter(
        and_(
            TimeBasedAccess.staff_id == user_id,
            TimeBasedAccess.is_active == True
        )
    ).all()
    
    if not restrictions:
        return True  # No restrictions
    
    current_day = current_time.weekday()  # 0=Monday, 6=Sunday
    current_time_only = current_time.time()
    
    for restriction in restrictions:
        if current_day in restriction.days_of_week:
            if restriction.start_time <= current_time_only <= restriction.end_time:
                return True
    
    return False


def setup_two_factor(db: Session, user_id: int) -> Dict[str, Any]:
    """Setup 2FA for user."""
    import pyotp
    
    existing = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == user_id).first()
    if existing:
        db.delete(existing)
    
    secret = pyotp.random_base32()
    backup_codes = [secrets.token_urlsafe(8) for _ in range(10)]
    
    two_factor = TwoFactorAuth(
        user_id=user_id,
        secret=secret,
        enabled=False,
        backup_codes=backup_codes
    )
    
    db.add(two_factor)
    db.commit()
    
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=f"aarya-clothing-{user_id}",
        issuer_name="Aarya Clothing"
    )
    
    return {
        "secret": secret,
        "qr_code_url": provisioning_uri,
        "backup_codes": backup_codes
    }


def verify_two_factor(db: Session, user_id: int, code: str) -> bool:
    """Verify 2FA code."""
    import pyotp
    
    two_factor = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == user_id).first()
    if not two_factor:
        return False
    
    totp = pyotp.TOTP(two_factor.secret)
    
    if totp.verify(code):
        two_factor.enabled = True
        two_factor.last_used = datetime.utcnow()
        db.commit()
        return True
    
    # Check backup codes
    if two_factor.backup_codes and code in two_factor.backup_codes:
        two_factor.backup_codes.remove(code)
        two_factor.enabled = True
        two_factor.last_used = datetime.utcnow()
        db.commit()
        return True
    
    return False


def enable_two_factor(db: Session, user_id: int, enable: bool) -> bool:
    """Enable or disable 2FA."""
    two_factor = db.query(TwoFactorAuth).filter(TwoFactorAuth.user_id == user_id).first()
    if not two_factor:
        return False
    
    two_factor.enabled = enable
    db.commit()
    return True


# ── Session Management ───────────────────────────────────────────────────────

def create_session(
    db: Session,
    user_id: int,
    token: str,
    ip_address: str,
    user_agent: str,
    expires_in_hours: int = 24
) -> StaffSession:
    """Create a new session."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)
    
    session = StaffSession(
        user_id=user_id,
        token_hash=token_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return session


def invalidate_session(db: Session, session_id: int) -> bool:
    """Invalidate a session."""
    session = db.query(StaffSession).filter(StaffSession.id == session_id).first()
    if not session:
        return False
    
    session.is_active = False
    db.commit()
    return True


def invalidate_all_sessions(db: Session, user_id: int) -> int:
    """Invalidate all sessions for a user."""
    result = db.query(StaffSession).filter(
        and_(
            StaffSession.user_id == user_id,
            StaffSession.is_active == True
        )
    ).update({"is_active": False})
    
    db.commit()
    return result


def get_active_sessions(db: Session, user_id: int) -> List[StaffSession]:
    """Get all active sessions for a user."""
    return db.query(StaffSession).filter(
        and_(
            StaffSession.user_id == user_id,
            StaffSession.is_active == True,
            StaffSession.expires_at > datetime.utcnow()
        )
    ).all()


def cleanup_expired_sessions(db: Session) -> int:
    """Clean up expired sessions."""
    result = db.query(StaffSession).filter(
        StaffSession.expires_at < datetime.utcnow()
    ).update({"is_active": False})
    
    db.commit()
    return result


# ── Audit Logging ────────────────────────────────────────────────────────────

def log_audit_action(
    db: Session,
    staff_id: int,
    action_type: str,
    module: str,
    description: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[Any]:
    """Log an audit action. Never raises — silently fails if table not ready."""
    try:
        audit_log = AuditLog(
            staff_id=staff_id,
            action_type=action_type,
            module=module,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            extra_data=metadata
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log
    except Exception as e:
        logger.warning(f"Audit log failed (non-fatal): {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return None


def get_audit_logs(
    db: Session,
    staff_id: Optional[int] = None,
    module: Optional[str] = None,
    action_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> List[AuditLog]:
    """Get audit logs with filters."""
    try:
        query = db.query(AuditLog)

        if staff_id:
            query = query.filter(AuditLog.staff_id == staff_id)
        if module:
            query = query.filter(AuditLog.module == module)
        if action_type:
            query = query.filter(AuditLog.action_type == action_type)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)

        return query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset).all()
    except Exception as e:
        logger.warning(f"get_audit_logs failed: {e}")
        return []


# ── Task Management ──────────────────────────────────────────────────────────

def create_task(
    db: Session,
    title: str,
    assigned_to: int,
    assigned_by: int,
    description: Optional[str] = None,
    priority: str = "medium",
    due_date: Optional[datetime] = None
) -> StaffTask:
    """Create a new task."""
    task = StaffTask(
        title=title,
        description=description,
        assigned_to=assigned_to,
        assigned_by=assigned_by,
        priority=priority,
        due_date=due_date
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    return task


def update_task(
    db: Session,
    task_id: int,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    due_date: Optional[datetime] = None,
    notes: Optional[str] = None
) -> StaffTask:
    """Update a task."""
    task = db.query(StaffTask).filter(StaffTask.id == task_id).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")
    
    if status:
        task.status = status
        if status == "completed":
            task.completed_at = datetime.utcnow()
    if priority:
        task.priority = priority
    if due_date:
        task.due_date = due_date
    if notes:
        task.notes = notes
    
    task.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    return task


def get_staff_tasks(
    db: Session,
    assigned_to: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50
) -> List[StaffTask]:
    """Get tasks for a staff member."""
    query = db.query(StaffTask)
    
    if assigned_to:
        query = query.filter(StaffTask.assigned_to == assigned_to)
    if status:
        query = query.filter(StaffTask.status == status)
    
    return query.order_by(
        StaffTask.priority.desc(),
        StaffTask.due_date.asc()
    ).limit(limit).all()


def get_staff_dashboard_stats(db: Session, staff_id: int) -> Dict[str, Any]:
    """Get dashboard statistics for staff member."""
    # Task stats
    pending_tasks = db.query(StaffTask).filter(
        and_(
            StaffTask.assigned_to == staff_id,
            StaffTask.status == "pending"
        )
    ).count()
    
    completed_today = db.query(StaffTask).filter(
        and_(
            StaffTask.assigned_to == staff_id,
            StaffTask.status == "completed",
            text("DATE(completed_at) = CURRENT_DATE")
        )
    ).count()
    
    overdue = db.query(StaffTask).filter(
        and_(
            StaffTask.assigned_to == staff_id,
            StaffTask.status.in_(["pending", "in_progress"]),
            StaffTask.due_date < datetime.utcnow()
        )
    ).count()
    
    # Order stats
    orders_today = db.execute(
        text("""
            SELECT COUNT(*) FROM orders
            WHERE status NOT IN ('cancelled', 'pending')
            AND DATE(created_at) = CURRENT_DATE
        """)
    ).scalar() or 0
    
    # Recent activities
    recent_activities = db.query(AuditLog).filter(
        AuditLog.staff_id == staff_id
    ).order_by(AuditLog.created_at.desc()).limit(10).all()
    
    return {
        "pending_tasks": pending_tasks,
        "completed_tasks_today": completed_today,
        "overdue_tasks": overdue,
        "orders_processed_today": orders_today,
        "recent_activities": [
            {
                "id": log.id,
                "action_type": log.action_type,
                "description": log.description,
                "module": log.module,
                "timestamp": log.created_at
            }
            for log in recent_activities
        ]
    }


# ── AI Pending Actions ───────────────────────────────────────────────────────

def create_pending_action(
    db: Session,
    session_id: str,
    action_type: str,
    params: Dict[str, Any],
    created_by_ai: bool = True
) -> AIPendingAction:
    """Create a pending action for admin approval."""
    action = AIPendingAction(
        session_id=session_id,
        action_type=action_type,
        params=params,
        created_by_ai=created_by_ai
    )
    
    db.add(action)
    db.commit()
    db.refresh(action)
    
    return action


def approve_pending_action(
    db: Session,
    action_id: int,
    reviewed_by: int
) -> AIPendingAction:
    """Approve a pending action."""
    action = db.query(AIPendingAction).filter(AIPendingAction.id == action_id).first()
    if not action:
        raise ValueError(f"Pending action {action_id} not found")
    
    action.status = "approved"
    action.reviewed_at = datetime.utcnow()
    action.reviewed_by = reviewed_by
    
    db.commit()
    db.refresh(action)
    
    return action


def reject_pending_action(
    db: Session,
    action_id: int,
    reviewed_by: int,
    reason: str
) -> AIPendingAction:
    """Reject a pending action."""
    action = db.query(AIPendingAction).filter(AIPendingAction.id == action_id).first()
    if not action:
        raise ValueError(f"Pending action {action_id} not found")
    
    action.status = "rejected"
    action.reviewed_at = datetime.utcnow()
    action.reviewed_by = reviewed_by
    action.rejection_reason = reason
    
    db.commit()
    db.refresh(action)
    
    return action


def get_pending_actions(
    db: Session,
    status: str = "pending"
) -> List[AIPendingAction]:
    """Get pending actions."""
    return db.query(AIPendingAction).filter(
        AIPendingAction.status == status
    ).order_by(AIPendingAction.created_at.desc()).all()

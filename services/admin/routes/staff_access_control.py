"""
Staff Access Control & Audit Logging API Endpoints
Continuation of ai_dashboard_staff.py
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.database import get_db
from schemas.staff_permissions import (
    IPRestrictionCreate, IPRestrictionResponse,
    TimeBasedAccessCreate, TimeBasedAccessResponse,
    TwoFactorAuthSetup, TwoFactorAuthVerify, TwoFactorAuthResponse,
    SessionManagementResponse, TaskCreate, TaskUpdate,
    StaffDashboardStats, ActivityTimelineEntry,
    AuditLogFilter, AuditLogResponse
)
from service.permissions_service import (
    check_ip_access, check_time_access, setup_two_factor, verify_two_factor,
    enable_two_factor, create_session, invalidate_session, invalidate_all_sessions,
    get_active_sessions, cleanup_expired_sessions, log_audit_action, get_audit_logs,
    create_task, update_task, get_staff_tasks, get_staff_dashboard_stats
)
from shared.auth_middleware import require_super_admin, require_admin, get_current_user

# Reuse the same router
router = APIRouter()

logger = logging.getLogger(__name__)


# ── Access Control: IP Restrictions ──────────────────────────────────────────

@router.post(
    "/api/v1/admin/staff/access/ip-restrictions",
    response_model=IPRestrictionResponse,
    tags=["Staff Access Control"],
    summary="Create IP restriction",
)
async def create_ip_restriction(
    restriction_data: IPRestrictionCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Create IP address restriction for a staff account."""
    from database.models_permissions import IPRestriction
    
    # Verify staff exists
    staff = db.execute(
        text("SELECT id FROM users WHERE id = :staff_id AND role IN ('admin', 'staff', 'super_admin')"),
        {"staff_id": restriction_data.staff_id}
    ).first()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff account not found")
    
    restriction = IPRestriction(
        staff_id=restriction_data.staff_id,
        ip_addresses=restriction_data.ip_addresses,
        description=restriction_data.description,
        is_active=restriction_data.is_active
    )
    
    db.add(restriction)
    db.commit()
    db.refresh(restriction)
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="CREATE",
        module="staff",
        description=f"Created IP restriction for staff {restriction_data.staff_id}",
        ip_address=user.get("ip"),
        metadata={"restriction_id": restriction.id}
    )
    
    return restriction


@router.get(
    "/api/v1/admin/staff/access/ip-restrictions/{staff_id}",
    response_model=List[IPRestrictionResponse],
    tags=["Staff Access Control"],
    summary="Get IP restrictions",
)
async def get_ip_restrictions(
    staff_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get IP restrictions for a staff member."""
    from database.models_permissions import IPRestriction
    
    restrictions = db.query(IPRestriction).filter(
        IPRestriction.staff_id == staff_id
    ).all()
    
    return restrictions


@router.delete(
    "/api/v1/admin/staff/access/ip-restrictions/{restriction_id}",
    tags=["Staff Access Control"],
    summary="Delete IP restriction",
)
async def delete_ip_restriction(
    restriction_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Delete an IP restriction."""
    from database.models_permissions import IPRestriction
    
    restriction = db.query(IPRestriction).filter(IPRestriction.id == restriction_id).first()
    if not restriction:
        raise HTTPException(status_code=404, detail="Restriction not found")
    
    db.delete(restriction)
    db.commit()
    
    return {"success": True, "message": "IP restriction deleted"}


# ── Access Control: Time-Based Access ────────────────────────────────────────

@router.post(
    "/api/v1/admin/staff/access/time-restrictions",
    response_model=TimeBasedAccessResponse,
    tags=["Staff Access Control"],
    summary="Create time-based access restriction",
)
async def create_time_restriction(
    restriction_data: TimeBasedAccessCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Create time-based access restriction for a staff account."""
    from database.models_permissions import TimeBasedAccess
    
    # Verify staff exists
    staff = db.execute(
        text("SELECT id FROM users WHERE id = :staff_id AND role IN ('admin', 'staff', 'super_admin')"),
        {"staff_id": restriction_data.staff_id}
    ).first()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff account not found")
    
    restriction = TimeBasedAccess(
        staff_id=restriction_data.staff_id,
        days_of_week=restriction_data.days_of_week,
        start_time=restriction_data.start_time,
        end_time=restriction_data.end_time,
        timezone=restriction_data.timezone,
        description=restriction_data.description,
        is_active=restriction_data.is_active
    )
    
    db.add(restriction)
    db.commit()
    db.refresh(restriction)
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="CREATE",
        module="staff",
        description=f"Created time restriction for staff {restriction_data.staff_id}",
        ip_address=user.get("ip"),
        metadata={"restriction_id": restriction.id}
    )
    
    return restriction


@router.get(
    "/api/v1/admin/staff/access/time-restrictions/{staff_id}",
    response_model=List[TimeBasedAccessResponse],
    tags=["Staff Access Control"],
    summary="Get time restrictions",
)
async def get_time_restrictions(
    staff_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get time-based access restrictions for a staff member."""
    from database.models_permissions import TimeBasedAccess
    
    restrictions = db.query(TimeBasedAccess).filter(
        TimeBasedAccess.staff_id == staff_id
    ).all()
    
    return restrictions


@router.delete(
    "/api/v1/admin/staff/access/time-restrictions/{restriction_id}",
    tags=["Staff Access Control"],
    summary="Delete time restriction",
)
async def delete_time_restriction(
    restriction_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Delete a time-based access restriction."""
    from database.models_permissions import TimeBasedAccess
    
    restriction = db.query(TimeBasedAccess).filter(TimeBasedAccess.id == restriction_id).first()
    if not restriction:
        raise HTTPException(status_code=404, detail="Restriction not found")
    
    db.delete(restriction)
    db.commit()
    
    return {"success": True, "message": "Time restriction deleted"}


# ── Two-Factor Authentication ────────────────────────────────────────────────

@router.post(
    "/api/v1/admin/staff/security/2fa/setup",
    response_model=TwoFactorAuthResponse,
    tags=["Staff Security"],
    summary="Setup 2FA",
)
async def setup_staff_2fa(
    setup_data: TwoFactorAuthSetup,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Setup two-factor authentication for a staff account."""
    # Only allow users to setup their own 2FA, or super_admin for anyone
    if user["sub"] != setup_data.staff_id:
        if user.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Can only setup 2FA for your own account")
    
    result = setup_two_factor(db, setup_data.staff_id)
    
    return {
        "staff_id": setup_data.staff_id,
        "enabled": False,
        "qr_code_url": result["qr_code_url"],
        "secret": result["secret"],
        "backup_codes": result["backup_codes"]
    }


@router.post(
    "/api/v1/admin/staff/security/2fa/verify",
    tags=["Staff Security"],
    summary="Verify 2FA code",
)
async def verify_staff_2fa(
    verify_data: TwoFactorAuthVerify,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Verify and enable two-factor authentication."""
    # Only allow users to verify their own 2FA
    if user["sub"] != verify_data.staff_id:
        raise HTTPException(status_code=403, detail="Can only verify 2FA for your own account")
    
    success = verify_two_factor(db, verify_data.staff_id, verify_data.code)
    
    if success:
        log_audit_action(
            db=db,
            staff_id=user["sub"],
            action_type="UPDATE",
            module="staff",
            description="Enabled 2FA for account",
            ip_address=user.get("ip")
        )
        return {"success": True, "message": "2FA enabled successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid 2FA code")


@router.post(
    "/api/v1/admin/staff/security/2fa/toggle",
    tags=["Staff Security"],
    summary="Enable/Disable 2FA",
)
async def toggle_staff_2fa(
    setup_data: TwoFactorAuthSetup,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Enable or disable two-factor authentication."""
    if user["sub"] != setup_data.staff_id and user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    success = enable_two_factor(db, setup_data.staff_id, setup_data.enable)
    
    if success:
        action = "Enabled" if setup_data.enable else "Disabled"
        log_audit_action(
            db=db,
            staff_id=user["sub"],
            action_type="UPDATE",
            module="staff",
            description=f"{action} 2FA for account",
            ip_address=user.get("ip")
        )
        return {"success": True, "enabled": setup_data.enable}
    else:
        raise HTTPException(status_code=400, detail="2FA not configured")


# ── Session Management ───────────────────────────────────────────────────────

@router.get(
    "/api/v1/admin/staff/sessions/{user_id}",
    response_model=List[SessionManagementResponse],
    tags=["Staff Security"],
    summary="Get active sessions",
)
async def get_user_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get all active sessions for a user."""
    # Only allow users to view their own sessions, or super_admin for anyone
    if user["sub"] != user_id and user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    sessions = get_active_sessions(db, user_id)
    
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "token_hash": s.token_hash,
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
            "created_at": s.created_at,
            "expires_at": s.expires_at,
            "last_activity": s.last_activity,
            "is_active": s.is_active
        }
        for s in sessions
    ]


@router.delete(
    "/api/v1/admin/staff/sessions/{session_id}",
    tags=["Staff Security"],
    summary="Invalidate session",
)
async def invalidate_user_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Invalidate a specific session."""
    session = db.execute(
        text("SELECT user_id FROM staff_sessions WHERE id = :session_id"),
        {"session_id": session_id}
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Only allow users to invalidate their own sessions, or super_admin for anyone
    if user["sub"] != session[0] and user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    success = invalidate_session(db, session_id)
    
    if success:
        log_audit_action(
            db=db,
            staff_id=user["sub"],
            action_type="DELETE",
            module="staff",
            description=f"Invalidated session {session_id}",
            ip_address=user.get("ip")
        )
        return {"success": True, "message": "Session invalidated"}
    else:
        raise HTTPException(status_code=400, detail="Failed to invalidate session")


@router.post(
    "/api/v1/admin/staff/sessions/{user_id}/invalidate-all",
    tags=["Staff Security"],
    summary="Invalidate all sessions",
)
async def invalidate_all_user_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Invalidate all sessions for a user (force logout)."""
    count = invalidate_all_sessions(db, user_id)
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="DELETE",
        module="staff",
        description=f"Invalidated all sessions for user {user_id}",
        ip_address=user.get("ip"),
        metadata={"sessions_invalidated": count}
    )
    
    return {"success": True, "sessions_invalidated": count}


# ── Audit Logging ────────────────────────────────────────────────────────────

@router.get(
    "/api/v1/admin/staff/audit-logs",
    response_model=List[AuditLogResponse],
    tags=["Staff Audit"],
    summary="Get audit logs",
)
async def get_staff_audit_logs(
    staff_id: Optional[int] = Query(None),
    module: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get audit logs with filtering."""
    if not has_permission(db, user["sub"], "staff", "view"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    logs = get_audit_logs(
        db=db,
        staff_id=staff_id,
        module=module,
        action_type=action_type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )
    
    return [
        {
            "id": log.id,
            "staff_id": log.staff_id,
            "staff_email": log.staff.email if hasattr(log, 'staff') else None,
            "staff_name": log.staff.full_name if hasattr(log, 'staff') else None,
            "action_type": log.action_type,
            "module": log.module,
            "description": log.description,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "metadata": log.metadata,
            "created_at": log.created_at
        }
        for log in logs
    ]


@router.get(
    "/api/v1/admin/staff/audit-logs/export",
    tags=["Staff Audit"],
    summary="Export audit logs",
)
async def export_audit_logs(
    staff_id: Optional[int] = Query(None),
    module: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Export audit logs as CSV."""
    if not has_permission(db, user["sub"], "staff", "export"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    logs = get_audit_logs(
        db=db,
        staff_id=staff_id,
        module=module,
        start_date=start_date,
        end_date=end_date,
        limit=10000
    )
    
    import csv
    import io
    
    output = io.StringIO()
    fieldnames = ["id", "staff_id", "staff_email", "action_type", "module", "description", "ip_address", "created_at"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for log in logs:
        writer.writerow({
            "id": log.id,
            "staff_id": log.staff_id,
            "staff_email": log.staff.email if hasattr(log, 'staff') else None,
            "action_type": log.action_type,
            "module": log.module,
            "description": log.description,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat()
        })
    
    from fastapi.responses import StreamingResponse
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs.csv"}
    )


# ── Task Management ──────────────────────────────────────────────────────────

@router.post(
    "/api/v1/admin/staff/tasks",
    tags=["Staff Tasks"],
    summary="Create task",
)
async def create_staff_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Create a new task for a staff member."""
    task = create_task(
        db=db,
        title=task_data.title,
        description=task_data.description,
        assigned_to=task_data.assigned_to,
        assigned_by=user["sub"],
        priority=task_data.priority,
        due_date=task_data.due_date
    )
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="CREATE",
        module="staff",
        description=f"Created task: {task_data.title}",
        ip_address=user.get("ip"),
        metadata={"task_id": task.id, "assigned_to": task_data.assigned_to}
    )
    
    return {"success": True, "task_id": task.id}


@router.get(
    "/api/v1/admin/staff/tasks",
    tags=["Staff Tasks"],
    summary="List tasks",
)
async def list_staff_tasks(
    assigned_to: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """List tasks with optional filtering."""
    # If no assigned_to specified, only show own tasks unless admin
    if not assigned_to and user.get("role") not in ["admin", "super_admin"]:
        assigned_to = user["sub"]
    
    tasks = get_staff_tasks(db, assigned_to=assigned_to, status=status, limit=limit)
    
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "assigned_to": t.assigned_to,
            "assigned_by": t.assigned_by,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date,
            "completed_at": t.completed_at,
            "created_at": t.created_at
        }
        for t in tasks
    ]


@router.put(
    "/api/v1/admin/staff/tasks/{task_id}",
    tags=["Staff Tasks"],
    summary="Update task",
)
async def update_staff_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Update a task."""
    task = update_task(
        db=db,
        task_id=task_id,
        status=task_data.status,
        priority=task_data.priority,
        due_date=task_data.due_date,
        notes=task_data.notes
    )
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="UPDATE",
        module="staff",
        description=f"Updated task: {task.title}",
        ip_address=user.get("ip"),
        metadata={"task_id": task_id}
    )
    
    return {"success": True, "task": task}


@router.get(
    "/api/v1/admin/staff/dashboard",
    response_model=StaffDashboardStats,
    tags=["Staff Dashboard"],
    summary="Get staff dashboard stats",
)
async def get_staff_dashboard(
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get dashboard statistics for the current staff member."""
    stats = get_staff_dashboard_stats(db, user["sub"])
    return stats


@router.get(
    "/api/v1/admin/staff/activity-timeline",
    response_model=List[ActivityTimelineEntry],
    tags=["Staff Dashboard"],
    summary="Get activity timeline",
)
async def get_activity_timeline(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get recent activity timeline for the current staff member."""
    logs = get_audit_logs(db, staff_id=user["sub"], limit=limit)
    
    return [
        {
            "id": log.id,
            "action_type": log.action_type,
            "description": log.description,
            "module": log.module,
            "timestamp": log.created_at,
            "metadata": log.metadata
        }
        for log in logs
    ]


# ── Permission Check Endpoint ────────────────────────────────────────────────

@router.get(
    "/api/v1/admin/staff/permissions/check",
    tags=["Staff Permissions"],
    summary="Check permission",
)
async def check_staff_permission(
    module: str = Query(...),
    action: str = Query(...),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Check if current user has specific permission."""
    from service.permissions_service import has_permission
    
    allowed = has_permission(db, user["sub"], module, action)
    
    return {
        "module": module,
        "action": action,
        "allowed": allowed,
        "user_id": user["sub"],
        "role": user.get("role")
    }


@router.get(
    "/api/v1/admin/staff/permissions/modules",
    tags=["Staff Permissions"],
    summary="Get module access",
)
async def get_module_permissions(
    module: str = Query(...),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get all actions a user can perform on a module."""
    from service.permissions_service import check_module_access
    
    access = check_module_access(db, user["sub"], module)
    
    return {
        "module": module,
        "access": access,
        "user_id": user["sub"]
    }

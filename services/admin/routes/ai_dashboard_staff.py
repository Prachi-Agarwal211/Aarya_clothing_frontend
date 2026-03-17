"""
Super Admin AI Dashboard & Staff Management API Endpoints
Extends the main admin service with AI dashboard and staff permission features.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.database import get_db
from schemas.admin import DashboardOverview, InventoryAlert
from schemas.staff_permissions import (
    CustomRoleCreate, CustomRoleUpdate, CustomRoleResponse,
    StaffAccountCreate, StaffAccountUpdate, StaffAccountResponse,
    IPRestrictionCreate, IPRestrictionResponse,
    TimeBasedAccessCreate, TimeBasedAccessResponse,
    TwoFactorAuthSetup, TwoFactorAuthVerify, TwoFactorAuthResponse,
    SessionManagementResponse, TaskCreate, TaskUpdate,
    StaffDashboardStats, ActivityTimelineEntry,
    AuditLogFilter, AuditLogResponse,
    PermissionModule, PermissionAction
)
from service.permissions_service import (
    create_custom_role, update_custom_role, delete_custom_role, get_custom_role,
    list_custom_roles, get_user_permissions, has_permission, check_module_access,
    check_ip_access, check_time_access, setup_two_factor, verify_two_factor,
    enable_two_factor, create_session, invalidate_session, invalidate_all_sessions,
    get_active_sessions, cleanup_expired_sessions, log_audit_action, get_audit_logs,
    create_task, update_task, get_staff_tasks, get_staff_dashboard_stats,
    create_pending_action, approve_pending_action, reject_pending_action,
    get_pending_actions, DEFAULT_PERMISSIONS
)
from service.ai_dashboard_tools import (
    _dashboard_tools, _execute_dashboard_tool, _get_ai_insights
)
from shared.auth_middleware import require_super_admin, require_admin, get_current_user

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()


# ── Super Admin AI Dashboard Endpoints ───────────────────────────────────────

@router.get(
    "/api/v1/admin/ai-dashboard/tools",
    tags=["AI Dashboard"],
    summary="Get available AI dashboard tools",
)
async def get_ai_dashboard_tools(
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Get list of available AI dashboard query tools."""
    tools = _dashboard_tools()
    return {"tools": tools, "count": len(tools)}


@router.post(
    "/api/v1/admin/ai-dashboard/query",
    tags=["AI Dashboard"],
    summary="Execute AI dashboard query",
)
async def execute_ai_dashboard_query(
    request: Dict[str, Any],
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """
    Execute a dashboard query tool.
    
    Available tools:
    - get_sales_metrics: Sales performance metrics
    - get_inventory_status: Inventory levels and alerts
    - get_customer_analytics: Customer insights
    - get_order_fulfillment: Order status overview
    - get_revenue_trends: Revenue trends over time
    - get_top_products: Best selling products
    - get_ai_insights: AI-generated business insights
    """
    tool_name = request.get("tool")
    args = request.get("args", {})
    
    if not tool_name:
        raise HTTPException(status_code=400, detail="Tool name required")
    
    # Check permission
    if not has_permission(db, user["sub"], "ai_dashboard", "view"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    result = _execute_dashboard_tool(db, tool_name, args)
    
    # Log the action
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="VIEW",
        module="ai_dashboard",
        description=f"Executed AI dashboard query: {tool_name}",
        ip_address=user.get("ip"),
        metadata={"tool": tool_name, "args": args}
    )
    
    return {"result": result}


@router.get(
    "/api/v1/admin/ai-dashboard/insights",
    tags=["AI Dashboard"],
    summary="Get AI business insights",
)
async def get_ai_business_insights(
    focus_area: str = Query("all", regex="^(sales|inventory|customers|orders|all)$"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Get AI-generated business insights and recommendations."""
    import json
    
    insights_result = _get_ai_insights(db, {"focus_area": focus_area})
    insights = json.loads(insights_result)
    
    return insights


@router.get(
    "/api/v1/admin/ai-dashboard/pending-actions",
    tags=["AI Dashboard"],
    summary="Get pending AI actions",
)
async def get_ai_pending_actions(
    status: str = Query("pending", regex="^(pending|approved|rejected|executed)$"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Get pending AI actions awaiting approval."""
    actions = get_pending_actions(db, status)
    
    return {
        "actions": [
            {
                "id": a.id,
                "session_id": a.session_id,
                "action_type": a.action_type,
                "params": a.params,
                "status": a.status,
                "created_at": a.created_at,
                "reviewed_at": a.reviewed_at,
                "rejection_reason": a.rejection_reason
            }
            for a in actions
        ],
        "count": len(actions)
    }


@router.post(
    "/api/v1/admin/ai-dashboard/pending-actions/{action_id}/approve",
    tags=["AI Dashboard"],
    summary="Approve pending AI action",
)
async def approve_ai_action(
    action_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Approve a pending AI action for execution."""
    from service.ai_service import execute_confirmed_action
    
    action = approve_pending_action(db, action_id, user["sub"])
    
    # Execute the approved action
    result = execute_confirmed_action(
        db=db,
        action_type=action.action_type,
        params=action.params,
        admin_user_id=user["sub"]
    )
    
    # Update action status
    action.status = "executed"
    action.executed_at = datetime.utcnow()
    db.commit()
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="APPROVE",
        module="ai_dashboard",
        description=f"Approved and executed AI action: {action.action_type}",
        ip_address=user.get("ip"),
        metadata={"action_id": action_id, "result": result}
    )
    
    return {"success": True, "action": action.action_type, "result": result}


@router.post(
    "/api/v1/admin/ai-dashboard/pending-actions/{action_id}/reject",
    tags=["AI Dashboard"],
    summary="Reject pending AI action",
)
async def reject_ai_action(
    action_id: int,
    reason: str = Query(..., min_length=5),
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Reject a pending AI action."""
    action = reject_pending_action(db, action_id, user["sub"], reason)
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="REJECT",
        module="ai_dashboard",
        description=f"Rejected AI action: {action.action_type}",
        ip_address=user.get("ip"),
        metadata={"action_id": action_id, "reason": reason}
    )
    
    return {"success": True, "action_id": action_id, "status": "rejected"}


# ── Custom Role Management ───────────────────────────────────────────────────

@router.post(
    "/api/v1/admin/staff/roles",
    response_model=CustomRoleResponse,
    tags=["Staff Roles"],
    summary="Create custom role",
)
async def create_staff_role(
    role_data: CustomRoleCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Create a new custom role with granular permissions."""
    if not has_permission(db, user["sub"], "staff", "create"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    role = create_custom_role(
        db=db,
        name=role_data.name,
        permissions=role_data.permissions,
        description=role_data.description,
        created_by=user["sub"]
    )
    
    return role


@router.get(
    "/api/v1/admin/staff/roles",
    response_model=List[CustomRoleResponse],
    tags=["Staff Roles"],
    summary="List custom roles",
)
async def list_staff_roles(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """List all custom roles."""
    if not has_permission(db, user["sub"], "staff", "view"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    roles = list_custom_roles(db, active_only=active_only)
    return roles


@router.get(
    "/api/v1/admin/staff/roles/{role_id}",
    response_model=CustomRoleResponse,
    tags=["Staff Roles"],
    summary="Get custom role",
)
async def get_staff_role(
    role_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get a specific custom role by ID."""
    if not has_permission(db, user["sub"], "staff", "view"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    role = get_custom_role(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return role


@router.put(
    "/api/v1/admin/staff/roles/{role_id}",
    response_model=CustomRoleResponse,
    tags=["Staff Roles"],
    summary="Update custom role",
)
async def update_staff_role(
    role_id: int,
    role_data: CustomRoleUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Update an existing custom role."""
    if not has_permission(db, user["sub"], "staff", "edit"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    role = update_custom_role(
        db=db,
        role_id=role_id,
        name=role_data.name,
        permissions=role_data.permissions,
        description=role_data.description,
        is_active=role_data.is_active,
        updated_by=user["sub"]
    )
    
    return role


@router.delete(
    "/api/v1/admin/staff/roles/{role_id}",
    tags=["Staff Roles"],
    summary="Delete custom role",
)
async def delete_staff_role(
    role_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Delete a custom role."""
    if not has_permission(db, user["sub"], "staff", "delete"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    delete_custom_role(db, role_id, user["sub"])
    return {"success": True, "message": f"Role {role_id} deleted"}


@router.get(
    "/api/v1/admin/staff/permission-presets",
    tags=["Staff Roles"],
    summary="Get permission presets",
)
async def get_permission_presets(
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get default permission presets for common roles."""
    return {"presets": DEFAULT_PERMISSIONS}


# ── Staff Account Management ─────────────────────────────────────────────────

@router.post(
    "/api/v1/admin/staff/accounts",
    response_model=StaffAccountResponse,
    tags=["Staff Accounts"],
    summary="Create staff account",
)
async def create_staff_account(
    account_data: StaffAccountCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Create a new staff account."""
    from core.validation import validate_email
    from passlib.context import CryptContext
    
    if not has_permission(db, user["sub"], "staff", "create"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Validate email
    email = validate_email(account_data.email)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid email")
    
    # Check if user exists
    existing = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": account_data.email}
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(account_data.password)
    
    # Create user
    result = db.execute(
        text("""
            INSERT INTO users (email, username, full_name, password_hash, role, custom_role_id, phone, department, is_active)
            VALUES (:email, :username, :full_name, :password, :role, :custom_role_id, :phone, :department, :is_active)
            RETURNING id, email, username, full_name, role, custom_role_id, phone, department, is_active, created_at
        """),
        {
            "email": account_data.email,
            "username": account_data.username,
            "full_name": account_data.full_name,
            "password": hashed_password,
            "role": account_data.role,
            "custom_role_id": account_data.custom_role_id,
            "phone": account_data.phone,
            "department": account_data.department,
            "is_active": account_data.is_active
        }
    ).fetchone()
    
    db.commit()
    
    # Get permissions for the role
    permissions = get_user_permissions(db, result[0])
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="CREATE",
        module="staff",
        description=f"Created staff account: {account_data.email}",
        ip_address=user.get("ip"),
        metadata={"user_id": result[0], "role": account_data.role}
    )
    
    return {
        "id": result[0],
        "email": result[1],
        "username": result[2],
        "full_name": result[3],
        "role": result[4],
        "custom_role_id": result[5],
        "custom_role_name": None,
        "permissions": permissions,
        "phone": result[6],
        "department": result[7],
        "is_active": result[8],
        "two_factor_enabled": False,
        "last_login": None,
        "created_at": result[9],
        "created_by": user["sub"]
    }


@router.get(
    "/api/v1/admin/staff/accounts",
    response_model=List[StaffAccountResponse],
    tags=["Staff Accounts"],
    summary="List staff accounts",
)
async def list_staff_accounts(
    role: Optional[str] = Query(None, regex="^(admin|staff|super_admin)$"),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """List all staff accounts with optional filtering."""
    if not has_permission(db, user["sub"], "staff", "view"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    conditions = ["role IN ('admin', 'staff', 'super_admin')"]
    params = {}
    
    if role:
        conditions.append("role = :role")
        params["role"] = role
    
    if is_active is not None:
        conditions.append("is_active = :is_active")
        params["is_active"] = is_active
    
    query = text(f"""
        SELECT id, email, username, full_name, role, custom_role_id, phone, department, is_active, created_at, last_login
        FROM users
        WHERE {' AND '.join(conditions)}
        ORDER BY created_at DESC
    """)
    
    results = db.execute(query, params).fetchall()
    
    accounts = []
    for row in results:
        permissions = get_user_permissions(db, row[0])
        
        # Get custom role name if applicable
        custom_role_name = None
        if row[5]:  # custom_role_id
            custom_role = db.query(text("SELECT name FROM custom_roles WHERE id = :id")).params(id=row[5]).first()
            if custom_role:
                custom_role_name = custom_role[0]
        
        # Check 2FA status
        two_factor = db.execute(
            text("SELECT enabled FROM staff_2fa WHERE user_id = :user_id"),
            {"user_id": row[0]}
        ).first()
        
        accounts.append({
            "id": row[0],
            "email": row[1],
            "username": row[2],
            "full_name": row[3],
            "role": row[4],
            "custom_role_id": row[5],
            "custom_role_name": custom_role_name,
            "permissions": permissions,
            "phone": row[6],
            "department": row[7],
            "is_active": row[8],
            "two_factor_enabled": two_factor[0] if two_factor else False,
            "last_login": row[10],
            "created_at": row[9],
            "created_by": None
        })
    
    return accounts


@router.get(
    "/api/v1/admin/staff/accounts/{user_id}",
    response_model=StaffAccountResponse,
    tags=["Staff Accounts"],
    summary="Get staff account",
)
async def get_staff_account(
    user_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    """Get a specific staff account."""
    if not has_permission(db, user["sub"], "staff", "view"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    result = db.execute(
        text("""
            SELECT id, email, username, full_name, role, custom_role_id, phone, department, is_active, created_at, last_login
            FROM users
            WHERE id = :user_id AND role IN ('admin', 'staff', 'super_admin')
        """),
        {"user_id": user_id}
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Staff account not found")
    
    permissions = get_user_permissions(db, user_id)
    
    two_factor = db.execute(
        text("SELECT enabled FROM staff_2fa WHERE user_id = :user_id"),
        {"user_id": user_id}
    ).first()
    
    return {
        "id": result[0],
        "email": result[1],
        "username": result[2],
        "full_name": result[3],
        "role": result[4],
        "custom_role_id": result[5],
        "custom_role_name": None,
        "permissions": permissions,
        "phone": result[6],
        "department": result[7],
        "is_active": result[8],
        "two_factor_enabled": two_factor[0] if two_factor else False,
        "last_login": result[10],
        "created_at": result[9],
        "created_by": None
    }


@router.put(
    "/api/v1/admin/staff/accounts/{user_id}",
    response_model=StaffAccountResponse,
    tags=["Staff Accounts"],
    summary="Update staff account",
)
async def update_staff_account(
    user_id: int,
    account_data: StaffAccountUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Update a staff account."""
    if not has_permission(db, user["sub"], "staff", "edit"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    updates = {}
    if account_data.full_name:
        updates["full_name"] = account_data.full_name
    if account_data.phone:
        updates["phone"] = account_data.phone
    if account_data.department:
        updates["department"] = account_data.department
    if account_data.role:
        updates["role"] = account_data.role
    if account_data.custom_role_id is not None:
        updates["custom_role_id"] = account_data.custom_role_id
    if account_data.is_active is not None:
        updates["is_active"] = account_data.is_active
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    query = text(f"""
        UPDATE users SET {', '.join([f'{k} = :{k}' for k in updates.keys()])}
        WHERE id = :user_id AND role IN ('admin', 'staff', 'super_admin')
        RETURNING id, email, username, full_name, role, custom_role_id, phone, department, is_active, created_at, last_login
    """)
    
    params = {**updates, "user_id": user_id}
    result = db.execute(query, params).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Staff account not found")
    
    db.commit()
    
    permissions = get_user_permissions(db, user_id)
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="UPDATE",
        module="staff",
        description=f"Updated staff account: {result[1]}",
        ip_address=user.get("ip"),
        metadata={"user_id": user_id, "updates": list(updates.keys())}
    )
    
    return {
        "id": result[0],
        "email": result[1],
        "username": result[2],
        "full_name": result[3],
        "role": result[4],
        "custom_role_id": result[5],
        "custom_role_name": None,
        "permissions": permissions,
        "phone": result[6],
        "department": result[7],
        "is_active": result[8],
        "two_factor_enabled": False,
        "last_login": result[10],
        "created_at": result[9],
        "created_by": user["sub"]
    }


@router.post(
    "/api/v1/admin/staff/accounts/{user_id}/deactivate",
    tags=["Staff Accounts"],
    summary="Deactivate staff account",
)
async def deactivate_staff_account(
    user_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_super_admin)
):
    """Deactivate a staff account and invalidate all sessions."""
    if not has_permission(db, user["sub"], "staff", "delete"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Deactivate user
    db.execute(
        text("UPDATE users SET is_active = FALSE WHERE id = :user_id"),
        {"user_id": user_id}
    )
    
    # Invalidate all sessions
    invalidate_all_sessions(db, user_id)
    
    db.commit()
    
    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="DELETE",
        module="staff",
        description=f"Deactivated staff account: {user_id}",
        ip_address=user.get("ip")
    )
    
    return {"success": True, "message": "Account deactivated"}

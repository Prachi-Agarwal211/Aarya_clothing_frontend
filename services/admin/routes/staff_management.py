"""
Staff identity management — custom roles and staff accounts.

Custom roles let admins define permission bundles (read/write per module);
staff account endpoints CRUD the underlying `users` rows whose role is in
('admin', 'staff', 'super_admin'). All mutations are audit-logged.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.database import get_db
from schemas.staff_permissions import (
    CustomRoleCreate,
    CustomRoleUpdate,
    CustomRoleResponse,
    StaffAccountCreate,
    StaffAccountUpdate,
    StaffAccountResponse,
)
from service.permissions_service import (
    create_custom_role,
    update_custom_role,
    delete_custom_role,
    get_custom_role,
    list_custom_roles,
    get_user_permissions,
    invalidate_all_sessions,
    log_audit_action,
    DEFAULT_PERMISSIONS,
)
from shared.auth_middleware import require_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Custom Role Management ──────────────────────────────────────────────────


@router.post(
    "/api/v1/admin/staff/roles",
    response_model=CustomRoleResponse,
    tags=["Staff Roles"],
    summary="Create custom role",
)
async def create_staff_role(
    role_data: CustomRoleCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new custom role with granular module permissions."""
    return create_custom_role(
        db=db,
        name=role_data.name,
        permissions=role_data.permissions,
        description=role_data.description,
        created_by=user["sub"],
    )


@router.get(
    "/api/v1/admin/staff/roles",
    response_model=List[CustomRoleResponse],
    tags=["Staff Roles"],
    summary="List custom roles",
)
async def list_staff_roles(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List custom roles, optionally filtered to active ones only."""
    return list_custom_roles(db, active_only=active_only)


@router.get(
    "/api/v1/admin/staff/roles/{role_id}",
    response_model=CustomRoleResponse,
    tags=["Staff Roles"],
    summary="Get custom role",
)
async def get_staff_role(
    role_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Fetch a single custom role by id."""
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
    user: dict = Depends(require_admin),
):
    """Update a custom role's name, permissions, description, or active flag."""
    return update_custom_role(
        db=db,
        role_id=role_id,
        name=role_data.name,
        permissions=role_data.permissions,
        description=role_data.description,
        is_active=role_data.is_active,
        updated_by=user["sub"],
    )


@router.delete(
    "/api/v1/admin/staff/roles/{role_id}",
    tags=["Staff Roles"],
    summary="Delete custom role",
)
async def delete_staff_role(
    role_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete a custom role. The service rejects the call if it is still in use."""
    delete_custom_role(db, role_id, user["sub"])
    return {"success": True, "message": f"Role {role_id} deleted"}


@router.get(
    "/api/v1/admin/staff/permission-presets",
    tags=["Staff Roles"],
    summary="Get permission presets",
)
async def get_permission_presets(
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Return the catalog of default permission presets used to seed new roles."""
    return {"presets": DEFAULT_PERMISSIONS}


# ── Staff Account Management ────────────────────────────────────────────────


def _staff_response(row, permissions, custom_role_name=None, two_factor_enabled=False, created_by=None):
    """Build the StaffAccountResponse payload from a SELECTed users row."""
    return {
        "id": row[0],
        "email": row[1],
        "username": row[2],
        "role": row[3],
        "full_name": row[4] or "",
        "custom_role_id": row[7],
        "custom_role_name": custom_role_name,
        "permissions": permissions,
        "phone": row[5] or "",
        "department": row[6] or "",
        "is_active": row[8],
        "two_factor_enabled": two_factor_enabled,
        "last_login": row[10] if len(row) > 10 else None,
        "created_at": row[9],
        "created_by": created_by,
    }


@router.post(
    "/api/v1/admin/staff/accounts",
    response_model=StaffAccountResponse,
    tags=["Staff Accounts"],
    summary="Create staff account",
)
async def create_staff_account(
    account_data: StaffAccountCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new staff account. Only super_admin may create admin accounts."""
    from core.validation import validate_email
    from passlib.context import CryptContext

    if not validate_email(account_data.email):
        raise HTTPException(status_code=400, detail="Invalid email")

    if db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": account_data.email},
    ).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if db.execute(
        text("SELECT id FROM users WHERE username = :username"),
        {"username": account_data.username},
    ).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(account_data.password)

    # Force role to 'staff' unless caller is super_admin promoting to 'admin'.
    safe_role = "staff"
    if user.get("role") == "super_admin" and account_data.role in ("staff", "admin"):
        safe_role = account_data.role

    result = db.execute(
        text(
            """
            INSERT INTO users (email, username, hashed_password, role, full_name,
                               phone, department, custom_role_id, is_active)
            VALUES (:email, :username, :hashed_password, :role, :full_name,
                    :phone, :department, :custom_role_id, :is_active)
            RETURNING id, email, username, role, full_name, phone, department,
                      custom_role_id, is_active, created_at
            """
        ),
        {
            "email": account_data.email,
            "username": account_data.username,
            "hashed_password": hashed_password,
            "role": safe_role,
            "full_name": account_data.full_name or "",
            "phone": account_data.phone or "",
            "department": account_data.department or "",
            "custom_role_id": account_data.custom_role_id,
            "is_active": account_data.is_active if account_data.is_active is not None else True,
        },
    ).fetchone()
    db.commit()

    permissions = get_user_permissions(db, result[0])

    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="CREATE",
        module="staff",
        description=f"Created staff account: {account_data.email}",
        ip_address=user.get("ip"),
        metadata={"user_id": result[0], "role": safe_role},
    )

    # `result` has 10 cols; fake last_login slot for the shared response builder.
    return _staff_response(
        list(result) + [None],
        permissions,
        created_by=user["sub"],
    )


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
    user: dict = Depends(require_admin),
):
    """List staff accounts, optionally filtered by role and active state."""
    conditions = ["role IN ('admin', 'staff', 'super_admin')"]
    params: dict = {}

    if role:
        conditions.append("role = :role")
        params["role"] = role

    if is_active is not None:
        conditions.append("is_active = :is_active")
        params["is_active"] = is_active

    rows = db.execute(
        text(
            f"""
            SELECT u.id, u.email, u.username, u.role, u.full_name, u.phone, u.department,
                   u.custom_role_id, u.is_active, u.created_at, u.last_login
            FROM users u
            WHERE {' AND '.join(conditions)}
            ORDER BY u.created_at DESC
            """
        ),
        params,
    ).fetchall()

    accounts = []
    for row in rows:
        permissions = get_user_permissions(db, row[0])

        custom_role_name = None
        if row[7]:
            cr = db.execute(
                text("SELECT name FROM custom_roles WHERE id = :id"),
                {"id": row[7]},
            ).first()
            if cr:
                custom_role_name = cr[0]

        two_factor = db.execute(
            text("SELECT enabled FROM staff_2fa WHERE user_id = :user_id"),
            {"user_id": row[0]},
        ).first()

        accounts.append(
            _staff_response(
                row,
                permissions,
                custom_role_name=custom_role_name,
                two_factor_enabled=bool(two_factor[0]) if two_factor else False,
            )
        )

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
    user: dict = Depends(require_admin),
):
    """Fetch a single staff account by id."""
    row = db.execute(
        text(
            """
            SELECT id, email, username, role, full_name, phone, department,
                   custom_role_id, is_active, created_at, last_login
            FROM users
            WHERE id = :user_id AND role IN ('admin', 'staff', 'super_admin')
            """
        ),
        {"user_id": user_id},
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Staff account not found")

    permissions = get_user_permissions(db, user_id)
    two_factor = db.execute(
        text("SELECT enabled FROM staff_2fa WHERE user_id = :user_id"),
        {"user_id": user_id},
    ).first()

    return _staff_response(
        row,
        permissions,
        two_factor_enabled=bool(two_factor[0]) if two_factor else False,
    )


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
    user: dict = Depends(require_admin),
):
    """Patch any subset of {full_name, phone, department, role, custom_role_id, is_active}."""
    updates: dict = {}
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

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    row = db.execute(
        text(
            f"""
            UPDATE users SET {set_clause}
            WHERE id = :user_id AND role IN ('admin', 'staff', 'super_admin')
            RETURNING id, email, username, role, full_name, phone, department,
                      custom_role_id, is_active, created_at, last_login
            """
        ),
        {**updates, "user_id": user_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Staff account not found")
    db.commit()

    permissions = get_user_permissions(db, user_id)

    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="UPDATE",
        module="staff",
        description=f"Updated staff account: {row[1]}",
        ip_address=user.get("ip"),
        metadata={"user_id": user_id, "updates": list(updates.keys())},
    )

    return _staff_response(row, permissions, created_by=user["sub"])


@router.post(
    "/api/v1/admin/staff/accounts/{user_id}/deactivate",
    tags=["Staff Accounts"],
    summary="Deactivate staff account",
)
async def deactivate_staff_account(
    user_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Soft-disable an account and invalidate every active session it owns."""
    db.execute(
        text("UPDATE users SET is_active = FALSE WHERE id = :user_id"),
        {"user_id": user_id},
    )
    invalidate_all_sessions(db, user_id)
    db.commit()

    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="DELETE",
        module="staff",
        description=f"Deactivated staff account: {user_id}",
        ip_address=user.get("ip"),
    )

    return {"success": True, "message": "Account deactivated"}


@router.delete(
    "/api/v1/admin/staff/accounts/{user_id}",
    tags=["Staff Accounts"],
    summary="Delete staff account permanently",
)
async def delete_staff_account(
    user_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Hard-delete a staff account. Only super_admin can delete super_admins."""
    if user["sub"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    target = db.execute(
        text(
            "SELECT id, email, role FROM users "
            "WHERE id = :user_id AND role IN ('staff', 'admin', 'super_admin')"
        ),
        {"user_id": user_id},
    ).fetchone()

    if not target:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if target[2] == "super_admin" and user.get("role") != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="Only super admins can delete super admin accounts",
        )

    # FK-safe ordering: dependents first, then the user row.
    for stmt in (
        "DELETE FROM staff_tasks WHERE assigned_to = :user_id",
        "DELETE FROM sessions WHERE user_id = :user_id",
        "DELETE FROM users WHERE id = :user_id",
    ):
        db.execute(text(stmt), {"user_id": user_id})
    db.commit()

    log_audit_action(
        db=db,
        staff_id=user["sub"],
        action_type="DELETE",
        module="staff",
        description=f"Permanently deleted staff account: {target[1]} (ID: {user_id})",
        ip_address=user.get("ip"),
    )

    return {"success": True, "message": "Account permanently deleted"}

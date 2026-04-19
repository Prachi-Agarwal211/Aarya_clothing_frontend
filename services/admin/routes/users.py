"""Admin user management — listing, lookup, status, and create/update.

The order-stat aggregations (count, total spent, last order date) are computed
inline rather than denormalised to keep the user table simple. Volumes are
small enough (admin tooling) that the join cost is fine.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from passlib.hash import bcrypt
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.redis_client import redis_client
from database.database import get_db
from schemas.admin import (
    BulkUserStatusUpdate,
    UserListItem,
    UserStatusUpdate,
)
from shared.auth_middleware import require_admin
from shared.time_utils import now_ist

router = APIRouter(tags=["Admin Users"])


_SORT_COLUMNS = {
    "full_name": "COALESCE(up.full_name, '')",
    "email": "u.email",
    "order_count": "COALESCE(order_stats.order_count, 0)",
    "total_spent": "COALESCE(order_stats.total_spent, 0)",
    "is_active": "u.is_active",
    "created_at": "u.created_at",
}


def _build_user_filters(
    role: Optional[str],
    is_active: Optional[bool],
    search: Optional[str],
) -> tuple[str, dict]:
    where, params = [], {}
    if role:
        where.append("u.role = :role")
        params["role"] = role
    if is_active is not None:
        where.append("u.is_active = :is_active")
        params["is_active"] = is_active
    if search:
        where.append(
            "(u.email ILIKE :search OR u.username ILIKE :search "
            "OR up.full_name ILIKE :search)"
        )
        params["search"] = f"%{search}%"
    clause = "WHERE " + " AND ".join(where) if where else ""
    return clause, params


@router.get(
    "/api/v1/admin/users",
    response_model=List[UserListItem],
)
async def list_users(
    role: Optional[str] = Query(None, regex="^(admin|staff|customer)$"),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    where_clause, params = _build_user_filters(role, is_active, search)
    params.update({"limit": limit, "skip": skip})

    order_column = _SORT_COLUMNS.get(sort_by, "u.created_at")
    order_direction = "ASC" if sort_order == "asc" else "DESC"
    order_clause = f"ORDER BY {order_column} {order_direction}, u.id DESC"

    query = f"""
        SELECT
            u.id, u.email, u.username,
            COALESCE(up.full_name, '') as full_name,
            COALESCE(up.phone, '') as phone,
            u.role, u.is_active, u.created_at,
            COALESCE(order_stats.order_count, 0) as order_count,
            COALESCE(order_stats.total_spent, 0) as total_spent
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN (
            SELECT user_id,
                   COUNT(*) as order_count,
                   COALESCE(SUM(total_amount), 0) as total_spent
            FROM orders
            WHERE status != 'cancelled'
            GROUP BY user_id
        ) order_stats ON u.id = order_stats.user_id
        {where_clause}
        {order_clause}
        LIMIT :limit OFFSET :skip
    """

    rows = db.execute(text(query), params).fetchall()
    return [
        {
            "id": row[0],
            "email": row[1],
            "username": row[2],
            "full_name": row[3],
            "phone": row[4],
            "role": row[5],
            "is_active": row[6],
            "created_at": row[7],
            "order_count": row[8],
            "total_spent": float(row[9]),
        }
        for row in rows
    ]


@router.get("/api/v1/admin/users/count")
async def count_users(
    role: Optional[str] = Query(None, regex="^(admin|staff|customer)$"),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    where_clause, params = _build_user_filters(role, is_active, search)
    query = f"""
        SELECT COUNT(*)
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        {where_clause}
    """
    return {"count": db.execute(text(query), params).scalar()}


@router.get(
    "/api/v1/admin/users/{user_id}",
    response_model=UserListItem,
)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    row = db.execute(
        text(
            """
            SELECT u.id, u.email, u.username,
                   COALESCE(up.full_name, '') as full_name,
                   COALESCE(up.phone, '') as phone,
                   u.role, u.is_active, u.created_at, u.updated_at,
                   COALESCE(order_stats.order_count, 0) as order_count,
                   COALESCE(order_stats.total_spent, 0) as total_spent,
                   order_stats.last_order_date
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN (
                SELECT user_id,
                       COUNT(*) as order_count,
                       COALESCE(SUM(total_amount), 0) as total_spent,
                       MAX(created_at) as last_order_date
                FROM orders WHERE status != 'cancelled'
                GROUP BY user_id
            ) order_stats ON u.id = order_stats.user_id
            WHERE u.id = :user_id
            """
        ),
        {"user_id": user_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": row[0],
        "email": row[1],
        "username": row[2],
        "full_name": row[3],
        "phone": row[4],
        "role": row[5],
        "is_active": row[6],
        "created_at": row[7],
        "updated_at": str(row[8]) if row[8] else None,
        "order_count": row[9],
        "total_spent": float(row[10]),
        "last_order_date": str(row[11]) if row[11] else None,
    }


@router.put("/api/v1/admin/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    exists = db.execute(
        text("SELECT id FROM users WHERE id = :user_id"), {"user_id": user_id}
    ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="User not found")

    db.execute(
        text(
            "UPDATE users SET is_active = :is_active, updated_at = :now "
            "WHERE id = :user_id"
        ),
        {
            "is_active": data.is_active,
            "now": datetime.now(timezone.utc),
            "user_id": user_id,
        },
    )
    db.commit()
    redis_client.invalidate_pattern("admin:dashboard:*")
    redis_client.invalidate_pattern("admin:analytics:*")
    return {
        "message": (
            f"User status updated to {'active' if data.is_active else 'inactive'}"
        )
    }


@router.patch("/api/v1/admin/users/bulk-status")
async def bulk_update_user_status(
    data: BulkUserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    if not data.user_ids:
        raise HTTPException(status_code=400, detail="No user IDs provided")

    db.execute(
        text(
            """
            UPDATE users
            SET is_active = :is_active, updated_at = :now
            WHERE id = ANY(:user_ids)
            """
        ),
        {
            "is_active": data.is_active,
            "now": datetime.now(timezone.utc),
            "user_ids": data.user_ids,
        },
    )
    db.commit()
    redis_client.invalidate_pattern("admin:dashboard:*")
    redis_client.invalidate_pattern("admin:analytics:*")
    return {
        "message": (
            f"Updated {len(data.user_ids)} users to "
            f"{'active' if data.is_active else 'inactive'}"
        )
    }


_VALID_ROLES = {"customer", "staff", "admin", "super_admin"}
_REQUIRED_CREATE_FIELDS = ("email", "first_name", "last_name", "password")


@router.post("/api/v1/admin/users", status_code=201)
async def admin_create_user(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Create a new user from the admin console.

    Newly-created users are marked verified — admins are vouching for the
    identity, so we skip the OTP loop they'd otherwise hit on first login.
    """
    missing = [f for f in _REQUIRED_CREATE_FIELDS if not payload.get(f)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing: {', '.join(missing)}")

    email = payload["email"].lower().strip()
    if db.execute(
        text("SELECT id FROM users WHERE LOWER(email) = :e"), {"e": email}
    ).fetchone():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = payload.get("role", "customer")
    if role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    first_name = payload["first_name"].strip()
    last_name = payload["last_name"].strip()
    full_name = f"{first_name} {last_name}".strip()
    username = payload.get("username") or email.split("@")[0]
    now = now_ist().replace(tzinfo=None)

    result = db.execute(
        text(
            "INSERT INTO users (email, username, first_name, last_name, full_name, "
            "phone, hashed_password, role, is_active, is_verified, created_at, "
            "updated_at) "
            "VALUES (:email, :username, :fn, :ln, :full, :phone, :pw, :role, "
            "        :active, TRUE, :now, :now) RETURNING id"
        ),
        {
            "email": email,
            "username": username,
            "fn": first_name,
            "ln": last_name,
            "full": full_name,
            "phone": payload.get("phone"),
            "pw": bcrypt.hash(payload["password"]),
            "role": role,
            "active": payload.get("is_active", True),
            "now": now,
        },
    )
    user_id = result.scalar()
    db.commit()
    redis_client.invalidate_pattern("admin:dashboard:*")
    return {"id": user_id, "email": email, "role": role}


_UPDATABLE_FIELDS = {"first_name", "last_name", "phone", "role", "is_active", "is_verified"}


@router.patch("/api/v1/admin/users/{user_id}")
async def admin_update_user(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Patch editable user fields. Recomputes ``full_name`` if either name part
    changes so reads from either column stay consistent."""
    if not db.execute(
        text("SELECT id FROM users WHERE id = :id"), {"id": user_id}
    ).fetchone():
        raise HTTPException(status_code=404, detail="User not found")

    sets = ["updated_at = :now"]
    params = {"id": user_id, "now": now_ist().replace(tzinfo=None)}
    for f in _UPDATABLE_FIELDS:
        if f in payload:
            sets.append(f"{f} = :{f}")
            params[f] = payload[f]

    if "first_name" in payload or "last_name" in payload:
        existing = db.execute(
            text("SELECT first_name, last_name FROM users WHERE id = :id"),
            {"id": user_id},
        ).fetchone()
        first = (
            payload["first_name"]
            if payload.get("first_name") is not None
            else (existing._mapping["first_name"] or "")
        )
        last = (
            payload["last_name"]
            if payload.get("last_name") is not None
            else (existing._mapping["last_name"] or "")
        )
        sets.append("full_name = :full_name")
        params["full_name"] = f"{first} {last}".strip()

    if len(sets) == 1:
        return {"message": "Nothing to update"}

    db.execute(text(f"UPDATE users SET {', '.join(sets)} WHERE id = :id"), params)
    db.commit()
    redis_client.invalidate_pattern("admin:dashboard:*")
    return {"id": user_id, "message": "User updated"}

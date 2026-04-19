"""
Customer profile router.

Owns the ``/api/v1/me/*`` endpoints that return the authenticated user's
profile, basic stats, and paginated order history. Backed by raw SQL
because the data shape is wide and these endpoints are read-only — the
cost of constructing full ORM graphs would dominate the response time.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.database import get_db
from shared.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Customer Profile"])


@router.get("/api/v1/me/profile")
async def get_customer_profile(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return the caller's profile plus order, address, and review counts."""
    user_id = current_user["user_id"]

    user = db.execute(
        text(
            "SELECT id, email, username, full_name, phone, role, is_active, created_at "
            "FROM users WHERE id = :id"
        ),
        {"id": user_id},
    ).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    order_stats = db.execute(
        text(
            "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) "
            "FROM orders WHERE user_id = :uid AND status != 'cancelled'"
        ),
        {"uid": user_id},
    ).fetchone()

    address_count = db.execute(
        text("SELECT COUNT(*) FROM addresses WHERE user_id = :uid"),
        {"uid": user_id},
    ).scalar() or 0
    review_count = db.execute(
        text("SELECT COUNT(*) FROM reviews WHERE user_id = :uid"),
        {"uid": user_id},
    ).scalar() or 0

    return {
        "user": {
            "id": user[0],
            "email": user[1],
            "username": user[2],
            "full_name": user[3],
            "phone": user[4],
            "role": str(user[5]),
            "is_active": user[6],
            "member_since": str(user[7]),
        },
        "stats": {
            "total_orders": order_stats[0] if order_stats else 0,
            "total_spent": float(order_stats[1]) if order_stats else 0,
            "saved_addresses": address_count,
            "reviews_written": review_count,
        },
    }


@router.get("/api/v1/me")
async def get_customer_me(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Backward-compatible alias for ``/api/v1/me/profile``."""
    return await get_customer_profile(db=db, current_user=current_user)


@router.get("/api/v1/me/order-history")
async def get_order_history(
    status_filter: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Paginated order history.

    ``status_filter`` is optional and matches the ``orders.status`` column
    verbatim; pass values like ``"pending"`` or ``"delivered"``.
    """
    user_id = current_user["user_id"]
    where = "WHERE o.user_id = :uid"
    params: dict = {"uid": user_id, "lim": limit, "off": skip}
    if status_filter:
        where += " AND o.status = :status"
        params["status"] = status_filter

    rows = db.execute(
        text(
            f"""
            SELECT o.id, o.total_amount, o.status, o.created_at,
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
            FROM orders o {where}
            ORDER BY o.created_at DESC
            LIMIT :lim OFFSET :off
            """
        ),
        params,
    ).fetchall()
    total = db.execute(
        text(f"SELECT COUNT(*) FROM orders o {where}"),
        params,
    ).scalar()

    return {
        "orders": [
            {
                "id": r[0],
                "total_amount": float(r[1]),
                "status": r[2],
                "created_at": str(r[3]),
                "item_count": r[4],
            }
            for r in rows
        ],
        "total": total,
        "page": skip // limit + 1,
    }

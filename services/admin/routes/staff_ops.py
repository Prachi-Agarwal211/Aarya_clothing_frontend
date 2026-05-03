"""
Staff operations router.

Owns the day-to-day staff-fulfilment surface that is intentionally simpler
than the full admin panel:

* Pending tasks queue and completion.
* In-app notifications (read state).
* A compact fulfilment dashboard and pending orders list.
* The quick-action launcher used by the staff app.

Everything here requires a staff role; admin endpoints with broader scope
live in their own router.
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.database import get_db
from schemas.admin import TaskComplete
from shared.auth_middleware import require_staff
from shared.time_utils import now_ist

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Staff"])


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


@router.get("/api/v1/staff/tasks", tags=["Staff Tasks"])
async def get_tasks(
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Open staff tasks ordered by priority then due time."""
    rows = db.execute(
        text(
            "SELECT * FROM staff_tasks "
            "WHERE status != 'completed' "
            "ORDER BY CASE priority "
            "  WHEN 'high' THEN 1 "
            "  WHEN 'medium' THEN 2 "
            "  ELSE 3 END, "
            "due_time ASC NULLS LAST"
        )
    ).fetchall()
    return {"pending_tasks": [dict(r._mapping) for r in rows]}


@router.post("/api/v1/staff/tasks/{task_id}/complete", tags=["Staff Tasks"])
async def complete_task(
    task_id: int,
    data: TaskComplete,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Mark a staff task as completed."""
    db.execute(
        text(
            "UPDATE staff_tasks "
            "SET status = 'completed', completed_at = :now, updated_at = :now "
            "WHERE id = :id"
        ),
        {"now": now_ist(), "id": task_id},
    )
    db.commit()
    return {"message": "Task completed"}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


@router.get("/api/v1/staff/notifications", tags=["Staff Notifications"])
async def get_notifications(
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Unread in-app notifications for the current staff user (or broadcast)."""
    uid = user.get("user_id")
    rows = db.execute(
        text(
            "SELECT * FROM staff_notifications "
            "WHERE (user_id = :uid OR user_id IS NULL) AND is_read = false "
            "ORDER BY created_at DESC LIMIT 50"
        ),
        {"uid": uid},
    ).fetchall()
    return {"alerts": [dict(r._mapping) for r in rows]}


@router.put("/api/v1/staff/notifications/{notif_id}/read", tags=["Staff Notifications"])
async def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Mark one notification as read."""
    db.execute(
        text("UPDATE staff_notifications SET is_read = true WHERE id = :id"),
        {"id": notif_id},
    )
    db.commit()
    return {"message": "Notification marked as read"}


# ---------------------------------------------------------------------------
# Quick actions launcher
# ---------------------------------------------------------------------------


@router.get("/api/v1/staff/quick-actions")
async def get_quick_actions():
    """Hard-coded launcher items the staff app pins to its home screen."""
    return {
        "actions": [
            {
                "name": "Add Stock",
                "endpoint": "/api/v1/staff/inventory/add-stock",
                "icon": "plus-box",
            },
            {
                "name": "Process Orders",
                "endpoint": "/api/v1/staff/orders/pending",
                "icon": "package",
            },
            {
                "name": "Low Stock Alert",
                "endpoint": "/api/v1/staff/inventory/low-stock",
                "icon": "alert",
            },
            {
                "name": "Stock Movement",
                "endpoint": "/api/v1/staff/inventory/movements",
                "icon": "chart-line",
            },
        ]
    }


# ---------------------------------------------------------------------------
# Fulfilment dashboard
# ---------------------------------------------------------------------------


@router.get("/api/v1/staff/dashboard")
async def staff_dashboard(
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Compact fulfilment dashboard: pending orders, today's orders, stock alerts."""
    today = (
        now_ist()
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .replace(tzinfo=None)
    )
    pending = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM orders "
                "WHERE status = 'confirmed'"
            )
        ).scalar()
        or 0
    )
    today_orders = (
        db.execute(
            text("SELECT COUNT(*) FROM orders WHERE created_at >= :t"),
            {"t": today},
        ).scalar()
        or 0
    )
    low_stock = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM inventory "
                "WHERE is_active = TRUE AND quantity > 0 AND quantity <= low_stock_threshold"
            )
        ).scalar()
        or 0
    )
    out_of_stock = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM inventory "
                "WHERE is_active = TRUE AND quantity = 0"
            )
        ).scalar()
        or 0
    )
    return {
        "pending_orders": pending,
        "today_orders": today_orders,
        "low_stock_variants": low_stock,
        "out_of_stock_variants": out_of_stock,
        "as_of": now_ist().isoformat(),
    }


@router.get("/api/v1/staff/orders/pending")
async def staff_orders_pending(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Paginated pending-orders queue used by the staff fulfilment app."""
    offset = (page - 1) * page_size
    total = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM orders "
                "WHERE status = 'confirmed'"
            )
        ).scalar()
        or 0
    )
    rows = db.execute(
        text(
            "SELECT o.id, o.invoice_number, o.status, o.total_amount, o.created_at, "
            "       COALESCE(u.full_name, u.email) AS customer "
            "FROM orders o LEFT JOIN users u ON u.id = o.user_id "
            "WHERE o.status = 'confirmed' "
            "ORDER BY o.created_at ASC LIMIT :lim OFFSET :off"
        ),
        {"lim": page_size, "off": offset},
    ).fetchall()
    return {
        "items": [dict(r._mapping) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.put("/api/v1/staff/orders/{order_id}/ship")
async def staff_ship_order(
    order_id: int,
    data: dict, # {tracking_number: str, notes?: str}
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Mark a confirmed order as shipped (staff action)."""
    track = data.get("tracking_number")
    if not track or not str(track).strip():
        raise HTTPException(status_code=400, detail="Tracking number is required")
    notes = data.get("notes") or f"Shipped (POD: {track})"
    staff_id = user.get("user_id") or user.get("id")
    now = now_ist().replace(tzinfo=None)

    res = db.execute(
        text(
            "UPDATE orders SET status = 'shipped', tracking_number = :track, "
            "updated_at = :now, shipped_at = :now "
            "WHERE id = :id AND status = 'confirmed'"
        ),
        {"id": order_id, "track": track, "now": now}
    )
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Order not found or not in 'confirmed' status")
    
    # Add tracking history
    db.execute(
        text(
            "INSERT INTO order_tracking (order_id, status, notes, updated_by, created_at) "
            "VALUES (:oid, 'shipped', :notes, :staff, :now)"
        ),
        {"oid": order_id, "notes": notes, "staff": staff_id, "now": now}
    )
    db.commit()
    return {"id": order_id, "status": "shipped"}


@router.put("/api/v1/staff/orders/{order_id}/deliver")
async def staff_deliver_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Mark a shipped order as delivered (staff action)."""
    staff_id = user.get("user_id") or user.get("id")
    now = now_ist().replace(tzinfo=None)

    res = db.execute(
        text(
            "UPDATE orders SET status = 'delivered', updated_at = :now, delivered_at = :now "
            "WHERE id = :id AND status = 'shipped'"
        ),
        {"id": order_id, "now": now}
    )
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Order not found or not in 'shipped' status")
    
    # Add tracking history
    db.execute(
        text(
            "INSERT INTO order_tracking (order_id, status, notes, updated_by, created_at) "
            "VALUES (:oid, 'delivered', 'Order marked as delivered', :staff, :now)"
        ),
        {"oid": order_id, "staff": staff_id, "now": now}
    )
    db.commit()
    return {"id": order_id, "status": "delivered"}

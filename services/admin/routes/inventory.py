"""Admin inventory CRUD + stock movements.

Direct read/write surface for the inventory table from the admin tools.
Customer reads still go through commerce; this is for ops adjusting stock,
auditing movement history, and surfacing low/out-of-stock dashboards.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.redis_client import redis_client
from database.database import get_db
from shared.auth_middleware import require_admin, require_staff
from shared.time_utils import now_ist

router = APIRouter(tags=["Admin Inventory"])


@router.post("/api/v1/admin/inventory", status_code=201, tags=["Admin Inventory"])
async def admin_create_inventory(
    data: dict, db: Session = Depends(get_db), user: dict = Depends(require_staff)
):
    """Create an inventory record (admin/staff only)."""
    required = ["product_id", "sku", "quantity"]
    for f in required:
        if f not in data:
            raise HTTPException(status_code=400, detail=f"Missing required field: {f}")
    result = db.execute(
        text("""
        INSERT INTO inventory (product_id, sku, size, color, image_url,
            quantity, reserved_quantity, low_stock_threshold, is_active, created_at, updated_at)
        VALUES (:pid, :sku, :size, :color, :image_url,
            :qty, 0, :threshold, TRUE, :now, :now)
        RETURNING id
    """),
        {
            "pid": data["product_id"],
            "sku": data["sku"],
            "size": data.get("size") or "",
            "color": data.get("color") or "",
            "image_url": data.get("image_url") or "",
            "qty": data["quantity"],
            "threshold": data.get("low_stock_threshold", 5),
            "now": now_ist().replace(tzinfo=None),
        },
    )
    inv_id = result.scalar()
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"id": inv_id, "message": "Inventory record created"}


@router.patch("/api/v1/admin/inventory/{inventory_id}", tags=["Admin Inventory"])
async def admin_update_inventory(
    inventory_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Update an inventory record (admin/staff only)."""
    inv = db.execute(
        text("SELECT id FROM inventory WHERE id = :id"),
        {"id": inventory_id},
    ).fetchone()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    ALLOWED = {
        "quantity",
        "low_stock_threshold",
        "size",
        "color",
        "color_hex",
        "image_url",
        "is_active",
    }
    sets, params = (
        ["updated_at = :now"],
        {"id": inventory_id, "now": now_ist().replace(tzinfo=None)},
    )
    for field in ALLOWED:
        if field in data:
            sets.append(f"{field} = :{field}")
            params[field] = data[field]
    if len(sets) == 1:
        return {"message": "Nothing to update"}
    db.execute(
        text(f"UPDATE inventory SET {', '.join(sets)} WHERE id = :id"),
        params,
    )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"message": "Inventory updated", "id": inventory_id}


@router.get("/api/v1/admin/inventory/movements", tags=["Admin Inventory"])
async def admin_inventory_movements(
    product_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get inventory movement history (admin only)."""
    offset = (page - 1) * limit
    where, params = "", {"lim": limit, "off": offset}
    if product_id:
        where = "WHERE pv.product_id = :pid"
        params["pid"] = product_id
    rows = db.execute(
        text(f"""
        SELECT im.*, pv.sku, pv.size, pv.color,
               p.name AS product_name
        FROM inventory_movements im
        JOIN inventory pv ON pv.id = im.inventory_id
        JOIN products p ON p.id = pv.product_id
        {where}
        ORDER BY im.created_at DESC LIMIT :lim OFFSET :off
    """),
        params,
    ).fetchall()
    return {"movements": [dict(r._mapping) for r in rows]}


@router.get("/api/v1/admin/inventory/out-of-stock", tags=["Admin Inventory"])
async def admin_out_of_stock(
    db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    """Get out-of-stock inventory items."""
    rows = db.execute(
        text(
            "SELECT pv.*, p.name AS product_name FROM inventory pv "
            "JOIN products p ON p.id = pv.product_id "
            "WHERE pv.quantity = 0 ORDER BY p.name"
        )
    ).fetchall()
    return {"items": [dict(r._mapping) for r in rows]}


@router.get("/api/v1/admin/inventory", tags=["Admin Inventory"])
async def admin_list_inventory(
    product_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """List inventory variants with pagination."""
    offset = (page - 1) * page_size
    where, params = ["1=1"], {"lim": page_size, "off": offset}
    if product_id:
        where.append("pv.product_id = :pid")
        params["pid"] = product_id
    if search:
        where.append("(pv.sku ILIKE :q OR p.name ILIKE :q OR pv.color ILIKE :q OR pv.size ILIKE :q)")
        params["q"] = f"%{search}%"
    where_sql = " AND ".join(where)
    total = db.execute(
        text(
            "SELECT COUNT(*) FROM inventory pv JOIN products p ON p.id = pv.product_id "
            f"WHERE {where_sql}"
        ),
        params,
    ).scalar() or 0
    rows = db.execute(
        text(
            "SELECT pv.id, pv.product_id, p.name AS product_name, pv.sku, pv.size, "
            "pv.color, pv.color_hex, pv.image_url, pv.quantity, pv.reserved_quantity, "
            "pv.low_stock_threshold, pv.is_active, pv.updated_at "
            "FROM inventory pv JOIN products p ON p.id = pv.product_id "
            f"WHERE {where_sql} "
            "ORDER BY p.name, pv.color, pv.size LIMIT :lim OFFSET :off"
        ),
        params,
    ).fetchall()
    return {
        "items": [dict(r._mapping) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/api/v1/admin/inventory/low-stock", tags=["Admin Inventory"])
async def admin_low_stock(
    db: Session = Depends(get_db), user: dict = Depends(require_staff)
):
    """List variants where quantity <= low_stock_threshold (and > 0)."""
    rows = db.execute(
        text(
            "SELECT pv.id, pv.product_id, p.name AS product_name, pv.sku, pv.size, "
            "pv.color, pv.quantity, pv.low_stock_threshold "
            "FROM inventory pv JOIN products p ON p.id = pv.product_id "
            "WHERE pv.is_active = TRUE AND pv.quantity > 0 "
            "  AND pv.quantity <= pv.low_stock_threshold "
            "ORDER BY pv.quantity ASC, p.name"
        )
    ).fetchall()
    return {"items": [dict(r._mapping) for r in rows], "total": len(rows)}


@router.post("/api/v1/admin/inventory/{variant_id}/adjust", tags=["Admin Inventory"])
async def admin_adjust_inventory(
    variant_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Apply a stock movement to a variant.

    payload = {
      "delta": int,            # +N to receive stock, -N to remove stock
      "set_to": int,           # alternatively, set absolute quantity (e.g. 0 = OOS)
      "reason": str,           # 'manual', 'restock', 'correction', 'sale', 'return'
      "notes": str | None,
    }
    Audit row written to inventory_movements (inventory_id, product_id, adjustment,
    reason, notes, performed_by, created_at).
    """
    variant = db.execute(
        text("SELECT id, product_id, quantity FROM inventory WHERE id = :id"),
        {"id": variant_id},
    ).fetchone()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    current_qty = int(variant._mapping["quantity"])
    delta = payload.get("delta")
    set_to = payload.get("set_to")
    if delta is None and set_to is None:
        raise HTTPException(status_code=400, detail="Provide 'delta' or 'set_to'")
    new_qty = int(set_to) if set_to is not None else current_qty + int(delta)
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Resulting quantity cannot be negative")
    movement_delta = new_qty - current_qty
    now = now_ist().replace(tzinfo=None)
    db.execute(
        text(
            "UPDATE inventory SET quantity = :q, updated_at = :now WHERE id = :id"
        ),
        {"q": new_qty, "now": now, "id": variant_id},
    )
    db.execute(
        text(
            "INSERT INTO inventory_movements (inventory_id, product_id, adjustment, reason, notes, "
            "performed_by, created_at) "
            "VALUES (:inventory_id, :product_id, :adjustment, :reason, :notes, :by, :now)"
        ),
        {
            "inventory_id": variant_id,
            "product_id": int(variant._mapping["product_id"]) if variant._mapping["product_id"] is not None else None,
            "adjustment": movement_delta,
            "reason": payload.get("reason") or "manual",
            "notes": payload.get("notes"),
            "by": user.get("user_id") or user.get("id"),
            "now": now,
        },
    )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {
        "id": variant_id,
        "previous_quantity": current_qty,
        "new_quantity": new_qty,
        "delta": movement_delta,
    }


@router.post("/api/v1/admin/inventory/adjust", tags=["Admin Inventory"])
async def admin_adjust_inventory_by_sku(
    payload: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Backward-compatible stock adjustment endpoint using SKU."""
    sku = (payload.get("sku") or "").strip()
    adjustment = payload.get("adjustment")
    if not sku:
        raise HTTPException(status_code=400, detail="sku is required")
    if adjustment is None:
        raise HTTPException(status_code=400, detail="adjustment is required")

    variant = db.execute(
        text("SELECT id, product_id, quantity FROM inventory WHERE sku = :sku"),
        {"sku": sku},
    ).fetchone()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found for SKU")

    variant_id = int(variant._mapping["id"])
    current_qty = int(variant._mapping["quantity"])
    delta = int(adjustment)
    new_qty = max(0, current_qty + delta)
    movement_delta = new_qty - current_qty
    now = now_ist().replace(tzinfo=None)

    db.execute(
        text("UPDATE inventory SET quantity = :q, updated_at = :now WHERE id = :id"),
        {"q": new_qty, "now": now, "id": variant_id},
    )
    db.execute(
        text(
            "INSERT INTO inventory_movements (inventory_id, product_id, adjustment, reason, notes, "
            "performed_by, created_at) "
            "VALUES (:inventory_id, :product_id, :adjustment, :reason, :notes, :by, :now)"
        ),
        {
            "inventory_id": variant_id,
            "product_id": int(variant._mapping["product_id"]) if variant._mapping["product_id"] is not None else None,
            "adjustment": movement_delta,
            "reason": payload.get("reason") or "manual",
            "notes": payload.get("notes"),
            "by": user.get("user_id") or user.get("id"),
            "now": now,
        },
    )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {
        "id": variant_id,
        "sku": sku,
        "previous_quantity": current_qty,
        "adjustment": delta,
        "new_quantity": new_qty,
    }

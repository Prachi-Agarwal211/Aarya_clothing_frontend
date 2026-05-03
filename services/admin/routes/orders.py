"""
Admin orders router - list, view, and update customer orders.
Optimized for high-volume listing and detailed status tracking.
"""

import logging
from typing import List, Optional, Dict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.database import get_db
from schemas.admin import OrderListItem, OrderStatusUpdate, BulkOrderUpdate
from shared.auth_middleware import require_admin, require_staff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/orders", tags=["Admin Orders"])


@router.get("", response_model=dict)
async def list_orders(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """
    List all orders with customer details.
    Supports filtering by status and searching by order number or email.
    """
    where, params = [], {"lim": limit, "off": skip}
    
    if status:
        where.append("o.status = :status")
        params["status"] = status
    
    if search:
        # Support search by invoice_number, email, or name
        where.append("(o.invoice_number ILIKE :search OR u.email ILIKE :search OR u.full_name ILIKE :search)")
        params["search"] = f"%{search}%"
        
    where_clause = "WHERE " + " AND ".join(where) if where else ""

    # Using raw SQL for efficient joining and data mapping
    rows = db.execute(
        text(f"""
        SELECT o.id, o.user_id, o.subtotal, o.shipping_cost,
               o.total_amount, o.payment_method, o.status, o.tracking_number,
               o.order_notes, o.created_at, o.updated_at,
               u.email as customer_email, COALESCE(u.full_name, u.username) as customer_name,
               COALESCE(u.phone, '') as customer_phone,
               o.invoice_number, o.shipping_address, o.razorpay_payment_id
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        {where_clause}
        ORDER BY o.created_at DESC
        LIMIT :lim OFFSET :off
    """),
        params,
    ).fetchall()

    count_params = {k: v for k, v in params.items() if k not in ("lim", "off")}
    total = (
        db.execute(
            text(
                f"SELECT COUNT(*) FROM orders o LEFT JOIN users u ON u.id = o.user_id {where_clause}"
            ),
            count_params,
        ).scalar()
        or 0
    )

    # Collect order IDs for batch fetching order items
    order_ids = [r[0] for r in rows]

    # Batch fetch order items for all orders in a single query (avoids N+1)
    items_by_order = {}
    if order_ids:
        placeholders = ", ".join(f":oid_{i}" for i in range(len(order_ids)))
        items_params = {f"oid_{i}": oid for i, oid in enumerate(order_ids)}
        items_rows = db.execute(
            text(f"""
                SELECT oi.order_id, oi.id as item_id, oi.product_id, oi.product_name,
                       oi.size, oi.color, COALESCE(oi.color_hex, iv.color_hex) as color_hex, oi.quantity, oi.unit_price, oi.line_total,
                       p.name as product_name_from_catalog,
                       pi.image_url as image_url
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
                LEFT JOIN inventory iv ON iv.id = oi.variant_id
                WHERE oi.order_id IN ({placeholders})
                ORDER BY oi.order_id, oi.id
            """),
            items_params,
        ).fetchall()
        for item_row in items_rows:
            oid = item_row[0]
            if oid not in items_by_order:
                items_by_order[oid] = []
            items_by_order[oid].append(
                {
                    "id": item_row[1],
                    "product_id": item_row[2],
                    "product_name": item_row[3] or item_row[10] or "Unknown Product",
                    "size": item_row[4],
                    "color": item_row[5],
                    "color_hex": item_row[6],
                    "quantity": item_row[7],
                    "unit_price": float(item_row[8] or 0),
                    "total_price": float(item_row[9] or 0),
                    "image_url": item_row[11],
                }
            )

    import json
    orders = []
    for r in rows:
        order_id = r[0]
        items = items_by_order.get(order_id, [])

        # Enhanced customer info resolution
        email = r[11]
        name = r[12]
        phone = r[13]

        # If user is missing (guest), try to parse from shipping address
        if not email or not name:
            try:
                addr_json = r[15]
                if addr_json:
                    addr = json.loads(addr_json) if isinstance(addr_json, str) else addr_json
                    name = name or addr.get("name") or addr.get("full_name")
                    email = email or addr.get("email")
                    phone = phone or addr.get("phone")
            except Exception:
                pass

        orders.append({
            "id": order_id,
            "user_id": r[1],
            "subtotal": float(r[2] or 0),
            "shipping_cost": float(r[3] or 0),
            "total_amount": float(r[4] or 0),
            "payment_method": r[5],
            "status": r[6],
            "tracking_number": r[7],
            "order_notes": r[8],
            "created_at": str(r[9]),
            "updated_at": str(r[10]),
            "customer_email": email or "Guest",
            "customer_name": name or "Guest Customer",
            "customer_phone": phone or "-",
            "invoice_number": r[14],
            "shipping_address": r[15],
            "razorpay_payment_id": r[16],
            "order_number": f"ORD-{r[0]:06d}",
            "items": items,
            "item_count": sum(it["quantity"] for it in items),
        })

    # Get accurate status counts for the current filter
    status_counts_rows = db.execute(
        text(f"""
            SELECT o.status, COUNT(*) 
            FROM orders o 
            LEFT JOIN users u ON u.id = o.user_id 
            {where_clause} 
            GROUP BY o.status
        """),
        count_params
    ).fetchall()
    status_counts = {row[0]: row[1] for row in status_counts_rows}
    
    # Get total revenue for the current filter
    total_revenue = db.execute(
        text(f"""
            SELECT SUM(o.total_amount) 
            FROM orders o 
            LEFT JOIN users u ON u.id = o.user_id 
            {where_clause}
        """),
        count_params
    ).scalar() or 0

    return {
        "orders": orders, 
        "total": total, 
        "skip": skip, 
        "limit": limit,
        "status_counts": status_counts,
        "total_revenue": float(total_revenue)
    }


@router.get("/{order_id}", response_model=dict)
async def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Get single order detail with customer and items."""
    order = db.execute(
        text("""
        SELECT o.*, u.email as customer_email, u.full_name as customer_name, u.phone as customer_phone
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.id = :id
    """),
        {"id": order_id},
    ).mappings().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items_rows = db.execute(
        text("""
        SELECT oi.*, p.name as product_name_catalog, pi.image_url, iv.color_hex as fallback_color_hex
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
        LEFT JOIN inventory iv ON iv.id = oi.variant_id
        WHERE oi.order_id = :oid
    """),
        {"oid": order_id},
    ).mappings().all()

    items = []
    for item in items_rows:
        items.append({
            "id": item["id"],
            "product_id": item["product_id"],
            "product_name": item["product_name"] or item["product_name_catalog"] or "Unknown",
            "sku": item["sku"],
            "size": item["size"],
            "color": item["color"],
            "color_hex": item["color_hex"] or item["fallback_color_hex"],
            "quantity": item["quantity"],
            "unit_price": float(item["unit_price"] or 0),
            "total_price": float(item["line_total"] or 0),
            "image_url": item["image_url"],
        })

    order_dict = dict(order)
    # Convert Decimals to floats for JSON
    for key in ["subtotal", "shipping_cost", "total_amount"]:
        if order_dict.get(key) is not None:
            order_dict[key] = float(order_dict[key])
    
    order_dict["items"] = items
    order_dict["order_number"] = f"ORD-{order_id:06d}"
    
    return order_dict


@router.get("/{order_id}/tracking", response_model=dict)
async def get_order_tracking(
    order_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Get status history/tracking entries for an order."""
    rows = db.execute(
        text("""
            SELECT id, status, location, notes, created_at, updated_by
            FROM order_tracking
            WHERE order_id = :oid
            ORDER BY created_at DESC
        """),
        {"oid": order_id}
    ).mappings().all()
    
    return {"tracking": [dict(r) for r in rows]}


@router.patch("/{order_id}/status", status_code=204)
async def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Update order status and/or tracking number (admin/staff)."""
    # 1. Verify existence
    existing = db.execute(
        text("SELECT status FROM orders WHERE id = :id"), {"id": order_id}
    ).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. Perform update
    sets, params = [], {"id": order_id}
    if data.status:
        sets.append("status = :status")
        params["status"] = data.status
    
    pod = data.get_pod()
    if pod is not None:
        sets.append("tracking_number = :tracking")
        params["tracking"] = pod
        
    if not sets:
        return

    db.execute(
        text(f"UPDATE orders SET {', '.join(sets)}, updated_at = NOW() WHERE id = :id"),
        params,
    )
    
    # 3. Add history entry
    if data.status:
        staff_id = user.get("user_id")
        db.execute(
            text("""
                INSERT INTO order_tracking (order_id, status, notes, updated_by, created_at)
                VALUES (:oid, :status, :notes, :staff, NOW())
            """),
            {
                "oid": order_id,
                "status": data.status,
                "notes": data.notes or f"Status updated to {data.status}",
                "staff": staff_id
            }
        )

    db.commit()
    return


@router.patch("/bulk-status", status_code=200)
async def bulk_update_order_status(
    data: BulkOrderUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Update status for multiple orders at once."""
    if not data.order_ids:
        return {"updated": 0}
        
    staff_id = user.get("user_id")
    now = datetime.now()
    
    # 1. Update the orders
    sets = ["status = :status", "updated_at = :now"]
    params = {"status": data.status, "now": now, "oids": tuple(data.order_ids)}
    
    if data.pod_number:
        sets.append("tracking_number = :pod")
        params["pod"] = data.pod_number
    if data.courier_name:
        sets.append("courier_name = :courier")
        params["courier"] = data.courier_name
        
    db.execute(
        text(f"UPDATE orders SET {', '.join(sets)} WHERE id IN :oids"),
        params
    )
    
    # 2. Add tracking history for each order
    for oid in data.order_ids:
        db.execute(
            text("""
                INSERT INTO order_tracking (order_id, status, notes, updated_by, created_at)
                VALUES (:oid, :status, :notes, :staff, :now)
            """),
            {
                "oid": oid,
                "status": data.status,
                "notes": data.notes or f"Bulk status update to {data.status}",
                "staff": staff_id,
                "now": now
            }
        )
    
    db.commit()
    return {"updated": len(data.order_ids)}


@router.delete("/{order_id}", status_code=200)
async def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete an order and its related items."""
    # Verify existence
    res = db.execute(text("SELECT status FROM orders WHERE id = :id"), {"id": order_id}).fetchone()
    if not res:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Delete order (cascades to order_items and order_tracking)
    db.execute(text("DELETE FROM orders WHERE id = :id"), {"id": order_id})
    db.commit()
    
    return {"message": "Order deleted successfully", "id": order_id}


@router.post("/bulk-delete", status_code=200)
async def bulk_delete_orders(
    data: Dict[str, List[int]],
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete multiple orders."""
    order_ids = data.get("order_ids", [])
    if not order_ids:
        return {"deleted": 0}
        
    db.execute(
        text("DELETE FROM orders WHERE id IN :oids"),
        {"oids": tuple(order_ids)}
    )
    db.commit()
    
    return {"message": f"Deleted {len(order_ids)} orders", "deleted": len(order_ids)}


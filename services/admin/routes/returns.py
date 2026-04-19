"""Admin returns management — list, view, approve/reject, receive, refund + bulk ops."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.database import get_db
from shared.auth_middleware import require_admin
from shared.time_utils import now_ist

router = APIRouter()


def _now_naive():
    """All return_request timestamp columns are naive — Postgres runs in IST."""
    return now_ist().replace(tzinfo=None)


# ==================== Bulk Approve / Reject ====================


@router.post("/api/v1/admin/returns/bulk-approve", tags=["Admin Returns"])
async def admin_bulk_approve_returns(
    payload: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Approve every pending return whose id is in `return_ids`."""
    ids = payload.get("return_ids") or []
    if not ids:
        raise HTTPException(status_code=400, detail="No return_ids provided")
    db.execute(
        text(
            "UPDATE return_requests SET status = 'approved', approved_at = :now, "
            "updated_at = :now WHERE id = ANY(:ids) AND status = 'pending'"
        ),
        {"ids": ids, "now": _now_naive()},
    )
    db.commit()
    return {"approved": len(ids)}


@router.post("/api/v1/admin/returns/bulk-reject", tags=["Admin Returns"])
async def admin_bulk_reject_returns(
    payload: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Reject every pending return whose id is in `return_ids`."""
    ids = payload.get("return_ids") or []
    if not ids:
        raise HTTPException(status_code=400, detail="No return_ids provided")
    reason = payload.get("rejection_reason") or "Rejected"
    db.execute(
        text(
            "UPDATE return_requests SET status = 'rejected', rejection_reason = :r, "
            "updated_at = :now WHERE id = ANY(:ids) AND status = 'pending'"
        ),
        {"ids": ids, "r": reason, "now": _now_naive()},
    )
    db.commit()
    return {"rejected": len(ids)}


# ==================== Per-return CRUD ====================


@router.get("/api/v1/admin/returns", tags=["Admin Returns"])
async def admin_list_returns(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List return requests, optionally filtered by status."""
    where, params = "", {"limit": limit, "skip": skip}
    if status_filter:
        where = "WHERE r.status = :status"
        params["status"] = status_filter
    rows = db.execute(
        text(
            f"""
            SELECT r.id, r.order_id, r.user_id, r.reason, r.description,
                   r.status, r.refund_amount, r.requested_at, r.updated_at,
                   u.email as customer_email, u.username as customer_username
            FROM return_requests r
            LEFT JOIN users u ON r.user_id = u.id
            {where}
            ORDER BY r.requested_at DESC
            LIMIT :limit OFFSET :skip
            """
        ),
        params,
    ).fetchall()
    returns = [
        {
            "id": r[0], "order_id": r[1], "user_id": r[2], "reason": r[3],
            "description": r[4], "status": r[5],
            "refund_amount": float(r[6]) if r[6] else None,
            "requested_at": r[7], "created_at": r[7], "updated_at": r[8],
            "customer_email": r[9], "customer_username": r[10],
        }
        for r in rows
    ]
    return {"returns": returns, "total": len(returns)}


@router.get("/api/v1/admin/returns/{return_id}", tags=["Admin Returns"])
async def admin_get_return(
    return_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Return full detail for a single return request: items + timeline + refund."""
    row = db.execute(
        text(
            """
            SELECT r.id, r.order_id, r.user_id, r.reason, r.description,
                   r.status, r.refund_amount, r.requested_at, r.updated_at,
                   r.approved_at, r.received_at, r.refunded_at, r.refund_transaction_id,
                   r.rejection_reason, r.return_tracking_number,
                   o.shipping_address, o.total_amount,
                   u.email as customer_email, u.username as customer_username
            FROM return_requests r
            LEFT JOIN orders o ON o.id = r.order_id
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.id = :id
            """
        ),
        {"id": return_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Return request not found")

    items = db.execute(
        text(
            """
            SELECT oi.product_id, oi.product_name, oi.sku, oi.size, oi.color,
                   oi.quantity, oi.unit_price
            FROM order_items oi
            WHERE oi.order_id = :order_id
            ORDER BY oi.id
            """
        ),
        {"order_id": row[1]},
    ).fetchall()

    timeline = [{"status": "requested", "date": row[7], "note": "Return request created", "actor": "Customer"}]
    if row[9]:
        timeline.append({"status": "approved", "date": row[9], "note": "Return approved", "actor": "Admin"})
    if row[10]:
        timeline.append({"status": "received", "date": row[10], "note": "Returned item marked as received", "actor": "Admin"})
    if row[11]:
        timeline.append({"status": "refunded", "date": row[11], "note": "Refund processed", "actor": "Admin"})
    if row[13] and row[5] == "rejected":
        timeline.append({"status": "rejected", "date": row[8], "note": row[13], "actor": "Admin"})

    return {
        "id": row[0], "order_id": row[1], "user_id": row[2], "reason": row[3],
        "description": row[4], "status": row[5],
        "refund_amount": float(row[6]) if row[6] else None,
        "requested_at": row[7], "created_at": row[7], "updated_at": row[8],
        "approved_at": row[9], "received_at": row[10], "refunded_at": row[11],
        "refund_transaction_id": row[12], "rejection_reason": row[13],
        "return_tracking_number": row[14],
        "return_number": f"RET-{str(row[0]).zfill(6)}",
        "type": "return",
        "order_number": f"#{row[1]}",
        "total_amount": float(row[16]) if row[16] else 0,
        "customer_email": row[17], "customer_username": row[18],
        "customer": {
            "name": row[18] or row[17] or "Customer",
            "email": row[17],
            "total_orders": None,
            "total_spent": float(row[16]) if row[16] else 0,
        },
        "shipping_address": {
            "name": None, "address": row[15], "city": None,
            "state": None, "pincode": None, "phone": None,
        },
        "items": [
            {
                "product_id": item[0], "name": item[1], "sku": item[2],
                "size": item[3], "color": item[4], "quantity": item[5],
                "price": float(item[6]) if item[6] else 0,
            }
            for item in items
        ],
        "timeline": timeline,
        "refund": (
            {"amount": float(row[6]) if row[6] else 0, "method": row[12] or "manual", "status": row[5]}
            if row[5] == "refunded" else None
        ),
    }


def _ensure_return_exists(db: Session, return_id: int) -> None:
    """404 if the return request id is unknown."""
    if not db.execute(
        text("SELECT 1 FROM return_requests WHERE id = :id"), {"id": return_id}
    ).fetchone():
        raise HTTPException(status_code=404, detail="Return request not found")


@router.post("/api/v1/admin/returns/{return_id}/approve", tags=["Admin Returns"])
async def admin_approve_return(
    return_id: int,
    data: dict = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Approve a single return request, optionally setting `refund_amount`."""
    _ensure_return_exists(db, return_id)
    data = data or {}
    sets = ["status = 'approved'", "updated_at = :now"]
    params = {"id": return_id, "now": _now_naive()}
    if data.get("refund_amount") is not None:
        sets.append("refund_amount = :refund")
        params["refund"] = data["refund_amount"]
    db.execute(text(f"UPDATE return_requests SET {', '.join(sets)} WHERE id = :id"), params)
    db.commit()
    return {"message": "Return approved", "return_id": return_id}


@router.post("/api/v1/admin/returns/{return_id}/reject", tags=["Admin Returns"])
async def admin_reject_return(
    return_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Reject a single return request, recording the rejection reason."""
    _ensure_return_exists(db, return_id)
    db.execute(
        text(
            "UPDATE return_requests SET status = 'rejected', rejection_reason = :reason, "
            "updated_at = :now WHERE id = :id"
        ),
        {"reason": data.get("reason", ""), "now": _now_naive(), "id": return_id},
    )
    db.commit()
    return {"message": "Return rejected", "return_id": return_id}


@router.post("/api/v1/admin/returns/{return_id}/receive", tags=["Admin Returns"])
async def admin_receive_return(
    return_id: int,
    data: dict = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Mark a return as received, optionally storing a return tracking number."""
    _ensure_return_exists(db, return_id)
    data = data or {}
    sets = ["status = 'received'", "updated_at = :now"]
    params = {"id": return_id, "now": _now_naive()}
    if data.get("tracking_number"):
        sets.append("return_tracking_number = :tn")
        params["tn"] = data["tracking_number"]
    db.execute(text(f"UPDATE return_requests SET {', '.join(sets)} WHERE id = :id"), params)
    db.commit()
    return {"message": "Return marked as received", "return_id": return_id}


@router.post("/api/v1/admin/returns/{return_id}/refund", tags=["Admin Returns"])
async def admin_process_return_refund(
    return_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Mark a return as refunded and store the refund transaction id."""
    _ensure_return_exists(db, return_id)
    db.execute(
        text(
            "UPDATE return_requests SET status = 'refunded', refund_transaction_id = :txn, "
            "updated_at = :now WHERE id = :id"
        ),
        {"txn": data.get("refund_transaction_id", ""), "now": _now_naive(), "id": return_id},
    )
    db.commit()
    return {"message": "Refund processed", "return_id": return_id}

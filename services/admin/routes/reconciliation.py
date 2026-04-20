"""Customer activity timeline + order/payment reconciliation (admin-only)."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.database import get_db
from shared.auth_middleware import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin Reconciliation"])


@router.get("/api/v1/admin/customers/{user_id}/activity")
async def get_customer_activity(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    activity_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    skip = (page - 1) * limit
    q = """
        SELECT id, user_id, activity_type, resource_type, resource_id,
               details, ip_address, user_agent, created_at
        FROM customer_activity_logs
        WHERE user_id = :user_id
    """
    params: dict = {"user_id": user_id, "skip": skip, "limit": limit}
    if activity_type:
        q += " AND activity_type = :activity_type"
        params["activity_type"] = activity_type
    if from_date:
        q += " AND created_at >= :from_date"
        params["from_date"] = from_date
    if to_date:
        q += " AND created_at <= :to_date"
        params["to_date"] = to_date + " 23:59:59"
    q += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"

    rows = db.execute(text(q), params).fetchall()
    count_q = "SELECT COUNT(*) FROM customer_activity_logs WHERE user_id = :user_id"
    count_params: dict = {"user_id": user_id}
    if activity_type:
        count_q += " AND activity_type = :activity_type"
        count_params["activity_type"] = activity_type
    if from_date:
        count_q += " AND created_at >= :from_date"
        count_params["from_date"] = from_date
    if to_date:
        count_q += " AND created_at <= :to_date"
        count_params["to_date"] = to_date + " 23:59:59"
    total = db.execute(text(count_q), count_params).scalar() or 0

    activities = []
    for row in rows:
        activities.append(
            {
                "id": row[0],
                "user_id": row[1],
                "activity_type": row[2],
                "resource_type": row[3],
                "resource_id": row[4],
                "details": row[5] if isinstance(row[5], dict) else {},
                "ip_address": row[6],
                "user_agent": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
            }
        )

    return {
        "activities": activities,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": skip + limit < total,
    }


@router.get("/api/v1/admin/reconciliation/summary")
async def get_reconciliation_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    try:
        result = db.execute(text("SELECT * FROM run_order_reconciliation()"))
        issues = [
            {"issue_type": row[0], "issue_count": row[1], "details": row[2]}
            for row in result.fetchall()
        ]
    except Exception as e:
        logger.warning("run_order_reconciliation failed: %s", e)
        issues = []

    try:
        orphaned = db.execute(
            text("SELECT * FROM v_orphaned_payments_enhanced LIMIT 10")
        ).fetchall()
    except Exception:
        orphaned = []

    try:
        no_payment = db.execute(
            text("SELECT * FROM v_orders_without_payment LIMIT 10")
        ).fetchall()
    except Exception:
        no_payment = []

    try:
        mismatches = db.execute(
            text("SELECT * FROM v_payment_amount_mismatches LIMIT 10")
        ).fetchall()
    except Exception:
        mismatches = []

    return {
        "summary": issues,
        "orphaned_payments_sample": [dict(r._mapping) for r in orphaned],
        "orders_without_payment_sample": [dict(r._mapping) for r in no_payment],
        "amount_mismatches_sample": [dict(r._mapping) for r in mismatches],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/api/v1/admin/reconciliation/fix-orphaned-payments")
async def fix_orphaned_payments(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Forward to payment service recovery job using the admin session cookie."""
    payment_service_url = os.getenv("PAYMENT_SERVICE_URL", "http://payment:5003")
    cookie = request.headers.get("cookie") or ""
    if not cookie:
        raise HTTPException(
            status_code=401,
            detail="Missing Cookie header — cannot authenticate to payment service",
        )
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{payment_service_url}/api/v1/admin/recovery/run",
                headers={"Cookie": cookie},
            )
        if response.status_code == 200:
            return {"success": True, "result": response.json()}
        return {
            "success": False,
            "error": response.text[:500],
            "status_code": response.status_code,
        }
    except Exception as e:
        logger.exception("Recovery proxy failed")
        raise HTTPException(status_code=500, detail=f"Recovery failed: {e!s}") from e

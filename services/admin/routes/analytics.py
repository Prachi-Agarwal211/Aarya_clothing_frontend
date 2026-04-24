"""Detailed analytics — product performance + customer LTV.

Sit alongside routes/dashboard.py: dashboard owns the high-level overview
tiles, while this module owns the deeper, slower analytics drilldowns the
admin reaches via "View detailed report" links.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from shared.time_utils import now_ist

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.database import get_db
from shared.auth_middleware import require_admin

router = APIRouter(tags=["Analytics"])

_PERIOD_DAYS = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}


@router.get("/api/v1/admin/analytics/products/performance", tags=["Analytics"])
async def get_product_performance(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Detailed product performance: views, orders, revenue, conversion."""
    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}[period]
    since = now_ist() - timedelta(days=days)
    rows = db.execute(
        text("""
        SELECT p.id, p.name, 
               MAX(i.sku) as sku, 
               p.base_price as price, 
               SUM(COALESCE(i.quantity, 0)) as total_stock,
               COALESCE(s.total_sold, 0) as total_sold,
               COALESCE(s.total_revenue, 0) as total_revenue,
               COALESCE(s.order_count, 0) as order_count,
               COALESCE(r.avg_rating, 0) as avg_rating,
               COALESCE(r.review_count, 0) as review_count
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        LEFT JOIN (
            SELECT p.id as product_id,
                   SUM(oi.quantity) as total_sold,
                   SUM(oi.unit_price * oi.quantity) as total_revenue,
                   COUNT(DISTINCT oi.order_id) as order_count
            FROM order_items oi
            JOIN inventory inv ON inv.id = oi.inventory_id
            JOIN products p ON p.id = inv.product_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= :since AND o.status != 'cancelled'
            GROUP BY p.id
        ) s ON s.product_id = p.id
        LEFT JOIN (
            SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
            FROM reviews WHERE is_approved = true GROUP BY product_id
        ) r ON r.product_id = p.id
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.base_price, s.total_sold, s.total_revenue, s.order_count, r.avg_rating, r.review_count
        ORDER BY total_revenue DESC LIMIT :lim
    """),
        {"since": since, "lim": limit},
    ).fetchall()

    products = [
        {
            "id": r[0],
            "name": r[1],
            "sku": r[2],
            "price": float(r[3]),
            "stock": r[4],
            "total_sold": r[5],
            "revenue": float(r[6]),
            "order_count": r[7],
            "avg_rating": round(float(r[8]), 1),
            "review_count": r[9],
        }
        for r in rows
    ]

    return {"products": products, "period": period, "total": len(products)}


@router.get("/api/v1/admin/analytics/customers/detailed", tags=["Analytics"])
async def get_detailed_customer_analytics(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Detailed customer analytics: LTV, segments, acquisition trends."""
    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}[period]
    since = now_ist() - timedelta(days=days)

    # Registration trend by day
    reg_trend = db.execute(
        text("""
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM users WHERE role = 'customer' AND created_at >= :since
        GROUP BY DATE(created_at) ORDER BY day
    """),
        {"since": since},
    ).fetchall()

    # Top customers by spend
    top_customers = db.execute(
        text("""
        SELECT u.id, u.username, u.email, COUNT(o.id) as orders, SUM(o.total_amount) as total_spent
        FROM users u JOIN orders o ON o.user_id = u.id
        WHERE o.status != 'cancelled' AND o.created_at >= :since
        GROUP BY u.id, u.username, u.email
        ORDER BY total_spent DESC LIMIT 10
    """),
        {"since": since},
    ).fetchall()

    # Customer segments
    avg_ltv = (
        db.execute(
            text("""
        SELECT AVG(total) FROM (
            SELECT SUM(total_amount) as total FROM orders
            WHERE status != 'cancelled'
            GROUP BY user_id
        ) sub
    """)
        ).scalar()
        or 0
    )

    high_value = (
        db.execute(
            text("""
        SELECT COUNT(DISTINCT user_id) FROM orders
        WHERE status != 'cancelled'
        GROUP BY user_id HAVING SUM(total_amount) > :threshold
    """),
            {"threshold": float(avg_ltv) * 2},
        ).scalar()
        or 0
    )

    return {
        "registration_trend": [{"date": str(r[0]), "count": r[1]} for r in reg_trend],
        "top_customers": [
            {
                "id": r[0],
                "username": r[1],
                "email": r[2],
                "orders": r[3],
                "total_spent": float(r[4]),
            }
            for r in top_customers
        ],
        "average_ltv": round(float(avg_ltv), 2),
        "high_value_customers": high_value,
        "period": period,
    }

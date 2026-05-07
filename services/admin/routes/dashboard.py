"""
Admin dashboard + analytics router.

Owns the read-only aggregate endpoints that drive the admin home screen and
the analytics tab. Two flavors live here so the data is in one place:

* ``/dashboard/*`` — fast, cache-friendly tiles for the daily/weekly/monthly
  selector on the admin home (revenue, top products, top customers, hourly
  bucketed charts).
* ``/analytics/*`` — heavier reports (revenue trend, customer cohort,
  best-selling products) for the analytics page.

All endpoints require an admin JWT.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.redis_client import redis_client
from database.database import get_db
from schemas.admin import (
    CustomerAnalytics,
    RevenueAnalytics,
    RevenueData,
    TopProduct,
    TopProductsAnalytics,
)
from service.dashboard_service import AdminDashboardService
from shared.auth_middleware import require_admin
from shared.time_utils import now_ist

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin Dashboard"])


# ---------------------------------------------------------------------------
# Dashboard tiles
# ---------------------------------------------------------------------------


@router.get("/api/v1/admin/dashboard/overview")
async def get_dashboard_overview(
    period: str = Query("daily", regex="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Aggregate KPIs (revenue, orders, AOV, customers) for the chosen period.

    Cached for 30 s in Redis since admins refresh frequently and the underlying
    aggregates are expensive on a busy database.
    """
    cache_key = f"admin:dashboard:overview:{period}"
    cached = redis_client.get_cache(cache_key)
    if cached:
        return cached

    result = AdminDashboardService(db).get_overview(period)
    redis_client.set_cache(cache_key, result, ttl=30)
    return result


@router.get("/api/v1/admin/dashboard/chart")
async def get_dashboard_chart(
    period: str = Query("daily", regex="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Revenue + order count bucketed by hour (daily) or day (weekly/monthly), in IST."""
    return {
        "period": period,
        "data": AdminDashboardService(db).get_chart(period),
    }


@router.get("/api/v1/admin/dashboard/top-products")
async def get_dashboard_top_products(
    period: str = Query("monthly", regex="^(daily|weekly|monthly)$"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Best-selling products in the chosen period."""
    return {
        "period": period,
        "products": AdminDashboardService(db).get_top_products(period, limit),
    }


@router.get("/api/v1/admin/dashboard/top-customers")
async def get_dashboard_top_customers(
    period: str = Query("monthly", regex="^(daily|weekly|monthly)$"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Top customers by spend in the chosen period."""
    return {
        "period": period,
        "customers": AdminDashboardService(db).get_top_customers(period, limit),
    }


# ---------------------------------------------------------------------------
# Analytics reports
# ---------------------------------------------------------------------------


@router.get(
    "/api/v1/admin/analytics/revenue",
    response_model=RevenueAnalytics,
    tags=["Analytics"],
)
async def get_revenue_analytics(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Daily revenue trend for the chosen window."""
    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}[period]
    since_ist = now_ist() - timedelta(days=days)
    since_utc = since_ist.replace(tzinfo=None) - timedelta(hours=5, minutes=30)
    rows = db.execute(
        text(
            "SELECT DATE(created_at) AS day, COALESCE(SUM(total_amount), 0), COUNT(*) "
            "FROM orders WHERE created_at >= :since AND status NOT IN ('cancelled') "
            "GROUP BY DATE(created_at) ORDER BY day"
        ),
        {"since": since_utc},
    ).fetchall()
    period_data = [
        RevenueData(period=str(r[0]), revenue=float(r[1]), orders=r[2]) for r in rows
    ]
    total = sum(d.revenue for d in period_data)
    return RevenueAnalytics(total_revenue=total, period_data=period_data)


@router.get(
    "/api/v1/admin/analytics/customers",
    response_model=CustomerAnalytics,
    tags=["Analytics"],
)
async def get_customer_analytics(
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Counts of total / new / returning customers across common buckets."""
    now = now_ist()
    total = (
        db.execute(text("SELECT COUNT(*) FROM users WHERE role = 'customer'")).scalar()
        or 0
    )
    today = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM users "
                "WHERE role='customer' AND DATE(created_at) = :d"
            ),
            {"d": now.date()},
        ).scalar()
        or 0
    )
    week = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM users "
                "WHERE role='customer' AND created_at >= :d"
            ),
            {"d": now - timedelta(days=7)},
        ).scalar()
        or 0
    )
    month = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM users "
                "WHERE role='customer' AND created_at >= :d"
            ),
            {"d": now - timedelta(days=30)},
        ).scalar()
        or 0
    )
    returning = (
        db.execute(
            text(
                "SELECT COUNT(DISTINCT user_id) FROM orders "
                "GROUP BY user_id HAVING COUNT(*) > 1"
            )
        ).scalar()
        or 0
    )
    return CustomerAnalytics(
        total_customers=total,
        new_customers_today=today,
        new_customers_this_week=week,
        new_customers_this_month=month,
        returning_customers=returning,
    )


@router.get(
    "/api/v1/admin/analytics/products/top-selling",
    response_model=TopProductsAnalytics,
    tags=["Analytics"],
)
async def get_top_selling_products(
    period: str = Query("30d"),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Top selling products by units sold over the chosen window."""
    from shared.time_utils import now_ist

    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(period, 30)
    since_ist = now_ist() - timedelta(days=days)
    since_utc = since_ist.replace(tzinfo=None) - timedelta(hours=5, minutes=30)
    rows = db.execute(
        text(
            "SELECT oi.product_id, COALESCE(p.name, 'Unknown'), "
            "SUM(oi.quantity), SUM(oi.line_total) "
            "FROM order_items oi "
            "LEFT JOIN products p ON p.id = oi.product_id "
            "JOIN orders o ON o.id = oi.order_id "
            "WHERE o.created_at >= :since AND o.status NOT IN ('cancelled') "
            "GROUP BY oi.product_id, p.name "
            "ORDER BY SUM(oi.quantity) DESC LIMIT :lim"
        ),
        {"since": since_utc, "lim": limit},
    ).fetchall()
    products = [
        TopProduct(
            product_id=r[0],
            product_name=r[1],
            total_sold=r[2],
            total_revenue=float(r[3]),
        )
        for r in rows
    ]
    return TopProductsAnalytics(top_products=products, period=period)

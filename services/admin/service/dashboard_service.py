"""Unified admin dashboard analytics.

All metrics here go through this single service so the admin app and any
internal tooling read from one source of truth. Time bucketing uses
``date_trunc(... AT TIME ZONE 'Asia/Kolkata')`` so days/weeks/months always
align with the merchant's local calendar (IST), not UTC.
"""

from datetime import timedelta
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.orm import Session

from shared.time_utils import now_ist


PERIODS = {
    "daily": {"days": 1, "trunc": "day", "bucket_count": 24, "bucket": "hour"},
    "weekly": {"days": 7, "trunc": "day", "bucket_count": 7, "bucket": "day"},
    "monthly": {"days": 30, "trunc": "day", "bucket_count": 30, "bucket": "day"},
}


class AdminDashboardService:
    """Aggregates revenue, orders, customers, inventory, and chart data."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def _period_config(self, period: str) -> Dict[str, Any]:
        return PERIODS.get(period, PERIODS["daily"])

    def get_overview(self, period: str = "daily") -> Dict[str, Any]:
        cfg = self._period_config(period)
        now = now_ist()
        start = now - timedelta(days=cfg["days"])

        params = {"start_date": start.replace(tzinfo=None)}

        period_revenue = (
            self.db.execute(
                text(
                    "SELECT COALESCE(SUM(total_amount), 0) FROM orders "
                    "WHERE created_at >= :start_date AND status NOT IN ('cancelled')"
                ),
                params,
            ).scalar()
            or 0
        )

        period_orders = (
            self.db.execute(
                text("SELECT COUNT(*) FROM orders WHERE created_at >= :start_date"),
                params,
            ).scalar()
            or 0
        )

        new_customers = (
            self.db.execute(
                text(
                    "SELECT COUNT(*) FROM users WHERE created_at >= :start_date "
                    "AND role = 'customer'"
                ),
                params,
            ).scalar()
            or 0
        )

        pending_orders = (
            self.db.execute(
                text(
                    "SELECT COUNT(*) FROM orders "
                    "WHERE status = 'confirmed'"
                )
            ).scalar()
            or 0
        )

        total_customers = (
            self.db.execute(
                text("SELECT COUNT(*) FROM users WHERE role = 'customer'")
            ).scalar()
            or 0
        )

        total_products = (
            self.db.execute(
                text("SELECT COUNT(*) FROM products WHERE is_active = true")
            ).scalar()
            or 0
        )

        low_stock = (
            self.db.execute(
                text(
                    "SELECT COUNT(*) FROM inventory "
                    "WHERE quantity > 0 AND quantity <= low_stock_threshold "
                    "AND is_active = true"
                )
            ).scalar()
            or 0
        )

        out_of_stock = (
            self.db.execute(
                text(
                    "SELECT COUNT(*) FROM inventory "
                    "WHERE quantity = 0 AND is_active = true"
                )
            ).scalar()
            or 0
        )

        recent = self.db.execute(
            text(
                """
                SELECT o.id, o.invoice_number AS order_number, o.total_amount,
                       o.status, o.created_at, u.full_name, u.email
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                ORDER BY o.created_at DESC LIMIT 5
                """
            )
        ).fetchall()

        recent_orders = [
            {
                "id": r.id,
                "order_number": r.order_number,
                "total_amount": float(r.total_amount or 0),
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "customer_name": r.full_name or r.email or "Guest",
            }
            for r in recent
        ]

        return {
            "period": period,
            "total_revenue": float(period_revenue),
            "total_orders": period_orders,
            "total_customers": total_customers,
            "total_products": total_products,
            "pending_orders": pending_orders,
            "period_revenue": float(period_revenue),
            "period_orders": period_orders,
            "period_new_customers": new_customers,
            "inventory_alerts": {
                "low_stock": low_stock,
                "out_of_stock": out_of_stock,
            },
            "recent_orders": recent_orders,
            "chart": self.get_chart(period),
        }

    def get_chart(self, period: str = "daily") -> List[Dict[str, Any]]:
        """Return revenue + order counts bucketed in IST.

        ``date_trunc`` runs in the IST timezone so a "Monday" or "12 Nov" bucket
        always matches what the merchant sees on their wall clock.
        """
        cfg = self._period_config(period)
        bucket = cfg["bucket"]
        start = now_ist() - timedelta(days=cfg["days"])

        rows = self.db.execute(
            text(
                f"""
                SELECT
                    date_trunc(:bucket,
                        (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'
                    ) AS bucket,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COUNT(*) AS orders
                FROM orders
                WHERE created_at >= :start_date
                  AND status NOT IN ('cancelled')
                GROUP BY bucket
                ORDER BY bucket ASC
                """
            ),
            {"bucket": bucket, "start_date": start.replace(tzinfo=None)},
        ).fetchall()

        return [
            {
                "bucket": r.bucket.isoformat() if r.bucket else None,
                "revenue": float(r.revenue or 0),
                "orders": int(r.orders or 0),
            }
            for r in rows
        ]

    def get_top_products(
        self, period: str = "monthly", limit: int = 10
    ) -> List[Dict[str, Any]]:
        cfg = self._period_config(period)
        start = now_ist() - timedelta(days=cfg["days"])

        rows = self.db.execute(
            text(
                """
                SELECT
                    p.id,
                    p.name,
                    p.primary_image,
                    SUM(oi.quantity) AS total_sold,
                    SUM(oi.line_total) AS total_revenue
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                JOIN products p ON p.id = oi.product_id
                WHERE o.created_at >= :start_date
                  AND o.status NOT IN ('cancelled')
                GROUP BY p.id, p.name, p.primary_image
                ORDER BY total_sold DESC
                LIMIT :limit
                """
            ),
            {"start_date": start.replace(tzinfo=None), "limit": limit},
        ).fetchall()

        return [
            {
                "product_id": r.id,
                "product_name": r.name,
                "primary_image": r.primary_image,
                "total_sold": int(r.total_sold or 0),
                "total_revenue": float(r.total_revenue or 0),
            }
            for r in rows
        ]

    def get_top_customers(
        self, period: str = "monthly", limit: int = 10
    ) -> List[Dict[str, Any]]:
        cfg = self._period_config(period)
        start = now_ist() - timedelta(days=cfg["days"])

        rows = self.db.execute(
            text(
                """
                SELECT
                    u.id,
                    u.full_name,
                    u.email,
                    COUNT(o.id) AS order_count,
                    COALESCE(SUM(o.total_amount), 0) AS total_spent
                FROM orders o
                JOIN users u ON u.id = o.user_id
                WHERE o.created_at >= :start_date
                  AND o.status NOT IN ('cancelled')
                GROUP BY u.id, u.full_name, u.email
                ORDER BY total_spent DESC
                LIMIT :limit
                """
            ),
            {"start_date": start.replace(tzinfo=None), "limit": limit},
        ).fetchall()

        return [
            {
                "user_id": r.id,
                "full_name": r.full_name or r.email or "Guest",
                "email": r.email,
                "order_count": int(r.order_count or 0),
                "total_spent": float(r.total_spent or 0),
            }
            for r in rows
        ]

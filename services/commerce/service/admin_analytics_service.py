"""Admin Analytics Service for business insights."""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from models.order import Order, OrderItem, OrderStatus
from models.product import Product
from models.inventory import Inventory
from models.collection import Collection


class AdminAnalyticsService:
    """Service for admin analytics and reporting."""
    
    def __init__(self, db: Session):
        """Initialize service."""
        self.db = db
    
    def get_overview_stats(self) -> Dict[str, Any]:
        """
        Get overview statistics for admin dashboard.
        
        Returns:
            Dict with key business metrics
        """
        now = datetime.now(timezone.utc)
        today = now.date()
        start_of_day = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Orders
        total_orders = self.db.query(func.count(Order.id)).scalar() or 0
        orders_today = self.db.query(func.count(Order.id)).filter(
            Order.created_at >= start_of_day
        ).scalar() or 0
        orders_this_month = self.db.query(func.count(Order.id)).filter(
            Order.created_at >= start_of_month
        ).scalar() or 0
        
        # Revenue
        total_revenue = self.db.query(func.sum(Order.total_amount)).filter(
            Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED])
        ).scalar() or Decimal(0)
        
        revenue_today = self.db.query(func.sum(Order.total_amount)).filter(
            and_(
                Order.created_at >= start_of_day,
                Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED])
            )
        ).scalar() or Decimal(0)
        
        revenue_this_month = self.db.query(func.sum(Order.total_amount)).filter(
            and_(
                Order.created_at >= start_of_month,
                Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED])
            )
        ).scalar() or Decimal(0)
        
        # Customers
        from models.user import User
        total_customers = self.db.query(func.count(User.id)).filter(
            User.role == "customer"
        ).scalar() or 0
        
        # Products
        total_products = self.db.query(func.count(Product.id)).filter(
            Product.is_active == True
        ).scalar() or 0
        
        # Low stock items
        low_stock_count = self.db.query(func.count(Inventory.id)).filter(
            and_(
                Inventory.quantity - Inventory.reserved_quantity <= Inventory.low_stock_threshold,
                Inventory.quantity > 0
            )
        ).scalar() or 0
        
        out_of_stock_count = self.db.query(func.count(Inventory.id)).filter(
            Inventory.quantity <= 0
        ).scalar() or 0
        
        return {
            "orders": {
                "total": total_orders,
                "today": orders_today,
                "this_month": orders_this_month
            },
            "revenue": {
                "total": float(total_revenue),
                "today": float(revenue_today),
                "this_month": float(revenue_this_month)
            },
            "customers": {
                "total": total_customers
            },
            "products": {
                "total": total_products
            },
            "inventory": {
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count
            }
        }
    
    def get_top_products(
        self,
        limit: int = 10,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: str = "quantity"
    ) -> List[Dict[str, Any]]:
        """
        Get top selling products.
        
        Args:
            limit: Number of products to return
            start_date: Start date for filtering
            end_date: End date for filtering
            sort_by: quantity (units sold) or revenue
            
        Returns:
            List of top products with sales data
        """
        # Build date filter
        date_filter = True
        if start_date:
            date_filter = and_(date_filter, Order.created_at >= start_date)
        if end_date:
            date_filter = and_(date_filter, Order.created_at <= end_date)
        
        # Query top products by quantity sold
        top_products = self.db.query(
            OrderItem.product_id,
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("total_quantity"),
            func.sum(OrderItem.line_total).label("total_revenue")
        ).join(Order).filter(
            and_(
                Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED]),
                date_filter
            )
        ).group_by(
            OrderItem.product_id,
            OrderItem.product_name
        ).order_by(
            func.sum(OrderItem.quantity).desc() if sort_by == "quantity"
            else func.sum(OrderItem.line_total).desc()
        ).limit(limit).all()
        
        return [
            {
                "product_id": p.product_id,
                "product_name": p.product_name,
                "total_quantity": p.total_quantity or 0,
                "total_revenue": float(p.total_revenue or 0)
            }
            for p in top_products
        ]
    
    def get_sales_report(
        self,
        start_date: datetime,
        end_date: datetime,
        group_by: str = "day"
    ) -> Dict[str, Any]:
        """
        Generate sales report for a date range.
        
        Args:
            start_date: Report start date
            end_date: Report end date
            group_by: day, week, or month
            
        Returns:
            Dict with sales data grouped by period
        """
        # Query sales data
        query = self.db.query(
            func.date(Order.created_at).label("date"),
            func.count(Order.id).label("orders"),
            func.sum(Order.total_amount).label("revenue"),
            func.avg(Order.total_amount).label("average_order")
        ).filter(
            and_(
                Order.created_at >= start_date,
                Order.created_at <= end_date,
                Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED])
            )
        ).group_by(
            func.date(Order.created_at)
        ).order_by(
            func.date(Order.created_at)
        ).all()
        
        data = [
            {
                "date": str(row.date),
                "orders": row.orders or 0,
                "revenue": float(row.revenue or 0),
                "average_order": float(row.average_order or 0)
            }
            for row in query
        ]
        
        # Calculate totals
        total_orders = sum(d["orders"] for d in data)
        total_revenue = sum(d["revenue"] for d in data)
        
        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "data": data,
            "summary": {
                "total_orders": total_orders,
                "total_revenue": total_revenue,
                "average_daily_revenue": total_revenue / len(data) if data else 0
            }
        }
    
    def get_inventory_value(self) -> Dict[str, Any]:
        """
        Calculate total inventory value.
        
        Returns:
            Dict with inventory valuation metrics
        """
        # Total inventory value
        result = self.db.query(
            func.count(Inventory.id).label("total_skus"),
            func.sum(Inventory.quantity).label("total_units"),
            func.sum(Inventory.quantity * Product.price).label("total_value")
        ).join(Product).first()
        
        # Low stock items
        low_stock = self.db.query(Inventory).filter(
            and_(
                Inventory.quantity - Inventory.reserved_quantity <= Inventory.low_stock_threshold,
                Inventory.quantity > 0
            )
        ).count()
        
        # Out of stock
        out_of_stock = self.db.query(Inventory).filter(
            Inventory.quantity <= 0
        ).count()
        
        # Collection breakdown
        category_breakdown = self.db.query(
            Collection.name,
            func.count(Inventory.id).label("skus"),
            func.sum(Inventory.quantity).label("units")
        ).join(Product).group_by(Collection.name).all()
        
        return {
            "total_skus": result.total_skus or 0,
            "total_units": result.total_units or 0,
            "total_value": float(result.total_value or 0),
            "low_stock_items": low_stock,
            "out_of_stock_items": out_of_stock,
            "by_category": [
                {
                    "category": c.name,
                    "skus": c.skus,
                    "units": c.units
                }
                for c in category_breakdown
            ]
        }
    
    def get_order_fulfillment_stats(self) -> Dict[str, Any]:
        """
        Get order fulfillment statistics.
        
        Returns:
            Dict with fulfillment metrics
        """
        total_orders = self.db.query(func.count(Order.id)).scalar() or 0
        
        status_counts = {}
        for status in OrderStatus:
            count = self.db.query(func.count(Order.id)).filter(
                Order.status == status
            ).scalar() or 0
            status_counts[status.value] = count
        
        # Average processing time (mock - would need order status timestamps)
        avg_processing_days = 2.5  # Placeholder
        
        return {
            "total_orders": total_orders,
            "by_status": status_counts,
            "average_processing_days": avg_processing_days,
            "fulfillment_rate": (
                status_counts.get("delivered", 0) / total_orders * 100
                if total_orders > 0 else 0
            )
        }
    
    def get_customer_segments(self) -> Dict[str, Any]:
        """
        Get customer segment counts.
        
        Returns:
            Dict with customer segments
        """
        from models.user import User
        from datetime import timedelta
        
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)
        ninety_days_ago = now - timedelta(days=90)
        
        total_customers = self.db.query(func.count(User.id)).filter(
            User.role == "customer"
        ).scalar() or 0
        
        # New customers (last 30 days)
        new_customers = self.db.query(func.count(User.id)).filter(
            and_(
                User.role == "customer",
                User.created_at >= thirty_days_ago
            )
        ).scalar() or 0
        
        # Active customers (ordered in last 30 days)
        active_customers = self.db.query(func.count(func.distinct(Order.user_id))).filter(
            and_(
                Order.created_at >= thirty_days_ago,
                Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED])
            )
        ).scalar() or 0
        
        # At risk (no order in 90 days)
        at_risk = self.db.query(func.count(User.id)).filter(
            and_(
                User.role == "customer",
                User.created_at < ninety_days_ago
            )
        ).scalar() or 0
        at_risk = at_risk - (self.db.query(func.count(func.distinct(Order.user_id))).filter(
            and_(
                Order.created_at >= ninety_days_ago,
                Order.status.in_([OrderStatus.COMPLETED, OrderStatus.DELIVERED])
            )
        ).scalar() or 0)
        
        return {
            "total": total_customers,
            "new_30_days": new_customers,
            "active_30_days": active_customers,
            "at_risk_90_days": max(0, at_risk)
        }

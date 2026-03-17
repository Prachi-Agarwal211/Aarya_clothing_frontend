"""
AI Dashboard Tools — Super Admin AI Assistant
Extended tools for dashboard queries, analytics, and platform management.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


# ── Dashboard Query Tools ────────────────────────────────────────────────────

def _dashboard_tools() -> List[Dict]:
    """Read-only dashboard query tools for AI assistant."""
    return [
        {
            "name": "get_sales_metrics",
            "description": "Get real-time sales metrics including revenue, orders, and trends. Use for queries about sales performance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["today", "yesterday", "week", "month", "quarter", "year"],
                        "description": "Time period for metrics"
                    },
                    "compare_previous": {
                        "type": "boolean",
                        "description": "Whether to compare with previous period"
                    }
                },
                "required": ["period"]
            }
        },
        {
            "name": "get_inventory_status",
            "description": "Get inventory status including low stock alerts, out of stock items, and total inventory value.",
            "parameters": {
                "type": "object",
                "properties": {
                    "alert_threshold": {
                        "type": "integer",
                        "description": "Quantity threshold for low stock alerts (default: 10)"
                    },
                    "category": {
                        "type": "string",
                        "description": "Filter by category name"
                    }
                }
            }
        },
        {
            "name": "get_customer_analytics",
            "description": "Get customer analytics including total customers, new customers, returning customers, and top spenders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["today", "week", "month", "quarter", "year"],
                        "description": "Time period for analytics"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of top customers to return (default: 10)"
                    }
                },
                "required": ["period"]
            }
        },
        {
            "name": "get_order_fulfillment",
            "description": "Get order fulfillment status including pending, processing, shipped, and delivered orders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "all"],
                        "description": "Filter by order status"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of recent orders to return (default: 20)"
                    }
                }
            }
        },
        {
            "name": "get_revenue_trends",
            "description": "Get revenue trends over time with daily/weekly/monthly breakdown.",
            "parameters": {
                "type": "object",
                "properties": {
                    "granularity": {
                        "type": "string",
                        "enum": ["daily", "weekly", "monthly"],
                        "description": "Time granularity for trends"
                    },
                    "days": {
                        "type": "integer",
                        "description": "Number of days to include (default: 30)"
                    }
                },
                "required": ["granularity"]
            }
        },
        {
            "name": "get_top_products",
            "description": "Get top selling products by revenue or units sold.",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric": {
                        "type": "string",
                        "enum": ["revenue", "units"],
                        "description": "Ranking metric"
                    },
                    "period": {
                        "type": "string",
                        "enum": ["week", "month", "quarter", "year"],
                        "description": "Time period"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of products to return (default: 10)"
                    }
                },
                "required": ["metric", "period"]
            }
        },
        {
            "name": "get_ai_insights",
            "description": "Get AI-generated business insights and recommendations based on current data patterns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "focus_area": {
                        "type": "string",
                        "enum": ["sales", "inventory", "customers", "orders", "all"],
                        "description": "Area to focus insights on"
                    }
                }
            }
        }
    ]


def _execute_dashboard_tool(db: Session, tool_name: str, args: Dict) -> str:
    """Execute dashboard query tool and return JSON result."""
    try:
        if tool_name == "get_sales_metrics":
            return _get_sales_metrics(db, args)
        elif tool_name == "get_inventory_status":
            return _get_inventory_status(db, args)
        elif tool_name == "get_customer_analytics":
            return _get_customer_analytics(db, args)
        elif tool_name == "get_order_fulfillment":
            return _get_order_fulfillment(db, args)
        elif tool_name == "get_revenue_trends":
            return _get_revenue_trends(db, args)
        elif tool_name == "get_top_products":
            return _get_top_products(db, args)
        elif tool_name == "get_ai_insights":
            return _get_ai_insights(db, args)
        else:
            return json.dumps({"error": f"Unknown dashboard tool: {tool_name}"})
    except Exception as e:
        logger.error(f"Dashboard tool error [{tool_name}]: {e}")
        return json.dumps({"error": str(e)})


def _get_sales_metrics(db: Session, args: Dict) -> str:
    """Get sales metrics for specified period."""
    period = args.get("period", "today")
    compare = args.get("compare_previous", False)
    
    # Calculate date ranges
    now = datetime.utcnow()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now
    elif period == "yesterday":
        start_date = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(days=7)
        end_date = now
    elif period == "month":
        start_date = now - timedelta(days=30)
        end_date = now
    elif period == "quarter":
        start_date = now - timedelta(days=90)
        end_date = now
    elif period == "year":
        start_date = now - timedelta(days=365)
        end_date = now
    else:
        start_date = now - timedelta(days=30)
        end_date = now
    
    # Get current period metrics
    query = text("""
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders
        WHERE status NOT IN ('cancelled', 'pending')
        AND created_at >= :start_date
        AND created_at <= :end_date
    """)
    
    result = db.execute(query, {"start_date": start_date, "end_date": end_date}).first()
    
    metrics = {
        "period": period,
        "total_orders": result[0] or 0,
        "total_revenue": float(result[1] or 0),
        "avg_order_value": float(result[2] or 0),
        "currency": "INR"
    }
    
    # Get previous period for comparison if requested
    if compare:
        period_duration = end_date - start_date
        prev_start = start_date - period_duration
        prev_end = start_date
        
        prev_result = db.execute(query, {"start_date": prev_start, "end_date": prev_end}).first()
        
        prev_revenue = float(prev_result[1] or 0)
        growth = ((metrics["total_revenue"] - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        
        metrics["previous_period"] = {
            "total_orders": prev_result[0] or 0,
            "total_revenue": prev_revenue,
            "avg_order_value": float(prev_result[2] or 0)
        }
        metrics["growth_percentage"] = round(growth, 2)
    
    return json.dumps(metrics, default=str)


def _get_inventory_status(db: Session, args: Dict) -> str:
    """Get inventory status with alerts."""
    alert_threshold = args.get("alert_threshold", 10)
    category = args.get("category")
    
    category_filter = ""
    params = {"threshold": alert_threshold}
    
    if category:
        category_filter = "AND c.name = :category"
        params["category"] = category
    
    # Get inventory summary
    query = text(f"""
        SELECT 
            COUNT(DISTINCT i.id) as total_products,
            COALESCE(SUM(i.quantity), 0) as total_units,
            COALESCE(SUM(i.quantity * p.base_price), 0) as total_value,
            COUNT(DISTINCT CASE WHEN i.quantity <= :threshold AND i.quantity > 0 THEN i.id END) as low_stock_count,
            COUNT(DISTINCT CASE WHEN i.quantity = 0 THEN i.id END) as out_of_stock_count
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1 {category_filter}
    """)
    
    result = db.execute(query, params).first()
    
    # Get low stock items
    low_stock_query = text(f"""
        SELECT p.id, p.name, i.sku, i.quantity, p.base_price
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE i.quantity <= :threshold AND i.quantity > 0
        {category_filter}
        ORDER BY i.quantity ASC
        LIMIT 20
    """)
    
    low_stock_items = [
        {"id": row[0], "name": row[1], "sku": row[2], "quantity": row[3], "price": float(row[4])}
        for row in db.execute(low_stock_query, params).fetchall()
    ]
    
    # Get out of stock items
    out_of_stock_query = text(f"""
        SELECT p.id, p.name, i.sku
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE i.quantity = 0
        {category_filter}
        LIMIT 20
    """)
    
    out_of_stock_items = [
        {"id": row[0], "name": row[1], "sku": row[2]}
        for row in db.execute(out_of_stock_query, params).fetchall()
    ]
    
    status = {
        "total_products": result[0] or 0,
        "total_units": result[1] or 0,
        "total_value": float(result[2] or 0),
        "low_stock_count": result[3] or 0,
        "out_of_stock_count": result[4] or 0,
        "low_stock_items": low_stock_items,
        "out_of_stock_items": out_of_stock_items,
        "alert_threshold": alert_threshold,
        "currency": "INR"
    }
    
    return json.dumps(status, default=str)


def _get_customer_analytics(db: Session, args: Dict) -> str:
    """Get customer analytics."""
    period = args.get("period", "month")
    limit = args.get("limit", 10)
    
    now = datetime.utcnow()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Get customer counts
    query = text("""
        SELECT 
            COUNT(*) as total_customers,
            COUNT(*) FILTER (WHERE created_at >= :start_date) as new_customers,
            COUNT(*) FILTER (WHERE role = 'customer') as active_customers
        FROM users
        WHERE role = 'customer'
    """)
    
    result = db.execute(query, {"start_date": start_date}).first()
    
    # Get top spenders
    top_spenders_query = text("""
        SELECT 
            u.id,
            u.email,
            u.username,
            COUNT(o.id) as order_count,
            COALESCE(SUM(o.total_amount), 0) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.status NOT IN ('cancelled', 'pending')
        WHERE u.role = 'customer'
        GROUP BY u.id, u.email, u.username
        ORDER BY total_spent DESC
        LIMIT :limit
    """)
    
    top_spenders = [
        {
            "id": row[0],
            "email": row[1],
            "username": row[2],
            "order_count": row[3],
            "total_spent": float(row[4])
        }
        for row in db.execute(top_spenders_query, {"limit": limit}).fetchall()
    ]
    
    # Get returning customers (customers with more than 1 order)
    returning_query = text("""
        SELECT COUNT(DISTINCT user_id)
        FROM orders
        WHERE status NOT IN ('cancelled', 'pending')
        GROUP BY user_id
        HAVING COUNT(*) > 1
    """)
    
    returning_count = len(db.execute(returning_query).fetchall())
    
    analytics = {
        "period": period,
        "total_customers": result[2] or 0,
        "new_customers": result[1] or 0,
        "returning_customers": returning_count,
        "top_spenders": top_spenders,
        "currency": "INR"
    }
    
    return json.dumps(analytics, default=str)


def _get_order_fulfillment(db: Session, args: Dict) -> str:
    """Get order fulfillment status."""
    status_filter = args.get("status", "all")
    limit = args.get("limit", 20)
    
    status_condition = ""
    if status_filter != "all":
        status_condition = "WHERE o.status = :status"
    
    # Get order counts by status
    counts_query = text("""
        SELECT 
            status,
            COUNT(*) as count,
            COALESCE(SUM(total_amount), 0) as total_value
        FROM orders
        GROUP BY status
    """)
    
    counts = {
        row[0]: {"count": row[1], "value": float(row[2])}
        for row in db.execute(counts_query).fetchall()
    }
    
    # Get recent orders
    orders_query = text(f"""
        SELECT 
            o.id,
            o.status,
            o.total_amount,
            o.created_at,
            u.email as customer_email,
            u.username as customer_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        {status_condition}
        ORDER BY o.created_at DESC
        LIMIT :limit
    """)
    
    params = {"limit": limit}
    if status_filter != "all":
        params["status"] = status_filter
    
    recent_orders = [
        {
            "id": row[0],
            "status": row[1],
            "total_amount": float(row[2]),
            "created_at": str(row[3]),
            "customer_email": row[4],
            "customer_name": row[5]
        }
        for row in db.execute(orders_query, params).fetchall()
    ]
    
    fulfillment = {
        "status_counts": counts,
        "recent_orders": recent_orders,
        "filtered_by": status_filter if status_filter != "all" else None
    }
    
    return json.dumps(fulfillment, default=str)


def _get_revenue_trends(db: Session, args: Dict) -> str:
    """Get revenue trends over time."""
    granularity = args.get("granularity", "daily")
    days = args.get("days", 30)
    
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)
    
    if granularity == "daily":
        date_trunc = "DATE(created_at)"
    elif granularity == "weekly":
        date_trunc = "DATE_TRUNC('week', created_at)"
    elif granularity == "monthly":
        date_trunc = "DATE_TRUNC('month', created_at)"
    else:
        date_trunc = "DATE(created_at)"
    
    query = text(f"""
        SELECT 
            {date_trunc} as period,
            COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as revenue,
            COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders
        WHERE status NOT IN ('cancelled', 'pending')
        AND created_at >= :start_date
        GROUP BY {date_trunc}
        ORDER BY period ASC
    """)
    
    trends = [
        {
            "period": str(row[0]),
            "order_count": row[1],
            "revenue": float(row[2]),
            "avg_order_value": float(row[3])
        }
        for row in db.execute(query, {"start_date": start_date}).fetchall()
    ]
    
    return json.dumps({"granularity": granularity, "trends": trends, "currency": "INR"}, default=str)


def _get_top_products(db: Session, args: Dict) -> str:
    """Get top selling products."""
    metric = args.get("metric", "revenue")
    period = args.get("period", "month")
    limit = args.get("limit", 10)
    
    now = datetime.utcnow()
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    if metric == "revenue":
        order_by = "total_revenue DESC"
    else:
        order_by = "total_units DESC"
    
    query = text(f"""
        SELECT 
            p.id,
            p.name,
            p.slug,
            SUM(oi.quantity) as total_units,
            COALESCE(SUM(oi.quantity * oi.price), 0) as total_revenue
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('cancelled', 'pending')
        AND o.created_at >= :start_date
        GROUP BY p.id, p.name, p.slug
        ORDER BY {order_by}
        LIMIT :limit
    """)
    
    products = [
        {
            "id": row[0],
            "name": row[1],
            "slug": row[2],
            "total_units": row[3],
            "total_revenue": float(row[4])
        }
        for row in db.execute(query, {"start_date": start_date, "limit": limit}).fetchall()
    ]
    
    return json.dumps({
        "metric": metric,
        "period": period,
        "products": products,
        "currency": "INR"
    }, default=str)


def _get_ai_insights(db: Session, args: Dict) -> str:
    """Generate AI insights based on data patterns."""
    focus = args.get("focus_area", "all")
    
    insights = []
    
    # Sales insights
    if focus in ["sales", "all"]:
        sales_query = text("""
            SELECT 
                COUNT(*) as today_orders,
                COALESCE(SUM(total_amount), 0) as today_revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value
            FROM orders
            WHERE DATE(created_at) = CURRENT_DATE
            AND status NOT IN ('cancelled', 'pending')
        """)
        result = db.execute(sales_query).first()
        
        if result[0] and result[0] > 0:
            insights.append({
                "category": "sales",
                "insight": f"Today's performance: {result[0]} orders generating ₹{result[1]:,.2f} in revenue",
                "priority": "high" if result[1] and result[1] > 10000 else "normal"
            })
    
    # Inventory insights
    if focus in ["inventory", "all"]:
        inventory_query = text("""
            SELECT 
                COUNT(*) FILTER (WHERE quantity = 0) as out_of_stock,
                COUNT(*) FILTER (WHERE quantity <= 10 AND quantity > 0) as low_stock
            FROM inventory
        """)
        result = db.execute(inventory_query).first()
        
        if result[0] and result[0] > 0:
            insights.append({
                "category": "inventory",
                "insight": f"Alert: {result[0]} products are out of stock and need immediate attention",
                "priority": "critical"
            })
        
        if result[1] and result[1] > 0:
            insights.append({
                "category": "inventory",
                "insight": f"Warning: {result[1]} products have low stock (≤10 units)",
                "priority": "high"
            })
    
    # Order insights
    if focus in ["orders", "all"]:
        orders_query = text("""
            SELECT 
                COUNT(*) as pending_orders,
                COUNT(*) FILTER (WHERE status = 'shipped') as shipped_orders
            FROM orders
            WHERE status IN ('pending', 'confirmed', 'shipped')
        """)
        result = db.execute(orders_query).first()
        
        if result[0] and result[0] > 10:
            insights.append({
                "category": "orders",
                "insight": f"You have {result[0]} pending orders that need processing",
                "priority": "high"
            })
    
    # Customer insights
    if focus in ["customers", "all"]:
        customers_query = text("""
            SELECT COUNT(*)
            FROM users
            WHERE role = 'customer'
            AND DATE(created_at) = CURRENT_DATE
        """)
        result = db.execute(customers_query).first()
        
        if result[0] and result[0] > 0:
            insights.append({
                "category": "customers",
                "insight": f"{result[0]} new customers joined today",
                "priority": "normal"
            })
    
    return json.dumps({"insights": insights, "focus_area": focus}, default=str)

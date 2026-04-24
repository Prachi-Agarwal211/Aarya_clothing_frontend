"""
Customer Activity Logger
========================
Logs all customer actions for audit trail and admin visibility.
"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def log_customer_activity(
    db_session,
    user_id: int,
    activity_type: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """
    Log a customer activity to the customer_activity_logs table.

    Args:
        db_session: SQLAlchemy database session
        user_id: ID of the customer
        activity_type: Type of activity (order_view, order_cancel, etc.)
        resource_type: Type of resource (order, product, address, etc.)
        resource_id: ID of the resource
        details: Additional JSON-serializable details
        ip_address: Customer's IP address
        user_agent: Customer's user agent string
    """
    from sqlalchemy import text

    try:
        db_session.execute(text("""
            INSERT INTO customer_activity_logs
                (user_id, activity_type, resource_type, resource_id, details, ip_address, user_agent)
            VALUES
                (:user_id, :activity_type, :resource_type, :resource_id,
                 :details, :ip_address, :user_agent)
        """), {
            "user_id": user_id,
            "activity_type": activity_type,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
        })
        db_session.commit()
    except Exception as e:
        # Never fail the main operation because logging failed
        logger.warning(f"Failed to log customer activity: {e}")
        try:
            db_session.rollback()
        except Exception:
            pass

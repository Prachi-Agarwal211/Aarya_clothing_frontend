"""Admin Customer Service for managing customers."""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import timedelta

from shared.time_utils import ist_naive

from models.user import User, UserRole
from models.order import Order, OrderStatus, OrderItem
from schemas.user import UserResponse


class AdminCustomerService:
    """Service for admin customer management."""
    
    def __init__(self, db: Session):
        """Initialize service."""
        self.db = db
    
    def get_customers(
        self,
        skip: int = 0,
        limit: int = 50,
        search_query: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        Get paginated list of customers.
        
        Args:
            skip: Number of records to skip
            limit: Maximum records to return
            search_query: Search by name, email, or username
            sort_by: Field to sort by
            sort_order: asc or desc
            
        Returns:
            Dict with customers list and pagination info
        """
        # Build query
        query = self.db.query(User).filter(User.role == UserRole.CUSTOMER)
        
        # Apply search
        if search_query:
            search = f"%{search_query}%"
            query = query.filter(
                or_(
                    User.full_name.ilike(search),
                    User.email.ilike(search),
                    User.username.ilike(search)
                )
            )
        
        # Get total count
        total = query.count()
        
        # Apply sorting
        sort_column = getattr(User, sort_by, User.created_at)
        if sort_order.lower() == "desc":
            sort_column = sort_column.desc()
        else:
            sort_column = sort_column.asc()
        
        # Apply pagination
        customers = query.order_by(sort_column).offset(skip).limit(limit).all()
        
        return {
            "customers": [self._format_customer(c) for c in customers],
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    def get_customer_details(self, customer_id: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed customer information.
        
        Args:
            customer_id: Customer ID
            
        Returns:
            Customer details or None if not found
        """
        customer = self.db.query(User).filter(
            User.id == customer_id,
            User.role == UserRole.CUSTOMER
        ).first()
        
        if not customer:
            return None

        # Get total order count (accurate, not limited)
        total_orders = self.db.query(Order).filter(Order.user_id == customer_id).count()

        # Get total spending across ALL orders (not just recent 100)
        total_spent_row = self.db.query(func.sum(Order.total_amount)).filter(Order.user_id == customer_id).first()
        total_spent = float(total_spent_row[0] or 0) if total_spent_row else 0

        # Get most recent 100 orders for details (not for counting)
        orders = self.db.query(Order).filter(Order.user_id == customer_id).order_by(Order.created_at.desc()).limit(100).all()

        last_order = max(orders, key=lambda o: o.created_at, default=None)
        
        return {
            "user": self._format_customer(customer),
            "statistics": {
                "total_orders": total_orders,
                "total_spent": total_spent,
                "average_order_value": total_spent / total_orders if total_orders > 0 else 0,
                "last_order_date": last_order.created_at if last_order else None
            }
        }
    
    def get_customer_orders(
        self,
        customer_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Get orders for a specific customer.
        
        Args:
            customer_id: Customer ID
            skip: Number of records to skip
            limit: Maximum records to return
            
        Returns:
            Dict with orders list and pagination info
        """
        # Verify customer exists
        customer = self.db.query(User).filter(
            User.id == customer_id,
            User.role == UserRole.CUSTOMER
        ).first()
        
        if not customer:
            return None
        
        # Get orders
        query = self.db.query(Order).filter(Order.user_id == customer_id)
        total = query.count()
        
        orders = query.order_by(
            Order.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        return {
            "orders": [self._format_order(o) for o in orders],
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    def get_customer_addresses(self, customer_id: int) -> List[Dict[str, Any]]:
        """
        Get all addresses for a customer.
        
        Args:
            customer_id: Customer ID
            
        Returns:
            List of addresses
        """
        from models.address import Address
        
        addresses = self.db.query(Address).filter(
            Address.user_id == customer_id
        ).all()
        
        return [self._format_address(a) for a in addresses]
    
    def get_customers_by_segment(self, segment: str) -> List[Dict[str, Any]]:
        """
        Get customers by segment.
        
        Args:
            segment: Segment type (new, returning, vip, at_risk)
            
        Returns:
            List of customers in segment
        """
        from models.address import Address
        
        now = ist_naive()
        thirty_days_ago = now - timedelta(days=30)
        ninety_days_ago = now - timedelta(days=90)
        
        if segment == "new":
            # Customers who joined in last 30 days
            customers = self.db.query(User).filter(
                User.role == UserRole.CUSTOMER,
                User.created_at >= thirty_days_ago
            ).all()
        
        elif segment == "returning":
            # Customers with more than 2 orders - use subquery to avoid N+1
            order_counts = (
                self.db.query(
                    Order.user_id,
                    func.count(Order.id).label('order_count')
                )
                .group_by(Order.user_id)
                .subquery()
            )
            customers = (
                self.db.query(User)
                .join(order_counts, User.id == order_counts.c.user_id)
                .filter(
                    User.role == UserRole.CUSTOMER,
                    order_counts.c.order_count > 2
                )
                .all()
            )
        
        elif segment == "vip":
            # Customers who spent more than 10000 - use subquery to avoid N+1
            order_totals = (
                self.db.query(
                    Order.user_id,
                    func.sum(Order.total_amount).label('total_spent')
                )
                .group_by(Order.user_id)
                .subquery()
            )
            customers = (
                self.db.query(User)
                .join(order_totals, User.id == order_totals.c.user_id)
                .filter(
                    User.role == UserRole.CUSTOMER,
                    order_totals.c.total_spent > 10000
                )
                .all()
            )
        
        elif segment == "at_risk":
            # Customers who haven't ordered in 90+ days - use subquery to avoid N+1
            recent_orders = (
                self.db.query(Order.user_id)
                .filter(Order.created_at >= ninety_days_ago)
                .distinct()
                .subquery()
            )
            customers = (
                self.db.query(User)
                .outerjoin(recent_orders, User.id == recent_orders.c.user_id)
                .filter(
                    User.role == UserRole.CUSTOMER,
                    User.created_at < ninety_days_ago,
                    recent_orders.c.user_id.is_(None)
                )
                .all()
            )
        
        else:
            customers = []
        
        return [self._format_customer(c) for c in customers]
    
    def _format_customer(self, user: User) -> Dict[str, Any]:
        """Format customer for response."""
        return {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "phone": user.phone,
            "is_active": user.is_active,
            "email_verified": user.email_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None
        }
    
    def _format_order(self, order: Order) -> Dict[str, Any]:
        """Format order for response."""
        return {
            "id": order.id,
            "total_amount": float(order.total_amount),
            "status": order.status.value if hasattr(order.status, 'value') else str(order.status),
            "created_at": order.created_at.isoformat() if order.created_at else None
        }
    
    def _format_address(self, address) -> Dict[str, Any]:
        """Format address for response."""
        return {
            "id": address.id,
            "type": address.address_type.value if hasattr(address.address_type, 'value') else str(address.address_type),
            "full_name": address.full_name,
            "phone": address.phone,
            "address_line_1": address.address_line_1,
            "address_line_2": address.address_line_2,
            "city": address.city,
            "state": address.state,
            "postal_code": address.postal_code,
            "country": address.country,
            "is_default": address.is_default
        }

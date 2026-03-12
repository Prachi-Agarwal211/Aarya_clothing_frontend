from sqlalchemy.orm import Session
from shared.event_bus import EventHandler, Event, EventType
from models.analytics import StaffTask
from database.database import SessionLocal
import logging

logger = logging.getLogger(__name__)

class OrderCreatedHandler(EventHandler):
    """Automatically creates a staff task when a new order is received."""
    
    def event_types(self):
        return [EventType.ORDER_CREATED]
        
    def handle(self, event: Event) -> bool:
        try:
            order_data = event.data
            order_id = event.aggregate_id
            order_number = order_data.get("order_number", f"#{order_id}")
            
            logger.info(f"Handling ORDER_CREATED event for order {order_number}, creating staff task")
            
            # Create a new session for the event handler
            db = SessionLocal()
            try:
                # Check if a task already exists for this order to prevent duplicates
                existing_task = db.query(StaffTask).filter(
                    StaffTask.task_type == "order_processing",
                    StaffTask.title.like(f"%{order_number}%")
                ).first()
                
                if existing_task:
                    logger.info(f"Staff task for order {order_number} already exists")
                    return True
                
                # Create new staff task for order processing
                new_task = StaffTask(
                    task_type="order_processing",
                    title=f"Process Order {order_number}",
                    description=f"New order received. Total: {order_data.get('total_amount', 'N/A')}. Shipping to: {order_data.get('shipping_address', 'N/A')}",
                    priority="high",
                    status="pending"
                )
                
                db.add(new_task)
                db.commit()
                logger.info(f"Successfully created staff task for order {order_number}")
                return True
            except Exception as e:
                db.rollback()
                logger.error(f"Error creating staff task for order: {str(e)}")
                return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to handle ORDER_CREATED event: {str(e)}")
            return False

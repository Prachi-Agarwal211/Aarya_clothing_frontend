from celery import shared_task
import logging
from database.database import SessionLocal
from models.inventory import Inventory
from models.product import Product
from shared.event_bus import EventBus
from core.redis_client import redis_client

logger = logging.getLogger(__name__)

@shared_task(name="core.tasks.inventory.process_bulk_inventory_update")
def process_bulk_inventory_update(updates: list[dict], user_id: int):
    """
    Background worker task to process heavy inventory syncs from ERP systems or bulk staff restocks.
    Args:
        updates: List of dicts e.g., [{"sku": "TSH-01", "quantity": 50}]
        user_id: ID of admin/staff triggering update
    """
    logger.info(f"Starting async bulk inventory update for {len(updates)} items.")
    
    db = SessionLocal()
    event_bus = EventBus(redis_client=redis_client, service_name="commerce_service")
    
    success_count = 0
    errors = []
    
    try:
        for update in updates:
            sku = update.get("sku")
            quantity_delta = update.get("quantity", 0)
            
            if not sku or quantity_delta == 0:
                continue
                
            inventory_item = db.query(Inventory).filter(Inventory.sku == sku).first()
            if not inventory_item:
                errors.append(f"SKU {sku} not found")
                continue
                
            # Update stock safely
            inventory_item.quantity += quantity_delta
            
            # Recheck product stock to clear "out-of-stock" statuses
            if inventory_item.product and inventory_item.product.is_active:
                if inventory_item.product.total_stock > 0:
                    inventory_item.product.is_active = True # Re-activate silently if it was disabled due to stock
            
            success_count += 1
            
        db.commit()
        
        # Publish exactly once per bulk op rather than 1000 times natively
        if success_count > 0:
            event_bus.publish_inventory_alert({
                "type": "bulk_sync_complete",
                "message": f"Successfully updated {success_count} SKUs.",
                "user_id": user_id
            })
            
    except Exception as e:
        db.rollback()
        logger.error(f"Bulk inventory update failed: {e}")
        event_bus.publish_inventory_alert({
            "type": "bulk_sync_failed",
            "message": str(e),
            "user_id": user_id
        })
    finally:
        db.close()
        
    return {"success": success_count, "errors": errors}

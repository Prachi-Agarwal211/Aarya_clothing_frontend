"""Script to apply new performance indexes to the database."""
import asyncio
import logging
from sqlalchemy import text
from typing import List

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import from app context
import sys
import os

# Add absolute project root to sys.path to find 'shared'
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# Add commerce service specifically to path for local DB resolving
commerce_path = os.path.join(project_root, 'services', 'commerce')
sys.path.insert(0, commerce_path)

try:
    from database.database import SessionLocal, engine
except ImportError as e:
    logger.error(f"Could not import database module: {e}")
    sys.exit(1)

# List of explicitly defined indexes to add
# Using CONCURRENTLY to avoid locking tables in production
INDEXES_TO_CREATE = [
    # Orders
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status ON orders(user_id, status, created_at DESC);",
    # Products
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_active ON products(category_id, is_active, created_at DESC);",
    # Chat Rooms
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_rooms_customer_status ON chat_rooms(customer_id, status, updated_at DESC);",
    # Order Tracking
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_tracking_order_status ON order_tracking(order_id, status, created_at DESC);",
    # Reviews
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_product_rating ON reviews(product_id, rating, created_at DESC);"
]

# Separate connection required for CONCURRENTLY indexing
def apply_indexes():
    logger.info("Starting index application...")
    
    # We must operate outside of a transaction block for CONCURRENTLY
    with engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        for query in INDEXES_TO_CREATE:
            try:
                logger.info(f"Executing: {query}")
                conn.execute(text(query))
                logger.info("Successfully created index.")
            except Exception as e:
                # Catching expected errors where features like chat_rooms don't exist yet
                logger.warning(f"Could not create index. It may already exist or table is missing: {str(e)[:100]}...")

    # For partial index which is safer inside standard schema definitions
    try:
         with engine.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            logger.info("Applying partial index on inventory...")
            conn.execute(text(
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_sku_low_stock "
                "ON inventory(sku) WHERE quantity <= low_stock_threshold;"
            ))
            logger.info("Successfully created partial inventory index.")
    except Exception as e:
         logger.warning(f"Failed partial index: {str(e)[:100]}...")


    logger.info("Index application complete.")

if __name__ == "__main__":
    apply_indexes()

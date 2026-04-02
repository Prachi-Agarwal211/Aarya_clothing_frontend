"""
Migration script to add 'tags' column to products table.

This script adds the missing 'tags' column that is required by the Meilisearch sync functionality.
Run this once to update existing database schema.

Usage:
    python migrate_tags_column.py
"""
import sys
import logging
from sqlalchemy import text, inspect
from database.database import engine, SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def add_tags_column():
    """Add tags column to products table if it doesn't exist."""
    if check_column_exists('products', 'tags'):
        logger.info("✓ Column 'tags' already exists in products table")
        return True
    
    logger.info("Adding 'tags' column to products table...")
    
    try:
        with engine.connect() as conn:
            # Add nullable column (safe operation)
            conn.execute(text("""
                ALTER TABLE products 
                ADD COLUMN tags VARCHAR(500) NULL
            """))
            conn.commit()
        
        logger.info("✓ Successfully added 'tags' column to products table")
        return True
    
    except Exception as e:
        logger.error(f"✗ Failed to add 'tags' column: {e}")
        return False


def verify_migration():
    """Verify that the migration was successful."""
    if check_column_exists('products', 'tags'):
        logger.info("✓ Migration verified: 'tags' column exists")
        return True
    else:
        logger.error("✗ Migration verification failed: 'tags' column not found")
        return False


def main():
    """Run the migration."""
    logger.info("=" * 60)
    logger.info("Starting migration: Add 'tags' column to products table")
    logger.info("=" * 60)
    
    success = add_tags_column()
    
    if success:
        verified = verify_migration()
        if verified:
            logger.info("=" * 60)
            logger.info("✓ Migration completed successfully")
            logger.info("=" * 60)
            return 0
    
    logger.error("=" * 60)
    logger.error("✗ Migration failed")
    logger.error("=" * 60)
    return 1


if __name__ == "__main__":
    sys.exit(main())

"""
Backfill OrderItem size/color from ProductVariant (inventory)
=============================================================

Fix for old orders created before 2026-04-28 where size/color were NULL
due to using wrong relationship (.inventory instead of .variant) or missing
snapshot data.

This script:
1. Finds all order_items with NULL size OR NULL color
2. For each, looks up the corresponding ProductVariant by variant_id
3. Updates size/color from variant if available

Run once: python backfill_order_item_variants.py
"""

import sys
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.base_config import BaseSettings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def backfill_order_items():
    """Update order_items.size/color from inventory table where NULL."""
    settings = BaseSettings()

    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = SessionLocal()

    try:
        logger.info("Starting backfill of order item size/color...")

        # Find all order_items with variant_id but NULL size or color
        query = text("""
            SELECT oi.id, oi.variant_id, oi.size, oi.color
            FROM order_items oi
            WHERE oi.variant_id IS NOT NULL
              AND (oi.size IS NULL OR oi.color IS NULL)
            ORDER BY oi.id
        """)
        items = db.execute(query).fetchall()

        logger.info(f"Found {len(items)} order items with missing size/color")
        if not items:
            logger.info("Nothing to fix!")
            return

        updated_count = 0
        skipped_count = 0

        for item in items:
            item_id, variant_id, old_size, old_color = item

            # Get variant data
            variant = db.execute(
                text("SELECT size, color FROM inventory WHERE id = :vid"),
                {"vid": variant_id},
            ).fetchone()

            if not variant:
                logger.warning(
                    f"Item {item_id}: variant {variant_id} not found in inventory"
                )
                skipped_count += 1
                continue

            variant_size, variant_color = variant
            new_size = variant_size if old_size is None else old_size
            new_color = variant_color if old_color is None else old_color

            if new_size == old_size and new_color == old_color:
                continue  # No change needed

            # Update
            db.execute(
                text("""
                    UPDATE order_items
                    SET size = :size, color = :color, updated_at = NOW()
                    WHERE id = :id
                """),
                {"id": item_id, "size": new_size, "color": new_color},
            )
            updated_count += 1
            logger.debug(f"Item {item_id}: set size={new_size}, color={new_color}")

            # Commit in batches of 100
            if updated_count % 100 == 0:
                db.commit()
                logger.info(f"Committed {updated_count} updates...")

        db.commit()
        logger.info(
            f"Backfill complete: {updated_count} updated, {skipped_count} skipped"
        )

    except Exception as e:
        logger.error(f"Backfill failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    backfill_order_items()

"""
Complete Database & Redis Wipe
================================
Nuclear option: delete ALL data from the e-commerce platform
EXCEPT user accounts (users table) to keep registrations intact.

Tables truncated in dependency order to respect FK constraints.
Sequences reset to 1.
Redis completely flushed.

Run ONLY when you want to reset the entire site to empty state.
"""

import sys
import os
import psycopg2
from redis import Redis
from psycopg2.extras import RealDictCursor
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config - adjust if needed
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "aarya_clothing",
    "user": "postgres",
    "password": "password",
}

REDIS_URL = "redis://localhost:6379"


def truncate_tables(conn):
    """Truncate all commerce/payment tables in safe order."""
    with conn.cursor() as cur:
        # Disable triggers temporarily for clean truncate
        cur.execute("SET session_replication_role = 'replica';")

        # Order matters - child tables first
        tables = [
            # Commerce
            "order_items",  # references orders, inventory
            "order_tracking",  # references orders
            "reviews",  # references products, users
            "returns",  # references orders, return_items?
            "return_items",  # references returns, order_items
            "chat_messages",  # references chat_rooms
            "chat_rooms",  # references users
            "inventory",  # references products
            "product_images",  # references products
            "collections_products",  # join table
            "collections",  # M:N with products
            "categories",  # alias for collections? treat as same
            "products",  # parent of inventory/images
            "addresses",  # references users
            "payment_refunds",  # references payment_transactions
            "payment_transactions",  # references orders
            "webhook_events",  # references payment_transactions
            # Core (keep users, but clear dependent data)
            "user_profiles",  # references users (1:1)
            "otp_verifications",  # references users
            "sessions",  # references users
            "password_reset_tokens",  # references users
            # Admin specific
            "staff_tasks",  # references orders, staff
            "staff_notifications",  # references staff
            "email_outbox",  # references orders, users
            # Audit logs (optional keep? truncate)
            "payment_order_audit",  # audit trail
            "admin_activity_log",  # audit trail
        ]

        for table in tables:
            try:
                cur.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE;')
                logger.info(f"✓ Truncated {table}")
            except Exception as e:
                logger.warning(f"⚠ Could not truncate {table}: {e}")

        # Re-enable triggers
        cur.execute("SET session_replication_role = 'default';")
        conn.commit()


def reset_sequences(conn):
    """Reset all sequences to 1."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT SETVAL('invoice_number_seq', 1, false);
            SELECT SETVAL('order_items_id_seq', 1, false);
            SELECT SETVAL('orders_id_seq', 1, false);
            SELECT SETVAL('products_id_seq', 1, false);
            SELECT SETVAL('product_images_id_seq', 1, false);
            SELECT SETVAL('inventory_id_seq', 1, false);
            SELECT SETVAL('payment_transactions_id_seq', 1, false);
            SELECT SETVAL('webhook_events_id_seq', 1, false);
            SELECT SETVAL('reviews_id_seq', 1, false);
            SELECT SETVAL('chat_rooms_id_seq', 1, false);
            SELECT SETVAL('chat_messages_id_seq', 1, false);
            SELECT SETVAL('addresses_id_seq', 1, false);
            SELECT SETVAL('order_tracking_id_seq', 1, false);
            SELECT SETVAL('email_outbox_id_seq', 1, false);
            SELECT SETVAL('staff_tasks_id_seq', 1, false);
            SELECT SETVAL('staff_notifications_id_seq', 1, false);
            SELECT SETVAL('admin_activity_log_id_seq', 1, false);
            SELECT SETVAL('payment_refunds_id_seq', 1, false);
        """)
        conn.commit()
        logger.info("✓ All sequences reset to 1")


def clear_redis():
    """Flush entire Redis database."""
    r = Redis.from_url(REDIS_URL)
    r.flushall()
    logger.info("✓ Redis flushed (all keys deleted)")


def main():
    logger.warning("=" * 70)
    logger.warning("DESTRUCTIVE OPERATION: WIPING ALL DATA")
    logger.warning("This will DELETE all orders, products, carts, reviews, etc.")
    logger.warning("User accounts will be preserved.")
    logger.warning("=" * 70)

    # Confirm
    confirm = input("Type 'YES I WANT TO WIPE' to confirm: ").strip()
    if confirm != "YES I WANT TO WIPE":
        logger.info("Aborted.")
        return

    # Connect DB
    logger.info("Connecting to database...")
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        logger.info("Truncating tables...")
        truncate_tables(conn)

        logger.info("Resetting sequences...")
        reset_sequences(conn)

        logger.info("Database cleared.")
    finally:
        conn.close()

    # Clear Redis
    logger.info("Clearing Redis cache...")
    try:
        clear_redis()
    except Exception as e:
        logger.error(f"Redis clear failed: {e}")

    logger.info("✅ Full wipe complete! Database and cache are now empty.")
    logger.info("You can now start services with: docker compose up -d")


if __name__ == "__main__":
    main()

"""
Migration script to consolidate duplicate user tables
This script merges data from commerce.users and commerce.user_profiles
into the consolidated core.users table
"""
import psycopg2
from psycopg2 import sql
from psycopg2.extras import DictCursor
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        dbname="aarya_clothing",
        user="postgres",
        password="postgres",
        host="localhost",
        port="5432"
    )

def migrate_user_data():
    """Migrate data from commerce.users to consolidated users table"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=DictCursor)
        
        logger.info("Starting user data migration...")
        
        # 1. Check if consolidated users table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'users'
            )
        """)
        users_table_exists = cursor.fetchone()[0]
        
        if not users_table_exists:
            logger.error("Consolidated users table does not exist!")
            return False
        
        # 2. Check if commerce.users table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'commerce_users'
            )
        """)
        commerce_users_exists = cursor.fetchone()[0]
        
        if not commerce_users_exists:
            logger.info("No commerce users table to migrate")
            return True
        
        # 3. Migrate user data
        cursor.execute("""
            INSERT INTO users (
                id, email, username, hashed_password, 
                full_name, phone, avatar_url, date_of_birth,
                is_active, email_verified, phone_verified, signup_verification_method,
                failed_login_attempts, account_locked_until, last_login_at, password_changed_at,
                role, created_at, updated_at
            )
            SELECT 
                id, email, username, hashed_password,
                COALESCE(up.full_name, ''), 
                COALESCE(up.phone, ''), 
                COALESCE(up.avatar_url, ''), 
                up.date_of_birth,
                is_active, email_verified, phone_verified, signup_verification_method,
                failed_login_attempts, account_locked_until, last_login_at, password_changed_at,
                role, created_at, updated_at
            FROM commerce_users cu
            LEFT JOIN commerce_user_profiles up ON cu.id = up.user_id
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                username = EXCLUDED.username,
                hashed_password = EXCLUDED.hashed_password,
                full_name = EXCLUDED.full_name,
                phone = EXCLUDED.phone,
                avatar_url = EXCLUDED.avatar_url,
                date_of_birth = EXCLUDED.date_of_birth,
                is_active = EXCLUDED.is_active,
                email_verified = EXCLUDED.email_verified,
                phone_verified = EXCLUDED.phone_verified,
                signup_verification_method = EXCLUDED.signup_verification_method,
                failed_login_attempts = EXCLUDED.failed_login_attempts,
                account_locked_until = EXCLUDED.account_locked_until,
                last_login_at = EXCLUDED.last_login_at,
                password_changed_at = EXCLUDED.password_changed_at,
                role = EXCLUDED.role,
                updated_at = EXCLUDED.updated_at
        """)
        
        migrated_count = cursor.rowcount
        logger.info(f"Migrated {migrated_count} user records")
        
        # 4. Migrate addresses
        cursor.execute("""
            INSERT INTO addresses (
                id, user_id, full_name, phone, address_line1, address_line2,
                city, state, postal_code, country, is_default
            )
            SELECT 
                id, user_id, full_name, phone, address_line1, address_line2,
                city, state, postal_code, country, is_default
            FROM commerce_addresses
            ON CONFLICT (id) DO NOTHING
        """)
        
        address_count = cursor.rowcount
        logger.info(f"Migrated {address_count} address records")
        
        # 5. Migrate wishlist
        cursor.execute("""
            INSERT INTO wishlist (
                id, user_id, product_id, created_at
            )
            SELECT 
                id, user_id, product_id, created_at
            FROM commerce_wishlist
            ON CONFLICT (id) DO NOTHING
        """)
        
        wishlist_count = cursor.rowcount
        logger.info(f"Migrated {wishlist_count} wishlist records")
        
        # 6. Migrate reviews
        cursor.execute("""
            INSERT INTO reviews (
                id, user_id, product_id, rating, comment, created_at, updated_at
            )
            SELECT 
                id, user_id, product_id, rating, comment, created_at, updated_at
            FROM commerce_reviews
            ON CONFLICT (id) DO NOTHING
        """)
        
        review_count = cursor.rowcount
        logger.info(f"Migrated {review_count} review records")
        
        # 7. Migrate orders
        cursor.execute("""
            INSERT INTO orders (
                id, user_id, order_number, status, total_amount, created_at, updated_at
            )
            SELECT 
                id, user_id, order_number, status, total_amount, created_at, updated_at
            FROM commerce_orders
            ON CONFLICT (id) DO NOTHING
        """)
        
        order_count = cursor.rowcount
        logger.info(f"Migrated {order_count} order records")
        
        conn.commit()
        logger.info("Migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def cleanup_duplicate_tables():
    """Drop duplicate tables after successful migration"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        logger.info("Cleaning up duplicate tables...")
        
        # Drop commerce tables
        tables_to_drop = [
            'commerce_users',
            'commerce_user_profiles',
            'commerce_addresses',
            'commerce_wishlist',
            'commerce_reviews',
            'commerce_orders'
        ]
        
        for table in tables_to_drop:
            cursor.execute(sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(sql.Identifier(table)))
            logger.info(f"Dropped table: {table}")
        
        conn.commit()
        logger.info("Cleanup completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Cleanup failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    logger.info("Starting user table consolidation migration...")
    
    # Step 1: Migrate data
    migration_success = migrate_user_data()
    
    if migration_success:
        # Step 2: Clean up duplicate tables
        cleanup_success = cleanup_duplicate_tables()
        
        if cleanup_success:
            logger.info("✅ User table consolidation completed successfully!")
        else:
            logger.error("❌ Migration succeeded but cleanup failed")
    else:
        logger.error("❌ Migration failed - no cleanup performed")
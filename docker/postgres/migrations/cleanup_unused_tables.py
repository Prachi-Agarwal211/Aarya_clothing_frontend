"""
Migration script to clean up unused tables and columns
Removes redundant user_profiles, user_security tables and unused columns
"""
import psycopg2
from psycopg2 import sql
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

def migrate_data_from_profiles_to_users():
    """Migrate any remaining data from user_profiles to users table"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        logger.info("Migrating data from user_profiles to users...")
        
        # Check if user_profiles table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'user_profiles'
            )
        """)
        profiles_exist = cursor.fetchone()[0]
        
        if not profiles_exist:
            logger.info("user_profiles table doesn't exist - nothing to migrate")
            return True
        
        # Migrate profile data to users table
        cursor.execute("""
            UPDATE users u
            SET 
                full_name = COALESCE(p.full_name, u.full_name),
                phone = COALESCE(p.phone, u.phone),
                avatar_url = COALESCE(p.avatar_url, u.avatar_url)
            FROM user_profiles p
            WHERE u.id = p.user_id
        """)
        
        migrated_count = cursor.rowcount
        logger.info(f"Migrated profile data for {migrated_count} users")
        
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def cleanup_unused_tables():
    """Drop unused tables"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        logger.info("Cleaning up unused tables...")
        
        # Tables to drop
        tables_to_drop = [
            'user_profiles',
            'user_security'
        ]
        
        for table in tables_to_drop:
            cursor.execute(sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(sql.Identifier(table)))
            logger.info(f"Dropped table: {table}")
        
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"Cleanup failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def cleanup_unused_columns():
    """Remove unused columns from users table"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        logger.info("Cleaning up unused columns...")
        
        # Check if columns exist before dropping
        columns_to_drop = ['avatar_url', 'last_login_ip']
        
        for column in columns_to_drop:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_name = 'users'
                    AND column_name = %s
                )
            """, (column,))
            
            column_exists = cursor.fetchone()[0]
            
            if column_exists:
                cursor.execute(sql.SQL("ALTER TABLE users DROP COLUMN IF EXISTS {} CASCADE").format(sql.Identifier(column)))
                logger.info(f"Dropped column: users.{column}")
            else:
                logger.info(f"Column users.{column} doesn't exist - skipping")
        
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"Column cleanup failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def cleanup_verification_tokens():
    """Remove unused columns from verification_tokens table"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        logger.info("Cleaning up verification_tokens table...")
        
        # Drop ip_address column if it exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'verification_tokens'
                AND column_name = 'ip_address'
            )
        """)
        
        ip_exists = cursor.fetchone()[0]
        
        if ip_exists:
            cursor.execute("ALTER TABLE verification_tokens DROP COLUMN ip_address")
            logger.info("Dropped column: verification_tokens.ip_address")
        else:
            logger.info("Column verification_tokens.ip_address doesn't exist - skipping")
        
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"Verification tokens cleanup failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    logger.info("Starting database cleanup...")
    
    # Step 1: Migrate any remaining profile data
    migration_success = migrate_data_from_profiles_to_users()
    
    if migration_success:
        # Step 2: Clean up unused tables
        tables_success = cleanup_unused_tables()
        
        if tables_success:
            # Step 3: Clean up unused columns
            columns_success = cleanup_unused_columns()
            
            if columns_success:
                # Step 4: Clean up verification tokens
                tokens_success = cleanup_verification_tokens()
                
                if tokens_success:
                    logger.info("✅ Database cleanup completed successfully!")
                else:
                    logger.error("❌ Verification tokens cleanup failed")
            else:
                logger.error("❌ Column cleanup failed")
        else:
            logger.error("❌ Table cleanup failed")
    else:
        logger.error("❌ Data migration failed")
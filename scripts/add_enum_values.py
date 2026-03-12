import os
import sys

# Append commerce service to path
commerce_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'services', 'commerce'))
sys.path.append(commerce_path)

from sqlalchemy import create_engine, text

# Default DB URL matching local dev setup
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://aarya_user:aarya_password@localhost:5433/aarya_db")

def add_enum_values():
    print("Connecting to database...")
    try:
        engine = create_engine(DATABASE_URL)
        with engine.begin() as conn:
            # PostgreSQL 12+ supports `ADD VALUE IF NOT EXISTS` inside ALTER TYPE
            # For returning reasons
            print("Adding 'color_issue' to return_reason pg_enum...")
            
            # Since native_enum=False is used in Python, the database might not actually have a pg_enum.
            # We first check if the enum type exists before altering.
            check_enum = text("""
                SELECT 1 FROM pg_type WHERE typname = 'return_reason';
            """)
            has_enum = conn.execute(check_enum).scalar()
            
            if has_enum:
                try:
                    conn.execute(text("ALTER TYPE return_reason ADD VALUE IF NOT EXISTS 'color_issue'"))
                    print("✅ Added 'color_issue' to return_reason (if didn't exist).")
                except Exception as e:
                    print(f"Warning: could not alter return_reason: {e}")
            else:
                print("ℹ️ 'return_reason' pg_enum type not found. The app likely uses VARCHAR/CHECK constraints.")
                
    except Exception as e:
        print(f"Failed to connect to database or execute query: {e}")

if __name__ == "__main__":
    add_enum_values()

#!/usr/bin/env python3
import os
import sys

# Append commerce service to path
commerce_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'services', 'commerce'))
sys.path.append(commerce_path)

from sqlalchemy import create_engine, text
from models.return_request import ReturnReason
from models.order import OrderStatus

# Default DB URL matching local dev setup
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://aarya_user:aarya_password@localhost:5433/aarya_db")

def check_enum_parity():
    print("Connecting to database...")
    try:
        engine = create_engine(DATABASE_URL)
        conn = engine.connect()
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        print("Skipping enum parity check.")
        return

    enums_to_check = [
        ('return_reason', ReturnReason),
        ('order_status', OrderStatus),
    ]

    all_matched = True

    try:
        for db_name, enum_class in enums_to_check:
            print(f"\nChecking enum: {db_name}")
            # Query pg_enum for existing values
            query = text("""
                SELECT e.enumlabel 
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid 
                WHERE t.typname = :name
            """)
            result = conn.execute(query, {"name": db_name})
            db_values = {row[0] for row in result}
            
            code_values = {e.value for e in enum_class}
            
            if not db_values and not code_values:
                print(f"⚠️ Both DB and Code have no values or enum doesn't exist.")
                continue
                
            if db_values == code_values:
                print(f"✅ EXACT MATCH!")
            else:
                all_matched = False
                print(f"❌ MISMATCH FOUND!")
                print(f"  Missing in DB: {code_values - db_values}")
                print(f"  Missing in Code: {db_values - code_values}")

        if all_matched:
            print("\n🎉 All enums match perfectly!")
            sys.exit(0)
        else:
            print("\n⚠️ Enum parities failed! Please update your DB schema or python models.")
            sys.exit(1)
            
    finally:
        conn.close()

if __name__ == "__main__":
    check_enum_parity()

#!/usr/bin/env python3
"""Remove user account by phone number so they can re-register.

Usage:
    python scripts/remove_phone_user.py --phone 9929986743 [--dry-run]

Requires DATABASE_URL env var (or .env file).
"""

import argparse
import os
import sys

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from sqlalchemy import create_engine, text


def main():
    parser = argparse.ArgumentParser(description="Remove user by phone number")
    parser.add_argument("--phone", required=True, help="Phone number to remove (digits only)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without deleting")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL env var not set")
        sys.exit(1)

    # Normalize phone to E.164 format
    digits = "".join(c for c in args.phone if c.isdigit())
    if len(digits) == 10:
        phone_e164 = f"+91{digits}"
    elif len(digits) == 12 and digits.startswith("91"):
        phone_e164 = f"+{digits}"
    else:
        phone_e164 = f"+{digits}"

    print(f"Looking for user with phone: {phone_e164}")

    engine = create_engine(db_url)

    with engine.connect() as conn:
        # Find the user
        user = conn.execute(
            text("SELECT id, email, username, phone, role, full_name FROM users WHERE phone = :phone"),
            {"phone": phone_e164},
        ).fetchone()

        if not user:
            # Try with raw digits too
            user = conn.execute(
                text("SELECT id, email, username, phone, role, full_name FROM users WHERE phone LIKE :pattern"),
                {"pattern": f"%{digits[-10:]}%"},
            ).fetchone()

        if not user:
            print("No user found with that phone number.")
            sys.exit(0)

        user_id = user[0]
        print(f"Found user: id={user_id}, email={user[1]}, username={user[2]}, phone={user[3]}, role={user[4]}, name={user[5]}")

        if user[4] in ("admin", "super_admin"):
            print("WARNING: This is an admin/super_admin user. Aborting.")
            sys.exit(1)

        if args.dry_run:
            print("\n--- DRY RUN ---")
            print(f"Would delete user_id={user_id} and related data:")
            # Check related data
            tables_to_check = [
                ("sessions", "user_id"),
                ("otp_codes", "user_id"),
                ("orders", "user_id"),
                ("cart_items", "user_id"),
                ("addresses", "user_id"),
                ("reviews", "user_id"),
                ("stock_reservations", "user_id"),
            ]
            for table, col in tables_to_check:
                try:
                    count = conn.execute(
                        text(f"SELECT COUNT(*) FROM {table} WHERE {col} = :uid"),
                        {"uid": user_id},
                    ).scalar()
                    if count:
                        print(f"  - {table}: {count} rows")
                except Exception:
                    pass
            print(f"\nRun without --dry-run to execute the deletion.")
            sys.exit(0)

        # Delete related data (order matters due to FK constraints)
        delete_queries = [
            ("DELETE FROM session_audit_logs WHERE session_id IN (SELECT id FROM sessions WHERE user_id = :uid)", "session_audit_logs"),
            ("DELETE FROM sessions WHERE user_id = :uid", "sessions"),
            ("DELETE FROM otp_codes WHERE user_id = :uid", "otp_codes"),
            ("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = :uid)", "order_items"),
            ("DELETE FROM orders WHERE user_id = :uid", "orders"),
            ("DELETE FROM cart_items WHERE user_id = :uid", "cart_items"),
            ("DELETE FROM addresses WHERE user_id = :uid", "addresses"),
            ("DELETE FROM reviews WHERE user_id = :uid", "reviews"),
            ("DELETE FROM stock_reservations WHERE user_id = :uid", "stock_reservations"),
            ("DELETE FROM users WHERE id = :uid", "users"),
        ]

        for query_str, table_name in delete_queries:
            try:
                result = conn.execute(text(query_str), {"uid": user_id})
                if result.rowcount:
                    print(f"  Deleted {result.rowcount} rows from {table_name}")
            except Exception as e:
                print(f"  Warning: Could not delete from {table_name}: {e}")
                # Rollback aborted transaction so subsequent operations can proceed
                conn.rollback()

        conn.commit()
        print(f"\nUser {user_id} ({phone_e164}) has been removed. They can now register again.")

    engine.dispose()


if __name__ == "__main__":
    main()

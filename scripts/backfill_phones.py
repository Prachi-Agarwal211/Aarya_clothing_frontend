#!/usr/bin/env python3
"""Backfill phone numbers to E.164 format (+91XXXXXXXXXX) for all users.

Usage:
    python scripts/backfill_phones.py --dry-run  # Preview changes
    python scripts/backfill_phones.py             # Apply changes
"""
import os, sys, logging
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DRY_RUN = "--dry-run" in sys.argv

from shared.phone_utils import normalize_phone_safe

def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL not set.")
        sys.exit(1)

    from sqlalchemy import create_engine, text
    engine = create_engine(db_url)
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, phone FROM users WHERE phone IS NOT NULL")).fetchall()
        logger.info(f"Found {len(rows)} users with phone numbers.")
        updated = skipped = errors = 0
        for row in rows:
            user_id, phone = row[0], row[1]
            normalized = normalize_phone_safe(phone)
            if not normalized:
                logger.warning(f"  User {user_id}: could not normalize {phone!r}")
                errors += 1
                continue
            if normalized == phone:
                skipped += 1
                continue
            logger.info(f"  User {user_id}: {phone!r} -> {normalized!r}")
            if not DRY_RUN:
                conn.execute(text("UPDATE users SET phone=:p, updated_at=NOW() WHERE id=:id"), {"p": normalized, "id": user_id})
            updated += 1
        if not DRY_RUN:
            conn.commit()
        logger.info(f"{'Would update' if DRY_RUN else 'Updated'} {updated}, skipped {skipped}, errors {errors}")
    engine.dispose()

if __name__ == "__main__":
    main()

"""Site config — admin-managed key/value store.

Backs the admin "Site Settings" page (free-shipping threshold, contact info,
intro-video toggles, etc.) and invalidates the public site/landing caches on
write so the storefront picks up changes within a request or two.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.redis_client import redis_client
from database.database import get_db
from shared.auth_middleware import require_admin

router = APIRouter(tags=["Site Config"])


@router.get("/api/v1/admin/site/config")
async def get_site_config(
    db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    rows = db.execute(
        text("SELECT key, value, description, updated_at FROM site_config")
    ).fetchall()
    return {
        "config": {
            r[0]: {"value": r[1], "description": r[2], "updated_at": str(r[3])}
            for r in rows
        }
    }


@router.put("/api/v1/admin/site/config")
async def update_site_config(
    data: dict, db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    """Upsert a batch of site_config keys.

    Values are coerced to strings (the column is TEXT) and the public caches
    are invalidated so storefront reads catch up immediately.
    """
    for key, value in data.items():
        val_str = str(value).lower() if isinstance(value, bool) else str(value)
        db.execute(
            text(
                "INSERT INTO site_config (key, value) VALUES (:key, :value) "
                "ON CONFLICT (key) DO UPDATE SET value = :value, updated_at = :now"
            ),
            {"key": key, "value": val_str, "now": datetime.now(timezone.utc)},
        )
    db.commit()
    redis_client.invalidate_pattern("public:site:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": "Site config updated"}

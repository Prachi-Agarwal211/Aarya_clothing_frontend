"""
Collections (a.k.a. categories) — storefront reads only.

Admin CRUD lives in ``services/admin/routes/collections.py`` (nginx
``/api/v1/admin/*`` → admin service).

Routes are duplicated under ``/api/v1/collections`` and ``/api/v1/categories``
for backward compatibility.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.advanced_cache import cache
from database.database import get_db
from helpers import enrich_collection
from models.collection import Collection

router = APIRouter(tags=["Collections"])


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------


@router.get("/api/v1/collections")
@router.get("/api/v1/categories")
async def list_collections(
    featured_only: bool = False,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """List collections; cached for 5 minutes per (featured, active) combo."""
    cache_key = f"collections:list:{featured_only}:{active_only}"

    async def fetch_collections():
        query = db.query(Collection)
        if active_only:
            query = query.filter(Collection.is_active == True)  # noqa: E712
        if featured_only:
            query = query.filter(Collection.is_featured == True)  # noqa: E712
        collections = query.order_by(
            Collection.display_order, Collection.name
        ).all()
        return [enrich_collection(c) for c in collections]

    return await cache.get_or_set(cache_key, fetch_collections, ttl=300)


@router.get("/api/v1/collections/{collection_id}")
@router.get("/api/v1/categories/{category_id}")
async def get_collection(
    collection_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Fetch a collection by numeric id (accepts either path segment)."""
    cid = collection_id or category_id
    col = db.query(Collection).filter(Collection.id == cid).first()
    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )
    return enrich_collection(col)


@router.get("/api/v1/collections/slug/{slug}")
@router.get("/api/v1/categories/slug/{slug}")
async def get_collection_by_slug(slug: str, db: Session = Depends(get_db)):
    """Fetch a collection by its URL slug."""
    col = db.query(Collection).filter(Collection.slug == slug).first()
    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )
    return enrich_collection(col)

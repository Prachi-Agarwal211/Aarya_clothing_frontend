"""
Collections (a.k.a. categories) router.

The storefront and admin panel both pivot off the same ``Collection`` model,
so this module owns:

* Public read endpoints (list / detail by id / detail by slug).
* Admin CRUD: create, list, update, delete, image upload.
* Admin bulk operations: status toggle, reorder.

Every route is registered under both ``/api/v1/collections`` and
``/api/v1/categories`` for backward compatibility with older clients that
still use the legacy ``categories`` path.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from core.advanced_cache import cache
from database.database import get_db
from helpers import enrich_collection
from models.collection import Collection
from schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from schemas.collection import (
    BulkCollectionReorder,
    BulkCollectionStatusUpdate,
)
from service.r2_service import r2_service
from shared.auth_middleware import require_admin

logger = logging.getLogger(__name__)

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


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/api/v1/admin/collections",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin - Collections"],
)
@router.post(
    "/api/v1/admin/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin - Collections"],
)
async def create_collection(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Create a collection. Slug must be globally unique."""
    existing = db.query(Collection).filter(Collection.slug == category.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slug already exists",
        )

    db_collection = Collection(
        **{k: v for k, v in category.model_dump().items() if hasattr(Collection, k)}
    )
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    cache.invalidate_pattern("collections:*")
    cache.invalidate_pattern("products:*")
    return enrich_collection(db_collection)


@router.get(
    "/api/v1/admin/collections",
    response_model=List[CategoryResponse],
    tags=["Admin - Collections"],
)
@router.get(
    "/api/v1/admin/categories",
    response_model=List[CategoryResponse],
    tags=["Admin - Collections"],
)
async def list_admin_collections(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """List collections for the admin grid (no caching, ordered by display_order)."""
    query = db.query(Collection)
    if active_only:
        query = query.filter(Collection.is_active == True)  # noqa: E712

    collections = (
        query.order_by(Collection.display_order.asc(), Collection.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [enrich_collection(col) for col in collections]


@router.patch(
    "/api/v1/admin/collections/{collection_id}",
    response_model=CategoryResponse,
    tags=["Admin - Collections"],
)
@router.patch(
    "/api/v1/admin/categories/{category_id}",
    response_model=CategoryResponse,
    tags=["Admin - Collections"],
)
async def update_collection(
    category_id: Optional[int] = None,
    collection_id: Optional[int] = None,
    category_update: CategoryUpdate = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Patch a collection. Unknown fields are silently dropped to stay forward compatible."""
    cid = collection_id or category_id
    db_collection = db.query(Collection).filter(Collection.id == cid).first()
    if not db_collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    update_data = category_update.model_dump(exclude_unset=True) if category_update else {}
    for field, value in update_data.items():
        if hasattr(db_collection, field):
            setattr(db_collection, field, value)

    db.commit()
    db.refresh(db_collection)
    cache.invalidate_pattern("collections:*")
    cache.invalidate_pattern("products:*")
    return enrich_collection(db_collection)


@router.delete(
    "/api/v1/admin/collections/{collection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Admin - Collections"],
)
@router.delete(
    "/api/v1/admin/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Admin - Collections"],
)
async def delete_collection(
    category_id: Optional[int] = None,
    collection_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Hard delete a collection plus its product associations via cascade."""
    cid = collection_id or category_id
    db_collection = db.query(Collection).filter(Collection.id == cid).first()
    if not db_collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    db.delete(db_collection)
    db.commit()
    cache.invalidate_pattern("collections:*")
    cache.invalidate_pattern("products:*")
    return


@router.post(
    "/api/v1/admin/collections/{collection_id}/image",
    response_model=CategoryResponse,
    tags=["Admin - Collections"],
)
@router.post(
    "/api/v1/admin/categories/{category_id}/image",
    response_model=CategoryResponse,
    tags=["Admin - Collections"],
)
async def upload_collection_image(
    category_id: Optional[int] = None,
    collection_id: Optional[int] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Upload (or replace) the collection's hero image in R2."""
    cid = collection_id or category_id
    db_collection = db.query(Collection).filter(Collection.id == cid).first()
    if not db_collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    try:
        image_url = await r2_service.upload_image(file, folder="collections")
        db_collection.image_url = image_url
        db.commit()
        db.refresh(db_collection)
        cache.invalidate_pattern("collections:*")
        return enrich_collection(db_collection)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload category image: {exc}",
        )


@router.post(
    "/api/v1/admin/collections/bulk/status",
    tags=["Admin - Collections"],
)
@router.post(
    "/api/v1/admin/categories/bulk/status",
    tags=["Admin - Collections"],
)
async def bulk_update_collection_status(
    payload: BulkCollectionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Activate or deactivate many collections in a single round trip."""
    updated = (
        db.query(Collection)
        .filter(Collection.id.in_(payload.ids))
        .update({"is_active": payload.is_active}, synchronize_session=False)
    )
    db.commit()
    cache.invalidate_pattern("collections:*")
    return {"updated": updated}


@router.post(
    "/api/v1/admin/collections/bulk/reorder",
    tags=["Admin - Collections"],
)
@router.post(
    "/api/v1/admin/categories/bulk/reorder",
    tags=["Admin - Collections"],
)
async def bulk_reorder_collections(
    payload: BulkCollectionReorder,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Apply per-collection display_order updates from the admin DnD UI."""
    for item in payload.items:
        db.query(Collection).filter(Collection.id == item["id"]).update(
            {"display_order": item["display_order"]},
            synchronize_session=False,
        )
    db.commit()
    cache.invalidate_pattern("collections:*")
    return {"reordered": len(payload.items)}

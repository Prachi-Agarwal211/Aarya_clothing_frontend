"""Admin collection / category management.

Owns CRUD on the ``collections`` table plus image upload/delete and the
two bulk operations admins use for merchandising (reorder + active toggle).
Each route is double-mounted under both ``/api/v1/admin/collections`` and
``/api/v1/admin/categories`` for backwards compatibility with older clients
that still call the legacy "categories" path.
"""

from datetime import datetime
from shared.time_utils import now_ist

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db
from schemas.admin import (
    BulkCollectionReorder,
    BulkCollectionStatusUpdate,
    CategoryCreate,
    CategoryUpdate,
)
from service.r2_service import r2_service
from shared.auth_middleware import require_admin
from utils.url_helpers import get_r2_public_url

router = APIRouter(tags=["Admin Collections"])




@router.get("/api/v1/admin/collections", tags=["Admin Collections"])
@router.get("/api/v1/admin/categories", tags=["Admin Collections"])
async def admin_list_collections(
    featured_only: bool = False,
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all collections for admin (includes inactive)."""
    where_parts = []
    if active_only:
        where_parts.append("is_active = true")
    if featured_only:
        where_parts.append("is_featured = true")
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
    rows = db.execute(
        text(f"""
        SELECT c.id, c.name, c.slug, c.description, c.image_url,
               c.display_order, c.is_active, c.is_featured, c.created_at, c.updated_at,
               COUNT(p.id) as product_count
        FROM collections c
        LEFT JOIN products p ON p.category_id = c.id
        {where_clause}
        GROUP BY c.id, c.name, c.slug, c.description, c.image_url,
                 c.display_order, c.is_active, c.is_featured, c.created_at, c.updated_at
        ORDER BY c.display_order NULLS LAST, c.name
    """)
    ).fetchall()
    collections = [
        {
            "id": r[0],
            "name": r[1],
            "slug": r[2],
            "description": r[3],
            "image_url": get_r2_public_url(r[4]) if r[4] else None,
            "display_order": r[5],
            "is_active": r[6],
            "is_featured": r[7],
            "created_at": r[8],
            "updated_at": r[9],
            "product_count": r[10],
        }
        for r in rows
    ]
    return collections


@router.post("/api/v1/admin/collections", status_code=201, tags=["Admin Collections"])
@router.post("/api/v1/admin/categories", status_code=201, tags=["Admin Collections"])
async def admin_create_collection(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new collection (admin only)."""
    import re  # noqa: PLC0415

    slug = data.slug
    if not slug:
        slug = re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-")
    existing = db.execute(
        text("SELECT id FROM collections WHERE slug = :slug"), {"slug": slug}
    ).fetchone()
    if existing:
        slug = f"{slug}-{int(now_ist().timestamp())}"
    result = db.execute(
        text("""
        INSERT INTO collections (name, slug, description, image_url, display_order,
            is_active, is_featured, created_at, updated_at)
        VALUES (:name, :slug, :desc, :img, :order, :active, :featured, :now, :now)
        RETURNING id
    """),
        {
            "name": data.name,
            "slug": slug,
            "desc": data.description,
            "img": data.image_url,
            "order": data.display_order,
            "active": data.is_active,
            "featured": data.is_featured,
            "now": now_ist(),
        },
    )
    coll_id = result.scalar()
    db.commit()
    redis_client.invalidate_pattern("collections:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {
        "id": coll_id,
        "name": data.name,
        "slug": slug,
        "message": "Collection created",
    }


@router.patch("/api/v1/admin/collections/{collection_id}", tags=["Admin Collections"])
@router.patch("/api/v1/admin/categories/{collection_id}", tags=["Admin Collections"])
async def admin_update_collection(
    collection_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update a collection (admin only)."""
    sets, params = (
        ["updated_at = :now"],
        {"id": collection_id, "now": now_ist()},
    )
    if data.name is not None:
        sets.append("name = :name")
        params["name"] = data.name
    if data.slug is not None:
        sets.append("slug = :slug")
        params["slug"] = data.slug
    if data.description is not None:
        sets.append("description = :desc")
        params["desc"] = data.description
    if data.image_url is not None:
        sets.append("image_url = :img")
        params["img"] = data.image_url
    if data.display_order is not None:
        sets.append("display_order = :order")
        params["order"] = data.display_order
    if data.is_active is not None:
        sets.append("is_active = :active")
        params["active"] = data.is_active
    if data.is_featured is not None:
        sets.append("is_featured = :featured")
        params["featured"] = data.is_featured
    result = db.execute(
        text(f"UPDATE collections SET {', '.join(sets)} WHERE id = :id RETURNING id"),
        params,
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Collection not found")
    db.commit()
    redis_client.invalidate_pattern("collections:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": "Collection updated", "id": collection_id}


@router.delete(
    "/api/v1/admin/collections/{collection_id}",
    status_code=204,
    tags=["Admin Collections"],
)
@router.delete(
    "/api/v1/admin/categories/{collection_id}",
    status_code=204,
    tags=["Admin Collections"],
)
async def admin_delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete a collection (admin only). Fails if active products exist."""
    product_count = (
        db.execute(
            text("SELECT COUNT(*) FROM products WHERE category_id = :id"),
            {"id": collection_id},
        ).scalar()
        or 0
    )
    if product_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete collection with {product_count} products. Reassign or delete products first.",
        )
    result = db.execute(
        text("DELETE FROM collections WHERE id = :id RETURNING id"),
        {"id": collection_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Collection not found")
    db.commit()
    redis_client.invalidate_pattern("collections:*")
    redis_client.invalidate_pattern("public:landing:*")


@router.post("/api/v1/admin/collections/bulk/status", tags=["Admin Collections"])
async def admin_bulk_collection_status(
    data: BulkCollectionStatusUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Bulk activate/deactivate collections."""
    db.execute(
        text(
            "UPDATE collections SET is_active = :active, updated_at = :now WHERE id = ANY(:ids)"
        ),
        {"active": data.is_active, "ids": data.ids, "now": now_ist()},
    )
    db.commit()
    redis_client.invalidate_pattern("collections:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"updated": len(data.ids), "is_active": data.is_active}


@router.post("/api/v1/admin/collections/bulk/reorder", tags=["Admin Collections"])
async def admin_bulk_collection_reorder(
    data: BulkCollectionReorder,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Bulk reorder collections."""
    for item in data.items:
        db.execute(
            text(
                "UPDATE collections SET display_order = :order, updated_at = :now WHERE id = :id"
            ),
            {
                "order": item["display_order"],
                "id": item["id"],
                "now": now_ist(),
            },
        )
    db.commit()
    redis_client.invalidate_pattern("collections:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"reordered": len(data.items)}


@router.post("/api/v1/admin/categories/{category_id}/image", tags=["Admin Collections"])
async def admin_upload_collection_image(
    category_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Upload an image for a collection/category to R2."""
    coll = db.execute(
        text("SELECT id, image_url FROM collections WHERE id = :id"),
        {"id": category_id},
    ).fetchone()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    if coll[1]:
        await r2_service.delete_image(coll[1])
    full_url = await r2_service.upload_image(file, folder="collections")
    r2_base = settings.R2_PUBLIC_URL.rstrip("/") if settings.R2_PUBLIC_URL else ""
    relative_path = (
        full_url.replace(r2_base + "/", "")
        if r2_base and full_url.startswith(r2_base)
        else full_url
    )
    db.execute(
        text(
            "UPDATE collections SET image_url = :img, updated_at = :now WHERE id = :id"
        ),
        {"img": relative_path, "id": category_id, "now": now_ist()},
    )
    db.commit()
    redis_client.invalidate_pattern("collections:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {
        "message": "Collection image updated",
        "image_url": get_r2_public_url(relative_path),
    }


@router.delete(
    "/api/v1/admin/categories/{category_id}/image",
    status_code=204,
    tags=["Admin Collections"],
)
async def admin_delete_collection_image(
    category_id: int, db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    """Delete a collection image from R2 and clear the record."""
    coll = db.execute(
        text("SELECT id, image_url FROM collections WHERE id = :id"),
        {"id": category_id},
    ).fetchone()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    if coll[1]:
        await r2_service.delete_image(coll[1])
        db.execute(
            text(
                "UPDATE collections SET image_url = NULL, updated_at = :now WHERE id = :id"
            ),
            {"id": category_id, "now": now_ist()},
        )
        db.commit()
    redis_client.invalidate_pattern("collections:*")

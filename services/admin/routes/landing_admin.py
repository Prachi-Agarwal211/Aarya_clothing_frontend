"""Admin landing-page configuration.

Two sub-areas, both admin-only:
- ``/api/v1/admin/landing/config`` and ``/landing/images``: per-section
  configuration JSON + hero/about images, including R2 upload, reorder, and
  delete.
- ``/api/v1/admin/landing/products``: curated product slots admins place into
  the new-arrivals carousel and similar sections.

Every mutation invalidates the ``public:landing:*`` Redis cache so the
public read endpoints (routes/landing_public.py) reflect changes within one
request.
"""

import json
from datetime import datetime
from shared.time_utils import now_ist
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.redis_client import redis_client
from database.database import get_db
from schemas.admin import (
    LandingConfigUpdate,
    LandingImageCreate,
    LandingProductCreate,
    LandingProductUpdate,
)
from service.r2_service import r2_service
from shared.auth_middleware import require_admin
from utils.url_helpers import get_r2_public_url

router = APIRouter(tags=["Landing Config"])




@router.get("/api/v1/admin/landing/config", tags=["Landing Config"])
async def get_landing_config(
    db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    rows = db.execute(text("SELECT * FROM landing_config ORDER BY section")).fetchall()
    return {"sections": [dict(r._mapping) for r in rows]}


@router.put("/api/v1/admin/landing/config/{section}", tags=["Landing Config"])
async def update_landing_config(
    section: str,
    data: LandingConfigUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    existing = db.execute(
        text("SELECT id FROM landing_config WHERE section = :s"), {"s": section}
    ).fetchone()
    config_json = json.dumps(data.config)
    user_id = user.get("user_id")

    if existing:
        updates = {
            "config": config_json,
            "updated_by": user_id,
            "now": now_ist(),
            "s": section,
        }
        if data.is_active is not None:
            db.execute(
                text(
                    "UPDATE landing_config SET config = :config::jsonb, is_active = :active, updated_by = :updated_by, updated_at = :now WHERE section = :s"
                ),
                {**updates, "active": data.is_active},
            )
        else:
            db.execute(
                text(
                    "UPDATE landing_config SET config = :config::jsonb, updated_by = :updated_by, updated_at = :now WHERE section = :s"
                ),
                updates,
            )
    else:
        db.execute(
            text(
                "INSERT INTO landing_config (section, config, updated_by) VALUES (:s, :config::jsonb, :by)"
            ),
            {"s": section, "config": config_json, "by": user_id},
        )
    db.commit()
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": f"Landing config for '{section}' updated"}


@router.get("/api/v1/admin/landing/images", tags=["Landing Config"])
async def get_landing_images(
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    if section:
        rows = db.execute(
            text(
                "SELECT * FROM landing_images WHERE section = :s ORDER BY display_order"
            ),
            {"s": section},
        ).fetchall()
    else:
        rows = db.execute(
            text("SELECT * FROM landing_images ORDER BY section, display_order")
        ).fetchall()
    return {"images": [dict(r._mapping) for r in rows]}


@router.post("/api/v1/admin/landing/images", tags=["Landing Config"])
async def add_landing_image(
    data: LandingImageCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Add a landing image using a pre-existing URL (e.g. from presigned upload)."""
    result = db.execute(
        text(
            "INSERT INTO landing_images (section, image_url, title, subtitle, link_url, display_order, device_variant) "
            "VALUES (:s, :url, :title, :sub, :link, :order, :variant) RETURNING id"
        ),
        {
            "s": data.section,
            "url": data.image_url,
            "title": data.title,
            "sub": data.subtitle,
            "link": data.link_url,
            "order": data.display_order,
            "variant": data.device_variant,
        },
    )
    db.commit()
    redis_client.invalidate_pattern(
        "public:landing:*"
    )  # Invalidate cache so changes reflect immediately
    return {"message": "Image added", "image_id": result.scalar()}


@router.post("/api/v1/admin/landing/images/upload", tags=["Landing Config"])
async def upload_landing_image(
    section: str,
    file: UploadFile = File(...),
    title: Optional[str] = None,
    subtitle: Optional[str] = None,
    link_url: Optional[str] = None,
    display_order: int = 0,
    device_variant: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Upload a landing page image directly to Cloudflare R2 and save metadata."""
    image_url = await r2_service.upload_image(file, folder="landing")

    result = db.execute(
        text(
            "INSERT INTO landing_images (section, image_url, title, subtitle, link_url, display_order, device_variant) "
            "VALUES (:s, :url, :title, :sub, :link, :order, :variant) RETURNING id"
        ),
        {
            "s": section,
            "url": image_url,
            "title": title,
            "sub": subtitle,
            "link": link_url,
            "order": display_order,
            "variant": device_variant,
        },
    )
    db.commit()

    # Invalidate cache so changes show immediately
    redis_client.invalidate_pattern("public:landing:*")

    return {
        "message": "Image uploaded and saved",
        "image_id": result.scalar(),
        "image_url": image_url,
    }


@router.patch("/api/v1/admin/landing/images/{image_id}", tags=["Landing Config"])
async def update_landing_image(
    image_id: int,
    title: Optional[str] = None,
    subtitle: Optional[str] = None,
    link_url: Optional[str] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update landing image metadata."""
    sets, params = [], {"id": image_id}
    if title is not None:
        sets.append("title = :title")
        params["title"] = title
    if subtitle is not None:
        sets.append("subtitle = :subtitle")
        params["subtitle"] = subtitle
    if link_url is not None:
        sets.append("link_url = :link_url")
        params["link_url"] = link_url
    if display_order is not None:
        sets.append("display_order = :display_order")
        params["display_order"] = display_order
    if is_active is not None:
        sets.append("is_active = :is_active")
        params["is_active"] = is_active
    if not sets:
        return {"message": "Nothing to update"}
    db.execute(
        text(f"UPDATE landing_images SET {', '.join(sets)} WHERE id = :id"), params
    )
    db.commit()
    redis_client.invalidate_pattern(
        "public:landing:*"
    )  # Invalidate cache so changes reflect immediately
    return {"message": "Image updated"}


@router.post("/api/v1/admin/landing/images/reorder", tags=["Landing Config"])
async def reorder_landing_images(
    section: str,
    ordered_ids: List[int],
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Reorder images in a section by providing ordered list of image IDs."""
    for idx, image_id in enumerate(ordered_ids):
        db.execute(
            text(
                "UPDATE landing_images SET display_order = :order WHERE id = :id AND section = :section"
            ),
            {"order": idx, "id": image_id, "section": section},
        )
    db.commit()
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": f"Reordered {len(ordered_ids)} images in section '{section}'"}


@router.delete("/api/v1/admin/landing/images/{image_id}", tags=["Landing Config"])
async def delete_landing_image(
    image_id: int, db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    """Delete a landing image from both the database and Cloudflare R2."""
    row = db.execute(
        text("SELECT image_url FROM landing_images WHERE id = :id"), {"id": image_id}
    ).fetchone()
    if row and row[0]:
        await r2_service.delete_image(row[0])
    db.execute(text("DELETE FROM landing_images WHERE id = :id"), {"id": image_id})
    db.commit()
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": "Image deleted"}


# --- Landing Products ---


@router.get("/api/v1/admin/landing/products", tags=["Landing Config"])
async def get_landing_products(
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Get admin-selected products for landing sections with full product details."""
    query = """
        SELECT lp.id, lp.section, lp.product_id, lp.display_order, lp.is_active,
               p.name, p.slug, p.base_price as price, p.mrp, p.short_description,
               c.name as collection_name,
               pi.image_url as primary_image
        FROM landing_products lp
        JOIN products p ON lp.product_id = p.id
        LEFT JOIN collections c ON p.category_id = c.id
        LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
    """
    params = {}
    if section:
        query += " WHERE lp.section = :section"
        params["section"] = section
    query += " ORDER BY lp.section, lp.display_order"
    rows = db.execute(text(query), params).fetchall()
    products = []
    for r in rows:
        products.append(
            {
                "id": r[0],
                "section": r[1],
                "product_id": r[2],
                "display_order": r[3],
                "is_active": r[4],
                "name": r[5],
                "slug": r[6],
                "price": float(r[7]) if r[7] else 0,
                "mrp": float(r[8]) if r[8] else None,
                "short_description": r[9],
                "collection_name": r[10],
                "primary_image": get_r2_public_url(r[11]) if r[11] else "",
            }
        )
    return {"products": products}


@router.post("/api/v1/admin/landing/products", tags=["Landing Config"])
async def add_landing_product(
    data: LandingProductCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Add a product to a landing section."""
    product_exists = db.execute(
        text("SELECT id FROM products WHERE id = :pid AND is_active = true"),
        {"pid": data.product_id},
    ).fetchone()
    if not product_exists:
        raise HTTPException(status_code=404, detail="Product not found or inactive")
    result = db.execute(
        text(
            "INSERT INTO landing_products (section, product_id, display_order, is_active) "
            "VALUES (:s, :pid, :order, :active) "
            "ON CONFLICT (section, product_id) DO UPDATE SET is_active = :active, display_order = :order "
            "RETURNING id"
        ),
        {
            "s": data.section,
            "pid": data.product_id,
            "order": data.display_order,
            "active": data.is_active,
        },
    )
    db.commit()
    redis_client.invalidate_pattern("public:landing:*")
    return {
        "message": "Product added to landing section",
        "landing_product_id": result.scalar(),
    }


@router.patch(
    "/api/v1/admin/landing/products/{landing_product_id}", tags=["Landing Config"]
)
async def update_landing_product(
    landing_product_id: str,
    data: LandingProductUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update display order or active status of a landing product."""
    sets, params = [], {"id": landing_product_id}
    if data.display_order is not None:
        sets.append("display_order = :order")
        params["order"] = data.display_order
    if data.is_active is not None:
        sets.append("is_active = :active")
        params["active"] = data.is_active
    if not sets:
        return {"message": "Nothing to update"}
    db.execute(
        text(f"UPDATE landing_products SET {', '.join(sets)} WHERE id = :id"), params
    )
    db.commit()
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": "Landing product updated"}


@router.delete(
    "/api/v1/admin/landing/products/{landing_product_id}", tags=["Landing Config"]
)
async def delete_landing_product(
    landing_product_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Remove a product from a landing section."""
    db.execute(
        text("DELETE FROM landing_products WHERE id = :id"), {"id": landing_product_id}
    )
    db.commit()
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": "Product removed from landing section"}


@router.post("/api/v1/admin/landing/products/reorder", tags=["Landing Config"])
async def reorder_landing_products(
    section: str,
    ordered_ids: List[int],
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Reorder products in a landing section by providing ordered list of landing_product IDs."""
    for idx, lp_id in enumerate(ordered_ids):
        db.execute(
            text(
                "UPDATE landing_products SET display_order = :order WHERE id = :id AND section = :section"
            ),
            {"order": idx, "id": lp_id, "section": section},
        )
    db.commit()
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": f"Reordered {len(ordered_ids)} products in section '{section}'"}

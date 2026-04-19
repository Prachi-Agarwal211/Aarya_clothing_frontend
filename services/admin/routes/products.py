"""Admin product CRUD, bulk operations, image and variant management.

This is the operational heart of the admin product surface: list/get/create/
update/delete products, bulk price/status/collection/inventory edits, image
upload + reorder + primary toggle, and per-variant CRUD with stock adjust.

Customer-facing product reads live in commerce; this router is admin-only and
purposefully invalidates ``products:*`` and ``public:landing:*`` Redis caches
on every write.
"""

import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db
from schemas.admin import (
    BulkCollectionAssign,
    BulkPriceUpdate,
    BulkStatusUpdate,
    InventoryAdjustRequest,
    ProductCreate,
    ProductUpdate,
    VariantCreate,
    VariantUpdate,
)
from service.r2_service import r2_service
from shared.auth_middleware import require_admin, require_staff
from shared.time_utils import now_ist
from utils.url_helpers import get_r2_public_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin Products"])




@router.get("/api/v1/admin/products", tags=["Admin Products"])
async def admin_list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    collection_id: Optional[int] = None,
    active_only: Optional[bool] = None,
    new_arrivals: Optional[bool] = None,
    featured: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """List all products for admin (includes inactive)."""
    where_parts = []
    params = {"limit": limit, "skip": skip}
    if active_only is True:
        where_parts.append("p.is_active = true")
    elif active_only is False:
        where_parts.append("p.is_active = false")
    if collection_id is not None:
        where_parts.append("p.category_id = :cid")
        params["cid"] = collection_id
    if new_arrivals is True:
        where_parts.append("p.is_new_arrival = true")
    if featured is True:
        where_parts.append("p.is_featured = true")
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
    rows = db.execute(
        text(f"""
        SELECT p.id, p.name, p.slug, p.base_price, p.mrp, p.short_description,
               p.description, p.is_active, p.is_featured, p.is_new_arrival,
               p.category_id, c.name as collection_name,
               p.meta_title, p.meta_description, p.created_at, p.updated_at,
               COALESCE(SUM(i.quantity), 0) as total_stock,
               pi.image_url as primary_image
        FROM products p
        LEFT JOIN collections c ON p.category_id = c.id
        LEFT JOIN inventory i ON i.product_id = p.id
        LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
        {where_clause}
        GROUP BY p.id, p.name, p.slug, p.base_price, p.mrp, p.short_description,
                 p.description, p.is_active, p.is_featured, p.is_new_arrival,
                 p.category_id, c.name, p.meta_title, p.meta_description,
                 p.created_at, p.updated_at, pi.image_url
        ORDER BY p.created_at DESC
        LIMIT :limit OFFSET :skip
    """),
        params,
    ).fetchall()
    products = []
    for r in rows:
        img = r[17]
        products.append(
            {
                "id": r[0],
                "name": r[1],
                "slug": r[2],
                "price": float(r[3]) if r[3] else 0,
                "mrp": float(r[4]) if r[4] else None,
                "short_description": r[5],
                "description": r[6],
                "is_active": r[7],
                "is_featured": r[8],
                "is_new_arrival": r[9],
                "category_id": r[10],
                "collection_id": r[10],
                "collection_name": r[11],
                "meta_title": r[12],
                "meta_description": r[13],
                "created_at": r[14],
                "updated_at": r[15],
                "total_stock": int(r[16]),
                "image_url": get_r2_public_url(img) if img else None,
                "primary_image": get_r2_public_url(img) if img else None,
            }
        )
    return products


@router.post("/api/v1/admin/products", status_code=201, tags=["Admin Products"])
async def admin_create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create a new product (admin only)."""
    # The cleaned schema uses `collection_id`; older callers may still pass
    # `category_id`, so accept both.
    category_id = data.collection_id or getattr(data, "category_id", None)
    # MRP defaults to selling price when omitted (per spec — single price model).
    mrp_value = data.mrp if data.mrp is not None else data.base_price
    # Auto-generate slug if not provided.
    slug = getattr(data, "slug", None)
    if not slug:
        slug = re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-")
    # Ensure slug uniqueness across products.
    existing = db.execute(
        text("SELECT id FROM products WHERE slug = :slug"), {"slug": slug}
    ).fetchone()
    if existing:
        slug = f"{slug}-{int(now_ist().timestamp())}"
    result = db.execute(
        text("""
        INSERT INTO products (name, slug, description, base_price, mrp,
            category_id, brand, is_active, is_featured, is_new_arrival,
            created_at, updated_at)
        VALUES (:name, :slug, :desc, :price, :mrp,
            :cat_id, :brand, :active, :featured, :new_arrival,
            :now, :now)
        RETURNING id
    """),
        {
            "name": data.name,
            "slug": slug,
            "desc": data.description,
            "price": data.base_price,
            "mrp": mrp_value,
            "cat_id": category_id,
            "brand": getattr(data, "brand", None),
            "active": data.is_active,
            "featured": data.is_featured,
            "new_arrival": data.is_new_arrival,
            "now": now_ist().replace(tzinfo=None),
        },
    )
    product_id = result.scalar()
    db.commit()
    # NOTE: No default inventory is created here. Variants must be added separately
    # via POST /api/v1/admin/products/{product_id}/variants. A product without
    # inventory variants will not be visible to customers.
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {
        "id": product_id,
        "name": data.name,
        "slug": slug,
        "message": "Product created. Add at least one variant (size/color) to make it visible to customers.",
    }


@router.patch("/api/v1/admin/products/{product_id}", tags=["Admin Products"])
async def admin_update_product(
    product_id: str,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update a product (admin only)."""
    # Resolve slug or ID
    resolved = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not resolved:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = resolved[0]
    sets, params = (
        ["updated_at = :now"],
        {"id": pid, "now": now_ist().replace(tzinfo=None)},
    )
    update_map = {
        "name": "name",
        "slug": "slug",
        "description": "description",
        "brand": "brand",
        "is_active": "is_active",
        "is_featured": "is_featured",
        "is_new_arrival": "is_new_arrival",
    }
    for field, col in update_map.items():
        val = getattr(data, field, None)
        if val is not None:
            sets.append(f"{col} = :{field}")
            params[field] = val
    if data.base_price is not None:
        sets.append("base_price = :base_price")
        params["base_price"] = data.base_price
    if data.mrp is not None:
        sets.append("mrp = :mrp")
        params["mrp"] = data.mrp
    cat_id = getattr(data, "collection_id", None) or getattr(data, "category_id", None)
    if cat_id is not None:
        sets.append("category_id = :cat_id")
        params["cat_id"] = cat_id
    result = db.execute(
        text(f"UPDATE products SET {', '.join(sets)} WHERE id = :id RETURNING id"),
        params,
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Product not found")
    db.commit()
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": "Product updated", "id": product_id}


@router.delete(
    "/api/v1/admin/products/{product_id}", status_code=204, tags=["Admin Products"]
)
async def admin_delete_product(
    product_id: str, db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    """Delete a product and its R2 images (admin only)."""
    # Resolve slug or ID
    resolved = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not resolved:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = resolved[0]
    # Delete R2 images first
    images = db.execute(
        text("SELECT image_url FROM product_images WHERE product_id = :pid"),
        {"pid": pid},
    ).fetchall()
    for img in images:
        if img[0]:
            await r2_service.delete_image(img[0])
    db.execute(
        text("DELETE FROM product_images WHERE product_id = :pid"), {"pid": pid}
    )
    result = db.execute(
        text("DELETE FROM products WHERE id = :id RETURNING id"), {"id": pid}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Product not found")
    db.commit()
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")


# --- Bulk operations ---


@router.post("/api/v1/admin/products/bulk/price", tags=["Admin Products"])
async def admin_bulk_price_update(
    data: BulkPriceUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Bulk price update for products."""
    from decimal import Decimal

    products = db.execute(
        text("SELECT id, base_price, mrp FROM products WHERE id = ANY(:ids)"),
        {"ids": data.product_ids},
    ).fetchall()
    updated = 0
    for p in products:
        sets, params = (
            ["updated_at = :now"],
            {"id": p[0], "now": datetime.now(timezone.utc)},
        )
        price = Decimal(str(p[1])) if p[1] else Decimal("0")
        mrp = Decimal(str(p[2])) if p[2] else None
        if data.price is not None:
            sets.append("base_price = :price")
            params["price"] = data.price
        if data.mrp is not None:
            sets.append("mrp = :mrp")
            params["mrp"] = data.mrp
        if data.price_adjustment is not None:
            new_price = max(
                Decimal("0.01"), price + Decimal(str(data.price_adjustment))
            )
            sets.append("base_price = :price")
            params["price"] = float(new_price)
        if data.price_percentage is not None:
            factor = Decimal(str(1 + data.price_percentage / 100))
            new_price = max(Decimal("0.01"), price * factor)
            sets.append("base_price = :price")
            params["price"] = float(new_price)
        if data.mrp_adjustment is not None and mrp is not None:
            new_mrp = max(Decimal("0"), mrp + Decimal(str(data.mrp_adjustment)))
            sets.append("mrp = :mrp")
            params["mrp"] = float(new_mrp)
        if data.mrp_percentage is not None and mrp is not None:
            factor = Decimal(str(1 + data.mrp_percentage / 100))
            new_mrp = max(Decimal("0"), mrp * factor)
            sets.append("mrp = :mrp")
            params["mrp"] = float(new_mrp)
        if sets:
            db.execute(
                text(f"UPDATE products SET {', '.join(sets)} WHERE id = :id"), params
            )
            updated += 1
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"updated": updated}


@router.post("/api/v1/admin/products/bulk/status", tags=["Admin Products"])
async def admin_bulk_status_update(
    data: BulkStatusUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Bulk activate/deactivate/feature products."""
    sets, params = (
        ["updated_at = :now"],
        {"ids": data.product_ids, "now": datetime.now(timezone.utc)},
    )
    if data.is_active is not None:
        sets.append("is_active = :active")
        params["active"] = data.is_active
    if data.is_featured is not None:
        sets.append("is_featured = :featured")
        params["featured"] = data.is_featured
    if data.is_new_arrival is not None:
        sets.append("is_new_arrival = :new_arrival")
        params["new_arrival"] = data.is_new_arrival
    db.execute(
        text(f"UPDATE products SET {', '.join(sets)} WHERE id = ANY(:ids)"), params
    )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"updated": len(data.product_ids)}


@router.post("/api/v1/admin/products/bulk/collection", tags=["Admin Products"])
async def admin_bulk_assign_collection(
    data: BulkCollectionAssign,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Bulk assign products to a collection."""
    coll = db.execute(
        text("SELECT id FROM collections WHERE id = :id"), {"id": data.collection_id}
    ).fetchone()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.execute(
        text(
            "UPDATE products SET category_id = :cid, updated_at = :now WHERE id = ANY(:ids)"
        ),
        {
            "cid": data.collection_id,
            "ids": data.product_ids,
            "now": datetime.now(timezone.utc),
        },
    )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"updated": len(data.product_ids), "collection_id": data.collection_id}


@router.post("/api/v1/admin/products/bulk/inventory", tags=["Admin Products"])
async def admin_bulk_inventory_update(
    data: dict, db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    """Bulk update inventory by SKU."""
    updates = data.get("updates", [])
    updated, errors = 0, []
    for item in updates:
        sku = item.get("sku")
        qty = item.get("quantity")
        if not sku or qty is None:
            errors.append({"sku": sku, "error": "Missing sku or quantity"})
            continue
        result = db.execute(
            text(
                "UPDATE inventory SET quantity = :qty, updated_at = :now WHERE sku = :sku"
            ),
            {"qty": qty, "sku": sku, "now": datetime.now(timezone.utc)},
        )
        if result.rowcount:
            updated += 1
        else:
            errors.append({"sku": sku, "error": "SKU not found"})
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"updated": updated, "errors": errors}


@router.post("/api/v1/admin/products/bulk/delete", tags=["Admin Products"])
async def admin_bulk_delete_products(
    data: dict, db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    """Bulk delete products."""
    product_ids = data.get("product_ids", [])
    deleted = 0
    for pid in product_ids:
        images = db.execute(
            text("SELECT image_url FROM product_images WHERE product_id = :pid"),
            {"pid": pid},
        ).fetchall()
        for img in images:
            if img[0]:
                await r2_service.delete_image(img[0])
        db.execute(
            text("DELETE FROM product_images WHERE product_id = :pid"), {"pid": pid}
        )
        result = db.execute(
            text("DELETE FROM products WHERE id = :id RETURNING id"), {"id": pid}
        )
        if result.fetchone():
            deleted += 1
    db.commit()
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"deleted": deleted}


# --- Image management ---


@router.post(
    "/api/v1/admin/products/{product_id}/images",
    status_code=201,
    tags=["Admin Products"],
)
async def admin_upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    alt_text: Optional[str] = None,
    is_primary: bool = False,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Upload a product image to R2 (admin only)."""
    product = db.execute(
        text("SELECT id, name FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    resolved_product_id = int(product[0])
    full_url = await r2_service.upload_image(file, folder="products")
    r2_base = settings.R2_PUBLIC_URL.rstrip("/") if settings.R2_PUBLIC_URL else ""
    relative_path = (
        full_url.replace(r2_base + "/", "")
        if r2_base and full_url.startswith(r2_base)
        else full_url
    )
    if is_primary:
        db.execute(
            text(
                "UPDATE product_images SET is_primary = false WHERE product_id = :pid"
            ),
            {"pid": resolved_product_id},
        )
    img_count = (
        db.execute(
            text("SELECT COUNT(*) FROM product_images WHERE product_id = :pid"),
            {"pid": resolved_product_id},
        ).scalar()
        or 0
    )
    result = db.execute(
        text("""
        INSERT INTO product_images (product_id, image_url, alt_text, is_primary, display_order, created_at)
        VALUES (:pid, :url, :alt, :primary, :order, :now) RETURNING id
    """),
        {
            "pid": resolved_product_id,
            "url": relative_path,
            "alt": alt_text or f"{product[1]} - Image {img_count + 1}",
            "primary": is_primary,
            "order": img_count,
            "now": datetime.now(timezone.utc),
        },
    )
    image_id = result.scalar()
    db.commit()
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {
        "id": image_id,
        "product_id": resolved_product_id,
        "image_url": get_r2_public_url(relative_path),
        "alt_text": alt_text or f"{product[1]} - Image {img_count + 1}",
        "is_primary": is_primary,
        "display_order": img_count,
    }


@router.delete(
    "/api/v1/admin/products/{product_id}/images/{image_id}",
    status_code=204,
    tags=["Admin Products"],
)
async def admin_delete_product_image(
    product_id: str,
    image_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete a product image from R2 and DB (admin only)."""
    product = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    resolved_product_id = int(product[0])

    img = db.execute(
        text(
            "SELECT image_url FROM product_images WHERE id = :id AND product_id = :pid"
        ),
        {"id": image_id, "pid": resolved_product_id},
    ).fetchone()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if img[0]:
        await r2_service.delete_image(img[0])
    db.execute(text("DELETE FROM product_images WHERE id = :id"), {"id": image_id})
    db.commit()
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")


@router.patch(
    "/api/v1/admin/products/{product_id}/images/reorder", tags=["Admin Products"]
)
async def admin_reorder_product_images(
    product_id: str,
    image_ids: List[int],
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Reorder product images by providing new display order (list of image IDs in desired order)."""
    product = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    resolved_product_id = int(product[0])
    for idx, img_id in enumerate(image_ids):
        db.execute(
            text(
                "UPDATE product_images SET display_order = :order WHERE id = :id AND product_id = :pid"
            ),
            {"order": idx, "id": img_id, "pid": resolved_product_id},
        )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": "Images reordered", "order": image_ids}


@router.patch(
    "/api/v1/admin/products/{product_id}/images/{image_id}/primary",
    tags=["Admin Products"],
)
async def admin_set_primary_image(
    product_id: str,
    image_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Set a specific image as the primary image for a product."""
    product = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    resolved_product_id = int(product[0])

    img = db.execute(
        text("SELECT id FROM product_images WHERE id = :id AND product_id = :pid"),
        {"id": image_id, "pid": resolved_product_id},
    ).fetchone()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    db.execute(
        text("UPDATE product_images SET is_primary = false WHERE product_id = :pid"),
        {"pid": resolved_product_id},
    )
    db.execute(
        text("UPDATE product_images SET is_primary = true WHERE id = :id"),
        {"id": image_id},
    )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    redis_client.invalidate_pattern("public:landing:*")
    return {"message": "Primary image updated", "image_id": image_id}


@router.get("/api/v1/admin/products/{product_id}", tags=["Admin Products"])
async def admin_get_product(
    product_id: str, db: Session = Depends(get_db), user: dict = Depends(require_admin)
):
    """Get a single product by ID or slug with images and inventory (admin only)."""
    logger = logging.getLogger(__name__)

    # Sanitize user input to prevent log injection attacks
    import re
    safe_sub = re.sub(r'[\n\r\t]', '', str(user.get('sub', 'unknown')))
    logger.info(f"[AdminProduct] Fetching product ID/slug={product_id} for user={safe_sub}")

    # Resolve slug or ID
    resolved = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not resolved:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = resolved[0]

    row = db.execute(
        text("""
        SELECT p.id, p.name, p.slug, p.base_price, p.mrp, p.short_description,
               p.description, p.is_active, p.is_featured, p.is_new_arrival,
               p.category_id, c.name as collection_name, p.brand,
               p.meta_title, p.meta_description, p.created_at, p.updated_at,
               COALESCE(SUM(i.quantity), 0) as total_stock
        FROM products p
        LEFT JOIN collections c ON p.category_id = c.id
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE p.id = :id
        GROUP BY p.id, p.name, p.slug, p.base_price, p.mrp, p.short_description,
                 p.description, p.is_active, p.is_featured, p.is_new_arrival,
                 p.category_id, c.name, p.brand, p.meta_title, p.meta_description,
                 p.created_at, p.updated_at
        """),
        {"id": pid},
    ).fetchone()
    
    if not row:
        logger.warning(f"[AdminProduct] Product ID={product_id} not found in database")
        raise HTTPException(status_code=404, detail="Product not found")
    
    logger.info(f"[AdminProduct] Product found: {row[1]} (ID={row[0]})")
    
    images = db.execute(
        text("SELECT id, image_url, alt_text, is_primary, display_order FROM product_images WHERE product_id = :pid ORDER BY is_primary DESC, display_order"),
        {"pid": pid},
    ).fetchall()
    inventory = db.execute(
        text("SELECT * FROM inventory WHERE product_id = :pid ORDER BY size, color"),
        {"pid": pid},
    ).fetchall()
    r2_base = settings.R2_PUBLIC_URL.rstrip("/") if settings.R2_PUBLIC_URL else ""

    def full_url(path):
        if not path:
            return None
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{r2_base}/{path.lstrip('/')}" if r2_base else path

    primary_img = next((full_url(img[1]) for img in images if img[3]), None) or (full_url(images[0][1]) if images else None)
    logger.info(f"[AdminProduct] Returning product with {len(images)} images and {len(inventory)} variants")
    
    return {
        "id": row[0],
        "name": row[1],
        "slug": row[2],
        "price": float(row[3]) if row[3] else 0,
        "base_price": float(row[3]) if row[3] else 0,
        "mrp": float(row[4]) if row[4] else None,
        "short_description": row[5],
        "description": row[6],
        "is_active": row[7],
        "is_featured": row[8],
        "is_new_arrival": row[9],
        "category_id": row[10],
        "collection_id": row[10],
        "collection_name": row[11],
        "brand": row[12],
        "meta_title": row[13],
        "meta_description": row[14],
        "created_at": row[15],
        "updated_at": row[16],
        "total_stock": int(row[17]),
        "image_url": primary_img,
        "primary_image": primary_img,
        "images": [
            {"id": img[0], "image_url": full_url(img[1]), "alt_text": img[2], "is_primary": img[3], "display_order": img[4]}
            for img in images
        ],
        "inventory": [dict(inv._mapping) for inv in inventory],
    }


@router.get("/api/v1/admin/products/{product_id}/variants", tags=["Admin Products"])
async def admin_get_product_variants(
    product_id: str, db: Session = Depends(get_db), user: dict = Depends(require_staff)
):
    """Get all inventory variants for a product."""
    resolved = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not resolved:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = resolved[0]
    rows = db.execute(
        text("SELECT * FROM inventory WHERE product_id = :pid ORDER BY size, color"),
        {"pid": pid},
    ).fetchall()
    return {"variants": [dict(r._mapping) for r in rows]}


@router.post(
    "/api/v1/admin/products/{product_id}/variants",
    status_code=201,
    tags=["Admin Products"],
)
async def admin_create_product_variant(
    product_id: str,
    data: VariantCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Create an inventory variant for a product."""
    # Resolve slug or ID
    product = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = product[0]
    existing = db.execute(
        text("SELECT id FROM inventory WHERE product_id = :pid AND sku = :sku"),
        {"pid": pid, "sku": data.sku},
    ).fetchone()
    if existing:
        raise HTTPException(
            status_code=400, detail=f"SKU '{data.sku}' already exists for this product"
        )
    result = db.execute(
        text("""
        INSERT INTO product_variants (product_id, sku, size, color, color_hex,
            quantity, low_stock_threshold, image_url, created_at, updated_at)
        VALUES (:pid, :sku, :size, :color, :color_hex, :qty,
            :low_stock_threshold, :image_url, :now, :now) RETURNING id
    """),
        {
            "pid": pid,
            "sku": data.sku,
            "size": data.size,
            "color": data.color,
            "color_hex": data.color_hex,
            "qty": data.quantity,
            "low_stock_threshold": data.low_stock_threshold
            if data.low_stock_threshold is not None
            else 5,
            "image_url": getattr(data, "image_url", None) or "",
            "now": now_ist().replace(tzinfo=None),
        },
    )
    inv_id = result.scalar()
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"id": inv_id, "message": "Variant created", "sku": data.sku}


@router.patch(
    "/api/v1/admin/products/{product_id}/variants/{variant_id}", tags=["Admin Products"]
)
async def admin_update_product_variant(
    product_id: str,
    variant_id: int,
    data: VariantUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Update a product inventory variant."""
    # Resolve slug or ID
    resolved = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not resolved:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = resolved[0]
    inv = db.execute(
        text("SELECT id FROM inventory WHERE id = :id AND product_id = :pid"),
        {"id": variant_id, "pid": pid},
    ).fetchone()
    if not inv:
        raise HTTPException(status_code=404, detail="Variant not found")
    sets, params = (
        ["updated_at = :now"],
        {"id": variant_id, "now": now_ist().replace(tzinfo=None)},
    )
    if data.size is not None:
        sets.append("size = :size")
        params["size"] = data.size
    if data.color is not None:
        sets.append("color = :color")
        params["color"] = data.color
    if data.color_hex is not None:
        sets.append("color_hex = :color_hex")
        params["color_hex"] = data.color_hex
    if data.quantity is not None:
        sets.append("quantity = :qty")
        params["qty"] = data.quantity
    if data.low_stock_threshold is not None:
        sets.append("low_stock_threshold = :low_stock_threshold")
        params["low_stock_threshold"] = data.low_stock_threshold
    if data.image_url is not None:
        sets.append("image_url = :image_url")
        params["image_url"] = data.image_url
    if data.is_active is not None:
        sets.append("is_active = :is_active")
        params["is_active"] = data.is_active
    if data.sku is not None:
        sets.append("sku = :sku")
        params["sku"] = data.sku
    # `price` is intentionally ignored — variant-level pricing was removed.
    db.execute(
        text(f"UPDATE product_variants SET {', '.join(sets)} WHERE id = :id"), params
    )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"message": "Variant updated"}


@router.delete(
    "/api/v1/admin/products/{product_id}/variants/{variant_id}",
    status_code=204,
    tags=["Admin Products"],
)
async def admin_delete_product_variant(
    product_id: str,
    variant_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Delete a product inventory variant."""
    # Resolve slug or ID
    resolved = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not resolved:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = resolved[0]
    result = db.execute(
        text("DELETE FROM inventory WHERE id = :id AND product_id = :pid RETURNING id"),
        {"id": variant_id, "pid": pid},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Variant not found")
    db.commit()
    redis_client.invalidate_pattern("products:*")


@router.post(
    "/api/v1/admin/products/{product_id}/variants/{variant_id}/adjust-stock",
    tags=["Admin Products"],
)
async def admin_adjust_variant_stock(
    product_id: str,
    variant_id: int,
    data: InventoryAdjustRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Adjust stock for a specific inventory variant."""
    resolved = db.execute(
        text("SELECT id FROM products WHERE id::text = :pid OR slug = :pid"),
        {"pid": product_id},
    ).fetchone()
    if not resolved:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = resolved[0]

    inv = db.execute(
        text("SELECT id, quantity FROM inventory WHERE id = :id AND product_id = :pid"),
        {"id": variant_id, "pid": pid},
    ).fetchone()
    if not inv:
        raise HTTPException(status_code=404, detail="Variant not found")
    new_qty = max(0, inv[1] + data.adjustment)
    db.execute(
        text("UPDATE inventory SET quantity = :qty, updated_at = :now WHERE id = :id"),
        {"qty": new_qty, "id": inv[0], "now": datetime.now(timezone.utc)},
    )
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"id": inv[0], "new_quantity": new_qty, "adjustment": data.adjustment}
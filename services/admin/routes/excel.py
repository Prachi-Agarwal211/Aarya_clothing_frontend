"""Admin Excel import/export.

Templates, exports, and bulk-imports for products, inventory, and orders.
Heavy lifting (workbook parsing, building, normalisation) is delegated to
``service.excel_service`` so this router stays as a thin HTTP layer.
"""

from __future__ import annotations

import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.redis_client import redis_client
from database.database import get_db
from service import excel_service
from shared.auth_middleware import require_admin, require_staff
from shared.time_utils import now_ist

router = APIRouter(tags=["Admin Excel"])


def _excel_response(data: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(data),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/v1/admin/excel/products/template", tags=["Admin Excel"])
async def excel_products_template(user: dict = Depends(require_staff)):
    return _excel_response(excel_service.products_template(), "products_template.xlsx")


@router.get("/api/v1/admin/excel/inventory/template", tags=["Admin Excel"])
async def excel_inventory_template(user: dict = Depends(require_staff)):
    return _excel_response(excel_service.inventory_template(), "inventory_template.xlsx")


@router.get("/api/v1/admin/excel/products/export", tags=["Admin Excel"])
async def excel_products_export(
    db: Session = Depends(get_db), user: dict = Depends(require_staff)
):
    rows = db.execute(
        text(
            "SELECT p.id AS product_id, p.name, p.slug, p.description, p.price, "
            "p.collection_id, p.primary_image, p.is_active, p.is_featured, "
            "p.is_new_arrival, pv.sku AS variant_sku, pv.size, pv.color, "
            "pv.color_hex, pv.image_url AS variant_image, pv.quantity, "
            "pv.low_stock_threshold "
            "FROM products p LEFT JOIN product_variants pv ON pv.product_id = p.id "
            "ORDER BY p.id, pv.color, pv.size"
        )
    ).fetchall()
    return _excel_response(
        excel_service.export_products([dict(r._mapping) for r in rows]),
        "products_export.xlsx",
    )


@router.post("/api/v1/admin/excel/products/import", tags=["Admin Excel"])
async def excel_products_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Bulk upsert products + variants from a workbook.

    Rules:
    - Row with `product_id` → updates that product (name/desc/price/etc).
    - Row without `product_id` → creates a new product (slug auto-derived).
    - Each row's variant section (`variant_sku`, size/color/qty) upserts the
      matching variant by SKU under the resolved product.
    """
    contents = await file.read()
    try:
        rows = excel_service.parse_products_import(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    created_products = updated_products = upserted_variants = 0
    now = now_ist().replace(tzinfo=None)
    for row in rows:
        pid = row.get("product_id")
        if pid:
            db.execute(
                text(
                    "UPDATE products SET name = COALESCE(:name, name), "
                    "description = COALESCE(:desc, description), "
                    "price = COALESCE(:price, price), "
                    "collection_id = COALESCE(:cid, collection_id), "
                    "primary_image = COALESCE(:img, primary_image), "
                    "is_active = COALESCE(:active, is_active), "
                    "updated_at = :now WHERE id = :id"
                ),
                {
                    "name": row.get("name"),
                    "desc": row.get("description"),
                    "price": row.get("price"),
                    "cid": row.get("collection_id"),
                    "img": row.get("primary_image"),
                    "active": row.get("is_active"),
                    "now": now,
                    "id": pid,
                },
            )
            updated_products += 1
        else:
            res = db.execute(
                text(
                    "INSERT INTO products (name, slug, description, price, "
                    "collection_id, primary_image, is_active, created_at, updated_at) "
                    "VALUES (:name, :slug, :desc, :price, :cid, :img, "
                    "        COALESCE(:active, TRUE), :now, :now) RETURNING id"
                ),
                {
                    "name": row.get("name"),
                    "slug": (row.get("slug") or (row.get("name") or "").lower().replace(" ", "-")),
                    "desc": row.get("description"),
                    "price": row.get("price") or 0,
                    "cid": row.get("collection_id"),
                    "img": row.get("primary_image"),
                    "active": row.get("is_active"),
                    "now": now,
                },
            )
            pid = res.scalar()
            created_products += 1
        if row.get("variant_sku"):
            db.execute(
                text(
                    "INSERT INTO product_variants (product_id, sku, size, color, "
                    "color_hex, image_url, quantity, low_stock_threshold, "
                    "created_at, updated_at) "
                    "VALUES (:pid, :sku, :size, :color, :hex, :img, :qty, "
                    "        COALESCE(:lst, 5), :now, :now) "
                    "ON CONFLICT (sku) DO UPDATE SET "
                    "  size = EXCLUDED.size, color = EXCLUDED.color, "
                    "  color_hex = EXCLUDED.color_hex, image_url = EXCLUDED.image_url, "
                    "  quantity = EXCLUDED.quantity, "
                    "  low_stock_threshold = EXCLUDED.low_stock_threshold, "
                    "  updated_at = EXCLUDED.updated_at"
                ),
                {
                    "pid": pid,
                    "sku": row["variant_sku"],
                    "size": row.get("size") or "",
                    "color": row.get("color") or "",
                    "hex": row.get("color_hex"),
                    "img": row.get("variant_image") or "",
                    "qty": row.get("quantity") or 0,
                    "lst": row.get("low_stock_threshold"),
                    "now": now,
                },
            )
            upserted_variants += 1
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {
        "created_products": created_products,
        "updated_products": updated_products,
        "upserted_variants": upserted_variants,
    }


@router.get("/api/v1/admin/excel/inventory/export", tags=["Admin Excel"])
async def excel_inventory_export(
    db: Session = Depends(get_db), user: dict = Depends(require_staff)
):
    rows = db.execute(
        text(
            "SELECT pv.id AS variant_id, pv.product_id, p.name AS product_name, "
            "pv.sku, pv.size, pv.color, pv.color_hex, pv.quantity, "
            "pv.reserved_quantity, pv.low_stock_threshold, pv.is_active, pv.updated_at "
            "FROM product_variants pv JOIN products p ON p.id = pv.product_id "
            "ORDER BY p.name, pv.color, pv.size"
        )
    ).fetchall()
    return _excel_response(
        excel_service.export_inventory([dict(r._mapping) for r in rows]),
        "inventory_export.xlsx",
    )


@router.post("/api/v1/admin/excel/inventory/import", tags=["Admin Excel"])
async def excel_inventory_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    """Bulk-update stock by SKU from an inventory workbook."""
    contents = await file.read()
    try:
        rows = excel_service.parse_inventory_import(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    now = now_ist().replace(tzinfo=None)
    updated = 0
    for row in rows:
        sku = row.get("sku")
        if not sku:
            continue
        variant = db.execute(
            text("SELECT id, quantity FROM product_variants WHERE sku = :sku"),
            {"sku": sku},
        ).fetchone()
        if not variant:
            continue
        new_qty = int(row.get("quantity") or 0)
        delta = new_qty - int(variant._mapping["quantity"])
        db.execute(
            text(
                "UPDATE product_variants SET quantity = :q, "
                "low_stock_threshold = COALESCE(:lst, low_stock_threshold), "
                "updated_at = :now WHERE id = :id"
            ),
            {
                "q": new_qty,
                "lst": row.get("low_stock_threshold"),
                "now": now,
                "id": variant._mapping["id"],
            },
        )
        if delta:
            db.execute(
                text(
                    "INSERT INTO inventory_movements (variant_id, delta, reason, "
                    "performed_by, created_at) "
                    "VALUES (:vid, :delta, 'excel_import', :by, :now)"
                ),
                {
                    "vid": variant._mapping["id"],
                    "delta": delta,
                    "by": user.get("user_id") or user.get("id"),
                    "now": now,
                },
            )
        updated += 1
    db.commit()
    redis_client.invalidate_pattern("products:*")
    return {"updated": updated}


@router.get("/api/v1/admin/excel/orders/export", tags=["Admin Excel"])
async def excel_orders_export(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_staff),
):
    where, params = ["1=1"], {}
    if from_date:
        where.append("DATE(o.created_at) >= :from_date")
        params["from_date"] = from_date
    if to_date:
        where.append("DATE(o.created_at) <= :to_date")
        params["to_date"] = to_date
    rows = db.execute(
        text(
            "SELECT o.invoice_number, o.id AS order_id, o.status, "
            "       o.payment_status, COALESCE(u.full_name, u.username) AS customer_name, "
            "       u.email AS customer_email, o.total_amount, o.subtotal, "
            "       o.tax_amount, o.shipping_amount, o.created_at, "
            "       oi.product_name, oi.sku, oi.size, oi.color, oi.quantity, "
            "       oi.unit_price, oi.line_total "
            "FROM orders o LEFT JOIN users u ON u.id = o.user_id "
            "LEFT JOIN order_items oi ON oi.order_id = o.id "
            f"WHERE {' AND '.join(where)} "
            "ORDER BY o.created_at DESC LIMIT 50000"
        ),
        params,
    ).fetchall()
    return _excel_response(
        excel_service.export_orders([dict(r._mapping) for r in rows]),
        "orders_export.xlsx",
    )

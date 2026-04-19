"""
Commerce service shared helpers.

Single source of truth for:
* R2 URL construction
* Hex color → human-readable name mapping
* ORM → dict enrichment for Product / Collection

main.py and route modules should import from here so we don't keep two
copies of `_enrich_product` drifting apart.
"""
from __future__ import annotations

import re
from typing import Optional

from core.config import settings
from shared.roles import is_staff


_HEX_COLOR_TO_NAME = {
    "#000000": "Black", "#FFFFFF": "White", "#DC2626": "Red", "#800000": "Maroon",
    "#EC4899": "Pink", "#F43F5E": "Rose", "#FFDAB9": "Peach", "#FF7F50": "Coral",
    "#F97316": "Orange", "#B7410E": "Rust", "#E3A849": "Mustard", "#FFD700": "Gold",
    "#EAB308": "Yellow", "#C5D94C": "Lime Yellow", "#84CC16": "Lime", "#22C55E": "Green",
    "#2E8B57": "Sea Green", "#4A7C59": "Mahendi", "#808000": "Olive", "#14B8A6": "Teal",
    "#40E0D0": "Turquoise", "#87CEEB": "Sky Blue", "#3B82F6": "Blue", "#1E3A5F": "Navy",
    "#A855F7": "Purple", "#E6E6FA": "Lavender", "#C8A2C8": "Lilac", "#E0B0FF": "Mauve",
    "#FF00FF": "Magenta", "#722F37": "Wine", "#800020": "Burgundy", "#92400E": "Brown",
    "#F5F5DC": "Beige", "#FFFFF0": "Ivory", "#FFFDD0": "Cream", "#9CA3AF": "Grey",
    "#C0C0C0": "Silver", "#36454F": "Charcoal", "#0A5C4A": "Emerald Green",
    "#2C2A5A": "Navy Blue", "#2F7F7A": "Teal Green",
}

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# Sizes are sorted in standard apparel order; unknown sizes go to the end.
SIZE_ORDER = {
    "XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5, "XXXL": 6,
    "3XL": 6, "4XL": 7, "Free Size": 99,
}


def r2_url(path: Optional[str]) -> str:
    """Convert an R2 relative key to the full public CDN URL."""
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    r2_base = settings.R2_PUBLIC_URL.rstrip("/")
    return f"{r2_base}/{path.lstrip('/')}"


def is_hex_color(value: str) -> bool:
    if not value:
        return False
    return bool(_HEX_RE.match(value.strip()))


def hex_to_color_name(hex_color: str) -> Optional[str]:
    if not hex_color:
        return None
    return _HEX_COLOR_TO_NAME.get(hex_color.strip().upper())


def enrich_product(product, user_role: Optional[str] = None) -> dict:
    """
    Convert a Product ORM object to a dict with full R2 URLs.

    Role-based filtering:
    * admin/staff → full inventory data (quantities, thresholds, ...)
    * customers   → in_stock boolean + available_quantity, no internal numbers
    """
    primary = product.primary_image
    is_admin_user = is_staff(user_role) if user_role else False

    if is_admin_user:
        inventory = [
            {
                "id": inv.id,
                "sku": inv.sku,
                "size": inv.size,
                "color": inv.color,
                "color_hex": getattr(inv, "color_hex", None),
                "color_name": (
                    inv.color
                    if inv.color and not is_hex_color(inv.color)
                    else hex_to_color_name(getattr(inv, "color_hex", "") or "")
                ),
                "quantity": inv.quantity,
                "reserved_quantity": inv.reserved_quantity,
                "available_quantity": inv.available_quantity,
                "low_stock_threshold": inv.low_stock_threshold,
                "is_low_stock": inv.is_low_stock,
                "is_out_of_stock": inv.is_out_of_stock,
                "updated_at": inv.updated_at,
            }
            for inv in (product.inventory or [])
        ]
    else:
        inventory = [
            {
                "id": inv.id,
                "sku": inv.sku,
                "size": inv.size,
                "color": inv.color,
                "color_hex": getattr(inv, "color_hex", None),
                "color_name": (
                    inv.color
                    if inv.color and not is_hex_color(inv.color)
                    else hex_to_color_name(getattr(inv, "color_hex", "") or "")
                ),
                "image_url": getattr(inv, "image_url", None),
                "quantity": inv.quantity,
                "available_quantity": inv.available_quantity,
                "in_stock": not inv.is_out_of_stock,
            }
            for inv in (product.inventory or [])
        ]

    sizes = sorted(
        list({inv.size for inv in (product.inventory or []) if inv.size}),
        key=lambda s: SIZE_ORDER.get(s.upper(), 50),
    )
    colors = sorted({inv.color for inv in (product.inventory or []) if inv.color})

    color_hex_map: dict[str, str] = {}
    color_name_map: dict[str, str] = {}
    for inv in (product.inventory or []):
        if not inv.color:
            continue
        if getattr(inv, "color_hex", None):
            color_hex_map[inv.color] = inv.color_hex
        color_name = (
            inv.color
            if not is_hex_color(inv.color)
            else hex_to_color_name(getattr(inv, "color_hex", "") or "")
        )
        if color_name:
            color_name_map[inv.color] = color_name
    color_objects = [
        {
            "name": c,
            "hex": color_hex_map.get(c, "#888888"),
            "display_name": color_name_map.get(c, c),
        }
        for c in colors
    ]

    images = [
        {
            "id": img.id,
            "image_url": r2_url(img.image_url),
            "alt_text": img.alt_text,
            "is_primary": img.is_primary,
            "display_order": img.display_order,
        }
        for img in (product.images or [])
    ]

    actual_in_stock = any(
        not inv.is_out_of_stock for inv in (product.inventory or [])
    )

    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "sku": getattr(product, "sku", None),
        "description": product.description,
        "short_description": product.short_description,
        "price": float(product.price),
        "mrp": float(product.mrp) if product.mrp else None,
        "category_id": product.category_id,
        "collection_id": product.category_id,
        "collection_name": product.collection.name if product.collection else None,
        "collection_slug": product.collection.slug if product.collection else None,
        "category": product.collection.name if product.collection else None,
        "brand": getattr(product, "brand", None),
        "image_url": r2_url(primary) if primary else None,
        "primary_image": r2_url(primary) if primary else None,
        "images": images,
        "inventory": inventory,
        "sizes": sizes,
        "colors": color_objects,
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_new_arrival": product.is_new_arrival,
        "is_new": product.is_new_arrival,
        "total_stock": product.total_stock or 0,
        "inventory_count": product.total_stock or 0 if is_admin_user else None,
        "stock_quantity": product.total_stock or 0,
        "in_stock": actual_in_stock,
        "is_on_sale": product.is_on_sale,
        "discount_percentage": product.discount_percentage,
        "rating": float(product.average_rating) if product.average_rating else 0,
        "reviews_count": product.review_count or 0,
        "meta_title": product.meta_title,
        "meta_description": product.meta_description,
        "tags": product.tags,
        "material": product.material,
        "care_instructions": product.care_instructions,
        "hsn_code": getattr(product, "hsn_code", None),
        "gst_rate": float(product.gst_rate) if product.gst_rate else None,
        "is_taxable": getattr(product, "is_taxable", None),
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


def enrich_collection(cat) -> dict:
    """Convert a Category/Collection ORM object to dict with full R2 URL."""
    return {
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "description": cat.description,
        "image_url": r2_url(cat.image_url) if cat.image_url else None,
        "display_order": cat.display_order,
        "is_active": cat.is_active,
        "is_featured": cat.is_featured,
        "product_count": len(cat.products) if cat.products else 0,
        "created_at": cat.created_at,
        "updated_at": cat.updated_at,
    }

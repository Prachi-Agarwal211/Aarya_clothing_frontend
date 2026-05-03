"""
Public landing-page router.

Owns the read-only landing page and static About/Contact pages. Heavy lifting
(SQL aggregation, Redis caching) happens here so main.py doesn't carry it.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload, selectinload

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db
from helpers import enrich_collection, enrich_product
from models.collection import Collection as Category
from models.product import Product
from shared.auth_middleware import get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Landing Page"])


@router.get("/api/v1/landing/config")
async def get_landing_page_config(db: Session = Depends(get_db)):
    """Return active landing-page configuration sections plus their images."""
    sections = db.execute(
        text(
            "SELECT section, config FROM landing_config"
            " WHERE is_active = true ORDER BY section"
        )
    ).fetchall()
    images = db.execute(
        text(
            "SELECT section, image_url, title, subtitle, link_url, display_order"
            " FROM landing_images WHERE is_active = true"
            " ORDER BY section, display_order"
        )
    ).fetchall()

    config = {row[0]: row[1] for row in sections}

    image_map: dict[str, list] = {}
    for img in images:
        image_map.setdefault(img[0], []).append(
            {
                "image_url": img[1],
                "title": img[2],
                "subtitle": img[3],
                "link_url": img[4],
                "display_order": img[5],
            }
        )

    return {"sections": config, "images": image_map}


@router.get("/api/v1/landing/featured")
async def get_featured_data(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Return featured products, collections and new arrivals."""
    user_role = current_user.get("role") if current_user else None

    featured_products = (
        db.query(Product)
        .options(
            joinedload(Product.category),
            selectinload(Product.images),
            selectinload(Product.variants),
        )
        .filter(Product.is_active.is_(True), Product.is_featured.is_(True))
        .order_by(Product.created_at.desc())
        .limit(12)
        .all()
    )

    new_arrivals = (
        db.query(Product)
        .options(
            joinedload(Product.category),
            selectinload(Product.images),
            selectinload(Product.variants),
        )
        .filter(Product.is_active.is_(True), Product.is_new_arrival.is_(True))
        .order_by(Product.created_at.desc())
        .limit(12)
        .all()
    )

    featured_categories = (
        db.query(Category)
        .filter(Category.is_active.is_(True), Category.is_featured.is_(True))
        .all()
    )

    return {
        "featured_products": [enrich_product(p, user_role) for p in featured_products],
        "new_arrivals": [enrich_product(p, user_role) for p in new_arrivals],
        "featured_categories": [enrich_collection(c) for c in featured_categories],
    }


def _no_browser_cache(response: JSONResponse) -> JSONResponse:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@router.get("/api/v1/landing/all")
async def get_landing_all(db: Session = Depends(get_db)):
    """
    Single bundled landing-page payload (config + images + featured + site cfg).

    Cached in Redis for 60 seconds; client is told never to cache so admin
    edits propagate within one Redis TTL window.
    """
    cached = redis_client.get_cache("public:landing:all")
    if cached:
        return _no_browser_cache(JSONResponse(content=cached))

    result: dict = {
        "hero": {"config": {}, "images": []},
        "newArrivals": {"config": {}, "products": []},
        "collections": {"config": {}, "collections": []},
        "about": {"config": {}, "images": []},
    }

    try:
        configs = db.execute(
            text("SELECT section, config FROM landing_config WHERE is_active = true")
        ).fetchall()
        for row in configs:
            section, raw_cfg = row[0], row[1]
            if section in result:
                result[section]["config"] = (
                    raw_cfg
                    if isinstance(raw_cfg, dict)
                    else json.loads(raw_cfg if raw_cfg else "{}")
                )

        images = db.execute(
            text(
                "SELECT id, section, image_url, title, subtitle, link_url, device_variant"
                " FROM landing_images WHERE is_active = true ORDER BY display_order"
            )
        ).fetchall()
        for img in images:
            img_data = {
                "id": img[0],
                "url": img[2],
                "title": img[3],
                "subtitle": img[4],
                "link": img[5],
                "device": img[6],
            }
            if img[1] in ("hero", "about") and img[1] in result:
                result[img[1]]["images"].append(img_data)

        # ── Transform hero config+images → frontend-expected shape ──
        hero_config = result["hero"].get("config", {})
        hero_images = result["hero"].get("images", [])

        # Group images by device variant
        laptop_images = [i for i in hero_images if not i.get("device") or i["device"] == "laptop"]
        phone_images = [i for i in hero_images if i.get("device") == "phone"]

        # Build slides: pair laptop + phone images by index
        slides = []
        max_slides = max(len(laptop_images), len(phone_images), 0)
        for i in range(max_slides):
            slide = {}
            if i < len(laptop_images):
                slide["image"] = laptop_images[i]["url"]
            if i < len(phone_images):
                slide["imageMobile"] = phone_images[i]["url"]
            # If only one variant exists, use it for both
            if not slide.get("image") and slide.get("imageMobile"):
                slide["image"] = slide["imageMobile"]
            if not slide.get("imageMobile") and slide.get("image"):
                slide["imageMobile"] = slide["image"]
            if slide:
                slides.append(slide)

        # Extract buttons from config (or use defaults)
        buttons = hero_config.get("buttons", [
            {"text": "Shop Now", "link": "/products"},
            {"text": "Explore Collections", "link": "/collections"},
        ])

        result["hero"] = {
            "tagline": hero_config.get("tagline", "Where Tradition Meets Modern Elegance"),
            "slides": slides,
            "buttons": buttons,
        }

        # ── Transform newArrivals config → frontend-expected shape ──
        na_config = result["newArrivals"].get("config", {})
        result["newArrivals"] = {
            "title": na_config.get("title", "New Arrivals"),
            "subtitle": na_config.get("subtitle", "Fresh styles, just for you"),
            "products": result["newArrivals"]["products"],
        }

        # Fallback for new arrivals: if empty, fetch any active featured products
        if not result["newArrivals"]["products"]:
            featured = db.execute(
                text("""
                    SELECT p.id, p.name, p.slug, p.description, p.base_price, p.mrp, p.is_new_arrival,
                           (SELECT image_url FROM product_images
                              WHERE product_id = p.id AND is_primary = true LIMIT 1) as primary_image
                    FROM products p
                    WHERE p.is_active = true AND p.is_featured = true
                    ORDER BY p.created_at DESC
                    LIMIT 8
                """)
            ).fetchall()
            result["newArrivals"]["products"] = [
                {
                    "id": p[0], "name": p[1], "slug": p[2], "description": p[3],
                    "price": float(p[4]), "mrp": float(p[5]) if p[5] else None,
                    "is_new_arrival": bool(p[6]),
                    "image_url": p[7],
                    "primary_image": p[7],
                } for p in featured
            ]

        # ── Transform collections → categories (frontend expects 'categories') ──
        collections = db.execute(
            text(
                """
                SELECT id, name, slug, description, image_url
                FROM collections
                WHERE is_active = true AND is_featured = true
                ORDER BY display_order
                """
            )
        ).fetchall()

        # Fallback for collections: if no featured collections, show any active collections
        if not collections:
            collections = db.execute(
                text("SELECT id, name, slug, description, image_url FROM collections WHERE is_active = true LIMIT 6")
            ).fetchall()

        coll_config = result["collections"].get("config", {})
        result["collections"] = {
            "title": coll_config.get("title", "Our Collections"),
            "categories": [
                {
                    "id": c[0],
                    "name": c[1],
                    "slug": c[2],
                    "description": c[3],
                    "image_url": c[4],
                }
                for c in collections
            ],
        }

        # ── Transform about config+images → frontend-expected shape ──
        about_config = result["about"].get("config", {})
        about_images = result["about"].get("images", [])
        result["about"] = {
            "title": about_config.get("title", "Our Story"),
            "story": about_config.get("story", about_config.get("description", "")),
            "stats": about_config.get("stats", []),
            "images": [img["url"] for img in about_images],
        }

        site_config = db.execute(text("SELECT key, value FROM site_config")).fetchall()
        config_dict = {row[0]: row[1] for row in site_config}

        r2_public = (getattr(settings, "R2_PUBLIC_URL", "") or "").rstrip("/")
        default_video = (
            f"{r2_public}/Create_a_video_202602141450_ub9p5.mp4"
            if r2_public
            else "/Create_a_video_202602141450_ub9p5.mp4"
        )

        result["site"] = {
            "logo": config_dict.get("logo_url") or (f"{r2_public}/logo.png" if r2_public else "/logo.png"),
            "video": {
                "desktop": (
                    config_dict.get("intro_video_url_desktop")
                    or config_dict.get("intro_video_url")
                    or default_video
                ),
                "mobile": (
                    config_dict.get("intro_video_url_mobile")
                    or config_dict.get("intro_video_url")
                    or default_video
                ),
                "enabled": config_dict.get("intro_video_enabled", "true").lower() == "true",
            },
            "brand_name": config_dict.get("brand_name", "Aarya Clothing"),
        }

        redis_client.set_cache("public:landing:all", result, ttl=60)
        return _no_browser_cache(JSONResponse(content=result))

    except Exception as exc:
        logger.error(f"Error fetching landing data: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch landing data")


@router.get("/api/v1/pages/about", tags=["Pages"])
async def get_about_page(db: Session = Depends(get_db)):
    """Return the About page content stored in landing_config."""
    config = db.execute(
        text(
            "SELECT config FROM landing_config"
            " WHERE section = 'about' AND is_active = true"
        )
    ).fetchone()
    return {
        "content": config[0]
        if config
        else {
            "brand_name": "Aarya Clothing",
            "tagline": "Elevate Your Style",
            "description": "Premium ethnic wear for the modern woman.",
            "founded_year": 2024,
        }
    }


@router.get("/api/v1/pages/contact", tags=["Pages"])
async def get_contact_info(db: Session = Depends(get_db)):
    """Return contact info from landing_config or sane defaults."""
    config = db.execute(
        text(
            "SELECT config FROM landing_config"
            " WHERE section = 'contact' AND is_active = true"
        )
    ).fetchone()
    return {
        "content": config[0]
        if config
        else {
            "email": "support@aaryaclothing.cloud",
            "phone": "+91-XXXXXXXXXX",
            "address": "India",
        }
    }

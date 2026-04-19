"""Public (unauthenticated) landing-page reads.

Powers the marketing site's homepage. Every endpoint is cached in Redis for
~30s and rebuilt from ``landing_config``/``landing_images``/``landing_products``
plus a small set of curated category queries. ``/api/v1/site/config`` exposes
site-wide branding (logo, intro video, contact info).

Mutations live in routes/landing_admin.py and explicitly invalidate the
``public:landing:*`` cache namespace.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.redis_client import redis_client
from database.database import get_db
from utils.url_helpers import get_r2_public_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Public Landing"])


def _get_default_landing_data() -> dict:
    """Empty landing-page payload used only when the database is empty.

    No marketing fallbacks — admins must populate ``landing_config`` and
    ``landing_images`` for a real homepage to render.
    """
    return {
        "hero": {"tagline": "", "slides": [], "buttons": []},
        "newArrivals": {"title": "", "subtitle": "", "products": []},
        "collections": {"title": "", "categories": []},
        "about": {"title": "", "story": "", "stats": [], "images": []},
    }




@router.get("/api/v1/landing/config", tags=["Public Landing"])
async def get_public_landing_config(db: Session = Depends(get_db)):
    """Get landing page configuration for public display. No authentication required.

    Returns only active sections with their configuration.
    """
    cache_key = "public:landing:config"
    cached = redis_client.get_cache(cache_key)
    if cached:
        return cached

    rows = db.execute(
        text(
            "SELECT section, config, is_active FROM landing_config WHERE is_active = true ORDER BY section"
        )
    ).fetchall()

    sections = {}
    for r in rows:
        # Safely parse config - use json.loads instead of eval
        raw_config = r[1]
        if isinstance(raw_config, dict):
            config = raw_config
        elif raw_config is None:
            config = {}
        elif isinstance(raw_config, str):
            try:
                config = json.loads(raw_config)
            except json.JSONDecodeError:
                config = {}
        else:
            config = {}
        sections[r[0]] = {"config": config, "is_active": r[2]}

    result = {"sections": sections}
    redis_client.set_cache(cache_key, result, ttl=30)  # Cache for 30 seconds
    return result


@router.get("/api/v1/landing/images", tags=["Public Landing"])
async def get_public_landing_images(
    section: Optional[str] = None, db: Session = Depends(get_db)
):
    """Get landing page images for public display. No authentication required.

    Returns images for active sections only.
    """
    cache_key = f"public:landing:images:{section or 'all'}"
    cached = redis_client.get_cache(cache_key)
    if cached:
        return cached

    if section:
        # Check if section is active
        section_active = db.execute(
            text("SELECT is_active FROM landing_config WHERE section = :s"),
            {"s": section},
        ).fetchone()

        if not section_active or not section_active[0]:
            return {"images": []}

        rows = db.execute(
            text(
                "SELECT id, section, image_url, title, subtitle, link_url, display_order, device_variant "
                "FROM landing_images WHERE section = :s ORDER BY display_order"
            ),
            {"s": section},
        ).fetchall()
    else:
        # Get all images for active sections
        rows = db.execute(
            text("""
            SELECT li.id, li.section, li.image_url, li.title, li.subtitle, li.link_url, li.display_order, li.device_variant
            FROM landing_images li
            JOIN landing_config lc ON lc.section = li.section
            WHERE lc.is_active = true
            ORDER BY li.section, li.display_order
        """)
        ).fetchall()

    images = [
        {
            "id": r[0],
            "section": r[1],
            "image_url": r[2],
            "title": r[3],
            "subtitle": r[4],
            "link_url": r[5],
            "display_order": r[6],
            "device_variant": r[7],
        }
        for r in rows
    ]

    result = {"images": images}
    redis_client.set_cache(cache_key, result, ttl=30)  # Cache for 30 seconds
    return result


@router.get("/api/v1/landing/all", tags=["Public Landing"])
async def get_public_landing_all(db: Session = Depends(get_db)):
    """Get all landing page data (config + images) in a single request. No authentication required.

    This is the main endpoint for the public landing page to fetch all data at once.
    Returns fully formatted, ready-to-use data - no frontend transformation needed.

    ARCHITECTURE: Database is the PRIMARY source of truth.
    - All data comes from database tables (landing_config, landing_images)
    - Hardcoded defaults are ONLY used as fallback when database is empty
    - All R2 URLs are constructed here
    - Frontend just displays the data as-is
    """
    cache_key = "public:landing:all"
    cached = redis_client.get_cache(cache_key)
    if cached:
        return cached

    # Get active sections config from DATABASE (PRIMARY SOURCE)
    config_rows = db.execute(
        text(
            "SELECT section, config, is_active FROM landing_config WHERE is_active = true ORDER BY section"
        )
    ).fetchall()

    sections = {}
    import json

    for r in config_rows:
        raw = r[1]
        if isinstance(raw, dict):
            config = raw
        elif raw is None:
            config = {}
        elif isinstance(raw, str):
            try:
                config = json.loads(raw)
            except Exception:
                config = {}
        else:
            config = raw
        sections[r[0]] = {"config": config, "is_active": r[2]}

    # Get images for active sections from DATABASE (PRIMARY SOURCE)
    image_rows = db.execute(
        text("""
        SELECT li.id, li.section, li.image_url, li.title, li.subtitle, li.link_url, li.display_order, li.device_variant
        FROM landing_images li
        JOIN landing_config lc ON lc.section = li.section
        WHERE lc.is_active = true
        ORDER BY li.section, li.display_order
    """)
    ).fetchall()

    # Check if database has any data
    has_database_data = bool(sections or image_rows)

    # DEBUG: Log what we found
    logger.info(
        f"Landing API - sections: {len(sections)}, image_rows: {len(image_rows)}, has_data: {has_database_data}"
    )
    if sections:
        logger.info(f"Available sections: {list(sections.keys())}")

    # ONLY use hardcoded defaults if database is COMPLETELY empty
    # This ensures database is always the PRIMARY source
    if not has_database_data:
        result = _get_default_landing_data()
        redis_client.set_cache(cache_key, result, ttl=30)
        return result

    # Build result from DATABASE (PRIMARY SOURCE)
    # If no data in database, return empty structure
    result = {
        "hero": {"tagline": "", "slides": [], "buttons": []},
        "newArrivals": {"title": "", "subtitle": "", "products": []},
        "collections": {"title": "", "categories": []},
        "about": {"title": "", "story": "", "stats": [], "images": []},
    }

    # Build hero section from database
    if "hero" in sections and sections["hero"].get("config"):
        hero_config = sections["hero"]["config"]
        result["hero"]["tagline"] = hero_config.get("tagline", "")

    # Default buttons are already set above

    # Build hero slides from database images
    # Group by display_order so desktop + mobile variants form ONE slide
    hero_images = [r for r in image_rows if r[1] == "hero"]
    if hero_images:
        hero_groups = {}
        for r in sorted(hero_images, key=lambda x: x[6]):
            order = r[6]  # display_order
            variant = (r[7] or "desktop").lower()  # device_variant column
            if order not in hero_groups:
                hero_groups[order] = {
                    "title": r[3],
                    "subtitle": r[4],
                    "link": r[5],
                }
            if variant in ("mobile", "phone"):
                hero_groups[order]["imageMobile"] = get_r2_public_url(r[2])
            else:
                hero_groups[order]["image"] = get_r2_public_url(r[2])
        result["hero"]["slides"] = list(hero_groups.values())

    # Pull buttons from hero config (admin-configurable)
    if "hero" in sections and sections["hero"].get("config"):
        hero_config = sections["hero"]["config"]
        # Handle both button array format and button1/button2 format
        if hero_config.get("buttons"):
            result["hero"]["buttons"] = hero_config["buttons"]
        elif hero_config.get("button1_text"):
            # Convert button1/button2 format to buttons array
            buttons = []
            if hero_config.get("button1_text") and hero_config.get("button1_link"):
                buttons.append(
                    {
                        "text": hero_config["button1_text"],
                        "link": hero_config["button1_link"],
                    }
                )
            if hero_config.get("button2_text") and hero_config.get("button2_link"):
                buttons.append(
                    {
                        "text": hero_config["button2_text"],
                        "link": hero_config["button2_link"],
                    }
                )
            result["hero"]["buttons"] = buttons

    # Build newArrivals section from database config + fetch admin-selected products
    if "newArrivals" in sections and sections["newArrivals"].get("config"):
        na_config = sections["newArrivals"]["config"]
        result["newArrivals"]["title"] = na_config.get("title", "New Arrivals")
        result["newArrivals"]["subtitle"] = na_config.get("subtitle", "")

    # Fetch new arrival products from landing_products table (admin-curated)
    try:
        na_limit = (sections.get("newArrivals", {}).get("config") or {}).get(
            "max_display", 8
        )
        product_rows = db.execute(
            text("""
            SELECT p.id, p.name, p.slug, p.base_price, p.mrp, p.short_description,
                   p.is_new_arrival, p.is_featured, p.is_active,
                   c.name AS collection_name, c.slug AS collection_slug,
                   pi.image_url AS primary_image
            FROM landing_products lp
            JOIN products p ON p.id = lp.product_id
            LEFT JOIN collections c ON p.category_id = c.id
            LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
            WHERE lp.section = 'newArrivals' 
              AND lp.is_active = true 
              AND p.is_active = true
            ORDER BY lp.display_order
            LIMIT :limit
        """),
            {"limit": na_limit},
        ).fetchall()
        result["newArrivals"]["products"] = [
            {
                "id": r[0],
                "name": r[1],
                "slug": r[2],
                "price": float(r[3]) if r[3] else 0,
                "mrp": float(r[4]) if r[4] else None,
                "short_description": r[5],
                "is_new_arrival": r[6],
                "is_featured": r[7],
                "collection_name": r[9],
                "collection_slug": r[10],
                "image_url": get_r2_public_url(r[11]) if r[11] else "",
                "primary_image": get_r2_public_url(r[11]) if r[11] else "",
            }
            for r in product_rows
        ]
    except Exception as e:
        logger.warning(f"Failed to fetch newArrivals products: {e}")
        result["newArrivals"]["products"] = []

    # Build collections section from database config + fetch featured categories
    if "collections" in sections and sections["collections"].get("config"):
        coll_config = sections["collections"]["config"]
        result["collections"]["title"] = coll_config.get("title", "Collections")

    # Fetch featured categories for collections section
    try:
        coll_limit = (sections.get("collections", {}).get("config") or {}).get(
            "max_display", 6
        )
        cat_rows = db.execute(
            text("""
            SELECT id, name, slug, description, image_url, is_active, is_featured
            FROM collections
            WHERE is_active = true AND is_featured = true
            ORDER BY display_order NULLS LAST, name
            LIMIT :limit
        """),
            {"limit": coll_limit},
        ).fetchall()
        result["collections"]["categories"] = [
            {
                "id": r[0],
                "name": r[1],
                "slug": r[2],
                "description": r[3],
                "image": get_r2_public_url(r[4]) if r[4] else "",
                "image_url": get_r2_public_url(r[4]) if r[4] else "",
                "link": f"/collections/{r[2]}",
                "is_active": r[5],
                "is_featured": r[6],
            }
            for r in cat_rows
        ]
    except Exception as e:
        logger.warning(f"Failed to fetch collections categories: {e}")
        result["collections"]["categories"] = []

    # Build about section from database
    if "about" in sections and sections["about"].get("config"):
        about_config = sections["about"]["config"]
        result["about"]["title"] = about_config.get("title", "")
        result["about"]["story"] = about_config.get(
            "description", about_config.get("story", "")
        )

        # Build stats from database if available
        if about_config.get("stats"):
            result["about"]["stats"] = about_config.get("stats")

    # Build about images from database
    about_images = [r for r in image_rows if r[1] == "about"]
    if about_images:
        result["about"]["images"] = [
            get_r2_public_url(r[2]) for r in sorted(about_images, key=lambda x: x[6])
        ]

    redis_client.set_cache(cache_key, result, ttl=30)  # Cache for 30 seconds
    return result


@router.get("/api/v1/site/config", tags=["Public Landing"])
async def get_site_config(db: Session = Depends(get_db)):
    """Get site-wide configuration from database."""
    cache_key = "public:site:config"
    cached = redis_client.get_cache(cache_key)
    if cached:
        return cached

    rows = db.execute(text("SELECT key, value FROM site_config")).fetchall()
    config = {r[0]: r[1] for r in rows}

    r2_base = (
        settings.R2_PUBLIC_URL or "https://pub-7846c786f7154610b57735df47899fa0.r2.dev"
    )

    # Map database keys to expected response structure
    result = {
        "logo": config.get("logo_url") or f"{r2_base}/logo.png",
        "video": {
            "intro": config.get("intro_video_url")
            or f"{r2_base}/Create_a_video_202602141450_ub9p5.mp4"
        },
        "noise": f"{r2_base}/noise.png",
        "r2BaseUrl": r2_base,
        "site_name": config.get("site_name", "Aarya Clothing"),
        "contact_email": config.get("contact_email", ""),
        "contact_phone": config.get("contact_phone", ""),
        "free_shipping_threshold": float(config.get("free_shipping_threshold", 1000)),
        "intro_video_enabled": config.get("intro_video_enabled") == "true",
    }

    redis_client.set_cache(cache_key, result, ttl=3600)
    return result

"""
Meilisearch client for product search indexing and querying.
Provides typo-tolerant full-text search for the commerce service.
"""
import logging
import meilisearch
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Import settings from commerce config for consistency
from core.config import settings

PRODUCTS_INDEX = "products"


def get_client() -> meilisearch.Client:
    """Get Meilisearch client instance."""
    return meilisearch.Client(settings.MEILISEARCH_URL, settings.MEILISEARCH_API_KEY)


def init_products_index():
    """Initialize the products index with searchable/filterable attributes."""
    try:
        client = get_client()
        index = client.index(PRODUCTS_INDEX)

        # Configure searchable attributes (priority order)
        index.update_searchable_attributes([
            "name",
            "description",
            "short_description",
            "sku",
            "category_name",
            "tags",
        ])

        # Configure filterable attributes for faceted search
        index.update_filterable_attributes([
            "category_id",
            "category_name",
            "price",
            "is_active",
            "is_featured",
            "is_new_arrival",
            "in_stock",
            "sizes",
            "colors",
        ])

        # Configure sortable attributes
        index.update_sortable_attributes([
            "price",
            "name",
            "created_at",
            "total_stock",
        ])

        # Ranking rules
        index.update_ranking_rules([
            "words",
            "typo",
            "proximity",
            "attribute",
            "sort",
            "exactness",
        ])

        # Synonyms for fashion terms
        index.update_synonyms({
            "kurta": ["kurti", "kurtis"],
            "saree": ["sari", "sarees"],
            "lehenga": ["lehnga", "lehngas"],
            "dupatta": ["chunni", "stole"],
            "salwar": ["shalwar", "palazzo"],
            "anarkali": ["anarkalis", "frock"],
            "top": ["blouse", "crop top"],
            "dress": ["gown", "maxi"],
        })

        logger.info("Meilisearch products index initialized successfully")
    except Exception as e:
        logger.warning(f"Could not initialize Meilisearch index: {e}")


def index_product(product_data: Dict[str, Any]):
    """Index a single product in Meilisearch."""
    try:
        client = get_client()
        index = client.index(PRODUCTS_INDEX)
        doc = _format_product(product_data)
        index.add_documents([doc])
    except Exception as e:
        logger.warning(f"Could not index product: {e}")


def index_products_bulk(products: List[Dict[str, Any]]):
    """Bulk index multiple products."""
    try:
        client = get_client()
        index = client.index(PRODUCTS_INDEX)
        docs = [_format_product(p) for p in products]
        if docs:
            index.add_documents(docs, primary_key="id")
            logger.info(f"Indexed {len(docs)} products in Meilisearch")
    except Exception as e:
        logger.warning(f"Could not bulk index products: {e}")


def delete_product(product_id: int):
    """Remove a product from the search index."""
    try:
        client = get_client()
        index = client.index(PRODUCTS_INDEX)
        index.delete_document(product_id)
    except Exception as e:
        logger.warning(f"Could not delete product from index: {e}")


def search_products(
    query: str,
    category_id: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    in_stock_only: bool = True,
    sort_by: Optional[str] = None,
    offset: int = 0,
    limit: int = 24,
) -> Dict[str, Any]:
    """
    Search products using Meilisearch with filters and sorting.
    Returns: dict with hits, total, processing_time_ms, query
    """
    try:
        client = get_client()
        index = client.index(PRODUCTS_INDEX)

        # Build filter array
        filters = ["is_active = true"]
        if category_id:
            filters.append(f"category_id = {category_id}")
        if min_price is not None:
            filters.append(f"price >= {min_price}")
        if max_price is not None:
            filters.append(f"price <= {max_price}")
        if in_stock_only:
            filters.append("in_stock = true")

        # Build sort
        sort_list = []
        if sort_by == "price_low":
            sort_list = ["price:asc"]
        elif sort_by == "price_high":
            sort_list = ["price:desc"]
        elif sort_by == "name_asc":
            sort_list = ["name:asc"]
        elif sort_by == "name_desc":
            sort_list = ["name:desc"]
        elif sort_by == "newest":
            sort_list = ["created_at:desc"]

        search_params = {
            "filter": " AND ".join(filters),
            "sort": sort_list,
            "offset": offset,
            "limit": limit,
            "attributesToHighlight": ["name", "description"],
            "highlightPreTag": "<mark>",
            "highlightPostTag": "</mark>",
        }

        result = index.search(query, search_params)

        return {
            "hits": result.get("hits", []),
            "total": result.get("estimatedTotalHits", 0),
            "processing_time_ms": result.get("processingTimeMs", 0),
            "query": query,
            "offset": offset,
            "limit": limit,
        }

    except Exception as e:
        logger.warning(f"Meilisearch search failed, falling back: {e}")
        return {
            "hits": [],
            "total": 0,
            "processing_time_ms": 0,
            "query": query,
            "offset": offset,
            "limit": limit,
            "error": str(e),
        }


def sync_all_products(db_session):
    """Sync all active products from database to Meilisearch index."""
    from sqlalchemy import text
    try:
        rows = db_session.execute(text("""
            SELECT p.id, p.name, p.description, p.short_description,
                   p.base_price, p.mrp, p.slug, p.is_active, p.is_featured,
                   p.is_new_arrival, p.category_id, p.created_at,
                   c.name as category_name,
                   COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as total_stock,
                   (SELECT pi.image_url FROM product_images pi
                    WHERE pi.product_id = p.id AND pi.is_primary = true
                    LIMIT 1) as image_url,
                   STRING_AGG(DISTINCT i.sku, ',') as skus
            FROM products p
            LEFT JOIN collections c ON p.category_id = c.id
            LEFT JOIN inventory i ON i.product_id = p.id AND i.is_active = true
            WHERE p.is_active = true
            GROUP BY p.id, p.name, p.description, p.short_description,
                     p.base_price, p.mrp, p.slug, p.is_active, p.is_featured,
                     p.is_new_arrival, p.category_id, p.created_at, c.name
        """)).fetchall()

        products = []
        for r in rows:
            products.append({
                "id": r[0], "name": r[1], "description": r[2],
                "short_description": r[3],
                "price": float(r[4]) if r[4] else 0,
                "mrp": float(r[5]) if r[5] else None, "slug": r[6],
                "is_active": r[7], "is_featured": r[8], "is_new_arrival": r[9],
                "category_id": r[10], "created_at": str(r[11]) if r[11] else None,
                "category_name": r[12],
                "total_stock": int(r[13]) if r[13] else 0,
                "image_url": r[14] or "",
                "sku": r[15] or "",
            })

        index_products_bulk(products)
        return len(products)
    except Exception as e:
        logger.error(f"Failed to sync products to Meilisearch: {e}")
        return 0


def _format_product(p: Dict[str, Any]) -> Dict[str, Any]:
    """Format a product dict for Meilisearch indexing."""
    return {
        "id": p.get("id"),
        "name": p.get("name", ""),
        "description": p.get("description", ""),
        "short_description": p.get("short_description", ""),
        "sku": p.get("sku", ""),
        "price": float(p["price"]) if p.get("price") else 0,
        "mrp": float(p["mrp"]) if p.get("mrp") else None,
        "slug": p.get("slug", ""),
        "is_active": p.get("is_active", True),
        "is_featured": p.get("is_featured", False),
        "is_new_arrival": p.get("is_new_arrival", False),
        "total_stock": p.get("total_stock", 0),
        "in_stock": (p.get("total_stock", 0) or 0) > 0,
        "image_url": p.get("image_url", "") or p.get("primary_image", ""),
        "category_id": p.get("category_id"),
        "category_name": p.get("category_name", ""),
        "created_at": str(p["created_at"]) if p.get("created_at") else None,
    }

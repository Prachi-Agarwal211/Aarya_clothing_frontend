"""
Size Guide Data for Aarya Clothing

Simple size chart: S=36, M=38, L=40, XL=42, XXL=44, XXXL=46
No complex measurements — just size letters and their numbers.
"""

from typing import Dict


# Simple size chart — same for all categories
# Maps size letter to the number the customer should look for
SIMPLE_SIZE_CHART = [
    {"size": "S", "number": 36},
    {"size": "M", "number": 38},
    {"size": "L", "number": 40},
    {"size": "XL", "number": 42},
    {"size": "XXL", "number": 44},
    {"size": "XXXL", "number": 46},
]

SIZE_ORDER = ["S", "M", "L", "XL", "XXL", "XXXL"]

# All categories map to the same simple chart
SIZE_CHARTS: Dict[str, list] = {
    "kurta": SIMPLE_SIZE_CHART,
    "kurti": SIMPLE_SIZE_CHART,
    "kurtas": SIMPLE_SIZE_CHART,
    "tops": SIMPLE_SIZE_CHART,
    "top": SIMPLE_SIZE_CHART,
    "bottoms": SIMPLE_SIZE_CHART,
    "bottom": SIMPLE_SIZE_CHART,
    "leggings": SIMPLE_SIZE_CHART,
    "palazzo": SIMPLE_SIZE_CHART,
    "pants": SIMPLE_SIZE_CHART,
    "dress": SIMPLE_SIZE_CHART,
    "dresses": SIMPLE_SIZE_CHART,
    "gown": SIMPLE_SIZE_CHART,
    "lehenga": SIMPLE_SIZE_CHART,
    "lehenga_choli": SIMPLE_SIZE_CHART,
    "saree": SIMPLE_SIZE_CHART,
    "saree_blouse": SIMPLE_SIZE_CHART,
    "blouse": SIMPLE_SIZE_CHART,
    "mens_shirt": SIMPLE_SIZE_CHART,
    "mens_kurta": SIMPLE_SIZE_CHART,
    "mens_tshirt": SIMPLE_SIZE_CHART,
    "mens_t-shirt": SIMPLE_SIZE_CHART,
}


def get_size_index(size: str) -> int:
    """Get numeric index for a size."""
    try:
        return SIZE_ORDER.index(size.upper())
    except ValueError:
        return 2  # Default to M


def get_size_by_index(index: int) -> str:
    """Get size string by index, clamped to valid range."""
    index = max(0, min(index, len(SIZE_ORDER) - 1))
    return SIZE_ORDER[index]


# ==================== HSN Codes for GST ====================

HSN_CODES = {
    "kurta": "6104",      # Women's suits, ensembles, jackets, dresses
    "kurti": "6104",
    "kurtas": "6104",
    "saree": "5007",      # Woven fabrics of silk
    "sarees": "5007",
    "lehenga": "6204",    # Women's suits, ensembles
    "lehenga_choli": "6204",
    "dress": "6204",
    "dresses": "6204",
    "gown": "6204",
    "top": "6106",        # Women's blouses
    "tops": "6106",
    "blouse": "6106",
    "blouses": "6106",
    "bottom": "6104",
    "bottoms": "6104",
    "leggings": "6104",
    "palazzo": "6104",
    "pants": "6104",
    "trousers": "6104",
    "mens_kurta": "6105", # Men's shirts
    "mens_shirt": "6105",
    "mens_tshirt": "6109",# T-shirts
    "mens_t-shirt": "6109",
}


def get_hsn_code(category: str) -> str:
    """Get HSN code for a product category."""
    category_lower = category.lower().strip()
    
    for key, code in HSN_CODES.items():
        if key in category_lower:
            return code
    
    # Default HSN code for apparel
    return "6104"


__all__ = [
    "SIMPLE_SIZE_CHART",
    "SIZE_CHARTS",
    "SIZE_ORDER",
    "get_size_index",
    "get_size_by_index",
    "get_hsn_code",
    "HSN_CODES",
]

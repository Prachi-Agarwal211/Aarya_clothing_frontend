"""
Commerce Service - Size Guide Routes

Simple size chart: S=36, M=38, L=40, XL=42, XXL=44, XXXL=46
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/size-guide", tags=["Size Guide"])


# ==================== Size Guide Endpoints ====================

@router.get("", response_model=dict)
async def get_size_guide(
    category: Optional[str] = Query(None, description="Product category (optional)")
):
    """
    Simple size chart: S=36, M=38, L=40, XL=42, XXL=44, XXXL=46
    """
    from shared.size_guide_data import SIMPLE_SIZE_CHART
    return {
        "category": category or "all",
        "size_chart": SIMPLE_SIZE_CHART,
        "tip": "When in between sizes, we recommend sizing up for comfort."
    }


@router.get("/categories", response_model=List[str])
async def get_size_guide_categories():
    """Get list of all available size guide categories."""
    from shared.size_guide_data import SIZE_CHARTS
    return sorted(set(SIZE_CHARTS.keys()))


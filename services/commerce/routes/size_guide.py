"""
Commerce Service - Size Guide Routes

Size guide endpoints:
- Get size charts by category
- Get size recommendations based on measurements
- Get fit type descriptions
- Get HSN codes for GST
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/size-guide", tags=["Size Guide"])


# ==================== Request/Response Schemas ====================

class SizeRecommendationRequest(BaseModel):
    """Request for size recommendation."""
    category: str = Field(..., description="Product category (e.g., 'kurta', 'dress', 'top')")
    height_cm: float = Field(..., ge=100, le=220, description="Height in centimeters")
    weight_kg: float = Field(..., ge=25, le=200, description="Weight in kilograms")
    age: Optional[int] = Field(None, ge=10, le=100, description="Age (optional)")
    fit_preference: str = Field("regular", description="Fit preference: slim, regular, relaxed, oversized")


class SizeRecommendationResponse(BaseModel):
    """Response with size recommendation."""
    recommended_size: str
    confidence_score: float
    fit_preference: str
    size_chart: Optional[dict]
    reasoning: str
    alternative_sizes: List[dict]


class MeasurementGuide(BaseModel):
    """Measurement guide for a specific measurement type."""
    name: str
    description: str
    tips: List[str]


class FitTypeDescription(BaseModel):
    """Description of a fit type."""
    name: str
    description: str
    recommendation: str


# ==================== Size Guide Endpoints ====================

@router.get("", response_model=dict)
async def get_size_guide(
    category: Optional[str] = Query(None, description="Product category (optional, returns all if not specified)")
):
    """
    Get size chart for a specific category or all categories.
    
    Returns comprehensive size measurements in both inches and centimeters.
    """
    from shared.size_guide_data import SIZE_CHARTS, MEASUREMENT_GUIDE, FIT_TYPE_DESCRIPTIONS
    
    if category:
        # Find matching size chart
        category_lower = category.lower().strip()
        size_chart = None
        
        for key, chart in SIZE_CHARTS.items():
            if key in category_lower:
                size_chart = chart
                break
        
        if not size_chart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Size chart not found for category: {category}"
            )
        
        return {
            "category": category,
            "size_chart": [size.to_dict() for size in size_chart],
            "measurement_guide": MEASUREMENT_GUIDE
        }
    
    # Return all size charts
    all_charts = {}
    for key, chart in SIZE_CHARTS.items():
        if key not in all_charts:  # Avoid duplicates (kurta/kurtas)
            all_charts[key] = [size.to_dict() for size in chart]
    
    return {
        "categories": list(all_charts.keys()),
        "size_charts": all_charts,
        "measurement_guide": MEASUREMENT_GUIDE,
        "fit_types": FIT_TYPE_DESCRIPTIONS
    }


@router.get("/categories", response_model=List[str])
async def get_size_guide_categories():
    """Get list of all available size guide categories."""
    from shared.size_guide_data import SIZE_CHARTS
    
    # Return unique category names
    categories = set()
    for key in SIZE_CHARTS.keys():
        categories.add(key)
    
    return sorted(list(categories))


@router.post("/recommend", response_model=SizeRecommendationResponse)
async def recommend_size(
    data: SizeRecommendationRequest
):
    """
    Get AI-powered size recommendation based on body measurements.
    
    Uses height, weight, age, and fit preference to recommend the best size.
    Returns confidence score and alternative sizes.
    """
    from shared.size_guide_data import recommend_size as get_recommendation
    
    try:
        recommendation = get_recommendation(
            category=data.category,
            height_cm=data.height_cm,
            weight_kg=data.weight_kg,
            age=data.age,
            fit_preference=data.fit_preference
        )
        
        return SizeRecommendationResponse(**recommendation)
    except Exception as e:
        logger.error(f"Error generating size recommendation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate size recommendation"
        )


@router.get("/measurements", response_model=dict)
async def get_measurement_guide():
    """
    Get detailed guide on how to take body measurements.
    
    Includes instructions for chest, waist, hip, shoulder, length, etc.
    """
    from shared.size_guide_data import MEASUREMENT_GUIDE
    
    return {
        "measurements": MEASUREMENT_GUIDE,
        "tips": [
            "Use a flexible measuring tape for accurate measurements",
            "Keep the tape parallel to the floor for horizontal measurements",
            "Don't pull the tape too tight - it should be snug but comfortable",
            "Measure over light clothing or undergarments for best results",
            "Take measurements in the morning for most accurate results",
            "Have someone help you for more accurate back measurements"
        ]
    }


@router.get("/fit-types", response_model=dict)
async def get_fit_types():
    """
    Get descriptions of different fit types.
    
    Explains Regular, Slim, Relaxed, and Oversized fits.
    """
    from shared.size_guide_data import FIT_TYPE_DESCRIPTIONS
    
    return {
        "fit_types": FIT_TYPE_DESCRIPTIONS,
        "guide": "Choose your fit based on comfort preference and style. Regular fit is true to size, Slim fit is more fitted, Relaxed fit offers extra room, and Oversized fit has an intentionally loose silhouette."
    }


@router.get("/hsn-codes", response_model=dict)
async def get_hsn_codes(
    category: Optional[str] = Query(None, description="Get HSN code for specific category")
):
    """
    Get HSN codes for GST compliance.
    
    HSN (Harmonized System of Nomenclature) codes are required for GST invoices.
    """
    from shared.size_guide_data import HSN_CODES, get_hsn_code
    
    if category:
        code = get_hsn_code(category)
        return {
            "category": category,
            "hsn_code": code,
            "description": get_hsn_description(code)
        }
    
    return {
        "hsn_codes": HSN_CODES,
        "note": "HSN codes are used for GST classification. All products must have valid HSN codes on invoices."
    }


def get_hsn_description(code: str) -> str:
    """Get description for HSN code."""
    descriptions = {
        "6104": "Women's suits, ensembles, jackets, dresses, skirts, trousers",
        "6204": "Women's suits, ensembles, jackets, blazers, dresses, skirts",
        "6106": "Women's blouses, shirts and shirt-blouses",
        "6109": "T-shirts, singlets and other vests",
        "6105": "Men's shirts",
        "5007": "Woven fabrics of silk",
        "6205": "Men's shirts",
    }
    return descriptions.get(code, "Apparel and clothing accessories")

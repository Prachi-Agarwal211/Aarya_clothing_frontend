"""
Size Guide Data for Aarya Clothing

Comprehensive size charts for all product categories.
Measurements in inches (primary) and centimeters (secondary).

This module provides standardized sizing data to reduce returns
by helping customers choose the correct size.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class FitType(str, Enum):
    """Fit types for garments."""
    REGULAR = "Regular"
    SLIM = "Slim"
    RELAXED = "Relaxed"
    OVERSIZED = "Oversized"


@dataclass
class Measurement:
    """Measurement with inches and centimeters."""
    inches: float
    centimeters: float

    def __post_init__(self):
        # Auto-convert if only one unit provided
        if self.centimeters is None and self.inches is not None:
            self.centimeters = round(self.inches * 2.54, 1)
        if self.inches is None and self.centimeters is not None:
            self.inches = round(self.centimeters / 2.54, 1)


@dataclass
class SizeChart:
    """Size chart entry for a specific size."""
    size: str
    chest_bust: Optional[Measurement] = None
    waist: Optional[Measurement] = None
    hip: Optional[Measurement] = None
    shoulder: Optional[Measurement] = None
    length: Optional[Measurement] = None
    inseam: Optional[Measurement] = None
    neck: Optional[Measurement] = None
    sleeve: Optional[Measurement] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        result = {"size": self.size}
        for field, value in asdict(self).items():
            if field != "size" and value is not None:
                if isinstance(value, Measurement):
                    result[field] = {
                        "inches": value.inches,
                        "centimeters": value.centimeters
                    }
                else:
                    result[field] = value
        return result


# ==================== Size Charts by Category ====================

KURTA_SIZE_CHART: List[SizeChart] = [
    SizeChart("XS", Measurement(32, 81), Measurement(26, 66), Measurement(34, 86)),
    SizeChart("S", Measurement(34, 86), Measurement(28, 71), Measurement(36, 91)),
    SizeChart("M", Measurement(36, 91), Measurement(30, 76), Measurement(38, 97)),
    SizeChart("L", Measurement(38, 97), Measurement(32, 81), Measurement(40, 102)),
    SizeChart("XL", Measurement(40, 102), Measurement(34, 86), Measurement(42, 107)),
    SizeChart("XXL", Measurement(42, 107), Measurement(36, 91), Measurement(44, 112)),
]

TOP_SIZE_CHART: List[SizeChart] = [
    SizeChart("XS", Measurement(30, 76), Measurement(24, 61), Measurement(14, 36)),
    SizeChart("S", Measurement(32, 81), Measurement(26, 66), Measurement(14.5, 37)),
    SizeChart("M", Measurement(34, 86), Measurement(28, 71), Measurement(15, 38)),
    SizeChart("L", Measurement(36, 91), Measurement(30, 76), Measurement(15.5, 39)),
    SizeChart("XL", Measurement(38, 97), Measurement(32, 81), Measurement(16, 41)),
    SizeChart("XXL", Measurement(40, 102), Measurement(34, 86), Measurement(16.5, 42)),
]

BOTTOM_SIZE_CHART: List[SizeChart] = [
    SizeChart("XS", Measurement(24, 61), Measurement(34, 86), Measurement(28, 71)),
    SizeChart("S", Measurement(26, 66), Measurement(36, 91), Measurement(28.5, 72)),
    SizeChart("M", Measurement(28, 71), Measurement(38, 97), Measurement(29, 74)),
    SizeChart("L", Measurement(30, 76), Measurement(40, 102), Measurement(29.5, 75)),
    SizeChart("XL", Measurement(32, 81), Measurement(42, 107), Measurement(30, 76)),
    SizeChart("XXL", Measurement(34, 86), Measurement(44, 112), Measurement(30.5, 77)),
]

DRESS_SIZE_CHART: List[SizeChart] = [
    SizeChart("XS", Measurement(32, 81), Measurement(26, 66), Measurement(34, 86), Measurement(35, 89)),
    SizeChart("S", Measurement(34, 86), Measurement(28, 71), Measurement(36, 91), Measurement(36, 91)),
    SizeChart("M", Measurement(36, 91), Measurement(30, 76), Measurement(38, 97), Measurement(37, 94)),
    SizeChart("L", Measurement(38, 97), Measurement(32, 81), Measurement(40, 102), Measurement(38, 97)),
    SizeChart("XL", Measurement(40, 102), Measurement(34, 86), Measurement(42, 107), Measurement(39, 99)),
    SizeChart("XXL", Measurement(42, 107), Measurement(36, 91), Measurement(44, 112), Measurement(40, 102)),
]

LEHENGA_SIZE_CHART: List[SizeChart] = [
    SizeChart("XS", Measurement(24, 61), Measurement(34, 86), Measurement(40, 102)),
    SizeChart("S", Measurement(26, 66), Measurement(36, 91), Measurement(40.5, 103)),
    SizeChart("M", Measurement(28, 71), Measurement(38, 97), Measurement(41, 104)),
    SizeChart("L", Measurement(30, 76), Measurement(40, 102), Measurement(41.5, 105)),
    SizeChart("XL", Measurement(32, 81), Measurement(42, 107), Measurement(42, 107)),
]

SAREE_BLOUSE_SIZE_CHART: List[SizeChart] = [
    SizeChart("XS", Measurement(32, 81), Measurement(26, 66), Measurement(34, 86)),
    SizeChart("S", Measurement(34, 86), Measurement(28, 71), Measurement(36, 91)),
    SizeChart("M", Measurement(36, 91), Measurement(30, 76), Measurement(38, 97)),
    SizeChart("L", Measurement(38, 97), Measurement(32, 81), Measurement(40, 102)),
    SizeChart("XL", Measurement(40, 102), Measurement(34, 86), Measurement(42, 107)),
    SizeChart("XXL", Measurement(42, 107), Measurement(36, 91), Measurement(44, 112)),
]

MENS_SHIRT_SIZE_CHART: List[SizeChart] = [
    SizeChart("S", Measurement(36, 91), Measurement(30, 76), Measurement(14, 36), Measurement(24, 61)),
    SizeChart("M", Measurement(38, 97), Measurement(32, 81), Measurement(14.5, 37), Measurement(24.5, 62)),
    SizeChart("L", Measurement(40, 102), Measurement(34, 86), Measurement(15, 38), Measurement(25, 64)),
    SizeChart("XL", Measurement(42, 107), Measurement(36, 91), Measurement(15.5, 39), Measurement(25.5, 65)),
    SizeChart("XXL", Measurement(44, 112), Measurement(38, 97), Measurement(16, 41), Measurement(26, 66)),
]

MENS_TSHIRT_SIZE_CHART: List[SizeChart] = [
    SizeChart("S", Measurement(36, 91), Measurement(30, 76), Measurement(17, 43), Measurement(27, 69)),
    SizeChart("M", Measurement(38, 97), Measurement(32, 81), Measurement(18, 46), Measurement(27.5, 70)),
    SizeChart("L", Measurement(40, 102), Measurement(34, 86), Measurement(19, 48), Measurement(28, 71)),
    SizeChart("XL", Measurement(42, 107), Measurement(36, 91), Measurement(20, 51), Measurement(28.5, 72)),
    SizeChart("XXL", Measurement(44, 112), Measurement(38, 97), Measurement(21, 53), Measurement(29, 74)),
]

# ==================== Category Mapping ====================

SIZE_CHARTS: Dict[str, List[SizeChart]] = {
    "kurta": KURTA_SIZE_CHART,
    "kurti": KURTA_SIZE_CHART,
    "kurtas": KURTA_SIZE_CHART,
    "tops": TOP_SIZE_CHART,
    "top": TOP_SIZE_CHART,
    "bottoms": BOTTOM_SIZE_CHART,
    "bottom": BOTTOM_SIZE_CHART,
    "leggings": BOTTOM_SIZE_CHART,
    "palazzo": BOTTOM_SIZE_CHART,
    "pants": BOTTOM_SIZE_CHART,
    "dress": DRESS_SIZE_CHART,
    "dresses": DRESS_SIZE_CHART,
    "gown": DRESS_SIZE_CHART,
    "lehenga": LEHENGA_SIZE_CHART,
    "lehenga_choli": LEHENGA_SIZE_CHART,
    "saree": SAREE_BLOUSE_SIZE_CHART,
    "saree_blouse": SAREE_BLOUSE_SIZE_CHART,
    "blouse": SAREE_BLOUSE_SIZE_CHART,
    "mens_shirt": MENS_SHIRT_SIZE_CHART,
    "mens_kurta": MENS_SHIRT_SIZE_CHART,
    "mens_tshirt": MENS_TSHIRT_SIZE_CHART,
    "mens_t-shirt": MENS_TSHIRT_SIZE_CHART,
}

# ==================== How to Measure Guide ====================

MEASUREMENT_GUIDE = {
    "chest_bust": {
        "name": "Chest/Bust",
        "description": "Measure around the fullest part of your chest/bust, keeping the tape parallel to the floor.",
        "tips": [
            "Keep arms relaxed at sides",
            "Don't pull tape too tight",
            "Breathe normally while measuring"
        ]
    },
    "waist": {
        "name": "Waist",
        "description": "Measure around your natural waistline (narrowest part of your torso).",
        "tips": [
            "Find the narrowest part above your navel",
            "Keep one finger between tape and body",
            "Don't suck in your stomach"
        ]
    },
    "hip": {
        "name": "Hip",
        "description": "Measure around the fullest part of your hips and buttocks.",
        "tips": [
            "Stand with feet together",
            "Measure around the widest part",
            "Keep tape parallel to floor"
        ]
    },
    "shoulder": {
        "name": "Shoulder",
        "description": "Measure from the edge of one shoulder to the other across your back.",
        "tips": [
            "Measure across the back, not front",
            "Start and end at shoulder bones",
            "Keep tape straight across"
        ]
    },
    "length": {
        "name": "Length",
        "description": "Measure from the highest point of shoulder down to desired length.",
        "tips": [
            "Start from shoulder bone",
            "Measure to where you want garment to end",
            "Stand straight while measuring"
        ]
    },
    "inseam": {
        "name": "Inseam",
        "description": "Measure from the crotch seam down to the ankle bone.",
        "tips": [
            "Measure along inner leg",
            "Stand with legs slightly apart",
            "Measure to desired pant length"
        ]
    },
    "neck": {
        "name": "Neck",
        "description": "Measure around the base of your neck where collar would sit.",
        "tips": [
            "Keep tape slightly loose",
            "Measure where collar normally sits",
            "Allow room for comfort"
        ]
    },
    "sleeve": {
        "name": "Sleeve Length",
        "description": "Measure from shoulder edge down to wrist bone.",
        "tips": [
            "Bend arm slightly",
            "Measure over elbow",
            "End at wrist bone"
        ]
    }
}

# ==================== Size Recommendation Logic ====================

# Height ranges in cm with corresponding base size
HEIGHT_SIZE_MAPPING = [
    (150, "XS"),  # Below 150cm
    (155, "S"),   # 150-155cm
    (160, "M"),   # 155-160cm
    (165, "L"),   # 160-165cm
    (170, "XL"),  # 165-170cm
    (175, "XXL"), # Above 170cm
]

# Weight ranges in kg with size adjustment
WEIGHT_SIZE_ADJUSTMENT = [
    (45, 0),   # Below 45kg: no adjustment
    (55, 0),   # 45-55kg: no adjustment
    (65, 1),   # 55-65kg: +1 size
    (75, 2),   # 65-75kg: +2 sizes
    (85, 3),   # 75-85kg: +3 sizes
    (999, 4),  # Above 85kg: +4 sizes
]

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]


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


def recommend_size(
    category: str,
    height_cm: float,
    weight_kg: float,
    age: Optional[int] = None,
    fit_preference: str = "regular"
) -> dict:
    """
    Recommend size based on body measurements.
    
    Args:
        category: Product category (kurta, top, dress, etc.)
        height_cm: Height in centimeters
        weight_kg: Weight in kilograms
        age: Optional age (used for fit adjustments)
        fit_preference: "slim", "regular", or "relaxed"
    
    Returns:
        Dictionary with recommended size, confidence score, and reasoning
    """
    # Normalize category
    category_lower = category.lower().strip()
    
    # Find matching size chart
    size_chart = None
    for key, chart in SIZE_CHARTS.items():
        if key in category_lower:
            size_chart = chart
            break
    
    if not size_chart:
        # Default to kurta size chart
        size_chart = KURTA_SIZE_CHART
    
    # Determine base size from height
    base_size = "M"
    for height_threshold, size in HEIGHT_SIZE_MAPPING:
        if height_cm < height_threshold:
            base_size = size
            break
    
    base_index = get_size_index(base_size)
    
    # Adjust for weight
    weight_adjustment = 0
    for weight_threshold, adjustment in WEIGHT_SIZE_ADJUSTMENT:
        if weight_kg < weight_threshold:
            weight_adjustment = adjustment
            break
    
    # Adjust for fit preference
    fit_adjustment = 0
    if fit_preference == "slim":
        fit_adjustment = -1  # Prefer tighter fit
    elif fit_preference == "relaxed":
        fit_adjustment = 1   # Prefer looser fit
    elif fit_preference == "oversized":
        fit_adjustment = 2   # Prefer very loose fit
    
    # Age adjustment (older customers may prefer looser fit)
    age_adjustment = 0
    if age and age > 50:
        age_adjustment = 1
    
    # Calculate final size
    final_index = base_index + weight_adjustment + fit_adjustment + age_adjustment
    final_index = max(0, min(final_index, len(SIZE_ORDER) - 1))
    recommended_size = get_size_by_index(final_index)
    
    # Calculate confidence score (0-100)
    # Higher confidence when height/weight are in typical ranges
    confidence = 85  # Base confidence
    
    # Reduce confidence for extreme measurements
    if height_cm < 145 or height_cm > 185:
        confidence -= 15
    if weight_kg < 35 or weight_kg > 120:
        confidence -= 15
    
    # Increase confidence for regular fit (most common)
    if fit_preference == "regular":
        confidence += 5
    
    confidence = max(50, min(95, confidence))
    
    # Get size chart data for recommended size
    size_data = None
    for size_entry in size_chart:
        if size_entry.size == recommended_size:
            size_data = size_entry.to_dict()
            break
    
    return {
        "recommended_size": recommended_size,
        "confidence_score": confidence,
        "fit_preference": fit_preference,
        "size_chart": size_data,
        "reasoning": generate_reasoning(
            base_size, weight_adjustment, fit_adjustment, 
            age_adjustment, recommended_size
        ),
        "alternative_sizes": get_alternative_sizes(
            recommended_size, fit_preference
        )
    }


def generate_reasoning(
    base_size: str,
    weight_adj: int,
    fit_adj: int,
    age_adj: int,
    final_size: str
) -> str:
    """Generate human-readable reasoning for size recommendation."""
    reasons = [f"Based on your height, we recommend {base_size}"]
    
    if weight_adj > 0:
        reasons.append(f"adjusted +{weight_adj} size(s) for weight")
    elif weight_adj < 0:
        reasons.append(f"adjusted {abs(weight_adj)} size(s) for weight")
    
    if fit_adj > 0:
        reasons.append(f"+{fit_adj} size(s) for relaxed fit")
    elif fit_adj < 0:
        reasons.append(f"{abs(fit_adj)} size(s) for slim fit")
    
    if age_adj > 0:
        reasons.append("+1 size for comfort")
    
    return f"Size {final_size}: " + ", ".join(reasons)


def get_alternative_sizes(recommended_size: str, fit_preference: str) -> List[dict]:
    """Get alternative sizes based on fit preference."""
    idx = get_size_index(recommended_size)
    alternatives = []
    
    if fit_preference == "slim":
        # Suggest one size up for looser option
        if idx < len(SIZE_ORDER) - 1:
            alternatives.append({
                "size": get_size_by_index(idx + 1),
                "reason": "For a more relaxed fit"
            })
    elif fit_preference in ["relaxed", "oversized"]:
        # Suggest one size down for tighter option
        if idx > 0:
            alternatives.append({
                "size": get_size_by_index(idx - 1),
                "reason": "For a more fitted look"
            })
    else:
        # Regular fit - suggest both directions
        if idx > 0:
            alternatives.append({
                "size": get_size_by_index(idx - 1),
                "reason": "For a slimmer fit"
            })
        if idx < len(SIZE_ORDER) - 1:
            alternatives.append({
                "size": get_size_by_index(idx + 1),
                "reason": "For a more relaxed fit"
            })
    
    return alternatives


# ==================== Fit Type Descriptions ====================

FIT_TYPE_DESCRIPTIONS = {
    FitType.REGULAR: {
        "name": "Regular Fit",
        "description": "Classic, comfortable fit with room for movement. True to size.",
        "recommendation": "Order your usual size"
    },
    FitType.SLIM: {
        "name": "Slim Fit",
        "description": "Closer to the body with a tailored silhouette. More fitted through chest and waist.",
        "recommendation": "Order your usual size for fitted look, one size up for comfort"
    },
    FitType.RELAXED: {
        "name": "Relaxed Fit",
        "description": "Loose, comfortable fit with extra room throughout.",
        "recommendation": "Order your usual size for relaxed look, one size down for regular fit"
    },
    FitType.OVERSIZED: {
        "name": "Oversized Fit",
        "description": "Intentionally loose and boxy silhouette. Street style aesthetic.",
        "recommendation": "Order your usual size for oversized look, two sizes down for regular fit"
    }
}


def get_fit_type_description(fit_type: str) -> dict:
    """Get description for a fit type."""
    try:
        fit = FitType(fit_type.upper())
        return FIT_TYPE_DESCRIPTIONS[fit]
    except (ValueError, KeyError):
        return FIT_TYPE_DESCRIPTIONS[FitType.REGULAR]


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


# ==================== Export Public API ====================

__all__ = [
    # Data classes
    "Measurement",
    "SizeChart",
    "FitType",
    
    # Size charts
    "KURTA_SIZE_CHART",
    "TOP_SIZE_CHART",
    "BOTTOM_SIZE_CHART",
    "DRESS_SIZE_CHART",
    "LEHENGA_SIZE_CHART",
    "SAREE_BLOUSE_SIZE_CHART",
    "MENS_SHIRT_SIZE_CHART",
    "MENS_TSHIRT_SIZE_CHART",
    "SIZE_CHARTS",
    
    # Measurement guide
    "MEASUREMENT_GUIDE",
    
    # Recommendation functions
    "recommend_size",
    "get_size_index",
    "get_size_by_index",
    "get_alternative_sizes",
    
    # Fit type functions
    "get_fit_type_description",
    "FIT_TYPE_DESCRIPTIONS",
    
    # HSN codes
    "get_hsn_code",
    "HSN_CODES",
]

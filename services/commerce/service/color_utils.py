"""
Color name lookup utility.
Converts hex color codes to human-readable color names.
"""

# Common hex to color name mapping
HEX_TO_COLOR = {
    "#FF0000": "Red",
    "#0000FF": "Blue",
    "#008000": "Green",
    "#FFFF00": "Yellow",
    "#800080": "Purple",
    "#FFA500": "Orange",
    "#000000": "Black",
    "#FFFFFF": "White",
    "#808080": "Gray",
    "#A52A2A": "Brown",
    "#FFC0CB": "Pink",
    "#00FFFF": "Cyan",
    "#FF00FF": "Magenta",
    "#800000": "Maroon",
    "#008080": "Teal",
    "#000080": "Navy",
    "#C0C0C0": "Silver",
    "#FFD700": "Gold",
    "#F5F5DC": "Beige",
    "#808000": "Olive",
    "#FF6347": "Tomato",
    "#40E0D0": "Turquoise",
    "#EE82EE": "Violet",
    "#F5DEB3": "Wheat",
    "#D2691E": "Chocolate",
    "#DC143C": "Crimson",
    "#FF69B4": "Hot Pink",
    "#9370DB": "Medium Purple",
    "#3CB371": "Medium Sea Green",
    "#4169E1": "Royal Blue",
    "#2E8B57": "Sea Green",
    "#DAA520": "Goldenrod",
    "#CD853F": "Peru",
    "#BC8F8F": "Rosy Brown",
    "#708090": "Slate Gray",
    "#F4A460": "Sandy Brown",
    "#2F4F4F": "Dark Slate Gray",
}


def _hex_to_color_name(hex_color: str) -> str:
    """
    Convert hex color code to human-readable color name.
    Falls back to the original hex if not found in mapping.
    """
    if not hex_color or not hex_color.startswith('#'):
        return hex_color

    hex_upper = hex_color.upper()
    return HEX_TO_COLOR.get(hex_upper, hex_color)

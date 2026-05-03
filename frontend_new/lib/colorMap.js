/**
 * Color map for Aarya Clothing
 * Contains only the main 50+ prioritized colors
 * Extended database moved to backend for auto-naming
 */

export const COLOR_MAP = {
  // --- Indian Clothing Specific (Prioritized) ---
  'Mahendi': '#4A7C59',
  'Rust': '#B7410E',
  'Mustard': '#E3A849',
  'Wine': '#722F37',
  'Burgundy': '#800020',
  'Cream': '#FFFDD0',
  'Peach': '#FFDAB9',
  'Coral': '#FF7F50',
  'Gold': '#FFD700',
  'Silver': '#C0C0C0',
  'Olive': '#808000',
  'Teal': '#14B8A6',
  'Lavender': '#E6E6FA',
  'Lilac': '#C8A2C8',
  'Mauve': '#E0B0FF',
  'Magenta': '#FF00FF',
  'Charcoal': '#36454F',
  'Multicolor': '#FF6B6B',

  // --- Standard Web Colors ---
  'Black': '#000000',
  'White': '#FFFFFF',
  'Red': '#FF0000',
  'Green': '#00FF00',
  'Blue': '#0000FF',
  'Yellow': '#FFFF00',
  'Cyan': '#00FFFF',
  'Aqua': '#00FFFF',
  'Fuchsia': '#FF00FF',
  'Pink': '#FFC0CB',
  'Orange': '#FFA500',
  'Purple': '#800080',
  'Navy': '#000080',
  'Maroon': '#800000',
  'Beige': '#F5F5DC',
  'Ivory': '#FFFFF0',
  'Gray': '#808080',
  'Grey': '#808080',
  'Sky Blue': '#87CEEB',
  'Royal Blue': '#4169E1',
  'Sea Green': '#2E8B57',
  'Spring Green': '#00FF7F',
  'Turquoise': '#40E0D0',
  'Indigo': '#4B0082',
  'Violet': '#EE82EE',
  'Brown': '#A52A2A',
  'Crimson': '#DC143C',
  'Dark Orange': '#FF8C00',
  'Hot Pink': '#FF69B4',
  'Lime': '#00FF00',
  'Midnight Blue': '#191970',
  'Orchid': '#DA70D6',
  'Salmon': '#FA8072',
  'Sienna': '#A0522D',
  'Slate Blue': '#6A5ACD',
  'Steel Blue': '#4682B4',
  'Tan': '#D2B48C',
  'Thistle': '#D8BFD8',
  'Tomato': '#FF6347',
  'Wheat': '#F5DEB3',
  'Azure': '#F0FFFF',
  'Misty Rose': '#FFE4E1',
  'Old Lace': '#FDF5E6',
  'Papaya Whip': '#FFEFD5',
  'Sea Shell': '#FFF5EE',
  'White Smoke': '#F5F5F5',
};

/**
 * Get hex code from color name (case-insensitive fuzzy match)
 * Only searches the 50+ main colors in COLOR_MAP
 */
export function getHexFromName(name) {
  if (!name) return null;

  const nameLower = name.toLowerCase().trim();

  // Exact match
  if (COLOR_MAP[name]) {
    return COLOR_MAP[name];
  }

  // Fuzzy match by checking if name is a hex code
  const hexMatch = name.match(/^#([0-9A-F]{6})$/i);
  if (hexMatch) {
    return `#${hexMatch[1].toUpperCase()}`;
  }

  // Try to find partial match
  for (const [colorName, hex] of Object.entries(COLOR_MAP)) {
    if (colorName.toLowerCase().includes(nameLower)) {
      return hex;
    }
    if (nameLower.includes(colorName.toLowerCase())) {
      return hex;
    }
  }

  return null;
}

/**
 * Get color name from hex (exact match only)
 * Only searches COLOR_MAP - uses backend for nearest match
 */
export function getColorName(hex) {
  if (!hex) return null;

  const hexUpper = hex.toUpperCase().replace('#', '');

  for (const [name, color] of Object.entries(COLOR_MAP)) {
    if (color.replace('#', '').toUpperCase() === hexUpper) {
      return name;
    }
  }

  return null;
}

/**
 * Note: Extended color database (1500+ colors) has been moved to backend
 * to reduce frontend bundle size and improve performance.
 * Use the API endpoint /api/v1/products/variants/{id}/color-name for nearest match.
 */

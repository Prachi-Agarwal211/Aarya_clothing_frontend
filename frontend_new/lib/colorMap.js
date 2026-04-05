// Centralized color map for Indian clothing colors
// Used by: ColorPicker, ProductDetail, ProductCard, AI Shopping

export const COLOR_MAP = {
  'Black': '#000000',
  'White': '#FFFFFF',
  'Red': '#DC2626',
  'Maroon': '#800000',
  'Pink': '#EC4899',
  'Rose': '#F43F5E',
  'Peach': '#FFDAB9',
  'Coral': '#FF7F50',
  'Orange': '#F97316',
  'Rust': '#B7410E',
  'Mustard': '#E3A849',
  'Gold': '#FFD700',
  'Yellow': '#EAB308',
  'Lime Yellow': '#C5D94C',
  'Lime': '#84CC16',
  'Green': '#22C55E',
  'Sea Green': '#2E8B57',
  'Mahendi': '#4A7C59',
  'Olive': '#808000',
  'Teal': '#14B8A6',
  'Turquoise': '#40E0D0',
  'Sky Blue': '#87CEEB',
  'Blue': '#3B82F6',
  'Navy': '#1E3A5F',
  'Purple': '#A855F7',
  'Lavender': '#E6E6FA',
  'Lilac': '#C8A2C8',
  'Mauve': '#E0B0FF',
  'Magenta': '#FF00FF',
  'Wine': '#722F37',
  'Burgundy': '#800020',
  'Brown': '#92400E',
  'Beige': '#F5F5DC',
  'Ivory': '#FFFFF0',
  'Cream': '#FFFDD0',
  'Grey': '#9CA3AF',
  'Gray': '#9CA3AF',
  'Silver': '#C0C0C0',
  'Charcoal': '#36454F',
  'Multicolor': '#FF6B6B',
};

// Reverse lookup: hex -> name
export const HEX_TO_NAME = Object.fromEntries(
  Object.entries(COLOR_MAP).map(([name, hex]) => [hex, name])
);

// Get color name from hex or return hex
export function getColorName(hex) {
  if (!hex) return null;
  const upper = hex.toUpperCase();
  return HEX_TO_NAME[upper] || null;
}

// Get hex from color name (case-insensitive fuzzy match)
export function getHexFromName(name) {
  if (!name) return '#888888';
  const trimmed = name.trim();
  // Exact match
  if (COLOR_MAP[trimmed]) return COLOR_MAP[trimmed];
  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (key.toLowerCase() === lower) return hex;
  }
  // Fuzzy: if name contains a known color word
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key.toLowerCase())) return hex;
  }
  return '#888888'; // Default gray fallback
}

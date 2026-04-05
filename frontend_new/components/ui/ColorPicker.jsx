'use client';

import React, { useState, useMemo } from 'react';
import { COLOR_MAP, getHexFromName } from '@/lib/colorMap';

/**
 * Paint-style color picker component.
 * Shows a grid of color swatches (like MS Paint palette).
 *
 * Props:
 *   - value: selected hex color (e.g. '#DC2626')
 *   - onChange: callback(hex, name) when selection changes
 *   - label: optional label text
 */
export default function ColorPicker({ value, onChange, label = 'Color' }) {
  const [customName, setCustomName] = useState('');

  // Convert the colors map to an array of { name, hex }
  const swatches = useMemo(() => {
    return Object.entries(COLOR_MAP).map(([name, hex]) => ({ name, hex }));
  }, []);

  // Find the currently selected swatch name
  const selectedName = useMemo(() => {
    if (!value) return null;
    const upper = value.toUpperCase();
    const entry = Object.entries(COLOR_MAP).find(([_, hex]) => hex.toUpperCase() === upper);
    return entry ? entry[0] : null;
  }, [value]);

  const handleSwatchClick = (hex, name) => {
    setCustomName('');
    onChange(hex, name);
  };

  const handleCustomNameChange = (e) => {
    const name = e.target.value;
    setCustomName(name);
    if (name.trim()) {
      const hex = getHexFromName(name);
      onChange(hex, name.trim());
    }
  };

  // For white swatches, use a dark border so they're visible on dark bg
  const isLight = (hex) => {
    if (!hex) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 180;
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm text-[#EAE0D5]/70">{label}</label>
      )}

      {/* Color grid — 10 columns like MS Paint */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl">
        {swatches.map(({ name, hex }) => {
          const isSelected = value && value.toUpperCase() === hex.toUpperCase();
          const light = isLight(hex);
          return (
            <button
              key={name}
              type="button"
              onClick={() => handleSwatchClick(hex, name)}
              title={name}
              className={`w-8 h-8 rounded-full transition-all duration-150 hover:scale-125 ${
                isSelected
                  ? 'ring-2 ring-[#F2C29A] ring-offset-2 ring-offset-[#0B0608] scale-110'
                  : light
                    ? 'ring-1 ring-white/30'
                    : 'ring-1 ring-white/10'
              }`}
              style={{ backgroundColor: hex }}
              aria-label={`Select ${name}`}
            />
          );
        })}
      </div>

      {/* Selected color info + custom input */}
      <div className="flex items-center gap-3">
        {value && (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full border-2 border-[#B76E79]/40"
              style={{ backgroundColor: value }}
            />
            <span className="text-xs text-[#EAE0D5]/60 font-mono">
              {selectedName || value} ({value})
            </span>
          </div>
        )}
      </div>

      {/* Custom color name input */}
      <div>
        <input
          type="text"
          value={customName}
          onChange={handleCustomNameChange}
          placeholder="Or type a custom color name..."
          className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
        />
      </div>
    </div>
  );
}

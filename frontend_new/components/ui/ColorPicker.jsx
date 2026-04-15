'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Pipette, ChevronDown } from 'lucide-react';
import { getColorName } from '@/lib/colorMap';

/**
 * Professional HSL gradient color picker.
 * - Saturation/Lightness 2D canvas picker
 * - Hue rainbow slider
 * - Opacity slider
 * - Hex input
 * - Quick preset swatches
 *
 * Props:
 *   value: hex string (e.g. '#DC2626')
 *   onChange: (hex, name) => void
 *   label: string
 */

const PRESETS = [
  '#E53935','#FB8C00','#FDD835','#43A047','#00ACC1',
  '#1E88E5','#8E24AA','#D81B60','#6D4C41','#546E7A',
  '#FFFFFF','#F5F5F5','#BDBDBD','#757575','#212121',
  '#000000','#FFD700','#FF69B4','#00CED1','#7B68EE',
];

// --- HSL <-> RGB <-> HEX helpers ---
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Derive a readable color name from hex
function nameFromHex(hex) {
  return getColorName(hex) || 'Custom';
}

export default function ColorPicker({ value, onChange, label = 'Color' }) {
  // Parse incoming hex → hsl
  const initHsl = useMemo(() => {
    if (!value) return { h: 0, s: 100, l: 50 };
    const { r, g, b } = hexToRgb(value);
    return rgbToHsl(r, g, b);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [hue, setHue] = useState(initHsl.h);
  const [sat, setSat] = useState(initHsl.s);
  const [lit, setLit] = useState(initHsl.l);
  const [opacity, setOpacity] = useState(100);
  const [hexInput, setHexInput] = useState(value || '#000000');
  const [open, setOpen] = useState(false);

  const gradRef = useRef(null);
  const hueRef = useRef(null);
  const opacRef = useRef(null);
  const dragging = useRef(null); // 'grad' | 'hue' | 'opac'

  // Current fully-opaque hex from h,s,l
  const currentHex = useMemo(() => {
    const { r, g, b } = hslToRgb(hue, sat, lit);
    return rgbToHex(r, g, b);
  }, [hue, sat, lit]);

  // Sync hex input & notify parent whenever hsl changes
  useEffect(() => {
    setHexInput(currentHex);
    if (onChange) onChange(currentHex, nameFromHex(currentHex));
  }, [currentHex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync internal state when value prop changes externally
  useEffect(() => {
    if (!value || value.toUpperCase() === currentHex.toUpperCase()) return;
    const { r, g, b } = hexToRgb(value);
    const { h, s, l } = rgbToHsl(r, g, b);
    setHue(h); setSat(s); setLit(l);
    setHexInput(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Gradient canvas pointer handling ---
  const handleGradPointer = useCallback((e) => {
    if (!gradRef.current) return;
    const rect = gradRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    // x = saturation 0→100, y = lightness 100→0 (with hue factored in)
    // Proper: s from 0→100 left→right, l from (100 - y*(100-0)) adjusted for hue
    // Simplified standard: s=x*100, l=(1-y)*100 adjusted → use HSV-style mapping
    // Actual Photoshop approach: s=x*100, v=(1-y)*100 → convert HSV→HSL
    const sv = x * 100;
    const vv = (1 - y) * 100;
    // HSV to HSL
    const ll = vv * (1 - sv / 200);
    const ss = ll === 0 || ll === 100 ? 0 : (vv - ll) / Math.min(ll, 100 - ll) * 100;
    setSat(clamp(ss, 0, 100));
    setLit(clamp(ll, 0, 100));
  }, []);

  const handleHuePointer = useCallback((e) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    setHue(x * 360);
  }, []);

  const handleOpacPointer = useCallback((e) => {
    if (!opacRef.current) return;
    const rect = opacRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    setOpacity(Math.round(x * 100));
  }, []);

  const onPointerDown = useCallback((type, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = type;
    if (type === 'grad') handleGradPointer(e);
    else if (type === 'hue') handleHuePointer(e);
    else if (type === 'opac') handleOpacPointer(e);
  }, [handleGradPointer, handleHuePointer, handleOpacPointer]);

  const onPointerMove = useCallback((type, e) => {
    if (dragging.current !== type) return;
    if (type === 'grad') handleGradPointer(e);
    else if (type === 'hue') handleHuePointer(e);
    else if (type === 'opac') handleOpacPointer(e);
  }, [handleGradPointer, handleHuePointer, handleOpacPointer]);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  // Hex input handler
  const handleHexInput = (e) => {
    const raw = e.target.value;
    setHexInput(raw);
    const cleaned = raw.replace(/[^0-9a-fA-F#]/g, '');
    const h = cleaned.startsWith('#') ? cleaned : '#' + cleaned;
    if (h.length === 7) {
      const { r, g, b } = hexToRgb(h);
      const { h: hh, s, l } = rgbToHsl(r, g, b);
      setHue(hh); setSat(s); setLit(l);
    }
  };

  // Cursor position on gradient canvas
  // HSL → HSV for cursor: v = l + s*min(l,100-l)/100; s_hsv = v===0 ? 0 : 200*(1-l/v)
  const vv = lit + sat * Math.min(lit, 100 - lit) / 100;
  const sv = vv === 0 ? 0 : 200 * (1 - lit / vv);
  const cursorX = clamp(sv / 100, 0, 1);
  const cursorY = clamp(1 - vv / 100, 0, 1);

  const pureHueHex = useMemo(() => {
    const { r, g, b } = hslToRgb(hue, 100, 50);
    return rgbToHex(r, g, b);
  }, [hue]);

  const isLight = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000 > 180;
  };

  return (
    <div className="relative">
      {label && <label className="block text-xs text-[#EAE0D5]/60 mb-1">{label}</label>}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg hover:border-[#B76E79]/40 transition-colors w-full"
      >
        <div
          className="w-6 h-6 rounded-md border border-white/10 shrink-0"
          style={{ backgroundColor: value || '#888888' }}
        />
        <span className="text-sm font-mono text-[#EAE0D5]/80 flex-1 text-left">
          {value ? value.toUpperCase() : 'Pick color'}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#EAE0D5]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Picker panel */}
      {open && (
        <div
          className="absolute z-50 mt-1 left-0 w-64 bg-[#1a0d12] border border-[#B76E79]/30 rounded-2xl shadow-2xl p-4 space-y-3"
          style={{ minWidth: 240 }}
        >
          {/* Saturation / Lightness canvas */}
          <div
            ref={gradRef}
            className="relative w-full rounded-xl overflow-hidden cursor-crosshair select-none"
            style={{
              height: 160,
              background: `linear-gradient(to bottom, transparent, #000),
                           linear-gradient(to right, #fff, ${pureHueHex})`,
            }}
            onPointerDown={(e) => onPointerDown('grad', e)}
            onPointerMove={(e) => onPointerMove('grad', e)}
            onPointerUp={onPointerUp}
          >
            {/* Cursor */}
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${cursorX * 100}%`,
                top: `${cursorY * 100}%`,
                backgroundColor: currentHex,
              }}
            />
          </div>

          {/* Hue slider */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Pipette className="w-3.5 h-3.5 text-[#EAE0D5]/40 shrink-0" />
              <div
                ref={hueRef}
                className="relative flex-1 h-3 rounded-full cursor-pointer select-none"
                style={{
                  background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
                }}
                onPointerDown={(e) => onPointerDown('hue', e)}
                onPointerMove={(e) => onPointerMove('hue', e)}
                onPointerUp={onPointerUp}
              >
                <div
                  className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: `${(hue / 360) * 100}%`, backgroundColor: pureHueHex }}
                />
              </div>
            </div>

            {/* Opacity slider */}
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 shrink-0" />
              <div
                ref={opacRef}
                className="relative flex-1 h-3 rounded-full cursor-pointer select-none"
                style={{
                  background: `linear-gradient(to right, transparent, ${currentHex}),
                               repeating-conic-gradient(#555 0% 25%, #888 0% 50%) 0 0 / 8px 8px`,
                }}
                onPointerDown={(e) => onPointerDown('opac', e)}
                onPointerMove={(e) => onPointerMove('opac', e)}
                onPointerUp={onPointerUp}
              >
                <div
                  className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: `${opacity}%`, backgroundColor: currentHex }}
                />
              </div>
            </div>
          </div>

          {/* Hex input + opacity */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 px-2 py-1.5 bg-[#0B0608]/80 border border-[#B76E79]/20 rounded-lg">
              <span className="text-[#EAE0D5]/40 text-xs">Hex</span>
              <input
                type="text"
                value={hexInput}
                onChange={handleHexInput}
                maxLength={7}
                className="flex-1 bg-transparent text-[#EAE0D5] text-xs font-mono focus:outline-none"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center gap-1 px-2 py-1.5 bg-[#0B0608]/80 border border-[#B76E79]/20 rounded-lg w-16">
              <input
                type="number"
                value={opacity}
                min={0}
                max={100}
                onChange={(e) => setOpacity(clamp(parseInt(e.target.value) || 0, 0, 100))}
                className="w-full bg-transparent text-[#EAE0D5] text-xs font-mono focus:outline-none text-right"
              />
              <span className="text-[#EAE0D5]/40 text-xs">%</span>
            </div>
          </div>

          {/* Preset swatches */}
          <div>
            <p className="text-[10px] text-[#EAE0D5]/40 mb-1.5 uppercase tracking-wider">Presets</p>
            <div className="grid grid-cols-10 gap-1">
              {PRESETS.map((hex) => {
                const selected = value && value.toUpperCase() === hex.toUpperCase();
                const light = isLight(hex);
                return (
                  <button
                    key={hex}
                    type="button"
                    title={hex}
                    onClick={() => {
                      const { r, g, b } = hexToRgb(hex);
                      const { h, s, l } = rgbToHsl(r, g, b);
                      setHue(h); setSat(s); setLit(l);
                    }}
                    className={`w-5 h-5 rounded-sm transition-transform hover:scale-125 ${
                      selected ? 'ring-2 ring-[#F2C29A] ring-offset-1 ring-offset-[#1a0d12]' : ''
                    } ${light ? 'border border-white/20' : ''}`}
                    style={{ backgroundColor: hex }}
                  />
                );
              })}
            </div>
          </div>

          {/* Current color preview + close */}
          <div className="flex items-center justify-between pt-1 border-t border-[#B76E79]/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg border border-white/10" style={{ backgroundColor: currentHex }} />
              <span className="text-xs text-[#EAE0D5]/60 font-mono">{currentHex.toUpperCase()}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1.5 bg-[#B76E79]/20 hover:bg-[#B76E79]/40 text-[#F2C29A] rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

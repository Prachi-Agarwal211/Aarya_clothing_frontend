'use client';

import React from 'react';
import Image from 'next/image';
import { Trash2, X, Copy } from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';
import { getHexFromName } from '@/lib/colorMap';
import DropZone from './DropZone';

/**
 * Inline-editable variant row used inside ProductForm.
 *
 * Variant shape (caller-owned):
 *   {
 *     id?           Existing DB id when editing, undefined when new.
 *     size, color, color_hex, sku
 *     quantity, low_stock_threshold
 *     is_active     defaults true on backend
 *     image_url     persisted variant image URL (when editing)
 *     image         { file, preview } for not-yet-uploaded files
 *   }
 *
 * `onCopyImageToColor` lets the user push the chosen image to every other
 * row that already shares the same color name — saves a lot of clicking
 * when you're adding S/M/L/XL of the same colorway.
 */
export default function VariantRow({
  index,
  variant,
  onChange,
  onRemove,
  onCopyImageToColor,
}) {
  const update = (field, value) => onChange(index, { ...variant, [field]: value });

  const handleImagePicked = (files) => {
    const file = files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    onChange(index, {
      ...variant,
      image: { file, preview },
    });
  };

  const clearImage = () => {
    if (variant.image?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(variant.image.preview);
    }
    onChange(index, { ...variant, image: null, image_url: '' });
  };

  const previewUrl = variant.image?.preview || variant.image_url || '';

  return (
    <div className="p-3 bg-[#0B0608]/60 border border-[#B76E79]/10 rounded-xl space-y-3">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Left: image preview / picker */}
        <div className="md:w-32 shrink-0">
          {previewUrl ? (
            <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[#7A2F57]/10 border border-[#B76E79]/30 group">
              <Image
                src={previewUrl}
                alt={`${variant.color || 'variant'} ${variant.size || ''}`.trim()}
                fill
                className="object-cover"
                sizes="128px"
                unoptimized={previewUrl.startsWith('blob:')}
              />
              <button
                type="button"
                onClick={clearImage}
                title="Remove image"
                className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-md text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {onCopyImageToColor && variant.color && (
                <button
                  type="button"
                  onClick={() => onCopyImageToColor(index)}
                  title={`Copy this image to all "${variant.color}" sizes`}
                  className="absolute bottom-1 right-1 p-1 bg-[#7A2F57]/80 rounded-md text-[#F2C29A] opacity-0 group-hover:opacity-100 hover:bg-[#7A2F57] transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <DropZone
              onFiles={handleImagePicked}
              multiple={false}
              compact
              label="+ image"
              id={`variant-image-${index}`}
            />
          )}
        </div>

        {/* Right: editable fields */}
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#EAE0D5]/50 block mb-1">Size</label>
              <input
                type="text"
                placeholder="S, M, L, XL, Free"
                value={variant.size || ''}
                onChange={(e) => update('size', e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
              />
            </div>
            <div>
              <ColorPicker
                value={
                  variant.color_hex || (variant.color ? getHexFromName(variant.color) : null)
                }
                onChange={(hex, name) => {
                  onChange(index, {
                    ...variant,
                    color: name || variant.color,
                    color_hex: hex,
                  });
                }}
                label="Color"
              />
              {variant.color && (
                <p className="text-[11px] text-[#EAE0D5]/50 mt-1">Name: {variant.color}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <label className="text-xs text-[#EAE0D5]/50 block mb-1">Qty</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={variant.quantity ?? ''}
                onChange={(e) => update('quantity', e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
              />
            </div>
            <div className="col-span-4">
              <label className="text-xs text-[#EAE0D5]/50 block mb-1">Low-stock at</label>
              <input
                type="number"
                min="0"
                placeholder="10"
                value={variant.low_stock_threshold ?? ''}
                onChange={(e) => update('low_stock_threshold', e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
              />
            </div>
            <div className="col-span-3 flex items-center gap-2 pb-1">
              <input
                id={`variant-active-${index}`}
                type="checkbox"
                checked={variant.is_active !== false}
                onChange={(e) => update('is_active', e.target.checked)}
                className="w-4 h-4 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
              />
              <label htmlFor={`variant-active-${index}`} className="text-xs text-[#EAE0D5]/70">
                Active
              </label>
            </div>
            <div className="col-span-1 flex items-end pb-0.5">
              <button
                type="button"
                onClick={() => onRemove(index)}
                title="Remove variant"
                className="w-full p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {variant.sku && (
            <p className="text-[11px] text-[#EAE0D5]/40">
              SKU: <span className="font-mono">{variant.sku}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

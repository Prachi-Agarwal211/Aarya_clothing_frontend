'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';

/**
 * Reusable drag-and-drop file picker. Pure UI — never touches the network.
 * Caller decides what to do with the chosen File[] in `onFiles`.
 *
 * Props
 *   onFiles     (files: File[]) => void
 *   accept      MIME-type filter (default 'image/*')
 *   multiple    allow multi-select (default true)
 *   compact     smaller variant for inline use (default false)
 *   label       primary CTA text
 *   sublabel    secondary helper text
 *   id          unique <input> id; auto-generated when omitted
 */
export default function DropZone({
  onFiles,
  accept = 'image/*',
  multiple = true,
  compact = false,
  label = 'Click to upload or drag & drop',
  sublabel = 'JPG, PNG, WebP — multiple images allowed',
  id,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = id || `dropzone-${Math.random().toString(36).slice(2, 9)}`;

  const acceptPredicate = (file) => {
    if (!accept || accept === '*' || accept === '*/*') return true;
    if (accept.endsWith('/*')) {
      const prefix = accept.slice(0, -1);
      return file.type.startsWith(prefix);
    }
    return accept.split(',').some((token) => file.type === token.trim());
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(acceptPredicate);
    if (files.length) onFiles(files);
  };
  const handlePick = (e) => {
    const files = Array.from(e.target.files).filter(acceptPredicate);
    if (files.length) onFiles(files);
    e.target.value = '';
  };

  const sizing = compact ? 'p-4' : 'p-8';
  const iconSize = compact ? 'w-5 h-5 mb-1.5' : 'w-8 h-8 mb-3';

  return (
    <label
      htmlFor={inputId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full flex flex-col items-center justify-center ${sizing} rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
        isDragging
          ? 'border-[#F2C29A] bg-[#B76E79]/20'
          : 'border-[#B76E79]/30 hover:border-[#B76E79]/60 hover:bg-[#B76E79]/5'
      }`}
    >
      <Upload className={`${iconSize} ${isDragging ? 'text-[#F2C29A]' : 'text-[#B76E79]/60'}`} />
      <span className={`${compact ? 'text-xs' : 'text-sm'} text-[#EAE0D5] font-medium ${compact ? '' : 'mb-1'}`}>
        {label}
      </span>
      {!compact && <span className="text-xs text-[#EAE0D5]/50">{sublabel}</span>}
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handlePick}
        className="hidden"
      />
    </label>
  );
}

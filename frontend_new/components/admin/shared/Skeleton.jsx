'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton - Loading placeholder component
 * Used for perceived performance during data loading
 *
 * @param {string} className - Additional CSS classes
 * @param {string} variant - 'text' | 'circular' | 'rounded' | 'square'
 * @param {string} width - Width of skeleton
 * @param {string} height - Height of skeleton
 * @param {number} count - Number of skeleton items to render
 */
export function Skeleton({
  className,
  variant = 'rounded',
  width = 'w-full',
  height = 'h-4',
  count = 1,
}) {
  const variants = {
    text: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-lg',
    square: 'rounded-none',
  };

  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse bg-[#B76E79]/10',
            variants[variant],
            width,
            height,
            className
          )}
          role="status"
          aria-label="Loading"
        />
      ))}
    </>
  );
}

/**
 * TableSkeleton - Pre-built table loading skeleton
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div
      className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden"
      role="status"
      aria-label="Loading data"
    >
      <div className="animate-pulse">
        {/* Table header */}
        <div className="h-12 bg-[#B76E79]/10 border-b border-[#B76E79]/15" />

        {/* Table rows */}
        {[...Array(rows)].map((_, i) => (
          <div
            key={i}
            className="h-14 border-b border-[#B76E79]/10 flex items-center px-4 gap-4"
          >
            {[...Array(columns)].map((_, j) => (
              <div
                key={j}
                className={cn(
                  'h-4 bg-[#B76E79]/10 rounded',
                  j === 0 ? 'w-1/4' : j === 1 ? 'w-1/3' : 'w-1/5'
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CardSkeleton - Pre-built card loading skeleton
 */
export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4 animate-pulse"
        >
          <div className="flex items-center gap-3 mb-3">
            <Skeleton variant="circular" width="w-10" height="w-10" />
            <Skeleton variant="text" width="w-24" height="h-4" />
          </div>
          <Skeleton variant="text" width="w-16" height="h-8" />
        </div>
      ))}
    </div>
  );
}

/**
 * PageSkeleton - Full page loading skeleton
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton variant="text" width="w-48" height="h-8" />
          <Skeleton variant="text" width="w-64" height="h-4" />
        </div>
        <Skeleton variant="rounded" width="w-24" height="h-10" />
      </div>

      {/* Stats cards */}
      <CardSkeleton count={4} />

      {/* Table */}
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

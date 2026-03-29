'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton - Premium loading skeleton component with shimmer effect
 * 
 * Features:
 * - Multiple variants (text, circle, card, image)
 * - Animated shimmer effect (not just pulse)
 * - Customizable dimensions
 * - Dark theme optimized
 */
const Skeleton = ({ 
  className, 
  variant = 'text',
  width,
  height,
  animate = true,
  shimmer = true,
  ...props 
}) => {
  const baseStyles = 'relative overflow-hidden bg-[#1a0a10]';
  
  const variants = {
    text: 'w-full h-4 rounded',
    circle: 'rounded-full',
    card: 'w-full rounded-2xl',
    image: 'rounded-2xl',
    button: 'rounded-xl h-12 w-32',
    avatar: 'rounded-full w-10 h-10',
    thumbnail: 'rounded-lg',
  };

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        animate && 'animate-pulse',
        shimmer && 'skeleton-shimmer',
        className
      )}
      style={{
        width: width,
        height: height,
      }}
      {...props}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <div className="absolute inset-0 shimmer-animation opacity-50" />
      )}
    </div>
  );
};

/**
 * SkeletonCard - Complete card skeleton for products with premium look
 */
export const SkeletonCard = ({ className }) => (
  <div className={cn('space-y-4', className)}>
    <Skeleton variant="image" className="aspect-[3/4] w-full rounded-2xl" />
    <div className="space-y-2 px-2">
      <Skeleton variant="text" className="w-1/3 h-3" />
      <Skeleton variant="text" className="w-full h-4" />
      <Skeleton variant="text" className="w-1/2 h-4" />
      <Skeleton variant="text" className="w-1/4 h-5 mt-2" />
    </div>
  </div>
);

/**
 * SkeletonProductGrid - Grid of product card skeletons
 */
export const SkeletonProductGrid = ({ count = 4, className }) => (
  <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

/**
 * SkeletonHero - Hero section skeleton
 */
export const SkeletonHero = ({ className }) => (
  <div className={cn('min-h-screen flex flex-col justify-end p-8', className)}>
    <Skeleton variant="image" className="absolute inset-0" />
    <div className="relative z-10 flex gap-4 justify-center">
      <Skeleton variant="button" className="w-40 h-14 rounded-full" />
      <Skeleton variant="button" className="w-40 h-14 rounded-full" />
    </div>
  </div>
);

/**
 * SkeletonTextBlock - Text content skeleton
 */
export const SkeletonTextBlock = ({ lines = 3, className }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton 
        key={i} 
        variant="text" 
        className={i === lines - 1 ? 'w-2/3' : 'w-full'} 
      />
    ))}
  </div>
);

/**
 * SkeletonTable - Table skeleton for admin pages
 */
export const SkeletonTable = ({ rows = 5, columns = 4, className }) => (
  <div className={cn('space-y-3', className)}>
    {/* Header */}
    <div className="flex gap-4 p-4 bg-[#0B0608]/40 rounded-xl">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="text" className="flex-1 h-4" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4 p-4 bg-[#0B0608]/40 rounded-xl">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" className="flex-1 h-4" />
        ))}
      </div>
    ))}
  </div>
);

/**
 * SkeletonDashboard - Dashboard stats skeleton
 */
export const SkeletonDashboard = ({ className }) => (
  <div className={cn('space-y-6', className)}>
    {/* Stats Grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-6 bg-[#0B0608]/40 rounded-2xl space-y-3">
          <Skeleton variant="text" className="w-1/2 h-3" />
          <Skeleton variant="text" className="w-3/4 h-8" />
        </div>
      ))}
    </div>
    {/* Charts Area */}
    <div className="grid md:grid-cols-2 gap-6">
      <Skeleton variant="card" className="h-64" />
      <Skeleton variant="card" className="h-64" />
    </div>
  </div>
);

/**
 * SkeletonProductDetail - Product detail page skeleton
 */
export const SkeletonProductDetail = ({ className }) => (
  <div className={cn('grid md:grid-cols-2 gap-8', className)}>
    {/* Images */}
    <div className="space-y-4">
      <Skeleton variant="image" className="aspect-[3/4] w-full rounded-2xl" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="thumbnail" className="w-20 h-24" />
        ))}
      </div>
    </div>
    {/* Content */}
    <div className="space-y-6">
      <Skeleton variant="text" className="w-1/3 h-3" />
      <Skeleton variant="text" className="w-full h-8" />
      <Skeleton variant="text" className="w-1/4 h-6" />
      <SkeletonTextBlock lines={4} />
      <div className="flex gap-4">
        <Skeleton variant="button" className="w-32 h-12 rounded-full" />
        <Skeleton variant="button" className="w-32 h-12 rounded-full" />
      </div>
    </div>
  </div>
);

/**
 * SkeletonCheckout - Checkout page skeleton
 */
export const SkeletonCheckout = ({ className }) => (
  <div className={cn('grid lg:grid-cols-3 gap-8', className)}>
    <div className="lg:col-span-2 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 bg-[#0B0608]/40 rounded-2xl flex gap-4">
          <Skeleton variant="thumbnail" className="w-24 h-28" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-3/4" />
            <Skeleton variant="text" className="w-1/2" />
            <Skeleton variant="text" className="w-1/4" />
          </div>
        </div>
      ))}
    </div>
    <div className="p-6 bg-[#0B0608]/40 rounded-2xl space-y-4">
      <Skeleton variant="text" className="w-1/2 h-6" />
      <SkeletonTextBlock lines={4} />
      <Skeleton variant="button" className="w-full h-12" />
    </div>
  </div>
);

export default Skeleton;

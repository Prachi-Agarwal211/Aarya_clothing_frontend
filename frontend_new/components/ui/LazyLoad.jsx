'use client';

import React, { Suspense } from 'react';

/**
 * Skeleton Loader Component
 * Provides visual placeholder during lazy loading
 */
export function SkeletonLoader({ className = '' }) {
  return (
    <div 
      className={`skeleton ${className}`}
      role="status"
      aria-label="Loading content"
    />
  );
}

/**
 * Lazy Load Component Wrapper
 * Wraps components with Suspense and provides skeleton loading state
 * 
 * @param {Object} props
 * @param {React.ComponentType} props.component - Component to lazy load
 * @param {string} props.className - CSS class for skeleton container
 * @param {string} props.skeletonHeight - Height of skeleton loader
 * @param {string} props.ariaLabel - ARIA label for loading state
 */
export function LazyLoad({ 
  children, 
  className = '', 
  skeletonHeight = '300px',
  ariaLabel = 'Loading content'
}) {
  return (
    <Suspense
      fallback={
        <SkeletonLoader 
          className={`w-full ${className}`} 
          style={{ height: skeletonHeight }}
        />
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * Dynamic Import Helper with Loading State
 * Use with React.lazy for better code splitting
 * 
 * @param {string} importPath - Path to component
 * @param {string} skeletonHeight - Height of skeleton loader
 */
export function lazyWithSkeleton(importPath, skeletonHeight = '300px') {
  return React.lazy(() => import(importPath));
}

/**
 * Image Skeleton - Specific skeleton for image placeholders
 */
export function ImageSkeleton({ aspectRatio = '3/4', className = '' }) {
  return (
    <div 
      className={`relative skeleton ${className}`}
      style={{ aspectRatio: aspectRatio }}
      role="status"
      aria-label="Loading image"
    />
  );
}

/**
 * Text Skeleton - For text content placeholders
 */
export function TextSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLoader 
          key={i} 
          className={`skeleton-text ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  );
}

/**
 * Card Skeleton - For product/card placeholders
 */
export function CardSkeleton({ count = 4, className = '' }) {
  return (
    <div className={`grid gap-6 ${className}`} role="status" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <ImageSkeleton aspectRatio="3/4" className="rounded-2xl" />
          <TextSkeleton lines={2} />
        </div>
      ))}
    </div>
  );
}

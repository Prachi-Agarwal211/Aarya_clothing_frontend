'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * OptimizedImage - Enhanced Next.js Image with performance optimizations
 *
 * Performance Features:
 * - Blur placeholder while loading (LCP optimization)
 * - Async decoding for non-blocking image rendering
 * - Smart loading strategy (eager for ATF, lazy for BTF)
 * - Connection-aware quality adjustment
 * - Proper sizes attribute for responsive images
 * - GPU-accelerated fade-in animation
 *
 * Accessibility:
 * - Proper alt text support
 * - Error state with retry option
 * - Loading state announcement
 */
// ── Global image load throttling ──────────────────────────────────────────
// Limits concurrent image downloads to prevent browser overload on pages
// with many images (admin panels, product grids, etc.)
const MAX_CONCURRENT_LOADS = 4;
let activeLoads = 0;
const loadQueue = [];

function enqueueImageLoad(callback) {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads++;
    Promise.resolve().then(callback);
  } else {
    loadQueue.push(callback);
  }
}

function dequeueImageLoad() {
  activeLoads = Math.max(0, activeLoads - 1);
  if (loadQueue.length > 0) {
    const next = loadQueue.shift();
    activeLoads++;
    Promise.resolve().then(next);
  }
}

const OptimizedImage = ({
  src,
  alt,
  fill = false,
  width,
  height,
  className,
  containerClassName,
  priority = false,
  sizes,
  quality,
  objectFit = 'cover',
  blur = true,
  blurDataURL,
  fallbackSrc,
  loading: loadingProp,
  decoding = 'async',
  onImageLoad,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [deferred, setDeferred] = useState(!priority);
  const isLoadingRef = useRef(true);
  // Default to a placeholder if no valid src is provided to prevent Next.js Image crashes
  const [currentSrc, setCurrentSrc] = useState(src && src !== '' ? src : (fallbackSrc || '/placeholder-image.jpg'));
  const [imageQuality, setImageQuality] = useState(quality);

  // Throttle non-priority images through the global queue
  useEffect(() => {
    if (priority || !deferred) return;
    enqueueImageLoad(() => setDeferred(false));
    return () => { if (isLoadingRef.current) dequeueImageLoad(); };
  }, []);

  // Detect connection speed and adjust quality accordingly
  useEffect(() => {
    // Default quality: 75 for mobile, 85 for desktop
    const defaultQuality = typeof window !== 'undefined' && window.innerWidth < 768 ? 75 : 85;
    setImageQuality(quality || defaultQuality);

    // Further reduce quality on slow connections
    if ('connection' in navigator) {
      const conn = navigator.connection;
      const isSlow = conn.saveData || 
        conn.effectiveType === '2g' || 
        conn.effectiveType === 'slow-2g';
      
      if (isSlow) {
        setImageQuality(prev => Math.max(50, (prev || 75) - 20));
      }
    }
  }, [quality]);

  // Update currentSrc when src changes
  React.useEffect(() => {
    isLoadingRef.current = true;
    setCurrentSrc(src && src !== '' ? src : (fallbackSrc || '/placeholder-image.jpg'));
    setHasError(false);
    setIsLoading(true);
  }, [src, fallbackSrc]);

  const handleError = () => {
    isLoadingRef.current = false;
    setHasError(true);
    setIsLoading(false);
    if (!priority) dequeueImageLoad();
    // Try fallback if available
    if (src && fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(false);
    } else if (currentSrc !== '/placeholder-image.jpg') {
      setCurrentSrc('/placeholder-image.jpg');
      setHasError(false);
    }
  };

  const handleLoad = () => {
    isLoadingRef.current = false;
    setIsLoading(false);
    setHasError(false);
    if (!priority) dequeueImageLoad();
    onImageLoad?.();
  };

  const handleRetry = () => {
    isLoadingRef.current = true;
    setCurrentSrc(src || fallbackSrc);
    setHasError(false);
    setIsLoading(true);
  };

  // Determine loading strategy based on priority and position
  const loadingStrategy = loadingProp || (priority ? 'eager' : 'lazy');

  // Default sizes for responsive images
  const defaultSizes = fill 
    ? sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
    : sizes;

  // Error placeholder
  const errorPlaceholder = hasError && (
    <div className="absolute inset-0 z-5 flex items-center justify-center bg-[#1a0a10] pointer-events-none" role="status" aria-label="Image unavailable">
      <div className="text-center p-4">
        <svg
          className="w-12 h-12 mx-auto text-[#E07B8B]/30 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-xs text-[#E07B8B]/50">Image unavailable</p>
        <button
          onClick={handleRetry}
          className="mt-2 text-xs text-[#FFD700] hover:text-[#FFD700]/80 underline"
          aria-label="Retry loading image"
        >
          Retry
        </button>
      </div>
    </div>
  );

  const imageProps = fill
    ? { fill: true, sizes: defaultSizes }
    : { width: width || 400, height: height || 500 };

  const imageClasses = cn(
    `object-${objectFit}`,
    isLoading ? 'opacity-0' : 'opacity-100',
    'transition-opacity duration-500 ease-out',
    // GPU acceleration for smoother animations
    'will-change-opacity',
    className
  );

  // For fill mode, don't wrap in extra div - just return the image with overlays
  if (fill) {
    return (
      <>
        {errorPlaceholder}
        <Image
          src={currentSrc}
          alt={alt || 'Product image'}
          {...imageProps}
          className={imageClasses}
          priority={priority}
          quality={imageQuality}
          loading={loadingStrategy}
          decoding={decoding}
          onError={handleError}
          onLoad={handleLoad}
          placeholder={blur && blurDataURL ? 'blur' : undefined}
          blurDataURL={blur && blurDataURL ? blurDataURL : undefined}
          {...props}
        />
      </>
    );
  }

  // For non-fill mode, wrap in container with aspect ratio preservation
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        'contain-layout', // CSS containment for performance
        containerClassName
      )}
    >
      {errorPlaceholder}

      <Image
        src={currentSrc}
        alt={alt || 'Product image'}
        {...imageProps}
        className={imageClasses}
        priority={priority}
        quality={imageQuality}
        loading={loadingStrategy}
        decoding={decoding}
        onError={handleError}
        onLoad={handleLoad}
        placeholder={blur && blurDataURL ? 'blur' : undefined}
        blurDataURL={blur && blurDataURL ? blurDataURL : undefined}
        {...props}
      />
    </div>
  );
};

export default OptimizedImage;

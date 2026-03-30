'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * OptimizedImage - Enhanced Next.js Image with blur placeholder
 * 
 * Features:
 * - Shimmer loading effect
 * - Blur placeholder while loading
 * - Error handling
 */
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
  quality = 85,
  objectFit = 'cover',
  blur = true,
  fallbackSrc,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // Default to a placeholder if no valid src is provided to prevent Next.js Image crashes
  const [currentSrc, setCurrentSrc] = useState(src && src !== '' ? src : (fallbackSrc || '/placeholder-image.jpg'));

  // Update currentSrc when src changes
  React.useEffect(() => {
    setCurrentSrc(src && src !== '' ? src : (fallbackSrc || '/placeholder-image.jpg'));
    setHasError(false);
    setIsLoading(true);
  }, [src, fallbackSrc]);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
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
    setIsLoading(false);
    setHasError(false);
  };

  const handleRetry = () => {
    setCurrentSrc(src || fallbackSrc);
    setHasError(false);
    setIsLoading(true);
  };

  // Error placeholder
  const errorPlaceholder = hasError && (
    <div className="absolute inset-0 z-5 flex items-center justify-center bg-[#1a0a10] pointer-events-none">
      <div className="text-center p-4">
        <svg
          className="w-12 h-12 mx-auto text-[#B76E79]/30 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-xs text-[#B76E79]/50">Image unavailable</p>
      </div>
    </div>
  );

  const imageProps = fill
    ? { fill: true, sizes: sizes || '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw' }
    : { width: width || 400, height: height || 500 };

  const imageClasses = cn(
    `object-${objectFit}`,
    isLoading ? 'opacity-0' : 'opacity-100',
    'transition-opacity duration-500',
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
          quality={quality}
          onError={handleError}
          onLoad={handleLoad}
          {...props}
        />
      </>
    );
  }

  // For non-fill mode, wrap in container
  return (
    <div
      className={cn(
        'relative overflow-hidden',
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
        quality={quality}
        onError={handleError}
        onLoad={handleLoad}
        {...props}
      />
    </div>
  );
};

export default OptimizedImage;

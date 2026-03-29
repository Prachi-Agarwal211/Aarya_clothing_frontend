'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Shared viewport detection hook.
 * Uses matchMedia for efficient, SSR-safe breakpoint detection.
 * Prevents downloading unused assets by providing device-type flags.
 *
 * Breakpoints:
 *   mobile  < 768px
 *   tablet  768–1023px
 *   desktop >= 1024px
 */
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    isTablet:
      typeof window !== 'undefined'
        ? window.innerWidth >= 768 && window.innerWidth < 1024
        : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  });

  const handleResize = useCallback(() => {
    if (typeof window === 'undefined') return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    setViewport({
      width: w,
      height: h,
      isMobile: w < 768,
      isTablet: w >= 768 && w < 1024,
      isDesktop: w >= 1024,
    });
  }, []);

  useEffect(() => {
    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);

  return viewport;
}

export default useViewport;

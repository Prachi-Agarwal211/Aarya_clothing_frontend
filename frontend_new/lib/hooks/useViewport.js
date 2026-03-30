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

    // Only update if breakpoint changed - prevents unnecessary re-renders
    setViewport(prev => {
      const newIsMobile = w < 768;
      const newIsTablet = w >= 768 && w < 1024;
      const newIsDesktop = w >= 1024;
      
      // Only update state if breakpoint actually changed
      if (prev.isMobile === newIsMobile && 
          prev.isTablet === newIsTablet && 
          prev.isDesktop === newIsDesktop &&
          Math.abs(prev.width - w) < 10 &&  // Allow small width changes without re-render
          Math.abs(prev.height - h) < 10) {
        return prev;
      }
      
      return {
        width: w,
        height: h,
        isMobile: newIsMobile,
        isTablet: newIsTablet,
        isDesktop: newIsDesktop,
      };
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

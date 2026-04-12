'use client';

import { useState, useEffect, useCallback, useLayoutEffect } from 'react';

/**
 * Shared viewport detection hook.
 * Uses matchMedia for efficient, SSR-safe breakpoint detection.
 * Prevents downloading unused assets by providing device-type flags.
 *
 * SSR defaults to mobile-first (isMobile: true) to avoid desktop→mobile
 * flash on hydration. The true value is set synchronously in useLayoutEffect
 * before the first paint on client.
 *
 * Breakpoints:
 *   mobile  < 768px
 *   tablet  768–1023px
 *   desktop >= 1024px
 */
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    isMobile: true,
    isTablet: false,
    isDesktop: false,
  });

  // useLayoutEffect runs synchronously before first paint — snaps to correct
  // viewport immediately, preventing SSR hydration flash.
  useLayoutEffect(() => {
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

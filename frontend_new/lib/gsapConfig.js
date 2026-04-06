/**
 * GSAP Configuration - Centralized imports and plugin registration
 *
 * This file provides a single entry point for GSAP imports across the application.
 * Benefits:
 * - Single plugin registration (prevents duplicate registrations)
 * - Smaller bundle size through tree-shaking
 * - Consistent animation configuration
 * - Easier maintenance and updates
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - force3D: true for GPU acceleration on all animations
 * - lazyLoad: true to defer animation initialization
 * - Mobile-specific settings for better battery life
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Draggable } from 'gsap/Draggable';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

// Register plugins only on client side
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, Draggable, MotionPathPlugin);

  // PERFORMANCE: Global GSAP performance settings
  // NOTE: force3D is deprecated in GSAP 3.12+ (now automatic)
  // Using gsap.ticker.fps() for performance instead
  gsap.defaults({
    lazy: true, // Lazy load animations
  });
}

// PERFORMANCE: Mobile detection utility
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Default animation configuration for consistency
export const animationConfig = {
  // Default easing curves
  ease: {
    smooth: 'power2.out',
    bounce: 'back.out(1.7)',
    elegant: 'power3.out',
    snappy: 'power4.out',
  },
  // Default durations - slightly longer on mobile for perceived smoothness
  duration: {
    fast: 0.3,
    normal: 0.5,
    slow: 0.8,
    dramatic: 1.2,
  },
  // Default stagger values
  stagger: {
    fast: 0.05,
    normal: 0.1,
    slow: 0.15,
  },
  // ScrollTrigger defaults
  scrollTrigger: {
    start: 'top 80%',
    end: 'bottom 20%',
    toggleActions: 'play none none reverse',
  },
  // PERFORMANCE: Mobile-specific optimizations
  mobileContext: {
    durationMultiplier: 1.2, // Slightly slower on mobile for battery
    reduceMotion: false, // Keep animations but optimize them
    // NOTE: force3D removed - GSAP 3.12+ handles GPU acceleration automatically
  },
};

// Export gsap and plugins for use in components
export { gsap, ScrollTrigger, ScrollToPlugin, Draggable };

/**
 * Helper function to create consistent scroll-triggered animations
 * @param {HTMLElement} element - Target element
 * @param {Object} fromVars - Starting animation values
 * @param {Object} toVars - Ending animation values
 * @param {Object} scrollConfig - ScrollTrigger configuration
 */
export function createScrollAnimation(element, fromVars, toVars, scrollConfig = {}) {
  // PERFORMANCE: Apply mobile optimizations if needed
  const isMobileDevice = isMobile();
  const durationMultiplier = isMobileDevice ? animationConfig.mobileContext.durationMultiplier : 1;

  return gsap.fromTo(element, fromVars, {
    ...toVars,
    duration: (toVars.duration || 1) * durationMultiplier,
    scrollTrigger: {
      trigger: element,
      ...animationConfig.scrollTrigger,
      ...scrollConfig,
    },
  });
}

/**
 * Helper to create staggered animations
 * @param {HTMLElement[]} elements - Array of target elements
 * @param {Object} fromVars - Starting animation values
 * @param {Object} toVars - Ending animation values
 * @param {string} staggerType - 'fast', 'normal', or 'slow'
 */
export function createStaggerAnimation(elements, fromVars, toVars, staggerType = 'normal') {
  // PERFORMANCE: Apply mobile optimizations
  const isMobileDevice = isMobile();
  const durationMultiplier = isMobileDevice ? animationConfig.mobileContext.durationMultiplier : 1;

  return gsap.fromTo(elements, fromVars, {
    ...toVars,
    duration: (toVars.duration || 1) * durationMultiplier,
    stagger: animationConfig.stagger[staggerType],
  });
}

/**
 * Cleanup helper for React components
 * Call this in useEffect cleanup to properly kill all animations
 * @param {gsap.Context} context - GSAP context from gsap.context()
 */
export function cleanupAnimations(context) {
  if (context) {
    context.revert();
  }
  // Also kill all ScrollTriggers for this component
  ScrollTrigger.getAll().forEach(trigger => {
    if (trigger.trigger && !document.body.contains(trigger.trigger)) {
      trigger.kill();
    }
  });
}

export default {
  gsap,
  ScrollTrigger,
  ScrollToPlugin,
  Draggable,
  animationConfig,
  createScrollAnimation,
  createStaggerAnimation,
  cleanupAnimations,
  isMobile,
};

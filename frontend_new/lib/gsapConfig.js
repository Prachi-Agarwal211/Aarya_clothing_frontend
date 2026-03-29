/**
 * GSAP Configuration - Centralized imports and plugin registration
 * 
 * This file provides a single entry point for GSAP imports across the application.
 * Benefits:
 * - Single plugin registration (prevents duplicate registrations)
 * - Smaller bundle size through tree-shaking
 * - Consistent animation configuration
 * - Easier maintenance and updates
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Draggable } from 'gsap/Draggable';

// Register plugins only on client side
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, Draggable);
}

// Default animation configuration for consistency
export const animationConfig = {
  // Default easing curves
  ease: {
    smooth: 'power2.out',
    bounce: 'back.out(1.7)',
    elegant: 'power3.out',
    snappy: 'power4.out',
  },
  // Default durations
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
  return gsap.fromTo(element, fromVars, {
    ...toVars,
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
  return gsap.fromTo(elements, fromVars, {
    ...toVars,
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
};

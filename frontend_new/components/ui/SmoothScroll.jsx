'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsapConfig';

/**
 * SmoothScrollProvider - Adds smooth scroll behavior with GSAP ScrollSmoother
 * 
 * Features:
 * - Smooth scrolling with momentum
 * - Scroll-triggered animations
 * - Performance optimized
 * 
 * Note: This is a lightweight implementation. For full ScrollSmoother,
 * you need GSAP ScrollSmoother plugin (paid).
 */
const SmoothScrollProvider = ({ children }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      return; // Skip smooth scroll for accessibility
    }

    // Simple smooth scroll for anchor links
    const handleAnchorClick = (e) => {
      const target = e.target.closest('a[href^="#"]');
      if (target) {
        e.preventDefault();
        const id = target.getAttribute('href').slice(1);
        const element = document.getElementById(id);
        if (element) {
          gsap.to(window, {
            duration: 1,
            scrollTo: { y: element, offsetY: 80 },
            ease: 'power3.inOut'
          });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    
    return () => {
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  return (
    <div ref={scrollRef} className="smooth-scroll-container">
      {children}
    </div>
  );
};

/**
 * ScrollToTop - Button to scroll back to top
 */
export const ScrollToTop = ({ 
  showAfter = 300, 
  className = '' 
}) => {
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > showAfter);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showAfter]);

  const scrollToTop = () => {
    gsap.to(window, {
      duration: 1,
      scrollTo: { y: 0 },
      ease: 'power3.inOut'
    });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed bottom-8 right-8 z-50
        p-3 rounded-full
        bg-gradient-to-r from-[#7A2F57] to-[#B76E79]
        text-white
        shadow-lg shadow-[#7A2F57]/30
        hover:shadow-xl hover:shadow-[#B76E79]/40
        transform hover:scale-110
        transition-all duration-300
        ${className}
      `}
      aria-label="Scroll to top"
    >
      <svg 
        className="w-5 h-5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M5 10l7-7m0 0l7 7m-7-7v18" 
        />
      </svg>
    </button>
  );
};

/**
 * ScrollProgress - Progress bar at top of page
 */
export const ScrollProgress = ({ className = '' }) => {
  const progressRef = useRef(null);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      
      if (progressRef.current) {
        progressRef.current.style.width = `${progress}%`;
      }
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return (
    <div 
      className={`
        fixed top-0 left-0 right-0 h-1 z-[100]
        bg-[#050203]/50
        ${className}
      `}
    >
      <div 
        ref={progressRef}
        className="h-full bg-gradient-to-r from-[#7A2F57] via-[#B76E79] to-[#F2C29A] transition-all duration-100"
        style={{ width: '0%' }}
      />
    </div>
  );
};

/**
 * FadeInSection - Wrapper for fade-in on scroll animations
 */
export const FadeInSection = ({ 
  children, 
  className = '',
  delay = 0,
  direction = 'up', // up, down, left, right
  distance = 50,
  duration = 0.8,
}) => {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const directions = {
      up: { y: distance },
      down: { y: -distance },
      left: { x: distance },
      right: { x: -distance },
    };

    const ctx = gsap.context(() => {
      gsap.fromTo(element,
        { 
          opacity: 0, 
          ...directions[direction] 
        },
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });

    return () => ctx.revert();
  }, [delay, direction, distance, duration]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};

export default SmoothScrollProvider;

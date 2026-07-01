'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsapConfig';
import { Button } from '../ui/button';
import OptimizedImage from '../ui/OptimizedImage';
import { useViewport } from '@/lib/hooks/useViewport';
import { MagneticButton } from '../ui/MagneticButton';

/**
 * HeroSection - Full viewport hero with image carousel
 *
 * ARCHITECTURE: All data comes from backend API via props.
 * No hard-coded defaults - parent component provides all data.
 *
 * Features:
 * - Full viewport (100vh) image carousel
 * - Mobile-optimized: serves 9:16 images on mobile, 16:9 on desktop
 * - Tagline overlaid at top
 * - Buttons overlaid at bottom
 * - Modern GSAP scroll animations
 * - Parallax effects
 * - Proper cleanup for all animations
 * 
 * Accessibility:
 * - ARIA labels for carousel
 * - Keyboard navigation support
 * - Reduced motion support
 * - Proper heading hierarchy
 */
const HeroSection = ({
  tagline,
  slides = [],
  buttons = []
}) => {
  const sectionRef = useRef(null);
  const slideRefs = useRef([]);
  const buttonContainerRef = useRef(null);
  const taglineRef = useRef(null);
  const currentSlide = useRef(0);
  const autoPlayRef = useRef(null);
  const slideAnimationRefs = useRef([]); // Track GSAP animations for cleanup
  const isMountedRef = useRef(true);
  const [activeSlide, setActiveSlide] = useState(0);

  // Detect mobile for responsive image source
  const { isMobile } = useViewport();

  const reduceMotion = prefersReducedMotion();

  // Auto-rotate slides with proper cleanup
  const nextSlide = useCallback(() => {
    if (!isMountedRef.current || !slides.length || slides.length < 2) return;

    const next = (currentSlide.current + 1) % slides.length;
    const outgoingSlide = slideRefs.current[currentSlide.current];
    const incomingSlide = slideRefs.current[next];

    // Guard: ensure both refs exist before animation
    if (!outgoingSlide || !incomingSlide) return;

    gsap.killTweensOf([outgoingSlide, incomingSlide]);

    if (reduceMotion) {
      // Instant switch for reduced motion / perf
      if (outgoingSlide) gsap.set(outgoingSlide, { opacity: 0, y: 0 });
      if (incomingSlide) gsap.set(incomingSlide, { opacity: 1, y: 0 });
      currentSlide.current = next;
      return;
    }

    // Create new animations and track them
    // GPU acceleration is automatic in GSAP 3.12+
    const outAnim = gsap.to(outgoingSlide, {
      opacity: 0,
      y: -50,
      duration: 1,
      ease: 'power2.inOut'
    });

    const inAnim = gsap.fromTo(incomingSlide,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power2.out'
      }
    );

    slideAnimationRefs.current = [outAnim, inAnim];
    currentSlide.current = next;
    setActiveSlide(next);
  }, [slides.length, reduceMotion]);

  useEffect(() => {
    // OPTIMIZATION: Increased interval to 15000ms for better user experience
    autoPlayRef.current = setInterval(nextSlide, 15000);

    // ScrollTrigger to pause auto-rotation when out of view
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top -50%",
        onLeave: () => {
          if (autoPlayRef.current) {
            clearInterval(autoPlayRef.current);
            autoPlayRef.current = null;
          }
        },
        onEnterBack: () => {
          if (!autoPlayRef.current) {
            autoPlayRef.current = setInterval(nextSlide, 15000);
          }
        }
      });
    });

    // ENHANCEMENT: Pause auto-rotation on hover for better desktop UX
    const section = sectionRef.current;
    const handleMouseEnter = () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
    const handleMouseLeave = () => {
      if (!autoPlayRef.current) {
        autoPlayRef.current = setInterval(nextSlide, 15000);
      }
    };
    
    if (section) {
      section.addEventListener('mouseenter', handleMouseEnter);
      section.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      // Kill any pending slide animations
      slideAnimationRefs.current.forEach(anim => {
        if (anim && anim.kill) anim.kill();
      });
      slideAnimationRefs.current = [];
      // Remove event listeners
      if (section) {
        section.removeEventListener('mouseenter', handleMouseEnter);
        section.removeEventListener('mouseleave', handleMouseLeave);
      }
      ctx.revert();
    };
  }, [nextSlide]);

  // Entrance animations
  useEffect(() => {
    if (reduceMotion) {
      // Instant for a11y/perf
      if (slideRefs.current[0]) gsap.set(slideRefs.current[0], { opacity: 1, y: 0 });
      if (taglineRef.current) gsap.set(taglineRef.current, { y: 0, opacity: 1 });
      if (buttonContainerRef.current) {
        const buttons = Array.from(buttonContainerRef.current.children);
        gsap.set(buttons, { y: 0, opacity: 1 });
      }
      return;
    }

    // Use gsap.context for proper cleanup in React
    let ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.3 });

      // First slide entrance
      if (slideRefs.current[0]) {
        tl.fromTo(slideRefs.current[0],
          { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }
        );
      }

      // Tagline entrance (from top)
      if (taglineRef.current) {
        tl.fromTo(taglineRef.current,
          { y: -30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
          "-=0.6"
        );
      }

      // Buttons entrance (staggered, from bottom)
      // NOTE: Convert HTMLCollection to Array to fix GSAP "target not found" warning
      if (buttonContainerRef.current) {
        const buttons = Array.from(buttonContainerRef.current.children);
        tl.fromTo(buttons,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out' },
          "-=0.4"
        );
      }
    });

    return () => ctx.revert(); // Cleanup GSAP animations
  }, [reduceMotion]);

  // Parallax scroll effect
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Use gsap.context for proper cleanup
    let ctx = gsap.context(() => {
      const targets = section.querySelectorAll('.parallax-layer');
      if (targets.length > 0) {
        gsap.to(targets, {
          yPercent: -20,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: true
          }
        });
      }
    });

    return () => ctx.revert(); // Cleanup GSAP animations
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Kill all GSAP animations on slides
      slideRefs.current.forEach(slide => {
        if (slide) gsap.killTweensOf(slide);
      });
    };
  }, []);

  /**
   * Pick the right image for the current viewport.
   * Each slide may have:
   *   - slide.image       (desktop 16:9)
   *   - slide.imageMobile  (mobile 9:16)
   * Falls back to whichever is available.
   */
  const getSlideImage = (slide) => {
    if (isMobile) {
      return slide.imageMobile || slide.image;
    }
    return slide.image || slide.imageMobile;
  };

  return (
    <section
      ref={sectionRef}
      className="relative h-screen h-dvh w-full"
      aria-label="Hero section"
      role="region"
    >
      {/* Slides - Full viewport */}
      {slides.map((slide, index) => {
            const imgSrc = getSlideImage(slide);
        return (
          <div
            key={index}
            ref={el => slideRefs.current[index] = el}
            className={`
              absolute inset-0 parallax-layer
              ${index === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}
            `}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${index + 1} of ${slides.length}`}
            aria-hidden={index !== currentSlide.current}
          >
            {/* Image - Full viewport with OptimizedImage for blur placeholders, error recovery, connection-aware quality */}
              {imgSrc && (
              <div className="absolute inset-0 aspect-[9/16] md:aspect-[16/9]">
                <OptimizedImage
                  src={imgSrc}
                  alt={slide.alt || `Hero slide ${index + 1}`}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 100vw"
                  className="object-cover object-top"
                  blur={true}
                />
                {/* Layered gradient overlay — top + bottom vignette + radial depth */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: 'linear-gradient(to bottom, rgba(5,2,3,0.35) 0%, transparent 30%, transparent 70%, rgba(5,2,3,0.45) 100%), radial-gradient(ellipse at center, transparent 50%, rgba(5,2,3,0.25) 100%)' }} />
              </div>
            )}
          </div>
        );
      })}

      {/* Subtle ambient glow — very low opacity for depth without distraction */}
      <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[100px]" />
      </div>

      {/* Slide indicators — dots for carousel */}
      {slides.length > 1 && (
        <div className="absolute bottom-16 sm:bottom-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2" aria-label="Slide indicators">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-500 ${i === activeSlide ? 'w-6 h-1.5 bg-[#FFD700]' : 'w-1.5 h-1.5 bg-[#F5F5F5]/30'}`}
            />
          ))}
        </div>
      )}

      {/* Transition gradient — smooth fade from hero into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 sm:h-40 bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent z-20 pointer-events-none" aria-hidden="true" />

      {/* Scroll-Down Indicator — animated chevron at bottom of hero */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 animate-bounce" aria-hidden="true">
        <span className="text-white/25 text-[10px] tracking-[0.3em] uppercase" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>Scroll</span>
        <svg className="w-5 h-5 text-[#FFD700]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" /></svg>
      </div>

      {/* Tagline and Buttons Container */}
      <div className="absolute bottom-24 sm:bottom-20 left-0 right-0 z-30 w-full px-4">
        {/* Tagline - Just above the buttons */}
        <div
          ref={taglineRef}
          className="text-center mb-6 sm:mb-8"
        >
          {/* Decorative line above tagline */}
          <div className="flex items-center justify-center gap-4 mb-4" aria-hidden="true">
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#E07B8B]/50" />
            <div className="w-2 h-2 rounded-full bg-[#FFD700]/30" />
            <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#E07B8B]/50" />
          </div>
          <p
            className="text-white/80 text-xs sm:text-sm md:text-base tracking-[0.25em] sm:tracking-[0.35em] uppercase font-light px-2"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            {tagline}
          </p>
          {/* Decorative line below tagline */}
          <div className="flex items-center justify-center gap-4 mt-4" aria-hidden="true">
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#E07B8B]/50" />
            <div className="w-2 h-2 rounded-full bg-[#FFD700]/30" />
            <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#E07B8B]/50" />
          </div>
        </div>

        {/* Buttons Container */}
        <div
          ref={buttonContainerRef}
          className="w-full max-w-2xl mx-auto"
          role="navigation"
          aria-label="Hero actions"
        >
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
            {buttons.map((btn, index) => (
              <MagneticButton key={index}>
                <Button
                  variant={btn.variant || 'heroLuxury'}
                  size="hero"
                  href={btn.link}
                >
                  {btn.text}
                </Button>
              </MagneticButton>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

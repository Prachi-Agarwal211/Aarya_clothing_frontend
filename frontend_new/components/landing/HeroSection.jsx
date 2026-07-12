'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsapConfig';
import { Button } from '../ui/button';
import OptimizedImage from '../ui/OptimizedImage';
import { useViewport } from '@/lib/hooks/useViewport';
import { MagneticButton } from '../ui/MagneticButton';

/** Chevron left — side nav */
function ChevronLeftIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 6L9 12L15 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Scroll cue — mouse + chevron */
function ScrollCueIcon() {
  return (
    <svg width="20" height="32" viewBox="0 0 20 32" fill="none" aria-hidden="true" className="text-white/50">
      <rect x="1" y="1" width="18" height="28" rx="9" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="10" cy="9" r="1.75" fill="currentColor" className="animate-pulse" />
      <path
        d="M10 18v6M7.5 21.5L10 24l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

/** Ornamental gold diamond separator */
function OrnamentLine() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <span className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-[#A8B4C8]/50" />
      <svg width="8" height="8" viewBox="0 0 8 8" className="text-[#D4AF37]/70">
        <path d="M4 0L8 4L4 8L0 4Z" fill="currentColor" />
      </svg>
      <span className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-[#A8B4C8]/50" />
    </div>
  );
}

/**
 * HeroSection — full-viewport carousel.
 * Bottom dock is a SINGLE column (tagline → CTAs → dots → scroll)
 * so dots and button text never collide on mobile or laptop.
 */
const HeroSection = ({ tagline, slides = [], buttons = [] }) => {
  const sectionRef = useRef(null);
  const slideRefs = useRef([]);
  const dockRef = useRef(null);
  const currentSlide = useRef(0);
  const autoPlayRef = useRef(null);
  const slideAnimationRefs = useRef([]);
  const isMountedRef = useRef(true);
  const [activeSlide, setActiveSlide] = useState(0);

  const { isMobile } = useViewport();
  const reduceMotion = prefersReducedMotion();

  const goToSlide = useCallback(
    (next) => {
      if (!isMountedRef.current || !slides.length) return;
      const n = ((next % slides.length) + slides.length) % slides.length;
      if (n === currentSlide.current) return;

      const outgoing = slideRefs.current[currentSlide.current];
      const incoming = slideRefs.current[n];
      if (!outgoing || !incoming) return;

      gsap.killTweensOf([outgoing, incoming]);

      if (reduceMotion) {
        gsap.set(outgoing, { opacity: 0, zIndex: 0 });
        gsap.set(incoming, { opacity: 1, zIndex: 10 });
      } else {
        gsap.set(incoming, { zIndex: 10 });
        gsap.set(outgoing, { zIndex: 5 });
        const outAnim = gsap.to(outgoing, {
          opacity: 0,
          duration: 0.85,
          ease: 'power2.inOut',
          onComplete: () => gsap.set(outgoing, { zIndex: 0 }),
        });
        const inAnim = gsap.fromTo(
          incoming,
          { opacity: 0 },
          { opacity: 1, duration: 0.85, ease: 'power2.out' }
        );
        slideAnimationRefs.current = [outAnim, inAnim];
      }

      currentSlide.current = n;
      setActiveSlide(n);
    },
    [slides.length, reduceMotion]
  );

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide.current + 1);
  }, [goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide.current - 1);
  }, [goToSlide]);

  // Autoplay
  useEffect(() => {
    if (slides.length < 2) return undefined;

    const start = () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      autoPlayRef.current = setInterval(nextSlide, 8000);
    };
    const stop = () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };

    start();
    const section = sectionRef.current;
    if (section) {
      section.addEventListener('mouseenter', stop);
      section.addEventListener('mouseleave', start);
      section.addEventListener('focusin', stop);
      section.addEventListener('focusout', start);
    }

    return () => {
      stop();
      slideAnimationRefs.current.forEach((a) => a?.kill?.());
      if (section) {
        section.removeEventListener('mouseenter', stop);
        section.removeEventListener('mouseleave', start);
        section.removeEventListener('focusin', stop);
        section.removeEventListener('focusout', start);
      }
    };
  }, [nextSlide, slides.length]);

  // Entrance
  useEffect(() => {
    const first = slideRefs.current[0];
    const dock = dockRef.current;
    if (reduceMotion) {
      if (first) gsap.set(first, { opacity: 1 });
      if (dock) gsap.set(dock, { opacity: 1, y: 0 });
      return undefined;
    }
    const ctx = gsap.context(() => {
      if (first) {
        gsap.fromTo(
          first,
          { opacity: 0.55, scale: 1.03 },
          { opacity: 1, scale: 1, duration: 1.1, ease: 'power3.out' }
        );
      }
      if (dock) {
        gsap.fromTo(
          dock,
          { y: 28, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.85, delay: 0.3, ease: 'power3.out' }
        );
      }
    }, sectionRef);
    return () => ctx.revert();
  }, [reduceMotion, slides.length]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      slideRefs.current.forEach((s) => s && gsap.killTweensOf(s));
    };
  }, []);

  const getSlideImage = (slide) => {
    if (isMobile) return slide.imageMobile || slide.image;
    return slide.image || slide.imageMobile;
  };

  const safeSlides = Array.isArray(slides) ? slides : [];
  const hasSlides = safeSlides.length > 0;

  const ctaButtons =
    buttons?.length > 0
      ? buttons
      : [
          { text: 'Shop Now', link: '/products' },
          { text: 'Collections', link: '/products' },
        ];

  return (
    <section
      ref={sectionRef}
      className="relative h-[100svh] min-h-[560px] max-h-[1100px] w-full overflow-hidden"
      aria-label="Hero section"
      role="region"
    >
      {/* ── Slides ── */}
      {hasSlides ? (
        safeSlides.map((slide, index) => {
          const imgSrc = getSlideImage(slide);
          return (
            <div
              key={index}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
              className={`absolute inset-0 ${index === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${safeSlides.length}`}
              aria-hidden={index !== activeSlide}
            >
              {imgSrc ? (
                <div className="absolute inset-0">
                  <OptimizedImage
                    src={imgSrc}
                    alt={slide.alt || `Hero slide ${index + 1}`}
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="object-cover object-top"
                    blur={true}
                  />
                  {/* Readable scrim for white/gold type */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    aria-hidden="true"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(8,12,20,0.45) 0%, rgba(8,12,20,0.12) 38%, rgba(8,12,20,0.2) 58%, rgba(8,12,20,0.78) 100%)',
                    }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-[#152238] via-[#111111] to-[#0D0D0D]" />
              )}
            </div>
          );
        })
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#152238] via-[#111111] to-[#0D0D0D]" />
      )}

      {/* ── Desktop side arrows (SVG) ── */}
      {safeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous slide"
            className="hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-40 w-12 h-12 items-center justify-center rounded-full border border-white/25 bg-black/25 backdrop-blur-md text-white hover:bg-white hover:text-[#0D0D0D] hover:border-white transition-all duration-300"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next slide"
            className="hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-40 w-12 h-12 items-center justify-center rounded-full border border-white/25 bg-black/25 backdrop-blur-md text-white hover:bg-white hover:text-[#0D0D0D] hover:border-white transition-all duration-300"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </>
      )}

      {/* ── Bottom dock: ONE column — never overlaps ── */}
      <div
        ref={dockRef}
        className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center px-4 pt-16 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6"
        style={{
          background:
            'linear-gradient(to top, rgba(8,12,20,0.88) 0%, rgba(8,12,20,0.45) 55%, transparent 100%)',
        }}
      >
        {/* Tagline */}
        <div className="w-full max-w-3xl text-center mb-4 sm:mb-5">
          <OrnamentLine />
          <p
            className="mt-3 mb-3 text-white text-[11px] sm:text-sm md:text-base tracking-[0.2em] sm:tracking-[0.28em] uppercase font-light px-2 leading-relaxed"
            style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
          >
            {tagline || 'Where Tradition Meets Modern Elegance'}
          </p>
          <OrnamentLine />
        </div>

        {/* CTAs — white + gold metallic outline */}
        <nav
          className="w-full max-w-md sm:max-w-xl flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-5 sm:mb-6"
          aria-label="Hero actions"
        >
          {ctaButtons.map((btn, index) => {
            const isSecondary = index > 0 || /outline|secondary|ghost/i.test(String(btn.variant || ''));
            const variant = isSecondary ? 'heroLuxuryOutline' : 'heroLuxury';
            return (
              <div key={index} className="w-full sm:w-auto flex justify-center">
                <MagneticButton>
                  <Button
                    variant={variant}
                    size="hero"
                    href={btn.link || '/products'}
                    className="w-full sm:w-auto min-w-[11rem] justify-center"
                  >
                    {btn.text}
                  </Button>
                </MagneticButton>
              </div>
            );
          })}
        </nav>

        {/* Slide dots — BELOW buttons, clear spacing */}
        {safeSlides.length > 1 && (
          <div
            className="flex items-center justify-center gap-2 mb-3 sm:mb-4"
            role="tablist"
            aria-label="Slide indicators"
          >
            {safeSlides.map((_, i) => {
              const active = i === activeSlide;
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => goToSlide(i)}
                  className="relative flex items-center justify-center min-w-[44px] min-h-[44px] -mx-1"
                >
                  {/* Visible pill */}
                  <span
                    className={`block rounded-full transition-all duration-400 ${
                      active
                        ? 'w-7 h-1.5 bg-gradient-to-r from-[#D4AF37] to-[#F0D78C] shadow-[0_0_10px_rgba(212,175,55,0.45)]'
                        : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Scroll cue — desktop only, never crowds mobile CTAs */}
        <div className="hidden sm:flex flex-col items-center gap-1.5 opacity-70" aria-hidden="true">
          <ScrollCueIcon />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

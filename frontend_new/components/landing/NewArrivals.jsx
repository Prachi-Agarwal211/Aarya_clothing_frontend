'use client';

import React, { useRef, useEffect, useCallback, memo } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsapConfig';
import ProductCard from '../common/ProductCard';
import { useViewport } from '@/lib/hooks/useViewport';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * NewArrivals - Simplified section showing products directly on landing page
 *
 * ARCHITECTURE: All data comes from backend API via props.
 * No hard-coded defaults - parent component provides all data.
 *
 * Features:
 * - Horizontal scroll product display
 * - GSAP scroll-triggered animations with dynamic will-change
 * - Glass card containers
 * - No separate CTA button - products are inline on landing page
 *
 * PERFORMANCE: Wrapped with React.memo to prevent unnecessary re-renders
 */
const NewArrivals = ({
  id,
  title,
  subtitle,
  products = []
}) => {
  const sectionRef = useRef(null);
  const headerRef = useRef(null);
  const productRefs = useRef([]);
  const scrollContainerRef = useRef(null);
  const { isMobile } = useViewport();

  const scrollBy = useCallback((direction) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cardWidth = container.querySelector(':scope > div')?.offsetWidth || 320;
    container.scrollBy({ left: direction * (cardWidth + 32), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const header = headerRef.current;
    if (!section) return;

    // Skip animations if no products
    if (!products || products.length === 0) return;

    // Narrow viewports: skip scrub timeline (scroll-linked work is expensive on phones)
    if (isMobile) {
      const cards = productRefs.current.filter(Boolean);
      if (cards.length > 0) {
        gsap.set([header, ...cards].filter(Boolean), {
          opacity: 1,
          y: 0,
          scale: 1,
        });
      }
      return;
    }      // Use gsap.context for proper cleanup - only kills THIS component's animations
    let ctx = gsap.context(() => {
      // Header entrance animation with dynamic will-change
      gsap.set(header, { willChange: "transform, opacity" });
      gsap.fromTo(header,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
          },
          onComplete: () => gsap.set(header, { willChange: "auto" })
        }
      );

      // Products entrance animations - staggered on scroll (NOT scrubbed)
      if (productRefs.current.length > 0) {
        gsap.fromTo(productRefs.current,
          { y: 50, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            stagger: 0.12,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: scrollContainerRef.current,
              start: "top 85%",
            },
            onStart: () => {
              productRefs.current.forEach(el => {
                if (el) gsap.set(el, { willChange: "transform, opacity" });
              });
            },
            onComplete: () => {
              productRefs.current.forEach(el => {
                if (el) gsap.set(el, { willChange: "auto" });
              });
            }
          }
        );
      }
    });

    return () => {
      // Force cleanup on unmount - prevent memory leaks
      if (productRefs.current.length > 0) {
        productRefs.current.forEach(el => {
          if (el) gsap.set(el, { willChange: "auto" });
        });
      }
      ctx.revert();
    };
  }, [products, isMobile]);

  return (
    <section id={id} ref={sectionRef} className="relative py-16 sm:py-20 md:py-24">
      {/* Subtle ambient depth */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/[0.01] rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-10 md:mb-12">                  <span
                    className="text-[#E07B8B]/70 text-[11px] sm:text-xs tracking-[0.35em] uppercase block mb-3"
                    style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 500 }}
                  >
                    Fresh this Season
                  </span>
                  <h2
                    className="text-3xl sm:text-4xl md:text-5xl text-[#F5F5F5] mb-3"
                    style={{ fontFamily: 'Cinzel, serif', fontWeight: 400, textShadow: '0 0 40px rgba(255, 215, 0, 0.06)' }}
                  >
                    {title}
                  </h2>
                  <p
                    className="text-[#A0A0A0] text-sm sm:text-base max-w-2xl mx-auto leading-relaxed"
                    style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 300 }}
                  >
                    {subtitle}
                  </p>
        </div>

        {/* Products - Horizontal Scroll Container */}
        <div className="relative group/scroll">
          <div
            ref={scrollContainerRef}
            className="flex gap-6 sm:gap-8 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-8 scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {products.map((product, index) => (
              <div
                key={product.id}
                ref={el => productRefs.current[index] = el}
                className="flex-shrink-0 snap-start w-[280px] sm:w-[320px] md:w-[360px]"
                style={{ transform: `translateY(${index % 2 === 1 ? '16px' : '0px'})` }}
              >
                <div
                  className="
                    relative rounded-2xl overflow-hidden
                    bg-[#0E0E0E]/60
                    border border-white/[0.06]
                    shadow-card
                    transition-all duration-500
                    hover:border-white/[0.12]
                    hover:shadow-card-hover
                    hover:-translate-y-1
                  "
                >
                  <ProductCard
                    product={product}
                    priority={index < 2}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop scroll arrows — only visible on hover */}
          {!isMobile && products.length > 3 && (
            <>
              <button
                onClick={() => scrollBy(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#0A0A0A]/80 backdrop-blur-sm border border-white/[0.1] flex items-center justify-center text-[#F5F5F5] opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-white/[0.08] hover:border-white/[0.2] -translate-x-2 group-hover/scroll:translate-x-0"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollBy(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#0A0A0A]/80 backdrop-blur-sm border border-white/[0.1] flex items-center justify-center text-[#F5F5F5] opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-white/[0.08] hover:border-white/[0.2] translate-x-2 group-hover/scroll:translate-x-0"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Scroll hint gradient */}
          <div className="absolute right-0 top-0 bottom-8 w-20 bg-gradient-to-l from-[#000000] to-transparent pointer-events-none hidden sm:block" />
          {/* Left scroll hint gradient */}
          <div className="absolute left-0 top-0 bottom-8 w-20 bg-gradient-to-r from-[#000000] to-transparent pointer-events-none hidden sm:block" />
        </div>

        {/* View All CTA */}
        <div className="text-center mt-10 md:mt-12">
          <Link
            href="/products?sort=newest"
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-transparent border border-white/[0.12] text-[#F5F5F5] rounded-xl hover:bg-white/[0.04] hover:border-white/[0.2] transition-all duration-300 text-sm tracking-wide"
          >
            View All New Arrivals
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </div>
    </section>
  );
};

// PERFORMANCE: Memoize component to prevent unnecessary re-renders
export default memo(NewArrivals);

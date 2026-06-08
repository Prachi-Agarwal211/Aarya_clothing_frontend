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
    }

    // Use gsap.context for proper cleanup - only kills THIS component's animations
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

      // Products entrance animations - SINGLE TIMELINE for better performance
      if (productRefs.current.length > 0) {
        gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            scrub: 1,
            onInterrupt: () => {
              // Clean up will-change if animation is interrupted (prevents memory leak)
              productRefs.current.forEach(el => {
                if (el) gsap.set(el, { willChange: "auto" });
              });
            }
          }
        })
        .fromTo(productRefs.current,
          { y: 50, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            stagger: 0.1,
            duration: 0.8,
            ease: "power3.out",
            onStart: () => {
              // Add will-change at animation start
              productRefs.current.forEach(el => {
                if (el) gsap.set(el, { willChange: "transform, opacity" });
              });
            },
            onComplete: () => {
              // Remove will-change after animation completes
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
      {/* Background decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F2C29A]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#B76E79]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-10 md:mb-12">
          <span
            className="text-[#B76E79] text-xs sm:text-sm tracking-[0.3em] uppercase block mb-3"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Fresh this Season
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl text-[#EAE0D5] mb-3"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            {title}
          </h2>
          <p
            className="text-[#EAE0D5]/60 text-base sm:text-lg max-w-2xl mx-auto"
            style={{ fontFamily: 'Playfair Display, serif' }}
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
                    relative rounded-3xl overflow-hidden
                    bg-[#0B0608]/40 backdrop-blur-md
                    border border-[#B76E79]/15
                    shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                    transition-all duration-500
                    hover:border-[#B76E79]/30
                    hover:shadow-[0_20px_60px_rgba(122,47,87,0.15)]
                    hover:-translate-y-2
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
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#0B0608]/80 backdrop-blur-sm border border-[#B76E79]/30 flex items-center justify-center text-[#F2C29A] opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-[#7A2F57]/40 hover:border-[#F2C29A]/50 -translate-x-2 group-hover/scroll:translate-x-0"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollBy(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#0B0608]/80 backdrop-blur-sm border border-[#B76E79]/30 flex items-center justify-center text-[#F2C29A] opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 hover:bg-[#7A2F57]/40 hover:border-[#F2C29A]/50 translate-x-2 group-hover/scroll:translate-x-0"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Scroll hint gradient */}
          <div className="absolute right-0 top-0 bottom-8 w-20 bg-gradient-to-l from-[#050203] to-transparent pointer-events-none hidden sm:block" />
          {/* Left scroll hint gradient */}
          <div className="absolute left-0 top-0 bottom-8 w-20 bg-gradient-to-r from-[#050203] to-transparent pointer-events-none hidden sm:block" />
        </div>

        {/* View All CTA */}
        <div className="text-center mt-10 md:mt-12">
          <Link
            href="/products?sort=newest"
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-transparent border-2 border-[#B76E79]/40 text-[#F2C29A] rounded-xl hover:bg-[#7A2F57]/20 hover:border-[#F2C29A]/50 transition-all duration-300 font-semibold text-sm tracking-wide"
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

'use client';

import React, { useRef, useEffect, useCallback, memo } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsapConfig';
import ProductCard from '../common/ProductCard';
import { useViewport } from '@/lib/hooks/useViewport';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';

/**
 * NewArrivals — editorial runway strip over silk background.
 * Inspired by luxury fashion PLPs: open silk field, no solid slab,
 * white/ivory type, royal-blue label, gold metallic micro-accents.
 */
const NewArrivals = ({ id, title, subtitle, products = [] }) => {
  const sectionRef = useRef(null);
  const headerRef = useRef(null);
  const productRefs = useRef([]);
  const scrollContainerRef = useRef(null);
  const { isMobile } = useViewport();

  const scrollBy = useCallback((direction) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cardWidth = container.querySelector(':scope > div')?.offsetWidth || 320;
    container.scrollBy({ left: direction * (cardWidth + 28), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const header = headerRef.current;
    if (!section) return;

    const revealAll = () => {
      const cards = productRefs.current.filter(Boolean);
      gsap.set([header, ...cards].filter(Boolean), {
        opacity: 1,
        y: 0,
        scale: 1,
        clearProps: 'transform',
      });
    };

    if (!products?.length || isMobile || prefersReducedMotion()) {
      revealAll();
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        header,
        { y: 28, opacity: 0.25 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 85%' },
        }
      );
      gsap.delayedCall(1.4, revealAll);

      if (productRefs.current.length > 0) {
        gsap.fromTo(
          productRefs.current,
          { y: 24, opacity: 0.4 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.08,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: scrollContainerRef.current,
              start: 'top 90%',
            },
          }
        );
      }
    });

    return () => {
      ctx.revert();
      revealAll();
    };
  }, [products, isMobile]);

  return (
    <section
      id={id}
      ref={sectionRef}
      className="relative py-16 sm:py-20 md:py-28 reveal-section"
    >
      {/* Soft royal wash only — silk stays visible underneath */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(30,58,95,0.22) 0%, transparent 60%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
        {/* Editorial header — magazine / runway style */}
        <div
          ref={headerRef}
          className="mb-10 md:mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
        >
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="h-px w-8 bg-[#1E3A5F]" aria-hidden="true" />
              <span
                className="text-[11px] sm:text-xs tracking-[0.32em] uppercase text-[#3D5A80]"
                style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 500 }}
              >
                Fresh this season
              </span>
            </div>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl text-white leading-tight"
              style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif', fontWeight: 400 }}
            >
              {title || 'New Arrivals'}
            </h2>
            <p
              className="mt-3 text-[#C8BFAF] text-sm sm:text-base leading-relaxed max-w-md"
              style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 300 }}
            >
              {subtitle || 'Handpicked pieces just in — scroll the runway.'}
            </p>
          </div>

          <div className="flex items-center gap-3 md:pb-1">
            {!isMobile && products.length > 3 && (
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <button
                  type="button"
                  onClick={() => scrollBy(-1)}
                  className="w-11 h-11 rounded-full border border-white/20 bg-white/[0.04] backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/10 hover:border-white/40 transition-all"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollBy(1)}
                  className="w-11 h-11 rounded-full border border-white/20 bg-white/[0.04] backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/10 hover:border-white/40 transition-all"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
            <Link
              href="/products?sort=newest"
              className="group inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full border border-white/25 text-white text-xs sm:text-sm tracking-[0.14em] uppercase hover:bg-white hover:text-[#0D0D0D] transition-all duration-300"
              style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
            >
              View all
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>

        {/* Gold metallic hairline under header */}
        <div
          className="h-px w-full max-w-xs mb-8 md:mb-10 bg-gradient-to-r from-[#D4AF37]/50 via-[#D4AF37]/15 to-transparent"
          aria-hidden="true"
        />

        {/* Runway product strip */}
        <div className="relative group/scroll">
          <div
            ref={scrollContainerRef}
            className="flex gap-5 sm:gap-7 md:gap-8 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-6 scroll-smooth -mx-5 px-5 sm:mx-0 sm:px-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {products.map((product, index) => (
              <div
                key={product.id}
                ref={(el) => {
                  productRefs.current[index] = el;
                }}
                className="flex-shrink-0 snap-start w-[260px] sm:w-[300px] md:w-[340px]"
              >
                <ProductCard product={product} priority={index < 2} />
              </div>
            ))}
          </div>

          {/* Edge fades into silk — not solid black slabs */}
          <div
            className="absolute left-0 top-0 bottom-6 w-10 sm:w-16 pointer-events-none hidden sm:block"
            style={{
              background: 'linear-gradient(to right, rgba(13,13,13,0.45), transparent)',
            }}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-0 bottom-6 w-10 sm:w-16 pointer-events-none hidden sm:block"
            style={{
              background: 'linear-gradient(to left, rgba(13,13,13,0.45), transparent)',
            }}
            aria-hidden="true"
          />
        </div>

        {/* Mobile secondary CTA */}
        <div className="text-center mt-8 sm:hidden">
          <Link
            href="/products?sort=newest"
            className="inline-flex items-center gap-2 text-[#D4AF37] text-sm tracking-wide underline-offset-4 hover:underline"
          >
            Explore new arrivals
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default memo(NewArrivals);

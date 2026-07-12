'use client';

import React, { useRef, useEffect, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsapConfig';
import { ArrowRight } from 'lucide-react';
import { getCoreBaseUrl } from '@/lib/baseApi';
import { useViewport } from '@/lib/hooks/useViewport';

/**
 * Collections - Modern section with overlapping cards
 *
 * ARCHITECTURE: All data comes from backend API via props.
 * No hard-coded defaults - parent component provides all data.
 *
 * Features:
 * - Overlapping card layout
 * - GSAP scroll-triggered animations with dynamic will-change
 * - Staggered reveal effects
 * - Glass morphism styling
 *
 * PERFORMANCE: Wrapped with React.memo to prevent unnecessary re-renders
 * MOBILE: Simplified animations on mobile for faster load times
 */
const Collections = ({
  id,
  title,
  categories = []
}) => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const cardsContainerRef = useRef(null);
  const cardRefs = useRef([]);
  const { isMobile } = useViewport();
  const reduce = prefersReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    const cards = cardRefs.current;
    if (!section) return;

    const reduce = prefersReducedMotion();

    const revealAll = () => {
      gsap.set([title, ...cards].filter(Boolean), {
        opacity: 1,
        y: 0,
        scale: 1,
      });
    };

    if (isMobile || reduce) {
      revealAll();
      return undefined;
    }

    let ctx = gsap.context(() => {
      gsap.set(title, { willChange: 'transform, opacity' });
      gsap.fromTo(
        title,
        { y: 36, opacity: 0.35, scale: 0.98 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
          },
          onComplete: () => gsap.set(title, { willChange: 'auto' }),
        }
      );
      gsap.delayedCall(1.5, revealAll);

      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { y: 28, opacity: 0.4, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            stagger: 0.1,
            duration: 0.75,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: cardsContainerRef.current,
              start: 'top 90%',
            },
            onComplete: () => {
              cards.forEach((el) => {
                if (el) gsap.set(el, { willChange: 'auto', opacity: 1 });
              });
            },
          }
        );
      }
    });

    return () => {
      ctx.revert();
      revealAll();
    };
  }, [isMobile, categories, reduce]);

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section
      id={id}
      ref={sectionRef}
      className="relative py-16 sm:py-20 md:py-28 reveal-section"
    >
      {/* Light royal wash — silk remains visible */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 80% 40%, rgba(30,58,95,0.2) 0%, transparent 55%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-10 md:mb-14">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="h-px w-8 bg-[#1E3A5F]" aria-hidden="true" />
            <span className="text-[11px] tracking-[0.32em] uppercase text-[#3D5A80]">Curated</span>
            <span className="h-px w-8 bg-[#1E3A5F]" aria-hidden="true" />
          </div>
          <h2
            ref={titleRef}
            className="text-3xl sm:text-4xl md:text-5xl text-white reveal-item"
            style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif', fontWeight: 400 }}
          >
            {title}
          </h2>
        </div>

        <div ref={cardsContainerRef} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {categories.map((category, index) => (
              <div key={category.id || index} ref={el => cardRefs.current[index] = el} className="w-full h-full">
                <CollectionCard category={category} />
              </div>
          ))}
        </div>

        <div className="text-center mt-12 md:mt-16">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 min-h-[48px] px-8 py-3 rounded-full bg-[#1E3A5F] border border-[#3D5A80]/50 text-white hover:bg-[#2C4A7C] transition-colors font-medium text-sm tracking-[0.12em] uppercase"
            style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
          >
            View All Collections
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

const CollectionCard = ({ category }) => {
  // Uniform card height for consistent grid layout
  const heightClass = 'h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px]';

  const ensureFullUrl = (url) => {
    if (!url) return '/placeholder-collection.svg';
    return url;
  };

  return (
    <Link
      href={category.link || `/products?collection_id=${category.id}`}
      className="group relative block w-full overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.02]"
    >
      <div className={`relative ${heightClass} bg-[#161616]/60 border border-white/[0.06] shadow-card transition-all duration-500 group-hover:shadow-card-hover group-hover:border-white/[0.12] overflow-hidden`}>
        <div className="absolute inset-0">
          {(category.image_url || category.image) ? (
            <Image
              src={ensureFullUrl(category.image_url || category.image)}
              alt={category.name || 'Collection'}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-[#161616] flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out">
              <span className="text-[#A8B4C8]/30 text-lg tracking-widest uppercase">{category.name || 'Collection'}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#000000]/90 via-[#000000]/30 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 w-full p-5 sm:p-6">
          <span
            className="text-[#D4AF37]/60 text-[10px] tracking-[0.2em] uppercase block mb-1.5 opacity-0 transform -translate-y-3 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0"
            style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 500 }}
          >
            Collection
          </span>
          <h3
            className="text-lg sm:text-xl md:text-2xl text-[#F5F0E8] mb-1 group-hover:text-white transition-colors"
            style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
          >
            {category.name}
          </h3>
          <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
            <div className="pt-3 flex items-center gap-2 text-[#A8B4C8]/80 tracking-wider text-xs font-medium" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
              EXPLORE <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="absolute inset-3 border border-white/[0.08] scale-95 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100 pointer-events-none rounded-xl" />
      </div>
    </Link>
  );
};

export default memo(Collections);

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

    if (isMobile || reduce) {
      gsap.set([title, ...cards].filter(Boolean), {
        opacity: 1,
        y: 0,
        scale: 1,
      });
      return;
    }      let ctx = gsap.context(() => {
      gsap.set(title, { willChange: "transform, opacity" });
      gsap.fromTo(title,
        { y: 60, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
          },
          onComplete: () => gsap.set(title, { willChange: "auto" })
        }
      );

      if (cards.length > 0) {
        gsap.fromTo(cards,
          { y: 50, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            stagger: 0.12,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: cardsContainerRef.current,
              start: "top 85%",
            },
            onStart: () => {
              cards.forEach(el => {
                if (el) gsap.set(el, { willChange: "transform, opacity" });
              });
            },
            onComplete: () => {
              cards.forEach(el => {
                if (el) gsap.set(el, { willChange: "auto" });
              });
            }
          }
        );
      }
    });

    return () => {
      if (cards.length > 0) {
        cards.forEach(el => {
          if (el) gsap.set(el, { willChange: "auto" });
        });
      }
      ctx.revert();
    };
  }, [isMobile]);

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section id={id} ref={sectionRef} className="relative py-16 sm:py-20 md:py-24">


      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
        <h2
          ref={titleRef}
          className="text-3xl sm:text-4xl md:text-5xl text-[#F5F5F5] text-center mb-10 md:mb-12"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {title}
        </h2>

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
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#9333EA] to-[#E07B8B] text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-sm sm:text-base tracking-wide"
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
    if (!url) return '/placeholder-collection.jpg';
    return url;
  };

  return (
    <Link
      href={category.link || `/products?collection_id=${category.id}`}
      className="group relative block w-full overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.02]"
    >
      <div className={`relative ${heightClass} bg-[#0E0E0E]/60 border border-white/[0.06] shadow-card transition-all duration-500 group-hover:shadow-card-hover group-hover:border-white/[0.12] overflow-hidden`}>
        <div className="absolute inset-0">
          {(category.image_url || category.image) ? (
            <Image
              src={ensureFullUrl(category.image_url || category.image)}
              alt={category.name || 'Collection'}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-[#141414] flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out">
              <span className="text-[#E07B8B]/30 text-lg tracking-widest uppercase">{category.name || 'Collection'}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#000000]/90 via-[#000000]/30 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 w-full p-5 sm:p-6">
          <span
            className="text-[#FFD700]/60 text-[10px] tracking-[0.2em] uppercase block mb-1.5 opacity-0 transform -translate-y-3 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0"
            style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 500 }}
          >
            Collection
          </span>
          <h3
            className="text-lg sm:text-xl md:text-2xl text-[#F5F5F5] mb-1 group-hover:text-white transition-colors"
            style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
          >
            {category.name}
          </h3>
          <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
            <div className="pt-3 flex items-center gap-2 text-[#E07B8B]/80 tracking-wider text-xs font-medium" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
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

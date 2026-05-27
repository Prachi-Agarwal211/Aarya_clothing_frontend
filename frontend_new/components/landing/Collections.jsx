'use client';

import React, { useRef, useEffect, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { gsap, ScrollTrigger } from '@/lib/gsapConfig';
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

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    const cards = cardRefs.current;
    if (!section) return;

    if (isMobile) {
      gsap.set([title, ...cards].filter(Boolean), {
        opacity: 1,
        y: 0,
        scale: 1,
      });
      return;
    }

    let ctx = gsap.context(() => {
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
        gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            scrub: 1,
            onInterrupt: () => {
              cards.forEach(el => {
                if (el) gsap.set(el, { willChange: "auto" });
              });
            }
          }
        })
        .fromTo(cards,
          { y: 50, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            stagger: 0.1,
            duration: 0.8,
            ease: "power3.out",
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
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-[#7A2F57]/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#F2C29A]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        <h2
          ref={titleRef}
          className="text-3xl sm:text-4xl md:text-5xl text-[#EAE0D5] text-center mb-10 md:mb-12"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {title}
        </h2>

        <div ref={cardsContainerRef} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {categories.map((category, index) => {
            return (
              <div key={category.id || index} ref={el => cardRefs.current[index] = el} className="w-full h-full">
                <CollectionCard category={category} size="medium" index={index} />
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12 md:mt-16">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-sm sm:text-base tracking-wide"
          >
            View All Collections
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

const CollectionCard = ({ category, size = 'medium', index }) => {
  const heights = {
    large: 'h-[300px] sm:h-[350px] md:h-[400px] lg:h-[450px]',
    medium: 'h-[240px] sm:h-[280px] md:h-[300px] lg:h-[320px]',
    small: 'h-[200px] sm:h-[240px] md:h-[260px] lg:h-[280px]'
  };

  const ensureFullUrl = (url) => {
    if (!url) return '/placeholder-collection.jpg';
    return url;
  };

  return (
    <Link
      href={category.link || `/products?collection_id=${category.id}`}
      className="group relative block w-full overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.02]"
    >
      <div className={`relative ${heights[size]} bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden`}>
        <div className="absolute inset-0">
          {(category.image_url || category.image) ? (
            <Image
              src={ensureFullUrl(category.image_url || category.image)}
              alt={category.name || 'Collection'}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-[#1A1114] flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out">
              <span className="text-[#B76E79]/30 text-lg tracking-widest uppercase">{category.name || 'Collection'}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050203]/90 via-[#050203]/30 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 w-full p-5 sm:p-6">
          <span
            className="text-[#F2C29A] text-xs tracking-[0.15em] uppercase block mb-1.5 opacity-0 transform -translate-y-3 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Collection
          </span>
          <h3
            className="text-lg sm:text-xl md:text-2xl text-[#EAE0D5] mb-1 group-hover:text-white transition-colors"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            {category.name}
          </h3>
          <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
            <div className="pt-3 flex items-center gap-2 text-[#B76E79] tracking-wider text-sm font-medium">
              EXPLORE <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="absolute inset-3 border border-[#F2C29A]/20 scale-95 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100 pointer-events-none rounded-xl" />
      </div>
    </Link>
  );
};

export default memo(Collections);

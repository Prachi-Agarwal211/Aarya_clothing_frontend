'use client';

import React, { useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { gsap, ScrollTrigger } from '@/lib/gsapConfig';
import { ArrowRight } from 'lucide-react';

/**
 * Collections - Modern section with overlapping cards
 * 
 * ARCHITECTURE: All data comes from backend API via props.
 * No hard-coded defaults - parent component provides all data.
 * 
 * Features:
 * - Overlapping card layout
 * - GSAP scroll-triggered animations
 * - Staggered reveal effects
 * - Glass morphism styling
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

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    const cards = cardRefs.current;
    if (!section) return;

    // Use gsap.context for proper cleanup - only kills THIS component's animations
    let ctx = gsap.context(() => {
      // Title animation
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
          }
        }
      );

      // Cards staggered reveal - simple fade up
      cards.forEach((card, index) => {
        gsap.fromTo(card,
          {
            y: 50,
            opacity: 0,
            scale: 0.95
          },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
            }
          }
        );
      });
    });

    return () => ctx.revert(); // Only kills this component's GSAP animations
  }, []);

  return (
    <section id={id} ref={sectionRef} className="relative py-16 sm:py-20 md:py-24">
      {/* Background decorative elements */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-[#7A2F57]/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#F2C29A]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        {/* Title */}
        <h2
          ref={titleRef}
          className="text-3xl sm:text-4xl md:text-5xl text-[#EAE0D5] text-center mb-10 md:mb-12"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {title}
        </h2>

        {/* Dynamic Layout for Categories: Horizontal Scroll on Mobile, Grid on Tablet/Desktop */}
        <div
          ref={cardsContainerRef}
          className="flex overflow-x-auto snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 pb-6 sm:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category, index) => {
            // Featured (first) item spans 2 cols only on md+ to prevent overflow on mobile
            const isFeatured = index === 0;
            return (
              <div
                key={category.id}
                ref={el => cardRefs.current[index] = el}
                className={`shrink-0 w-[85vw] sm:w-auto snap-center ${isFeatured ? "sm:col-span-2 sm:row-span-2" : ""}`}
              >
                <CollectionCard
                  category={category}
                  size={isFeatured ? "large" : "medium"}
                  index={index}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// Separate Card Component for cleaner code
const CollectionCard = ({ category, size = 'medium', index }) => {
  const heights = {
    large: 'h-[350px] sm:h-[400px] md:h-[450px]',
    medium: 'h-[280px] sm:h-[300px] md:h-[320px]',
    small: 'h-[250px] sm:h-[280px]'
  };

  const ensureFullUrl = (url) => {
    if (!url) return '/placeholder-collection.jpg'; // Return placeholder if null/undefined
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6005';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <Link
      href={category.link || `/collections/${category.slug}`}
      className="
        group relative block w-full overflow-hidden rounded-2xl
        transition-all duration-500
        hover:scale-[1.02]
      "
    >
      <div
        className={`
          relative ${heights[size]}
          bg-[#0B0608]/40 backdrop-blur-md
          border border-[#B76E79]/15
          shadow-[0_8px_32px_rgba(0,0,0,0.3)]
          overflow-hidden
        `}
      >
        {/* Background Image */}
        <div className="absolute inset-0">
          {category.image && category.image !== '' ? (
            <Image
              src={ensureFullUrl(category.image)}
              alt={category.name || 'Collection'}
              fill
              className="object-top object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-[#1A1114] flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out">
              <span className="text-[#B76E79]/30 text-lg tracking-widest uppercase">{category.name || 'Collection'}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050203]/90 via-[#050203]/30 to-transparent" />
        </div>

        {/* Content */}
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

        {/* Border Effect */}
        <div className="absolute inset-3 border border-[#F2C29A]/20 scale-95 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100 pointer-events-none rounded-xl" />
      </div>
    </Link>
  );
};

export default Collections;

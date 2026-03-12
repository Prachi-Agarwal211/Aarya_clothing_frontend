'use client';

import React, { useRef, useEffect } from 'react';
import { gsap, ScrollTrigger } from '@/lib/gsapConfig';
import ProductCard from '../common/ProductCard';
import { Button } from '../ui/button';

/**
 * NewArrivals - Modern section with creative asymmetric layout
 * 
 * ARCHITECTURE: All data comes from backend API via props.
 * No hard-coded defaults - parent component provides all data.
 * 
 * Features:
 * - Asymmetric masonry-style grid
 * - GSAP scroll-triggered animations
 * - Horizontal scroll effect on products
 * - Glass card containers
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

  useEffect(() => {
    const section = sectionRef.current;
    const header = headerRef.current;
    if (!section) return;

    // Use gsap.context for proper cleanup - only kills THIS component's animations
    let ctx = gsap.context(() => {
      // Header entrance animation
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
          }
        }
      );

      // Products entrance animations only (no horizontal scroll pinning)
      if (productRefs.current.length > 0) {
        productRefs.current.forEach((product, index) => {
          gsap.fromTo(product,
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
              delay: index * 0.1,
              ease: "power3.out",
              scrollTrigger: {
                trigger: product,
                start: "top 85%",
                toggleActions: "play none none reverse"
              }
            }
          );
        });
      }
    });

    return () => ctx.revert(); // Only kills this component's GSAP animations
  }, [products]);

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
        <div className="relative">
          <div
            className="flex gap-6 sm:gap-8 overflow-x-auto scrollbar-hide pb-8"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {products.map((product, index) => (
              <div
                key={product.id}
                ref={el => productRefs.current[index] = el}
                className="
                  flex-shrink-0 w-[280px] sm:w-[320px] md:w-[360px]
                  scroll-snap-align-start
                "
              >
                <div
                  className="
                    relative rounded-3xl overflow-hidden
                    bg-[#0B0608]/40 backdrop-blur-md
                    border border-[#B76E79]/15
                    shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                    transition-all duration-500
                    hover:border-[#B76E79]/30
                    hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]
                  "
                >
                  <ProductCard product={product} />
                </div>
              </div>
            ))}
          </div>

          {/* Scroll hint gradient */}
          <div className="absolute right-0 top-0 bottom-8 w-20 bg-gradient-to-l from-[#050203] to-transparent pointer-events-none hidden sm:block" />
        </div>

        {/* CTA Button */}
        <div className="flex justify-center mt-10">
          <Button
            variant="luxurySecondary"
            size="sm"
            href="/new-arrivals"
          >
            View All Products
          </Button>
        </div>
      </div>
    </section>
  );
};

export default NewArrivals;

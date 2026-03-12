'use client';

import React, { useRef, useEffect } from 'react';
import Image from 'next/image';
import { gsap, ScrollTrigger } from '@/lib/gsapConfig';
import { Button } from '../ui/button';
import { useLogo } from '@/lib/siteConfigContext';

/**
 * AboutSection - Modern about section with scroll animations
 * 
 * ARCHITECTURE: All data comes from backend API via props.
 * No hard-coded defaults - parent component provides all data.
 * 
 * Features:
 * - Split layout with parallax images
 * - GSAP scroll-triggered animations
 * - Counter animation for stats
 * - Glass morphism styling
 */
const AboutSection = ({
  id,
  title,
  story,
  stats = [],
  images = []
}) => {
  const sectionRef = useRef(null);
  const contentRef = useRef(null);
  const imageRefs = useRef([]);
  const statsRef = useRef(null);
  const decorRef = useRef(null);

  // Get logo URL from backend via context
  const logoUrl = useLogo();

  useEffect(() => {
    const section = sectionRef.current;
    const content = contentRef.current;
    const images = imageRefs.current;
    const stats = statsRef.current;
    if (!section || !content) return;

    // Use gsap.context for proper cleanup - only kills THIS component's animations
    let ctx = gsap.context(() => {
      // Content reveal animation
      gsap.fromTo(content.children,
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: content,
            start: "top 80%",
          }
        }
      );

      // Parallax images with different speeds
      images.forEach((img, index) => {
        const speed = index === 0 ? -30 : 30;

        gsap.fromTo(img,
          { y: 100, opacity: 0, x: index === 0 ? -50 : 50 },
          {
            y: 0,
            x: 0,
            opacity: 1,
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: img,
              start: "top 85%",
            }
          }
        );

        // Parallax on scroll
        gsap.to(img, {
          yPercent: speed,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 1
          }
        });
      });

      // Stats counter animation
      if (stats) {
        const statElements = stats.children;
        Array.from(statElements).forEach((el, index) => {
          gsap.fromTo(el,
            { y: 50, opacity: 0, scale: 0.8 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.8,
              delay: index * 0.15,
              ease: "back.out(1.7)",
              scrollTrigger: {
                trigger: stats,
                start: "top 85%",
              }
            }
          );
        });
      }

      // Decorative element animation
      if (decorRef.current) {
        gsap.fromTo(decorRef.current,
          { rotation: 0 },
          {
            rotation: 360,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: 1
            }
          }
        );
      }

      return () => ctx.revert(); // Only kills this component's GSAP animations
    }); // Close gsap.context
  }, []);

  return (
    <section id={id} ref={sectionRef} className="relative py-20 sm:py-24 md:py-32">
      {/* Decorative rotating element */}
      <div
        ref={decorRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none opacity-5"
      >
        <div className="w-full h-full border border-[#F2C29A] rounded-full" />
        <div className="absolute inset-8 border border-[#B76E79] rounded-full" />
        <div className="absolute inset-16 border border-[#F2C29A] rounded-full" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Image Side - Creative Layout */}
          <div className="w-full lg:w-1/2 relative h-[500px] sm:h-[600px] lg:h-[700px]">
            {/* Main Image */}
            <div
              ref={el => imageRefs.current[0] = el}
              className="absolute top-0 right-0 w-3/4 h-3/4 z-10"
            >
              <div
                className="
                  relative w-full h-full rounded-3xl overflow-hidden
                  bg-[#0B0608]/40 backdrop-blur-md
                  border border-[#B76E79]/15
                  shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                "
              >
                <Image
                  src={images[0]}
                  alt="Craftsmanship"
                  fill
                  className="object-top object-cover grayscale hover:grayscale-0 transition-all duration-700"
                />
              </div>
            </div>

            {/* Secondary Image - Overlapping */}
            <div
              ref={el => imageRefs.current[1] = el}
              className="absolute bottom-0 left-0 w-2/3 h-2/3 z-20"
            >
              <div
                className="
                  relative w-full h-full rounded-3xl overflow-hidden
                  bg-[#0B0608]/60 backdrop-blur-md
                  border border-[#F2C29A]/20
                  shadow-[0_12px_40px_rgba(0,0,0,0.4)]
                  p-3
                "
              >
                <div className="relative w-full h-full rounded-2xl overflow-hidden">
                  <Image
                    src={images[1]}
                    alt="Detail"
                    fill
                    className="object-top object-cover opacity-80 hover:opacity-100 transition-opacity duration-500"
                  />
                </div>
              </div>
            </div>

            {/* Decorative accent with logo */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 border-2 border-[#F2C29A]/20 rounded-3xl z-0 flex items-center justify-center bg-[#0B0608]/40 backdrop-blur-sm">
              <img
                src={logoUrl}
                alt="Aarya Clothing"
                className="w-24 h-24 object-contain opacity-90 drop-shadow-[0_0_15px_rgba(242,194,154,0.5)]"
              />
            </div>
          </div>

          {/* Text Side */}
          <div className="w-full lg:w-1/2 relative z-20">
            <div ref={contentRef} className="space-y-6 sm:space-y-8">
              <span
                className="text-[#F2C29A] tracking-[0.4em] text-xs sm:text-sm uppercase font-semibold"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Our Story
              </span>

              <h2
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#EAE0D5] leading-tight"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                {title}
              </h2>

              <p
                className="text-white text-base sm:text-lg leading-relaxed max-w-xl"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {story}
              </p>

              <Button
                variant="luxury"
                size="lg"
                href="/about"
              >
                Discover Our Brand
              </Button>
            </div>

            {/* Statistics */}
            <div
              ref={statsRef}
              className="grid grid-cols-3 gap-4 sm:gap-8 mt-12 sm:mt-16 pt-8 border-t border-[#F2C29A]/10"
            >
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center sm:text-left">
                  <span
                    className="block text-2xl sm:text-3xl md:text-4xl text-[#B76E79] mb-1 sm:mb-2"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    {stat.value}
                  </span>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#EAE0D5]/50">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;

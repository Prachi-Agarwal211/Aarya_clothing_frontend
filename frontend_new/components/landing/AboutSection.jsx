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
    const imageElements = imageRefs.current;
    const statsElement = statsRef.current;
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

      // Parallax images with different speeds — filter null refs (React sets ref=null on unmount)
      imageElements.filter(Boolean).forEach((img, index) => {
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
      if (statsElement) {
        const statElements = statsElement.children;
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
                trigger: statsElement,
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

    }); // Close gsap.context
    return () => ctx.revert(); // Only kills this component's GSAP animations
  }, []);

  return (
    <section id={id} ref={sectionRef} className="relative py-16 sm:py-20 md:py-24 lg:py-32">
      {/* Decorative rotating element - hidden on mobile for cleaner look */}
      <div
        ref={decorRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[700px] md:w-[800px] h-[600px] sm:h-[700px] md:h-[800px] pointer-events-none opacity-5"
      >
        <div className="w-full h-full border border-[#F2C29A] rounded-full" />
        <div className="absolute inset-8 border border-[#B76E79] rounded-full" />
        <div className="absolute inset-16 border border-[#F2C29A] rounded-full" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        {/* Mobile: Text first, then images. Desktop: Side by side */}
        <div className="flex flex-col lg:flex-row items-center gap-10 sm:gap-12 lg:gap-20">

          {/* Image Side - Stacked layout on mobile, overlapping on desktop */}
          <div className="w-full lg:w-1/2 relative order-1">
            {/* Mobile: Stacked vertical layout. Desktop: Overlapping creative layout */}
            <div className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[700px]">
              {/* Main Image - Full width on mobile, positioned on desktop */}
              <div
                ref={el => imageRefs.current[0] = el}
                className="absolute top-0 right-0 w-full sm:w-3/4 md:w-3/4 lg:w-3/4 h-3/5 lg:h-3/4 z-10"
              >
                <div
                  className="
                    relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden
                    bg-[#0B0608]/40 backdrop-blur-md
                    border border-[#B76E79]/15
                    shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                  "
                >
                  {images[0] ? (
                    <Image
                      src={images[0]}
                      alt="Craftsmanship"
                      fill
                      className="object-top object-cover grayscale hover:grayscale-0 transition-all duration-700"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[#B76E79]/30 text-xs tracking-widest uppercase">Our Craftsmanship</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary Image - Below on mobile, overlapping on desktop */}
              <div
                ref={el => imageRefs.current[1] = el}
                className="absolute bottom-0 left-0 w-full sm:w-2/3 md:w-2/3 lg:w-2/3 h-2/5 lg:h-2/3 z-20 sm:-translate-x-4"
              >
                <div
                  className="
                    relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden
                    bg-[#0B0608]/60 backdrop-blur-md
                    border border-[#F2C29A]/20
                    shadow-[0_12px_40px_rgba(0,0,0,0.4)]
                    p-2 sm:p-3
                  "
                >
                  <div className="relative w-full h-full rounded-xl sm:rounded-2xl overflow-hidden">
                    {images[1] ? (
                      <Image
                        src={images[1]}
                        alt="Detail"
                        fill
                        className="object-top object-cover opacity-80 hover:opacity-100 transition-opacity duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[#F2C29A]/20 text-xs tracking-widest uppercase">Fine Detail</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Decorative accent with logo - Hidden on mobile, visible on desktop */}
              <div className="hidden sm:flex absolute -bottom-4 -right-4 w-24 h-24 sm:w-32 sm:h-32 border-2 border-[#F2C29A]/20 rounded-2xl sm:rounded-3xl z-0 items-center justify-center bg-[#0B0608]/40 backdrop-blur-sm">
                <img
                  src={logoUrl}
                  alt="Aarya Clothing"
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain opacity-90 drop-shadow-[0_0_15px_rgba(242,194,154,0.5)]"
                />
              </div>
            </div>
          </div>

          {/* Text Side - Order first on mobile, second on desktop */}
          <div className="w-full lg:w-1/2 relative z-20 order-2">
            <div ref={contentRef} className="space-y-5 sm:space-y-8">
              <span
                className="text-[#F2C29A] tracking-[0.3em] sm:tracking-[0.4em] text-xs sm:text-sm uppercase font-semibold block"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Our Story
              </span>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-[#EAE0D5] leading-tight"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                {title}
              </h2>

              <div
                className="text-white text-sm sm:text-base md:text-lg leading-relaxed space-y-3 sm:space-y-4"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {story?.split(/\\n\\n|\n\n/).map((para, i) => (
                  <p key={i}>{para.replace(/\\n/g, ' ').trim()}</p>
                ))}
              </div>

              <Button
                variant="luxury"
                size="md"
                href="/about"
                className="w-full sm:w-auto"
              >
                Discover Our Brand
              </Button>
            </div>

            {/* Statistics - Compact on mobile */}
            <div
              ref={statsRef}
              className="grid grid-cols-3 gap-3 sm:gap-6 md:gap-8 mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-[#F2C29A]/10"
            >
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center sm:text-left">
                  <span
                    className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl text-[#B76E79] mb-0.5 sm:mb-1 md:mb-2"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    {stat.value}
                  </span>
                  <span className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-widest text-[#EAE0D5]/50 leading-tight">
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

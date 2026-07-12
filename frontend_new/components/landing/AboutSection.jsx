'use client';

import React, { useRef, useEffect, memo } from 'react';
import OptimizedImage from '../ui/OptimizedImage';
import { gsap, ScrollTrigger } from '@/lib/gsapConfig';
import { Button } from '../ui/button';
import { useLogo } from '@/lib/siteConfigContext';
import { useViewport } from '@/lib/hooks/useViewport';

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
 *
 * PERFORMANCE: Wrapped with React.memo to prevent unnecessary re-renders
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
  const { isMobile } = useViewport();

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

        // Parallax on scroll — desktop only (scrub ties animation to every scroll frame)
        if (!isMobile) {
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
        }
      });

      // Stats counter animation
      if (statsElement) {
        Array.from(statsElement.children).forEach((el, index) => {
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

      // Decorative element — scroll-scrubbed rotation on desktop only
      if (decorRef.current) {
        if (!isMobile) {
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
      }

    }); // Close gsap.context
    return () => ctx.revert(); // Only kills this component's GSAP animations
  }, [isMobile]);

  return (
    <section id={id} ref={sectionRef} className="relative py-16 sm:py-20 md:py-24 lg:py-32 reveal-section">


      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
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
                    bg-[#111111]/40 backdrop-blur-md
                    border border-white/[0.06]
                    shadow-lg
                  "
                >
                  {images[0] ? (
                    <OptimizedImage
                      src={images[0]}
                      alt="Craftsmanship"
                      fill
                      className="object-top object-cover grayscale hover:grayscale-0 transition-all duration-700"
                      blur={true}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[#A8B4C8]/30 text-xs tracking-widest uppercase">Our Craftsmanship</span>
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
                    bg-[#111111]/60 backdrop-blur-md
                    border border-white/[0.06]
                    shadow-lg
                    p-2 sm:p-3
                  "
                >
                  <div className="relative w-full h-full rounded-xl sm:rounded-2xl overflow-hidden">
                    {images[1] ? (
                      <OptimizedImage
                        src={images[1]}
                        alt="Detail"
                        fill
                        className="object-top object-cover opacity-80 hover:opacity-100 transition-opacity duration-500"
                        blur={true}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[#D4AF37]/20 text-xs tracking-widest uppercase">Fine Detail</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Decorative accent with logo - Hidden on mobile, visible on desktop */}
              {logoUrl && (
                <div              className="hidden sm:flex absolute -bottom-4 -right-4 w-24 h-24 sm:w-32 sm:h-32 border border-white/[0.08] rounded-2xl sm:rounded-3xl z-0 items-center justify-center bg-[#111111]/40 backdrop-blur-sm">
                  <OptimizedImage
                    src={logoUrl}
                    alt="Aarya Clothing"
                    width={96}
                    height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 object-contain opacity-90"
                    blur={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Text Side - Order first on mobile, second on desktop */}
          <div className="w-full lg:w-1/2 relative z-20 order-2">
            <div ref={contentRef} className="space-y-5 sm:space-y-8">
              <span
                className="text-[#D4AF37]/70 tracking-[0.3em] sm:tracking-[0.35em] text-[11px] sm:text-xs uppercase block"
                style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 500 }}
              >
                Our Story
              </span>

              <h2
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-[#F5F0E8] leading-tight"
                style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
              >
                {title}
              </h2>

              <div
                className="text-[#B8B8B8] text-sm sm:text-base md:text-lg leading-[1.7] space-y-3 sm:space-y-4"
                style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 300 }}
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
              className="grid grid-cols-3 gap-3 sm:gap-6 md:gap-8 mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-[#D4AF37]/10"
            >
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center sm:text-left">
                  <span
                    className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl text-[#A8B4C8] mb-0.5 sm:mb-1 md:mb-2"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    {stat.value}
                  </span>                  <span
                    className="text-[10px] sm:text-[11px] md:text-xs uppercase tracking-[0.15em] text-[#A0A0A0] leading-tight"
                    style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 400 }}
                  >
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

// PERFORMANCE: Memoize component to prevent unnecessary re-renders
export default memo(AboutSection);

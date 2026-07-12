'use client';

import { useRef, useEffect } from 'react';
import { gsap } from '@/lib/gsapConfig';
import { ShieldCheck, Truck, Lock } from 'lucide-react';
import { useViewport } from '@/lib/hooks/useViewport';

const BADGES = [
  {
    Icon: ShieldCheck,
    title: 'No Hidden Charges',
    desc: 'The price you see is the price you pay. All taxes and shipping are already included.',
  },
  {
    Icon: Truck,
    title: 'Free Shipping',
    desc: 'All orders ship free across India. No minimum order value, no surprise fees.',
  },
  {
    Icon: Lock,
    title: 'Secure Online Payment',
    desc: 'Pay safely via UPI, cards, or net banking through Razorpay.',
  },
];

/**
 * TrustBadges — "Our Promise to You" section.
 * Extracted from LandingClient for proper componentisation.
 * Desktop: GSAP stagger reveal. Mobile: IntersectionObserver.
 */
export default function TrustBadges() {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const badgeRefs = useRef([]);
  const { isMobile } = useViewport();

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Mobile IO reveal ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMobile || prefersReducedMotion) return;

    const elements = [headingRef.current, ...badgeRefs.current].filter(Boolean);
    elements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = `opacity 0.5s ease ${i * 90}ms, transform 0.5s ease ${i * 90}ms`;
    });

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [isMobile, prefersReducedMotion]);

  // ─── Desktop GSAP ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMobile || prefersReducedMotion) return;

    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headingRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 82%' },
        }
      );

      const badges = badgeRefs.current.filter(Boolean);
      gsap.fromTo(
        badges,
        { y: 50, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          stagger: 0.12,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 78%' },
        }
      );
    });

    return () => ctx.revert();
  }, [isMobile, prefersReducedMotion]);

  return (
    <section ref={sectionRef} className="py-20 sm:py-24 relative z-10 overflow-hidden reveal-section">


      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto">

          {/* Heading */}
          <div ref={headingRef} className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-[1px] w-10 bg-gradient-to-r from-transparent to-white/15" />
              <span
                className="text-[#A0A0A0] text-xs sm:text-sm tracking-[0.3em] uppercase px-2"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Our Promise to You
              </span>
              <div className="h-[1px] w-10 bg-gradient-to-l from-transparent to-white/15" />
            </div>
            
            <h2
              className="text-2xl sm:text-4xl text-[#F5F0E8] font-light leading-tight"
              style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
            >
              Shopping should be simple, honest, and stress-free.
            </h2>
          </div>

          {/* Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {BADGES.map(({ Icon, title, desc }, i) => (
              <div
                key={title}
                ref={el => badgeRefs.current[i] = el}
                className="
                  group relative p-8 sm:p-10 rounded-2xl
                  bg-[#111111]/50 backdrop-blur-md
                  border-x border-[#A8B4C8]/10
                  text-center transition-all duration-500
                  hover:-translate-y-2
                  overflow-hidden
                "
              >


                {/* Icon */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-white/10 mb-5">
                  <Icon className="w-6 h-6 text-white/60" strokeWidth={1.5} aria-hidden="true" />
                </div>
                
                {/* Title */}
                <h3 
                  className="text-[#F5F0E8] font-semibold mb-3 text-sm sm:text-base uppercase tracking-widest"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  {title}
                </h3>


                
                {/* Description */}
                <p className="text-[#F5F0E8]/70 text-sm leading-relaxed max-w-[260px] mx-auto">
                  {desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

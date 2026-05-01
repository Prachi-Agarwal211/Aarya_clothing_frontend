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
    <section ref={sectionRef} className="py-20 sm:py-24 relative z-10 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#B76E79]/4 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto">

          {/* Heading */}
          <div ref={headingRef} className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent to-[#F2C29A]/80" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#F2C29A] transform rotate-45" />
              <span
                className="text-[#F2C29A] text-xs sm:text-sm tracking-[0.35em] uppercase px-2"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Our Promise to You
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#F2C29A] transform rotate-45" />
              <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent to-[#F2C29A]/80" />
            </div>
            
            <h2
              className="text-2xl sm:text-4xl text-[#EAE0D5] font-light leading-tight"
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
                  bg-[#0B0608]/50 backdrop-blur-md
                  border-x border-[#B76E79]/10
                  text-center transition-all duration-500
                  hover:-translate-y-2
                  overflow-hidden
                "
              >
                {/* Top/Bottom Glowing Borders */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F2C29A]/60 to-transparent opacity-80" />
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F2C29A]/60 to-transparent opacity-80" />
                
                {/* Top glowing orb effect (optional but nice) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-[#F2C29A] blur-[8px] opacity-60" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-[#F2C29A] blur-[8px] opacity-60" />

                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[#F2C29A]/30 mb-6 group-hover:bg-[#F2C29A]/10 transition-colors duration-300">
                  <Icon className="w-8 h-8 text-[#F2C29A]" strokeWidth={1.5} aria-hidden="true" />
                </div>
                
                {/* Title */}
                <h3 
                  className="text-[#EAE0D5] font-semibold mb-3 text-sm sm:text-base uppercase tracking-widest"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  {title}
                </h3>

                {/* Inner separator */}
                <div className="flex items-center justify-center gap-2 mb-4" aria-hidden="true">
                  <div className="w-1 h-1 rounded-full bg-[#F2C29A] transform rotate-45 opacity-60" />
                </div>
                
                {/* Description */}
                <p className="text-[#EAE0D5]/70 text-sm leading-relaxed max-w-[260px] mx-auto">
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

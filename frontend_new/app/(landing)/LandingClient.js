'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import HeroSection from '@/components/landing/HeroSection';
import IntroVideo from '@/components/landing/IntroVideo';
import { LazyLoad, CardSkeleton } from '@/components/ui/LazyLoad';
import { useViewport } from '@/lib/hooks/useViewport';
import { ShieldCheck, Truck, Lock } from 'lucide-react';
import { gsap } from '@/lib/gsapConfig';

// Lazy load below-fold sections
const NewArrivals = dynamic(() => import('@/components/landing/NewArrivals'), {
  loading: () => (
    <section aria-label="Loading new arrivals" className="py-16 sm:py-20 md:py-24">
      <div className="container mx-auto px-4">
        <CardSkeleton count={4} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      </div>
    </section>
  ),
});

const Collections = dynamic(() => import('@/components/landing/Collections'), {
  loading: () => (
    <section aria-label="Loading collections" className="py-16 sm:py-20 md:py-24">
      <div className="container mx-auto px-4">
        <CardSkeleton count={3} className="grid-cols-1 md:grid-cols-3" />
      </div>
    </section>
  ),
});

const WholesaleSection = dynamic(() => import('@/components/landing/WholesaleSection'), {
  loading: () => (
    <section aria-label="Loading wholesale section" className="py-16 sm:py-20 md:py-24">
      <div className="container mx-auto px-4">
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </section>
  ),
});

const AboutSection = dynamic(() => import('@/components/landing/AboutSection'), {
  loading: () => (
    <section aria-label="Loading about section" className="py-16 sm:py-20 md:py-24">
      <div className="container mx-auto px-4">
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </section>
  ),
});

const Footer = dynamic(() => import('@/components/landing/Footer'), {
  loading: () => (
    <footer aria-label="Loading footer" className="py-16">
      <div className="container mx-auto px-4">
        <div className="skeleton h-48 rounded-3xl" />
      </div>
    </footer>
  ),
});

export default function LandingClient({ landingData }) {
  const [showLanding, setShowLanding] = useState(false);
  const { isMobile } = useViewport();

  const handleVideoEnd = () => {
    setShowLanding(true);
    // Store timestamp to skip for 24 hours
    localStorage.setItem('introVideoLastSeen', Date.now().toString());
  };

  // Skip intro on mobile or if seen within last 24h
  useEffect(() => {
    const lastSeen = localStorage.getItem('introVideoLastSeen');
    const isRecentlySeen = lastSeen && (Date.now() - parseInt(lastSeen, 10)) < 24 * 60 * 60 * 1000;
    
    if (isMobile || isRecentlySeen || localStorage.getItem('introVideoSeen') === 'true') {
      setShowLanding(true);
    }
  }, [isMobile]);

  // Handle hash scrolling
  useEffect(() => {
    if (!showLanding) return;
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const target = document.querySelector(hash);
        if (target) {
          const isMobileView = window.innerWidth < 768;
          gsap.to(window, {
            scrollTo: { y: target, offsetY: isMobileView ? 60 : 80 },
            duration: 1,
            ease: 'power3.inOut',
          });
        }
      }, 500);
    }
  }, [showLanding]);

  return (
    <>
      {/* Intro Video Overlay - Non-blocking */}
      {!showLanding && !isMobile && (
        <div className="fixed inset-0 z-[200]">
          <IntroVideo onVideoEnd={handleVideoEnd} />
        </div>
      )}

      {/* Main Content - Always rendered behind or after intro */}
      <main 
        id="main-content"
        className={`min-h-screen text-[#EAE0D5] overflow-x-hidden selection:bg-[#F2C29A] selection:text-[#050203] transition-opacity duration-700 ${showLanding ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}
        role="main"
        aria-label="Aarya Clothing Landing Page"
      >
        <div className="relative z-10">
          <EnhancedHeader />

          <HeroSection
            tagline={landingData.hero?.tagline}
            slides={landingData.hero?.slides}
            buttons={(() => {
              const apiButtons = landingData.hero?.buttons || [];
              const hasShopLink = apiButtons.some(b => b.link === '/products');
              return hasShopLink ? apiButtons : [...apiButtons, { text: 'Shop Now', link: '/products', variant: 'heroLuxury' }];
            })()}
          />

          <LazyLoad skeletonHeight="400px">
            <NewArrivals
              id="new-arrivals"
              title={landingData.newArrivals?.title}
              subtitle={landingData.newArrivals?.subtitle}
              products={landingData.newArrivals?.products}
            />
          </LazyLoad>

          <LazyLoad skeletonHeight="300px">
            <Collections
              id="collections"
              title={landingData.collections?.title}
              categories={landingData.collections?.categories}
            />
          </LazyLoad>

          <WholesaleSection />

          <LazyLoad skeletonHeight="600px">
            <AboutSection
              id="about"
              title={landingData.about?.title}
              story={landingData.about?.story}
              stats={landingData.about?.stats}
              images={landingData.about?.images}
            />
          </LazyLoad>

          <section className="py-16 sm:py-20 relative z-10">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-[#F2C29A] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                    Our Promise to You
                  </h2>
                  <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A] to-transparent mx-auto mb-4" />
                  <p className="text-[#EAE0D5]/60 text-sm sm:text-base">
                    Shopping should be simple, honest, and stress-free.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { Icon: ShieldCheck, title: 'No Hidden Charges', desc: 'The price you see is the price you pay. All taxes and shipping are already included.' },
                    { Icon: Truck, title: 'Free Shipping', desc: 'All orders ship free across India. No minimum order value, no surprise fees.' },
                    { Icon: Lock, title: 'Secure Online Payment', desc: 'Pay safely via UPI, cards, or net banking through Razorpay.' },
                  ].map(({ Icon, title, desc }) => (
                    <div key={title} className="group relative p-6 rounded-2xl border border-[#B76E79]/20 bg-[#0B0608]/40 text-center backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/20 mb-4">
                        <Icon className="w-7 h-7 text-[#F2C29A]" />
                      </div>
                      <h3 className="text-[#EAE0D5] font-semibold mb-2 text-lg">{title}</h3>
                      <p className="text-[#EAE0D5]/50 text-sm leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <LazyLoad skeletonHeight="300px">
            <Footer id="footer" />
          </LazyLoad>
        </div>
      </main>
    </>
  );
}

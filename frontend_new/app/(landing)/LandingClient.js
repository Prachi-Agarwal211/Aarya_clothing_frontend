'use client';

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import HeroSection from '@/components/landing/HeroSection';
import IntroVideo from '@/components/landing/IntroVideo';
import NewArrivals from '@/components/landing/NewArrivals';
import Collections from '@/components/landing/Collections';
import TrustBadges from '@/components/landing/TrustBadges';
import Footer from '@/components/landing/Footer';
import { useViewport } from '@/lib/hooks/useViewport';
import { gsap } from '@/lib/gsapConfig';

// Lazy load below-the-fold sections for faster initial render / mobile perf
const WholesaleSection = lazy(() => import('@/components/landing/WholesaleSection'));
const AboutSection = lazy(() => import('@/components/landing/AboutSection'));

export default function LandingClient({ landingData }) {
  const [showLanding, setShowLanding] = useState(false);
  const { isMobile } = useViewport();

  const handleVideoEnd = () => {
    setShowLanding(true);
    localStorage.setItem('introVideoLastSeen', Date.now().toString());
  };

  useEffect(() => {
    const lastSeen = localStorage.getItem('introVideoLastSeen');
    const isRecentlySeen = lastSeen && (Date.now() - parseInt(lastSeen, 10)) < 24 * 60 * 60 * 1000;
    
    if (isMobile || isRecentlySeen || localStorage.getItem('introVideoSeen') === 'true') {
      setShowLanding(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!showLanding) return;
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const target = document.querySelector(hash);
        if (target) {
          const isMobileView = window.innerWidth < 768;
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          gsap.to(window, {
            scrollTo: { y: target, offsetY: isMobileView ? 60 : 80 },
            duration: reduce ? 0.01 : 1,
            ease: reduce ? 'none' : 'power3.inOut',
          });
        }
      }, 500);
    }
  }, [showLanding]);

  // Scroll progress indicator — thin gold line that fills as user scrolls
  useEffect(() => {
    if (!showLanding) return;
    const progressBar = document.getElementById('scroll-progress');
    if (!progressBar) return;

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = `${progress}%`;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showLanding]);

  return (
    <>
      {!showLanding && !isMobile && (
        <div className="fixed inset-0 z-[200]">
          <IntroVideo onVideoEnd={handleVideoEnd} />
        </div>
      )}

      {/* Scroll Progress Indicator */}
      <div className="fixed top-0 left-0 w-full h-[2px] z-[200] bg-transparent">
        <div
          id="scroll-progress"
          className="h-full bg-gradient-to-r from-[#7A2F57] via-[#B76E79] to-[#F2C29A] transition-none"
          style={{ width: '0%' }}
        />
      </div>

      <main 
        id="main-content"
        className={`min-h-screen text-[#EAE0D5] overflow-x-hidden selection:bg-[#F2C29A] selection:text-[#050203] transition-opacity duration-700 ${showLanding ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}
        role="main"
        aria-label="Aarya Clothing Landing Page"
      >
        <div className="relative z-10">
          <EnhancedHeader />

          {/* Mobile: show local vertical images; Desktop: show API-provided slides */}
          <HeroSection
            tagline={landingData.hero?.tagline}
            slides={isMobile
              ? [
                  { image: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/landing/432315a38f1d.png', imageMobile: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/landing/432315a38f1d.png', alt: 'Handcrafted elegance' },
                  { image: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/landing/effab78654fd.png', imageMobile: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/landing/effab78654fd.png', alt: 'Timeless designs' },
                ]
              : landingData.hero?.slides
            }
            buttons={(() => {
              const apiButtons = landingData.hero?.buttons || [];
              const hasShopLink = apiButtons.some(b => b.link === '/products');
              return hasShopLink ? apiButtons : [...apiButtons, { text: 'Shop Now', link: '/products', variant: 'heroLuxury' }];
            })()}
          />

          <NewArrivals
            id="new-arrivals"
            title={landingData.newArrivals?.title}
            subtitle={landingData.newArrivals?.subtitle}
            products={landingData.newArrivals?.products}
          />

          <Collections
            id="collections"
            title={landingData.collections?.title}
            categories={landingData.collections?.categories}
          />

          <Suspense fallback={<div className="h-32" />}>
            <WholesaleSection />
          </Suspense>

          <Suspense fallback={<div className="h-64" />}>
            <AboutSection
              id="about"
              title={landingData.about?.title}
              story={landingData.about?.story}
              stats={landingData.about?.stats}
              images={landingData.about?.images}
            />
          </Suspense>

          {/* Trust Badges — extracted to dedicated component with GSAP animations */}
          <TrustBadges />

          <Footer id="footer" />
        </div>
      </main>
    </>
  );
}

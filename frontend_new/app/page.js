'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import HeroSection from '@/components/landing/HeroSection';
import IntroVideo from '@/components/landing/IntroVideo';
import { getLandingAll } from '@/lib/api';
import { gsap } from '@/lib/gsapConfig';
import logger from '@/lib/logger';
import { LazyLoad, CardSkeleton } from '@/components/ui/LazyLoad';

// Lazy load below-fold sections for faster initial load
const NewArrivals = dynamic(() => import('@/components/landing/NewArrivals'), {
  loading: () => (
    <section aria-label="Loading new arrivals" className="py-16 sm:py-20 md:py-24">
      <div className="container mx-auto px-4">
        <CardSkeleton count={4} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      </div>
    </section>
  ),
  ssr: false,
});

const Collections = dynamic(() => import('@/components/landing/Collections'), {
  loading: () => (
    <section aria-label="Loading collections" className="py-16 sm:py-20 md:py-24">
      <div className="container mx-auto px-4">
        <CardSkeleton count={3} className="grid-cols-1 md:grid-cols-3" />
      </div>
    </section>
  ),
  ssr: false,
});

const AboutSection = dynamic(() => import('@/components/landing/AboutSection'), {
  loading: () => (
    <section aria-label="Loading about section" className="py-16 sm:py-20 md:py-24">
      <div className="container mx-auto px-4">
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </section>
  ),
  ssr: false,
});

const Footer = dynamic(() => import('@/components/landing/Footer'), {
  loading: () => (
    <footer aria-label="Loading footer" className="py-16">
      <div className="container mx-auto px-4">
        <div className="skeleton h-48 rounded-3xl" />
      </div>
    </footer>
  ),
  ssr: false,
});

/**
 * Landing Page Component
 * 
 * ARCHITECTURE: Frontend fetches ready-to-use data from backend API.
 * - Backend is the SINGLE SOURCE OF TRUTH
 * - All R2 URLs are constructed by backend
 * - All data transformation happens in backend
 * - All default values come from backend/database
 * - Frontend just displays data as-is
 * 
 * No hard-coded data, no direct R2 access, no transformation logic here.
 */

// Empty fallback for error cases - admin must configure everything
const ERROR_FALLBACK_DATA = {
  hero: {
    tagline: "",
    slides: [],
    buttons: []
  },
  newArrivals: {
    title: "",
    subtitle: "",
    products: []
  },
  collections: {
    title: "",
    categories: []
  },
  about: {
    title: "",
    story: "",
    stats: [],
    images: []
  }
};

export default function Home() {
  const [showLanding, setShowLanding] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [landingData, setLandingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Fetch landing page data from backend
  // Backend returns fully formatted, ready-to-use data
  const fetchLandingData = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);

      // Backend returns data in exact format needed by components
      // No transformation required on frontend
      const response = await getLandingAll();

      if (response) {
        // Direct assignment - backend has already:
        // - Constructed all R2 URLs
        // - Applied default values
        // - Sorted and formatted data
        // - Transformed config into component-ready format
        setLandingData(response);
        logger.log('Landing data loaded from backend');
      } else {
        // Empty response - use error fallback
        setLandingData(ERROR_FALLBACK_DATA);
        setHasError(true);
        logger.warn('Empty response from landing API');
      }
    } catch (error) {
      // API error - use error fallback for graceful degradation
      logger.error('Failed to fetch landing data:', error.message);
      setLandingData(ERROR_FALLBACK_DATA);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    // Fetch landing data from backend
    fetchLandingData();

    // Check if user has already seen the intro video in this session
    const hasSeenIntro = sessionStorage.getItem('hasSeenIntroVideo');
    if (hasSeenIntro) {
      setShowLanding(true);
    }
  }, [fetchLandingData]);

  const handleVideoEnd = () => {
    setShowLanding(true);
  };

  // When landing page is visible and data is loaded, check for URL hash
  // and smooth-scroll to the target section. Retries because dynamic
  // sections (ssr:false) may not be in the DOM immediately.
  useEffect(() => {
    if (!showLanding || !landingData) return;

    const hash = window.location.hash;
    if (!hash) return;

    let attempts = 0;
    const maxAttempts = 5;

    const tryScroll = () => {
      const target = document.querySelector(hash);
      if (target) {
        const isMobile = window.innerWidth < 768;
        gsap.to(window, {
          scrollTo: { y: target, offsetY: isMobile ? 60 : 80 },
          duration: 1,
          ease: 'power3.inOut',
        });
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryScroll, 200);
      }
    };

    // Small delay to let React render dynamic sections
    setTimeout(tryScroll, 100);
  }, [showLanding, landingData]);

  // Don't render anything on server to avoid hydration mismatch
  if (!isClient) {
    return null;
  }

  // Show loading state
  if (isLoading || !landingData) {
    return (
      <main 
        id="main-content"
        className="min-h-screen text-[#EAE0D5] flex items-center justify-center"
        role="main"
        aria-label="Main content"
        aria-busy="true"
      >
        <div 
          className="animate-pulse text-xl"
          role="status"
          aria-live="polite"
        >
          Loading...
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Intro Video Overlay */}
      {!showLanding && (
        <IntroVideo onVideoEnd={handleVideoEnd} />
      )}

      {/* Main Landing Page */}
      <main 
        id="main-content"
        className={`min-h-screen text-[#EAE0D5] overflow-x-hidden selection:bg-[#F2C29A] selection:text-[#050203] transition-opacity duration-700 ${showLanding ? 'opacity-100' : 'opacity-0'}`}
        role="main"
        aria-label="Aarya Clothing Landing Page"
      >
        {/* Background is now handled by root layout - no duplicate SilkBackground here */}

        {/* Scrollable Content Layer */}
        <div className="relative z-10">
          <EnhancedHeader />

          <HeroSection
            tagline={landingData.hero?.tagline}
            slides={landingData.hero?.slides}
            buttons={landingData.hero?.buttons}
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

          <LazyLoad skeletonHeight="600px">
            <AboutSection
              id="about"
              title={landingData.about?.title}
              story={landingData.about?.story}
              stats={landingData.about?.stats}
              images={landingData.about?.images}
            />
          </LazyLoad>

          {/* Pricing Promise / No Hidden Charges Section */}
          <section className="py-16 sm:py-20 relative z-10">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-[#F2C29A] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                    Our Promise to You
                  </h2>
                  <p className="text-[#EAE0D5]/60 text-sm sm:text-base">
                    Shopping should be simple, honest, and stress-free.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {
                      icon: '✓',
                      title: 'No Hidden Charges',
                      desc: 'The price you see is the price you pay. All taxes and shipping are already included — always.',
                      color: 'border-green-500/20 bg-green-500/5',
                      textColor: 'text-green-400',
                    },
                    {
                      icon: '✓',
                      title: 'Free Shipping',
                      desc: 'All orders ship free across India. No minimum order value, no surprise fees at checkout.',
                      color: 'border-[#B76E79]/20 bg-[#7A2F57]/10',
                      textColor: 'text-[#F2C29A]',
                    },
                    {
                      icon: '✓',
                      title: 'Secure Online Payment',
                      desc: 'Pay safely via UPI, cards, or net banking through Razorpay. No COD — your security is our priority.',
                      color: 'border-blue-500/20 bg-blue-500/5',
                      textColor: 'text-blue-400',
                    },
                  ].map((item) => (
                    <div key={item.title} className={`p-6 rounded-2xl border ${item.color} text-center`}>
                      <span className={`text-2xl font-bold ${item.textColor} mb-3 block`}>{item.icon}</span>
                      <h3 className="text-[#EAE0D5] font-semibold mb-2">{item.title}</h3>
                      <p className="text-[#EAE0D5]/50 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <LazyLoad skeletonHeight="300px">
            <Footer
              id="footer"
            />
          </LazyLoad>
        </div>
      </main>
    </>
  );
}

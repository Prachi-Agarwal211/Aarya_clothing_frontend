'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import HeroSection from '@/components/landing/HeroSection';
import IntroVideo from '@/components/landing/IntroVideo';
import { getLandingAll } from '@/lib/api';
import { gsap } from '@/lib/gsapConfig';
import logger from '@/lib/logger';

// Lazy load below-fold sections for faster initial load
const NewArrivals = dynamic(() => import('@/components/landing/NewArrivals'), {
  loading: () => <div className="min-h-[400px]" />,
  ssr: false,
});

const Collections = dynamic(() => import('@/components/landing/Collections'), {
  loading: () => <div className="min-h-[400px]" />,
  ssr: false,
});

const AboutSection = dynamic(() => import('@/components/landing/AboutSection'), {
  loading: () => <div className="min-h-[600px]" />,
  ssr: false,
});

const Footer = dynamic(() => import('@/components/landing/Footer'), {
  loading: () => <div className="min-h-[300px]" />,
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
      <main className="min-h-screen text-[#EAE0D5] flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
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
      <main className={`min-h-screen text-[#EAE0D5] overflow-x-hidden selection:bg-[#F2C29A] selection:text-[#050203] transition-opacity duration-700 ${showLanding ? 'opacity-100' : 'opacity-0'}`}>
        {/* Background is now handled by root layout - no duplicate SilkBackground here */}

        {/* Scrollable Content Layer */}
        <div className="relative z-10">
          <EnhancedHeader />

          <HeroSection
            tagline={landingData.hero?.tagline}
            slides={landingData.hero?.slides}
            buttons={landingData.hero?.buttons}
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

          <AboutSection
            id="about"
            title={landingData.about?.title}
            story={landingData.about?.story}
            stats={landingData.about?.stats}
            images={landingData.about?.images}
          />

          <Footer
            id="footer"
          />
        </div>
      </main>
    </>
  );
}

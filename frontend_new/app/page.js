'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Truck, Lock } from 'lucide-react';
import dynamic from 'next/dynamic';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import HeroSection from '@/components/landing/HeroSection';
import IntroVideo from '@/components/landing/IntroVideo';
import { getLandingAll } from '@/lib/api';
import { gsap } from '@/lib/gsapConfig';
import logger from '@/lib/logger';
import { LazyLoad, CardSkeleton } from '@/components/ui/LazyLoad';

// Lazy load below-fold sections for faster initial load
// PERFORMANCE: Removed ssr:false to enable SSR and prevent hydration jumps
// Skeleton loaders now match content height for stable layout
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
    slides: []
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

// Timeout for API calls (10 seconds)
const API_TIMEOUT_MS = 10000;
// Max retries with exponential backoff
const MAX_RETRIES = 2;
// Initial retry delay in ms
const INITIAL_RETRY_DELAY = 1000;

export default function Home() {
  const [showLanding, setShowLanding] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [landingData, setLandingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch landing page data from backend with timeout and retry
  // Backend returns fully formatted, ready-to-use data
  const fetchLandingData = useCallback(async (isRetry = false, currentRetryCount = 0) => {
    try {
      if (!isRetry) {
        setIsLoading(true);
      }
      setHasError(false);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      try {
        // Backend returns data in exact format needed by components
        // No transformation required on frontend
        const response = await getLandingAll();

        clearTimeout(timeoutId);

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
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      // Check if we should retry
      const isTimeoutError = error.name === 'AbortError' || error.message?.includes('timeout');
      const shouldRetry = !isRetry && currentRetryCount < MAX_RETRIES;

      if (shouldRetry) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, currentRetryCount);
        logger.warn(`Landing data fetch failed (attempt ${currentRetryCount + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchLandingData(true, currentRetryCount + 1);
      }

      // Max retries reached or non-retryable error - use error fallback for graceful degradation
      logger.error('Failed to fetch landing data after retries:', error.message);
      setLandingData(ERROR_FALLBACK_DATA);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch - triggers when component mounts and landing should show
  useEffect(() => {
    if (showLanding && !landingData) {
      fetchLandingData();
    }
  }, [showLanding, landingData, fetchLandingData]);

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

  // Show loading state — but only AFTER intro video is done
  // If video is still playing, let IntroVideo handle the visual
  if (isLoading || !landingData) {
    if (!showLanding) {
      // Intro video is still playing — show it instead of spinner
      return (
        <main id="main-content" className="min-h-screen bg-[#050203]" role="main">
          <IntroVideo onVideoEnd={handleVideoEnd} />
        </main>
      );
    }
    return (
      <main
        id="main-content"
        className="min-h-screen bg-[#050203] flex items-center justify-center"
        role="main"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <div className="w-16 h-16 border-2 border-[#B76E79]/20 border-t-[#F2C29A] rounded-full animate-spin" />
          <p className="text-[#F2C29A]/60 text-sm uppercase tracking-[0.3em] font-light" style={{ fontFamily: 'Cinzel, serif' }}>Aarya Clothing</p>
          {hasError && (
            <button
              onClick={() => {
                setRetryCount(0);
                fetchLandingData();
              }}
              className="mt-2 px-4 py-2 bg-[#7A2F57]/30 text-[#F2C29A] rounded-lg hover:bg-[#7A2F57]/50 transition-colors text-sm"
              type="button"
            >
              Retry
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Intro Video Overlay — only if landing data is loaded but video hasn't ended */}
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
                    {
                      Icon: ShieldCheck,
                      title: 'No Hidden Charges',
                      desc: 'The price you see is the price you pay. All taxes and shipping are already included — always.',
                      gradient: 'from-green-500/10 to-emerald-500/5',
                      border: 'border-green-500/30',
                      iconBg: 'bg-gradient-to-br from-green-500/20 to-emerald-500/10',
                      iconColor: 'text-green-400',
                      hoverGlow: 'group-hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]',
                    },
                    {
                      Icon: Truck,
                      title: 'Free Shipping',
                      desc: 'All orders ship free across India. No minimum order value, no surprise fees at checkout.',
                      gradient: 'from-[#F2C29A]/10 to-[#B76E79]/5',
                      border: 'border-[#F2C29A]/30',
                      iconBg: 'bg-gradient-to-br from-[#F2C29A]/20 to-[#B76E79]/10',
                      iconColor: 'text-[#F2C29A]',
                      hoverGlow: 'group-hover:shadow-[0_0_30px_rgba(242,194,154,0.15)]',
                    },
                    {
                      Icon: Lock,
                      title: 'Secure Online Payment',
                      desc: 'Pay safely via UPI, cards, or net banking through Razorpay. No COD — your security is our priority.',
                      gradient: 'from-blue-500/10 to-cyan-500/5',
                      border: 'border-blue-500/30',
                      iconBg: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10',
                      iconColor: 'text-blue-400',
                      hoverGlow: 'group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
                    },
                  ].map(({ Icon, title, desc, gradient, border, iconBg, iconColor, hoverGlow }) => (
                    <div
                      key={title}
                      className={`group relative p-6 rounded-2xl border ${border} bg-gradient-to-br ${gradient} text-center backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] ${hoverGlow}`}
                    >
                      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${iconBg} border ${border} mb-4 transition-transform duration-300 group-hover:scale-110`}>
                        <Icon className={`w-7 h-7 ${iconColor}`} />
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
            {showLanding && (
              <Footer
                id="footer"
              />
            )}
          </LazyLoad>
        </div>
      </main>
    </>
  );
}

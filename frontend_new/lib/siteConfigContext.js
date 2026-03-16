'use client';

/**
 * Site Configuration Context
 * 
 * This context provides site-wide configuration (logo, video URLs, etc.) from the backend.
 * 
 * ARCHITECTURE: Backend is the SINGLE SOURCE OF TRUTH for all URLs.
 * - All asset URLs come from backend API
 * - No direct R2 access from frontend
 * - No hard-coded URLs in frontend
 * 
 * Usage:
 *   import { useSiteConfig, SiteConfigProvider } from '@/lib/siteConfigContext';
 *   
 *   function MyComponent() {
 *     const { logo, video, isLoading } = useSiteConfig();
 *     return <img src={logo} alt="Logo" />;
 *   }
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSiteConfig } from './api';
import logger from './logger';

// Create context with default values
const SiteConfigContext = createContext(null);

// Default fallback values (only used when API completely fails)
const DEFAULT_CONFIG = {
  logo: null,
  video: {
    intro: {
      desktop: null,
      mobile: null
    }
  },
  noise: null,
  r2BaseUrl: null
};

/**
 * Site Configuration Provider
 * Fetches site config from backend and provides it to all child components.
 */
export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await getSiteConfig();
      if (response) {
        setConfig({
          logo: response.logo && response.logo.trim() !== '' ? response.logo : DEFAULT_CONFIG.logo,
          video: response.video || DEFAULT_CONFIG.video,
          noise: response.noise && response.noise.trim() !== '' ? response.noise : DEFAULT_CONFIG.noise,
          r2BaseUrl: response.r2BaseUrl || ''
        });
        logger.log('Site config loaded from backend');
      }
    } catch (err) {
      // Use defaults on error - graceful fallback
      logger.warn('Failed to fetch site config, using defaults:', err.message);
      setError(err);
      setConfig(DEFAULT_CONFIG);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const value = {
    ...config,
    isLoading,
    error,
    refetch: fetchConfig
  };

  return (
    <SiteConfigContext.Provider value={value}>
      {children}
    </SiteConfigContext.Provider>
  );
}

/**
 * Hook to access site configuration
 * @returns {Object} Site configuration with logo, video, noise, isLoading, error, refetch
 */
export function useSiteConfig() {
  const context = useContext(SiteConfigContext);

  if (!context) {
    throw new Error('useSiteConfig must be used within a SiteConfigProvider');
  }

  return context;
}

/**
 * Hook to get just the logo URL
 * @returns {string} Logo URL
 */
export function useLogo() {
  const { logo } = useSiteConfig();
  return logo;
}

/**
 * Hook to get intro video URLs for desktop and mobile.
 * @returns {{ desktop: string|null, mobile: string|null }} Video URLs per device
 */
export function useIntroVideo() {
  const { video } = useSiteConfig();
  const intro = video?.intro || DEFAULT_CONFIG.video.intro;

  // Normalise: backend may send a plain string (legacy) or { desktop, mobile }
  if (typeof intro === 'string') {
    return { desktop: intro, mobile: null };
  }
  return {
    desktop: intro?.desktop || null,
    mobile: intro?.mobile || null,
  };
}

// Export default
export default SiteConfigContext;

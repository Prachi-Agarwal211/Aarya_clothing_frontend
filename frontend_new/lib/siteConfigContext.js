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
import { landingApi } from './customerApi';
import logger from './logger';

// Create context with default values
const SiteConfigContext = createContext(null);

// Default fallback values (only used when API completely fails)
const DEFAULT_CONFIG = {
  logo: null,
  video: {
    desktop: null,
    mobile: null,
    enabled: true
  },
  noise: null,
  r2BaseUrl: null,
  /** Backend MSG91 configured — when false, SMS OTP UI is disabled */
  smsOtpEnabled: false,
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

      const response = await landingApi.getSiteConfig();
      if (response) {
        setConfig({
          logo: response.logo && response.logo.trim() !== '' ? response.logo : DEFAULT_CONFIG.logo,
          video: response.video || DEFAULT_CONFIG.video,
          noise: response.noise && response.noise.trim() !== '' ? response.noise : DEFAULT_CONFIG.noise,
          r2BaseUrl: response.r2BaseUrl || '',
          smsOtpEnabled: Boolean(response.smsOtpEnabled ?? response.sms_otp_enabled),
          whatsappEnabled: Boolean(response.whatsappEnabled),
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
 * CRITICAL: Mobile ALWAYS falls back to desktop if not available.
 * @returns {{ desktop: string|null, mobile: string|null }} Video URLs per device
 */
export function useIntroVideo() {
  const { video } = useSiteConfig();

  // Admin can disable the video via enabled flag (default: true)
  const enabled = video?.enabled !== false;

  // NEW FORMAT (from backend): video is { desktop, mobile, enabled }
  // Backward compatibility: video.intro (legacy string format)
  
  // First check: Direct desktop/mobile from backend (new format)
  if (video?.desktop || video?.mobile) {
    const desktop = video.desktop || video.mobile;
    const mobile = video.mobile || video.desktop;
    return { desktop, mobile, enabled };
  }

  // Legacy format: video.intro (string or object)
  const intro = video?.intro;
  if (typeof intro === 'string') {
    return { desktop: intro, mobile: intro, enabled };
  }
  if (intro?.desktop || intro?.mobile) {
    return {
      desktop: intro.desktop || intro.mobile,
      mobile: intro.mobile || intro.desktop,
      enabled,
    };
  }
  
  // Fallback to default config
  return {
    desktop: null,
    mobile: null,
    enabled,
  };
}

// Export default
export default SiteConfigContext;

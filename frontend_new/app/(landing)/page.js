import React from 'react';
import LandingClient from './LandingClient';
import { landingApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

// Incremental Static Regeneration: Re-generate the page at most once every 60 seconds
export const revalidate = 60;

/**
 * Server-Side Landing Page (Server Component)
 * 
 * PERFORMANCE: This component fetches data on the server during build or request.
 * The HTML arrives in the browser fully populated with Hero slides, New Arrivals, etc.
 * No more "Loading..." spinners for the initial visit.
 */
export default async function Home() {
  let landingData = null;

  try {
    // Fetch data on the server. Next.js will cache this response.
    landingData = await landingApi.getAll();
    logger.info('Landing page data fetched successfully on server');
  } catch (error) {
    logger.error('Failed to fetch landing data on server:', error.message);
    // Fallback data structure to prevent page crash
    landingData = {
      hero: { tagline: "ELEGANCE IN EVERY THREAD", slides: [] },
      newArrivals: { title: "New Arrivals", products: [] },
      collections: { title: "Our Collections", categories: [] },
      about: { title: "Our Story", story: "", stats: [], images: [] }
    };
  }

  return <LandingClient landingData={landingData} />;
}

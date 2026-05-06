import React from 'react';
import LandingClient from './LandingClient';
import { landingApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

export const revalidate = 60;

export default async function Home() {
  let landingData = null;

  try {
    landingData = await landingApi.getAll();
    logger.info('Landing page data fetched successfully', { 
      heroSlides: landingData?.hero?.slides?.length || 0,
      newArrivals: landingData?.newArrivals?.products?.length || 0 
    });
  } catch (error) {
    logger.error('Failed to fetch landing data:', error.message);
    landingData = {
      hero: { tagline: "ELEGANCE IN EVERY THREAD", slides: [] },
      newArrivals: { title: "New Arrivals", products: [] },
      collections: { title: "Our Collections", categories: [] },
      about: { title: "Our Story", story: "", stats: [], images: [] }
    };
  }

  return <LandingClient landingData={landingData} />;
}

import React from 'react';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { productsApi, reviewsApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

// Revalidate product pages every hour
export const revalidate = 3600;

/**
 * Server-Side Product Detail Page
 * 
 * PERFORMANCE: Fetches product and reviews on the server.
 * Provides instant content for users and perfect SEO for Google.
 */
export default async function Page({ params }) {
  const { id } = await params;

  try {
    // 1. Fetch product first to get the numeric ID
    const productRes = await (isNaN(id) 
      ? productsApi.getBySlug(id) 
      : productsApi.get(id).catch(() => productsApi.getBySlug(id)));

    const product = productRes.product || productRes;
    if (!product) return notFound();

    // 2. Fetch reviews using the numeric product ID
    const reviewsRes = await reviewsApi.list(product.id).catch(() => []);

    // Transform reviews to array
    const reviews = Array.isArray(reviewsRes) 
      ? reviewsRes 
      : (reviewsRes?.reviews || reviewsRes?.items || []);

    return (
      <ProductDetailClient 
        initialProduct={product} 
        initialReviews={reviews} 
      />
    );
  } catch (error) {
    logger.error('Error loading product page on server:', error.message);
    return notFound();
  }
}

import React from 'react';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { productsApi, reviewsApi } from '@/lib/customerApi';
import {
  generateProductSchema,
  generateBreadcrumbSchema,
} from '@/lib/structuredData';
import logger from '@/lib/logger';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aaryaclothing.in';

// ISR: revalidate product pages hourly for speed + freshness
export const revalidate = 3600;

/**
 * Resolve product by numeric id or slug (SSR — SEO-critical).
 */
async function fetchProduct(id) {
  const productRes = await (Number.isNaN(Number(id))
    ? productsApi.getBySlug(id)
    : productsApi.get(id).catch(() => productsApi.getBySlug(id)));
  return productRes?.product || productRes || null;
}

/**
 * Dynamic metadata for Google / social crawlers.
 * Runs on the server — product name, price, image in <head>.
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const product = await fetchProduct(id);
    if (!product) {
      return { title: 'Product not found | Aarya Clothing' };
    }

    const handle = product.slug || product.id;
    const title = `${product.name} | Aarya Clothing`;
    const description = (
      product.short_description ||
      product.meta_description ||
      product.description ||
      `Shop ${product.name} — premium ethnic wear at Aarya Clothing. Free shipping across India.`
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);

    const image =
      product.primary_image ||
      product.image_url ||
      product.images?.[0]?.image_url ||
      `${BASE_URL}/logo.png`;

    const canonical = `${BASE_URL}/products/${handle}`;
    const price = product.price != null ? `₹${Number(product.price).toLocaleString('en-IN')}` : '';

    return {
      title,
      description,
      keywords: [
        product.name,
        product.collection_name,
        product.category,
        'ethnic wear',
        'Aarya Clothing',
        'buy online India',
      ].filter(Boolean),
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: 'Aarya Clothing',
        type: 'website',
        locale: 'en_IN',
        images: [
          {
            url: image,
            width: 1200,
            height: 1600,
            alt: product.name,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: price ? `${description} · ${price}` : description,
        images: [image],
      },
      robots: {
        index: product.is_active !== false,
        follow: true,
      },
      // Extra crawl hints for price-aware SERP/social tools
      other: {
        ...(product.price != null
          ? {
              'product:price:amount': String(product.price),
              'product:price:currency': 'INR',
            }
          : {}),
        ...(product.sku ? { 'product:retailer_item_id': String(product.sku) } : {}),
      },
    };
  } catch (err) {
    logger.error('generateMetadata product failed:', err?.message);
    return { title: 'Aarya Clothing | Premium Ethnic Wear' };
  }
}

/**
 * Server-Side Product Detail Page
 * — Fetches product + reviews on the server for instant HTML + SEO.
 * — Client island only for interactivity (variants, cart).
 */
export default async function Page({ params }) {
  const { id } = await params;

  try {
    const product = await fetchProduct(id);
    if (!product) return notFound();

    const reviewsRes = await reviewsApi.list(product.id).catch(() => []);
    const reviews = Array.isArray(reviewsRes)
      ? reviewsRes
      : reviewsRes?.reviews || reviewsRes?.items || [];

    const handle = product.slug || product.id;
    const productSchema = generateProductSchema(product, reviews);
    const breadcrumbSchema = generateBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Products', url: '/products' },
      ...(product.collection_name
        ? [
            {
              name: product.collection_name,
              url: product.collection_slug
                ? `/products?collection=${product.collection_slug}`
                : '/products',
            },
          ]
        : []),
      { name: product.name, url: `/products/${handle}` },
    ]);

    return (
      <>
        {/* JSON-LD in SSR HTML for rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(productSchema).replace(/</g, '\\u003c'),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c'),
          }}
        />
        <ProductDetailClient
          initialProduct={product}
          initialReviews={reviews}
        />
      </>
    );
  } catch (error) {
    logger.error('Error loading product page on server:', error.message);
    return notFound();
  }
}

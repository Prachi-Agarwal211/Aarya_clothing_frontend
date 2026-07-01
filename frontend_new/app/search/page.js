import React, { Suspense } from 'react';
import SearchClient from './SearchClient';
import { productsApi, collectionsApi } from '@/lib/customerApi';

// Force fully dynamic — never statically cache with empty searchParams.
// ISR caching of a server-computed page without query params will freeze
// the page in the 'start typing' state and never revalidate for different q.
export const dynamic = 'force-dynamic'; // Search varies by query param — ISR unsafe here. Backend caching handles performance.

async function getInitialData(q, pg = 1) {
  if (!q) return { products: [], total: 0, collections: [] };

  try {
    const PAGE_SIZE = 24;
    const params = {
      skip: (pg - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      sort_by: 'newest',
    };

    // Parallel fetch for speed
    const [productsRes, collectionsRes] = await Promise.all([
      productsApi.search(q, params),
      collectionsApi.list()
    ]);

    // Search endpoint returns { hits, total, ... }
    const products = productsRes?.hits || [];
    const collections = Array.isArray(collectionsRes) ? collectionsRes : (collectionsRes?.items || collectionsRes?.collections || []);
    const total = productsRes?.total ?? products.length;

    return { products, collections, total };
  } catch (error) {
    // Direct console.error — logger.error is a no-op in production
    console.error('Search pre-fetch failed:', error?.message || error);
    return { products: [], collections: [], total: 0 };
  }
}

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const q = params.q || '';
  const page = parseInt(params.page || '1', 10);
  
  const initialData = await getInitialData(q, page);
  
  const initialFilters = {
    page: page,
    sort: params.sort || 'created_at:desc',
    collection_id: params.collection_id || '',
    min_price: params.min_price || '',
    max_price: params.max_price || '',
  };

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
        <div className="w-10 h-10 border-2 border-[#E07B8B] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SearchClient 
        initialQuery={q} 
        initialData={initialData}
        initialFilters={initialFilters}
      />
    </Suspense>
  );
}

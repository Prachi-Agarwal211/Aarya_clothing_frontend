import React, { Suspense } from 'react';
import SearchClient from './SearchClient';
import { productsApi, collectionsApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

// Search results should be dynamic but can be cached for a short period
export const revalidate = 300; // Cache search results for 5 minutes

async function getInitialData(q, pg = 1) {
  if (!q) return { products: [], total: 0, collections: [] };

  try {
    const PAGE_SIZE = 24;
    const params = {
      search: q,
      page: pg,
      limit: PAGE_SIZE,
      sort: 'created_at',
      order: 'desc',
    };

    // Parallel fetch for speed
    const [productsRes, collectionsRes] = await Promise.all([
      productsApi.list(params),
      collectionsApi.list()
    ]);

    const products = Array.isArray(productsRes) ? productsRes : (productsRes?.items || productsRes?.products || []);
    const collections = Array.isArray(collectionsRes) ? collectionsRes : (collectionsRes?.items || collectionsRes?.collections || []);
    const total = productsRes?.total ?? products.length;

    return { products, collections, total };
  } catch (error) {
    logger.error('Search pre-fetch failed:', error.message);
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
      <div className="min-h-screen flex items-center justify-center bg-[#050203]">
        <div className="w-10 h-10 border-2 border-[#B76E79] border-t-transparent rounded-full animate-spin" />
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

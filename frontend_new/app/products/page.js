import { Suspense } from 'react';
import ProductsClient from './ProductsClient';
import { productsApi, collectionsApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function getInitialData(params) {
  try {
    const [field, order] = (params.sort || 'created_at:desc').split(':');
    const PAGE_SIZE = 24;
    const page = parseInt(params.page || '1', 10);
    
    const productParams = {
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      sort: field,
      order: order || 'desc',
    };

    if (params.q) productParams.search = params.q;
    if (params.collection_id) productParams.category_id = parseInt(params.collection_id);
    if (params.min_price) productParams.min_price = parseFloat(params.min_price);
    if (params.max_price) productParams.max_price = parseFloat(params.max_price);

    const [productsRes, collectionsRes] = await Promise.all([
      productsApi.list(productParams),
      collectionsApi.list()
    ]);

    const products = Array.isArray(productsRes) 
      ? productsRes 
      : (productsRes?.items || productsRes?.products || productsRes?.hits || []);
    
    const collections = Array.isArray(collectionsRes) 
      ? collectionsRes 
      : (collectionsRes?.items || collectionsRes?.collections || []);
    
    const total = productsRes?.total ?? productsRes?.total_hits ?? products.length;

    return { products, collections, total };
  } catch (error) {
    logger.error('Failed to fetch initial products data:', error.message);
    return { products: [], collections: [], total: 0 };
  }
}

export default async function ProductsPage({ searchParams }) {
  const params = await searchParams;
  const initialData = await getInitialData(params);
  
  const initialFilters = {
    collection_id: params?.collection_id || '',
    minPrice: params?.min_price || '',
    maxPrice: params?.max_price || '',
    sort: params?.sort || 'created_at:desc',
    search: params?.q || '',
    page: parseInt(params?.page || '1', 10),
  };

  // Remount listing when query changes so useState(initialFilters) matches URL (SPA nav)
  const productsClientKey = [
    initialFilters.collection_id ?? '',
    initialFilters.page,
    initialFilters.sort ?? '',
    initialFilters.search ?? '',
    initialFilters.minPrice ?? '',
    initialFilters.maxPrice ?? '',
  ].join('|');

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#050203]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#B76E79]/20 border-t-[#F2C29A] rounded-full animate-spin" />
          <p className="text-[#F2C29A]/60 text-sm uppercase tracking-[0.3em]" style={{ fontFamily: 'Cinzel, serif' }}>Aarya Clothing</p>
        </div>
      </div>
    }>
      <ProductsClient key={productsClientKey} initialFilters={initialFilters} initialData={initialData} />
    </Suspense>
  );
}

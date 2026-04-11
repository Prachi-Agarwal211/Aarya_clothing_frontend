import { Suspense } from 'react';
import ProductsClient from './ProductsClient';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }) {
  const params = await searchParams;
  
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
      <ProductsClient key={productsClientKey} initialFilters={initialFilters} />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ShoppingBag,
} from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import ProductCard from '@/components/common/ProductCard';
import logger from '@/lib/logger';

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'base_price:asc', label: 'Price: Low to High' },
  { value: 'base_price:desc', label: 'Price: High to Low' },
  { value: 'average_rating:desc', label: 'Highest Rated' },
];

const PAGE_SIZE = 24;

// Simple API fetcher - no complex Proxy, direct fetch
async function fetchProductsAPI(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/v1/products/browse${queryString ? '?' + queryString : ''}`;

  console.log('[fetchProductsAPI] Fetching:', url);

  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });

  console.log('[fetchProductsAPI] Response status:', response.status);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function fetchCollectionsAPI() {
  const response = await fetch('/api/v1/collections', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

export default function ProductsContent({ initialFilters, initialData }) {
  const [products, setProducts] = useState(initialData?.products || []);
  const [collections, setCollections] = useState(initialData?.collections || []);
  const [totalProducts, setTotalProducts] = useState(initialData?.total || products.length);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState(initialFilters || {
    collection_id: '',
    minPrice: '',
    maxPrice: '',
    sort: 'created_at:desc',
    search: '',
    page: 1,
  });
  const [searchInput, setSearchInput] = useState(initialFilters?.search || '');
  const debouncedSearch = useDebounce(searchInput, 400);

  const fetchCollections = useCallback(async () => {
    if (initialData?.collections) return; // Skip if already provided
    try {
      const data = await fetchCollectionsAPI();
      const items = Array.isArray(data) ? data : (data?.items || data?.collections || []);
      setCollections(items);
    } catch (err) {
      logger.warn('Failed to load collections:', err?.message);
      setCollections([]);
    }
  }, [initialData]);

  const fetchProducts = useCallback(async (activeFilters, isRetry = false, attempt = 0) => {
    // Skip first fetch if initialData matches current filters
    if (activeFilters === initialFilters && initialData && !isRetry) {
      console.log('[ProductsClient] Using initialData, skipping first fetch');
      return;
    }

    try {
      if (!isRetry) {
        setLoading(true);
      }
      setError(null);

      const [sortField, sortOrder] = (activeFilters.sort || 'created_at:desc').split(':');
      const currentPage = activeFilters.page || 1;
      const skip = (currentPage - 1) * PAGE_SIZE;

      const params = {
        skip: skip,
        limit: PAGE_SIZE,
        sort: sortField,
        order: sortOrder || 'desc',
      };

      if (activeFilters.search) params.search = activeFilters.search;
      if (activeFilters.collection_id) params.category_id = parseInt(activeFilters.collection_id);
      if (activeFilters.minPrice) params.min_price = parseFloat(activeFilters.minPrice);
      if (activeFilters.maxPrice) params.max_price = parseFloat(activeFilters.maxPrice);

      const data = await fetchProductsAPI(params);
      const items = Array.isArray(data) ? data : (data?.items || data?.products || []);
      const total = data?.total ?? items.length;

      setProducts(items);
      setTotalProducts(total);
    } catch (err) {
      console.error('[ProductsClient] Fetch error:', err);
      const shouldRetry = !isRetry && attempt < 2;

      if (shouldRetry) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchProducts(activeFilters, true, attempt + 1);
      }

      setError(err?.message || 'Failed to load products. Please try again.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [initialData, initialFilters]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    fetchProducts(filters);
  }, [filters.collection_id, filters.minPrice, filters.maxPrice, filters.sort, filters.page, fetchProducts]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters(prev => ({ ...prev, search: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch, filters.search]);

  const applyFilter = (updates) => {
    setFilters(prev => ({ ...prev, ...updates, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      collection_id: '',
      minPrice: '',
      maxPrice: '',
      sort: 'created_at:desc',
      search: '',
      page: 1,
    });
  };

  const hasActiveFilters = filters.collection_id || filters.minPrice || filters.maxPrice || filters.search;
  const totalPages = Math.ceil(totalProducts / PAGE_SIZE);
  const selectedCollection = collections.find(c => String(c.id) === String(filters.collection_id));

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            {/* Page Header */}
            <div className="mb-8">
              <nav className="flex items-center gap-2 text-sm text-[#EAE0D5]/50 mb-4">
                <Link href="/" className="hover:text-[#F2C29A] transition-colors">Home</Link>
                <ChevronRightIcon className="w-3 h-3" />
                {selectedCollection ? (
                  <>
                    <Link href="/collections" className="hover:text-[#F2C29A] transition-colors">Collections</Link>
                    <ChevronRightIcon className="w-3 h-3" />
                    <span className="text-[#EAE0D5]">{selectedCollection.name}</span>
                  </>
                ) : (
                  <span className="text-[#EAE0D5]">All Products</span>
                )}
              </nav>
              <h1
                className="text-3xl md:text-4xl font-bold text-[#F2C29A]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                {selectedCollection ? selectedCollection.name : 'Our Collection'}
              </h1>
              <p className="text-[#EAE0D5]/60 mt-2">
                {selectedCollection?.description || 'Discover our curated collection of elegant ethnic wear'}
              </p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder:text-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors text-base"
                />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) => applyFilter({ sort: e.target.value })}
                  className="appearance-none px-4 py-2.5 pr-10 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 transition-colors cursor-pointer text-base"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#0B0608]">{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/50 pointer-events-none" />
              </div>

              {/* Filters Toggle (mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] hover:border-[#B76E79]/40 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-6">
              {/* Filters Sidebar */}
              <aside className={`
                ${showFilters ? 'block' : 'hidden md:block'}
                md:w-64 flex-shrink-0 space-y-4
              `}>
                {/* Mobile close button */}
                {showFilters && (
                  <div className="md:hidden flex justify-end mb-2">
                    <button
                      onClick={() => setShowFilters(false)}
                      className="p-2 rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:border-[#B76E79]/40 hover:text-[#EAE0D5] transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Collections */}
                  {collections.length > 0 && (
                    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
                      <h4 className="text-sm font-semibold text-[#F2C29A] mb-3">Collections</h4>
                      <div className="space-y-1.5">
                        {[{ id: '', name: 'All Collections' }, ...collections].map(col => {
                          const isSelected = String(filters.collection_id) === String(col.id);
                          return (
                            <button
                              key={col.id}
                              onClick={() => applyFilter({ collection_id: col.id })}
                              className="w-full flex items-center gap-2.5 cursor-pointer group py-1"
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'border-[#B76E79] bg-[#B76E79]'
                                  : 'border-[#B76E79]/30 bg-transparent group-hover:border-[#B76E79]/60'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              <span className={`text-sm transition-colors ${
                                isSelected ? 'text-[#F2C29A] font-medium' : 'text-[#EAE0D5]/70 group-hover:text-[#EAE0D5]'
                              }`}>
                                {col.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Price Range */}
                  <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
                    <h4 className="text-sm font-semibold text-[#F2C29A] mb-3">Price Range</h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.minPrice}
                        onChange={(e) => applyFilter({ minPrice: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder:text-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-base"
                      />
                      <span className="text-[#EAE0D5]/50">–</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.maxPrice}
                        onChange={(e) => applyFilter({ maxPrice: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder:text-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-base"
                      />
                    </div>
                  </div>

                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="w-full py-2.5 text-sm text-[#B76E79] hover:text-[#F2C29A] border border-[#B76E79]/20 rounded-xl hover:border-[#B76E79]/40 transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </aside>

              {/* Products Grid */}
              <div className="flex-1 min-w-0 pb-24 md:pb-0">
                {/* Results Count */}
                <p className="text-sm text-[#EAE0D5]/50 mb-4">
                  {loading ? 'Loading...' : `Showing ${products.length} of ${totalProducts} products`}
                </p>

                {error && (
                  <div className="text-center py-12 bg-[#0B0608]/40 rounded-2xl border border-red-500/20">
                    <p className="text-red-400 mb-3">{error}</p>
                    <button
                      onClick={() => fetchProducts(filters)}
                      className="px-4 py-2 bg-[#7A2F57]/30 text-[#F2C29A] rounded-lg hover:bg-[#7A2F57]/50 transition-colors text-sm"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {!error && loading && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-[3/4] bg-[#B76E79]/10 rounded-2xl mb-3" />
                        <div className="h-4 bg-[#B76E79]/10 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-[#B76E79]/10 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                )}

                {!error && !loading && products.length === 0 && (
                  <div className="text-center py-20 bg-[#0B0608]/40 rounded-2xl border border-[#B76E79]/10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#B76E79]/10 flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-[#B76E79]/40" />
                    </div>
                    <h3 className="text-[#F2C29A] text-lg mb-2" style={{ fontFamily: 'Cinzel, serif' }}>No Products Found</h3>
                    <p className="text-[#EAE0D5]/50 text-sm mb-6">
                      {hasActiveFilters ? 'Try adjusting your filters or clearing your search' : 'Check back soon for new arrivals'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="px-5 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl text-sm hover:opacity-90 transition-opacity"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>
                )}

                {!error && !loading && products.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {products.map((product, index) => (
                        <ProductCard
                          key={product.id ?? `product-${product.sku ?? product.slug ?? index}`}
                          product={product}
                          priority={index < 4}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-8">
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                          disabled={filters.page <= 1}
                          className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:border-[#B76E79]/40 hover:text-[#EAE0D5] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-[#EAE0D5]/70 px-4">
                          Page {filters.page} of {totalPages}
                        </span>
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                          disabled={filters.page >= totalPages}
                          className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:border-[#B76E79]/40 hover:text-[#EAE0D5] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRightIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <Footer />
        </div>
      </div>
    </main>
  );
}

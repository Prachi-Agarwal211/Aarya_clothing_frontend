'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronRight,
  Package,
} from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import { productsApi, collectionsApi } from '@/lib/customerApi';

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'base_price:asc', label: 'Price: Low to High' },
  { value: 'base_price:desc', label: 'Price: High to Low' },
  { value: 'average_rating:desc', label: 'Highest Rated' },
];

export default function SearchClient({ initialQuery, initialData, initialFilters }) {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery || '');
  const [inputValue, setInputValue] = useState(initialQuery || '');
  
  const [products, setProducts] = useState(initialData?.products || []);
  const [collections, setCollections] = useState(initialData?.collections || []);
  const [total, setTotal] = useState(initialData?.total || products.length);
  
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(initialFilters?.page || 1);
  const [sort, setSort] = useState(initialFilters?.sort || 'created_at:desc');
  const [collectionId, setCollectionId] = useState(initialFilters?.collection_id || '');
  const [minPrice, setMinPrice] = useState(initialFilters?.min_price || '');
  const [maxPrice, setMaxPrice] = useState(initialFilters?.max_price || '');
  const [showFilters, setShowFilters] = useState(false);

  // Load collections for facet filter on mount if not provided
  useEffect(() => {
    if (collections.length === 0) {
      collectionsApi.list()
        .then(data => {
          const items = Array.isArray(data) ? data : (data?.items || data?.collections || []);
          setCollections(items);
        })
        .catch(() => {});
    }
  }, [collections.length]);

  const doSearch = useCallback(async (q, pg, srt, cid, minP, maxP) => {
    // Skip initial fetch only if SSR data contains actual products
    // (initialData being a truthy empty object would trap the page in 'no results' forever)
    const isInitialParams = 
      q === initialQuery &&
      pg === initialFilters?.page &&
      srt === (initialFilters?.sort || 'created_at:desc') &&
      cid === (initialFilters?.collection_id || '') &&
      minP === (initialFilters?.min_price || '') &&
      maxP === (initialFilters?.max_price || '');

    if (isInitialParams && initialData && initialData?.products?.length > 0) {
      return;
    }

    if (!q?.trim()) {
      setProducts([]);
      setTotal(0);
      return;
    }
    
    try {
      setLoading(true);
      
      // Map frontend sort option to Meilisearch sort_by
      const sortByMap = {
        'created_at:desc': 'newest',
        'base_price:asc': 'price_low',
        'base_price:desc': 'price_high',
        'average_rating:desc': 'popular',
      };
      const sortBy = sortByMap[srt] || 'newest';
      
      const params = {
        skip: (pg - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        sort_by: sortBy,
      };
      if (cid) params.category_id = parseInt(cid);
      if (minP) params.min_price = parseFloat(minP);
      if (maxP) params.max_price = parseFloat(maxP);

      // Use dedicated search endpoint instead of browse
      const data = await productsApi.search(q.trim(), params);
      
      // Search endpoint returns { hits, total, ... }
      const items = data?.hits || [];
      const totalCount = data?.total ?? items.length;
      
      setProducts(items);
      setTotal(totalCount);
    } catch (err) {
      console.error('Search failed:', err);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search when query/filters change
  useEffect(() => {
    doSearch(query, page, sort, collectionId, minPrice, maxPrice);
  }, [query, page, sort, collectionId, minPrice, maxPrice, doSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    setQuery(trimmed);
    setPage(1);
    if (trimmed) {
      router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
    } else {
      router.replace('/search', { scroll: false });
    }
  };

  const clearAll = () => {
    setInputValue('');
    setQuery('');
    setCollectionId('');
    setMinPrice('');
    setMaxPrice('');
    setPage(1);
    router.replace('/search', { scroll: false });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = collectionId || minPrice || maxPrice;

  return (
    <main className="min-h-screen text-[#F5F0E8] selection:bg-[#D4AF37] selection:text-[#000000]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing pb-bottom-nav">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-[#F5F0E8]/50 mb-6">
              <Link href="/" className="hover:text-[#D4AF37] transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#F5F0E8]">Search</span>
              {query && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[#F5F0E8]/70 truncate max-w-[200px]">&ldquo;{query}&rdquo;</span>
                </>
              )}
            </nav>

            {/* Search Bar */}
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="relative max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#F5F0E8]/40" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Search sarees, kurtis, lehengas…"
                  className="w-full pl-12 pr-14 py-4 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-2xl text-[#F5F0E8] placeholder-[#F5F0E8]/30 focus:outline-none focus:border-[#A8B4C8]/50 text-lg transition-colors"
                />
                {inputValue && (
                  <button
                    type="button"
                    onClick={() => { setInputValue(''); setQuery(''); setPage(1); router.replace('/search', { scroll: false }); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#F5F0E8]/40 hover:text-[#F5F0E8]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>

            {/* Results header */}
            {query && (
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <p className="text-[#F5F0E8]/70">
                  {loading ? 'Searching…' : (
                    total > 0
                      ? <>{total} result{total !== 1 ? 's' : ''} for <span className="text-[#D4AF37] font-medium">&ldquo;{query}&rdquo;</span></>
                      : <>No results for <span className="text-[#D4AF37] font-medium">&ldquo;{query}&rdquo;</span></>
                  )}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-3 py-2 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-sm text-[#F5F0E8]/70 hover:border-[#A8B4C8]/40 transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {hasFilters && <span className="w-2 h-2 rounded-full bg-[#A8B4C8]" />}
                  </button>

                  <select
                    value={sort}
                    onChange={(e) => { setSort(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-sm text-[#F5F0E8] focus:outline-none focus:border-[#A8B4C8]/40 transition-colors appearance-none cursor-pointer"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[#111111]">{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Filter panel */}
            {showFilters && (
              <div className="bg-[#111111]/40 backdrop-blur-md border border-[#A8B4C8]/15 rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Collection */}
                {collections.length > 0 && (
                  <div>
                    <label className="block text-xs text-[#F5F0E8]/60 mb-2 uppercase tracking-wider">Collection</label>
                    <select
                      value={collectionId}
                      onChange={(e) => { setCollectionId(e.target.value); setPage(1); }}
                      className="w-full px-3 py-2 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-sm text-[#F5F0E8] focus:outline-none focus:border-[#A8B4C8]/40 appearance-none"
                    >
                      <option value="">All Collections</option>
                      {collections.map(c => (
                        <option key={c.id} value={c.id} className="bg-[#111111]">{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Min Price */}
                <div>
                  <label className="block text-xs text-[#F5F0E8]/60 mb-2 uppercase tracking-wider">Min Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-sm text-[#F5F0E8] focus:outline-none focus:border-[#A8B4C8]/40 placeholder-[#F5F0E8]/30"
                  />
                </div>
                {/* Max Price */}
                <div>
                  <label className="block text-xs text-[#F5F0E8]/60 mb-2 uppercase tracking-wider">Max Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                    placeholder="Any"
                    className="w-full px-3 py-2 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-sm text-[#F5F0E8] focus:outline-none focus:border-[#A8B4C8]/40 placeholder-[#F5F0E8]/30"
                  />
                </div>
                {hasFilters && (
                  <div className="sm:col-span-3 flex justify-end">
                    <button onClick={clearAll} className="text-xs text-[#A8B4C8] hover:text-[#D4AF37] transition-colors">
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* No query state */}
            {!query && (
              <div className="text-center py-24">
                <Search className="w-16 h-16 text-[#A8B4C8]/20 mx-auto mb-4" />
                <p className="text-[#F5F0E8]/50 text-lg">Start typing to search products</p>
                <p className="text-[#F5F0E8]/30 text-sm mt-2">Try &ldquo;kurti&rdquo;, &ldquo;saree&rdquo;, or &ldquo;lehenga&rdquo;</p>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && query && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-[#A8B4C8]/10 rounded-2xl animate-pulse" />
                ))}
              </div>
            )}

            {/* No results */}
            {!loading && query && products.length === 0 && (
              <div className="text-center py-24">
                <Package className="w-16 h-16 text-[#A8B4C8]/20 mx-auto mb-4" />
                <h2 className="text-xl text-[#F5F0E8]/70 mb-2">No results found</h2>
                <p className="text-[#F5F0E8]/40 text-sm mb-6">
                  Try different keywords or browse our collections
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button
                    onClick={clearAll}
                    className="px-4 py-2 bg-[#1E3A5F]/20 border border-[#A8B4C8]/30 rounded-xl text-[#D4AF37] text-sm hover:bg-[#1E3A5F]/40 transition-colors"
                  >
                    Clear search
                  </button>
                  <Link
                    href="/collections"
                    className="px-4 py-2 bg-gradient-to-r from-[#1E3A5F] to-[#A8B4C8] rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
                  >
                    Browse Collections
                  </Link>
                </div>
              </div>
            )}

            {/* Results grid */}
            {!loading && products.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                  {products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.slug || product.id}`}
                      className="group bg-[#111111]/40 backdrop-blur-md border border-[#A8B4C8]/15 rounded-2xl overflow-hidden hover:border-[#A8B4C8]/30 hover:shadow-[0_0_30px_rgba(183,110,121,0.08)] transition-all duration-300"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-[#1C1C1C]">
                        {(product.primary_image || product.image_url) ? (
                          <Image
                            src={product.primary_image || product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[#161616] flex items-center justify-center">
                            <span className="text-[#A8B4C8]/30 text-xs">No Image</span>
                          </div>
                        )}
                        {(product.is_new || product.is_new_arrival) && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#1E3A5F]/80 text-[#D4AF37] text-xs rounded-lg">New</span>
                        )}
                        {product.discount_percentage > 0 && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#A8B4C8]/80 text-white text-xs rounded-lg">
                            {product.discount_percentage}% OFF
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-[#A8B4C8] mb-1 truncate">{product.collection_name || product.category}</p>
                        <h3 className="text-sm font-medium text-[#F5F0E8] group-hover:text-[#D4AF37] transition-colors line-clamp-2 leading-tight">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-semibold text-[#D4AF37] text-sm">{formatCurrency(product.price)}</span>
                          {product.mrp > product.price && (
                            <span className="text-xs text-[#F5F0E8]/40 line-through">{formatCurrency(product.mrp)}</span>
                          )}
                        </div>
                        {product.average_rating > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-yellow-400 text-xs">★</span>
                            <span className="text-xs text-[#F5F0E8]/60">{product.average_rating}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pb-12">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-sm text-[#F5F0E8]/70 hover:border-[#A8B4C8]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[#F5F0E8]/50">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-sm text-[#F5F0E8]/70 hover:border-[#A8B4C8]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}

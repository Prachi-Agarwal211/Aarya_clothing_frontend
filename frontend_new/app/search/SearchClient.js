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
    // Skip initial fetch if we have SSR data and filters haven't changed
    const isInitialParams = 
      q === initialQuery &&
      pg === initialFilters?.page &&
      srt === (initialFilters?.sort || 'created_at:desc') &&
      cid === (initialFilters?.collection_id || '') &&
      minP === (initialFilters?.min_price || '') &&
      maxP === (initialFilters?.max_price || '');

    if (isInitialParams && initialData) {
      return;
    }

    if (!q?.trim()) {
      setProducts([]);
      setTotal(0);
      return;
    }
    
    try {
      setLoading(true);
      const [sortField, sortOrder] = (srt || 'created_at:desc').split(':');
      const params = {
        search: q.trim(),
        page: pg,
        limit: PAGE_SIZE,
        sort: sortField,
        order: sortOrder || 'desc',
      };
      if (cid) params.category_id = parseInt(cid);
      if (minP) params.min_price = parseFloat(minP);
      if (maxP) params.max_price = parseFloat(maxP);

      const data = await productsApi.list(params);
      
      // Robust data extraction
      let items = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data?.items) {
        items = data.items;
      } else if (data?.products) {
        items = data.products;
      } else if (data?.hits) {
        items = data.hits;
      }
      
      const totalCount = data?.total ?? data?.total_hits ?? items.length;
      
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
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-[#EAE0D5]/50 mb-6">
              <Link href="/" className="hover:text-[#F2C29A] transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#EAE0D5]">Search</span>
              {query && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[#EAE0D5]/70 truncate max-w-[200px]">&ldquo;{query}&rdquo;</span>
                </>
              )}
            </nav>

            {/* Search Bar */}
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="relative max-w-2xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#EAE0D5]/40" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Search sarees, kurtis, lehengas…"
                  className="w-full pl-12 pr-14 py-4 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-2xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 text-lg transition-colors"
                />
                {inputValue && (
                  <button
                    type="button"
                    onClick={() => { setInputValue(''); setQuery(''); setPage(1); router.replace('/search', { scroll: false }); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#EAE0D5]/40 hover:text-[#EAE0D5]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>

            {/* Results header */}
            {query && (
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <p className="text-[#EAE0D5]/70">
                  {loading ? 'Searching…' : (
                    total > 0
                      ? <>{total} result{total !== 1 ? 's' : ''} for <span className="text-[#F2C29A] font-medium">&ldquo;{query}&rdquo;</span></>
                      : <>No results for <span className="text-[#F2C29A] font-medium">&ldquo;{query}&rdquo;</span></>
                  )}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5]/70 hover:border-[#B76E79]/40 transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {hasFilters && <span className="w-2 h-2 rounded-full bg-[#B76E79]" />}
                  </button>

                  <select
                    value={sort}
                    onChange={(e) => { setSort(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 transition-colors appearance-none cursor-pointer"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[#0B0608]">{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Filter panel */}
            {showFilters && (
              <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Collection */}
                {collections.length > 0 && (
                  <div>
                    <label className="block text-xs text-[#EAE0D5]/60 mb-2 uppercase tracking-wider">Collection</label>
                    <select
                      value={collectionId}
                      onChange={(e) => { setCollectionId(e.target.value); setPage(1); }}
                      className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 appearance-none"
                    >
                      <option value="">All Collections</option>
                      {collections.map(c => (
                        <option key={c.id} value={c.id} className="bg-[#0B0608]">{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Min Price */}
                <div>
                  <label className="block text-xs text-[#EAE0D5]/60 mb-2 uppercase tracking-wider">Min Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 placeholder-[#EAE0D5]/30"
                  />
                </div>
                {/* Max Price */}
                <div>
                  <label className="block text-xs text-[#EAE0D5]/60 mb-2 uppercase tracking-wider">Max Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                    placeholder="Any"
                    className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 placeholder-[#EAE0D5]/30"
                  />
                </div>
                {hasFilters && (
                  <div className="sm:col-span-3 flex justify-end">
                    <button onClick={clearAll} className="text-xs text-[#B76E79] hover:text-[#F2C29A] transition-colors">
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* No query state */}
            {!query && (
              <div className="text-center py-24">
                <Search className="w-16 h-16 text-[#B76E79]/20 mx-auto mb-4" />
                <p className="text-[#EAE0D5]/50 text-lg">Start typing to search products</p>
                <p className="text-[#EAE0D5]/30 text-sm mt-2">Try &ldquo;kurti&rdquo;, &ldquo;saree&rdquo;, or &ldquo;lehenga&rdquo;</p>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && query && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-[#B76E79]/10 rounded-2xl animate-pulse" />
                ))}
              </div>
            )}

            {/* No results */}
            {!loading && query && products.length === 0 && (
              <div className="text-center py-24">
                <Package className="w-16 h-16 text-[#B76E79]/20 mx-auto mb-4" />
                <h2 className="text-xl text-[#EAE0D5]/70 mb-2">No results found</h2>
                <p className="text-[#EAE0D5]/40 text-sm mb-6">
                  Try different keywords or browse our collections
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button
                    onClick={clearAll}
                    className="px-4 py-2 bg-[#7A2F57]/20 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] text-sm hover:bg-[#7A2F57]/40 transition-colors"
                  >
                    Clear search
                  </button>
                  <Link
                    href="/collections"
                    className="px-4 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
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
                      className="group bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden hover:border-[#B76E79]/30 hover:shadow-[0_0_30px_rgba(183,110,121,0.08)] transition-all duration-300"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden">
                        {(product.primary_image || product.image_url) ? (
                          <Image
                            src={product.primary_image || product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[#1A1114] flex items-center justify-center">
                            <span className="text-[#B76E79]/30 text-xs">No Image</span>
                          </div>
                        )}
                        {(product.is_new || product.is_new_arrival) && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#7A2F57]/80 text-[#F2C29A] text-xs rounded-lg">New</span>
                        )}
                        {product.discount_percentage > 0 && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#B76E79]/80 text-white text-xs rounded-lg">
                            {product.discount_percentage}% OFF
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-[#B76E79] mb-1 truncate">{product.collection_name || product.category}</p>
                        <h3 className="text-sm font-medium text-[#EAE0D5] group-hover:text-[#F2C29A] transition-colors line-clamp-2 leading-tight">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-semibold text-[#F2C29A] text-sm">{formatCurrency(product.price)}</span>
                          {product.mrp > product.price && (
                            <span className="text-xs text-[#EAE0D5]/40 line-through">{formatCurrency(product.mrp)}</span>
                          )}
                        </div>
                        {product.average_rating > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-yellow-400 text-xs">★</span>
                            <span className="text-xs text-[#EAE0D5]/60">{product.average_rating}</span>
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
                      className="px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5]/70 hover:border-[#B76E79]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[#EAE0D5]/50">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5]/70 hover:border-[#B76E79]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search,
  Grid,
  List,
  ChevronDown,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ShoppingBag,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
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

export default function ProductsContent({ initialFilters }) {
  const router = useRouter();
  const { addItem, openCart } = useCart();
  const { isStaff } = useAuth();
  const isAdminUser = isStaff();
  const [quickAddingId, setQuickAddingId] = React.useState(null);

  const handleQuickAdd = async (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.in_stock || quickAddingId) return;
    setQuickAddingId(product.id);
    try {
      const variantId = product.inventory?.[0]?.id || null;
      await addItem(product.id, 1, variantId);
      openCart();
    } catch (err) {
      logger.error('Quick add failed:', err);
    } finally {
      setQuickAddingId(null);
    }
  };

  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
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
    try {
      const data = await fetchCollectionsAPI();
      const items = Array.isArray(data) ? data : (data?.items || data?.collections || []);
      setCollections(items);
    } catch (err) {
      logger.warn('Failed to load collections:', err?.message);
      setCollections([]);
    }
  }, []);

  const fetchProducts = useCallback(async (activeFilters, isRetry = false, attempt = 0) => {
    console.log('[ProductsClient] fetchProducts called', { activeFilters, isRetry, attempt });
    try {
      if (!isRetry) {
        setLoading(true);
      }
      setError(null);

      const [sortField, sortOrder] = (activeFilters.sort || 'created_at:desc').split(':');

      const params = {
        page: activeFilters.page || 1,
        limit: PAGE_SIZE,
        sort: sortField,
        order: sortOrder || 'desc',
      };

      if (activeFilters.search) params.search = activeFilters.search;
      if (activeFilters.collection_id) params.category_id = parseInt(activeFilters.collection_id);
      if (activeFilters.minPrice) params.min_price = parseFloat(activeFilters.minPrice);
      if (activeFilters.maxPrice) params.max_price = parseFloat(activeFilters.maxPrice);

      console.log('[ProductsClient] Fetching from URL:', `/api/v1/products/browse?${new URLSearchParams(params).toString()}`);
      
      const data = await fetchProductsAPI(params);
      console.log('[ProductsClient] Fetch successful, received:', data);
      const items = Array.isArray(data) ? data : (data?.items || data?.products || []);
      const total = data?.total ?? items.length;

      setProducts(items);
      setTotalProducts(total);
      console.log('[ProductsClient] State updated:', { items: items.length, total });
    } catch (err) {
      console.error('[ProductsClient] Fetch error:', err);
      const shouldRetry = !isRetry && attempt < 2;

      if (shouldRetry) {
        const delay = 1000 * Math.pow(2, attempt);
        logger.warn(`Products fetch failed (attempt ${attempt + 1}/3), retrying in ${delay}ms...`, err?.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchProducts(activeFilters, true, attempt + 1);
      }

      logger.error('Error fetching products after retries:', err);
      setError(err?.message || 'Failed to load products. Please try again.');
      setProducts([]);
    } finally {
      setLoading(false);
      console.log('[ProductsClient] Loading set to false');
    }
  }, []);

  useEffect(() => {
    console.log('[ProductsClient] fetchCollections useEffect running');
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    console.log('[ProductsClient] fetchProducts useEffect running', { filters });
    fetchProducts(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.collection_id, filters.minPrice, filters.maxPrice, filters.sort, filters.page, fetchProducts]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      applyFilter({ search: debouncedSearch, page: 1 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

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

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const hasActiveFilters = filters.collection_id || filters.minPrice || filters.maxPrice || filters.search;
  const totalPages = Math.ceil(totalProducts / PAGE_SIZE);
  const selectedCollection = collections.find(c => String(c.id) === String(filters.collection_id));

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        <div className="h-16 bg-[#0B0608]/60 border-b border-[#B76E79]/10" />
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

              {/* View Mode & Filters Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="md:hidden px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] hover:border-[#B76E79]/40 transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
                <div className="flex rounded-xl border border-[#B76E79]/20 overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2.5 transition-colors ${viewMode === 'grid' ? 'bg-[#B76E79]/20 text-[#F2C29A]' : 'bg-[#0B0608]/60 text-[#EAE0D5]/50 hover:text-[#EAE0D5]'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2.5 transition-colors ${viewMode === 'list' ? 'bg-[#B76E79]/20 text-[#F2C29A]' : 'bg-[#0B0608]/60 text-[#EAE0D5]/50 hover:text-[#EAE0D5]'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
                    <div className={`
                      grid gap-4 md:gap-6
                      ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'}
                    `}>
                      {products.map(product => {
                      // Validate product ID to prevent null/undefined URLs
                      const productHref = product.id ? `/products/${product.slug || product.id}` : '/products';
                      return (
                        <Link
                          key={product.id ?? `product-${product.sku ?? product.slug ?? 'unknown'}`}
                          href={productHref}
                          className="group"
                        >
                          <div className={`
                            bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15
                            rounded-2xl overflow-hidden
                            hover:border-[#B76E79]/30 hover:shadow-[0_0_30px_rgba(183,110,121,0.1)]
                            transition-all duration-300
                            ${viewMode === 'list' ? 'flex' : ''}
                          `}>
                            {/* Image */}
                            <div className={`
                              relative overflow-hidden flex-shrink-0
                              ${viewMode === 'list' ? 'w-32 h-32' : 'aspect-[3/4]'}
                            `}>
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
                                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-[#7A2F57]/80 text-[#F2C29A] text-xs rounded-md">
                                  New
                                </span>
                              )}
                              {product.discount_percentage > 0 && (
                                <span className="absolute top-2 right-2 z-10 px-2 py-0.5 bg-[#B76E79]/80 text-white text-xs rounded-md">
                                  {product.discount_percentage}% OFF
                                </span>
                              )}
                              {/* Quick-add (admin/staff only) */}
                              {isAdminUser && viewMode === 'grid' && product.in_stock && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 z-10">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      addItem(product.id, 1, product.inventory?.[0]?.id || null);
                                      openCart();
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#7A2F57]/90 text-[#F2C29A] text-sm rounded-xl hover:bg-[#7A2F57] transition-colors backdrop-blur-sm"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    Quick Add
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="p-3 md:p-4">
                              {(product.collection_name || product.category) && (
                                <p className="text-xs text-[#B76E79] mb-1 truncate">
                                  {product.collection_name || product.category}
                                </p>
                              )}
                              <h3 className="font-medium text-[#EAE0D5] group-hover:text-[#F2C29A] transition-colors line-clamp-2 text-sm md:text-base">
                                {product.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="font-semibold text-[#F2C29A]">{formatCurrency(product.price)}</span>
                                {product.mrp && product.mrp > product.price && (
                                  <span className="text-sm text-[#EAE0D5]/40 line-through">
                                    {formatCurrency(product.mrp)}
                                  </span>
                                )}
                              </div>
                              {product.average_rating > 0 && (
                                <div className="flex items-center gap-1 mt-2">
                                  <Star className="w-3.5 h-3.5 fill-[#B76E79] text-[#B76E79]" />
                                  <span className="text-xs text-[#EAE0D5]/70">
                                    {product.average_rating.toFixed(1)} ({product.review_count || product.reviews_count || 0})
                                  </span>
                                </div>
                              )}
                              {!product.in_stock && (
                                <p className="text-xs text-red-400 mt-2 font-medium">Out of Stock</p>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
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
      </div>
      <Footer />
    </main>
  );
}

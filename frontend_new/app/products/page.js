'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Filter,
  Grid,
  List,
  ChevronDown,
  X,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import ProductCard from '@/components/common/ProductCard';
import { productsApi, categoriesApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
];

function ProductsContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
    search: searchParams.get('q') || '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [productsData, categoriesData] = await Promise.all([
        productsApi.list({ limit: 50 }),
        categoriesApi.list(),
      ]);

      setProducts(productsData.products || productsData || []);
      setCategories(categoriesData.categories || categoriesData || []);
    } catch (err) {
      logger.error('Error fetching data:', err);
      setError('Failed to load products. Please try again.');
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Filter and sort products
  const filteredProducts = products.filter(product => {
    if (filters.category && product.category?.toLowerCase() !== filters.category.toLowerCase()) return false;
    if (filters.minPrice && product.price < parseInt(filters.minPrice)) return false;
    if (filters.maxPrice && product.price > parseInt(filters.maxPrice)) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return product.name.toLowerCase().includes(search) ||
        product.category?.toLowerCase().includes(search);
    }
    return true;
  }).sort((a, b) => {
    switch (filters.sort) {
      case 'price-low': return a.price - b.price;
      case 'price-high': return b.price - a.price;
      case 'rating': return (b.rating || 0) - (a.rating || 0);
      case 'popular': return (b.reviews || 0) - (a.reviews || 0);
      default: return b.id - a.id;
    }
  });

  const clearFilters = () => {
    setFilters({
      category: '',
      minPrice: '',
      maxPrice: '',
      sort: 'newest',
      search: '',
    });
  };

  const hasActiveFilters = filters.category || filters.minPrice || filters.maxPrice || filters.search;

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      {/* Background is now handled by root layout */}

      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            {/* Page Header */}
            <div className="mb-8">
              <h1
                className="text-3xl md:text-4xl font-bold text-[#F2C29A]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Our Collection
              </h1>
              <p className="text-[#EAE0D5]/60 mt-2">
                Discover our curated collection of elegant ethnic wear
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
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors"
                />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
                  className="appearance-none px-4 py-2.5 pr-10 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 transition-colors cursor-pointer"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value} className="bg-[#0B0608]">{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/50 pointer-events-none" />
              </div>

              {/* Filter Toggle (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>

              {/* View Mode */}
              <div className="hidden md:flex items-center gap-1 p-1 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#7A2F57]/30 text-[#F2C29A]' : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[#7A2F57]/30 text-[#F2C29A]' : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-6 relative">
              {/* Mobile Filter Overlay */}
              {showFilters && (
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
                  onClick={() => setShowFilters(false)}
                />
              )}
              {/* Filters Sidebar */}
              <aside className={`
              fixed md:static inset-y-0 left-0 z-50 w-72 
              bg-[#0B0608]/95 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none
              transform transition-transform duration-300
              ${showFilters ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
              md:w-64 flex-shrink-0
            `}>
                <div className="h-full md:h-auto overflow-y-auto p-6 md:p-0">
                  {/* Mobile Close */}
                  <div className="flex items-center justify-between mb-6 md:hidden">
                    <h3 className="text-lg font-semibold text-[#F2C29A]">Filters</h3>
                    <button onClick={() => setShowFilters(false)}>
                      <X className="w-5 h-5 text-[#EAE0D5]/70" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Categories */}
                    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
                      <h4 className="text-sm font-semibold text-[#F2C29A] mb-3">Categories</h4>
                      <div className="space-y-2">
                        {categories.map(cat => (
                          <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="radio"
                              name="category"
                              checked={filters.category === cat.slug || filters.category === cat.name}
                              onChange={() => setFilters(prev => ({ ...prev, category: cat.slug || cat.name }))}
                              className="w-4 h-4 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
                            />
                            <span className="text-sm text-[#EAE0D5]/70 group-hover:text-[#EAE0D5] transition-colors">
                              {cat.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
                      <h4 className="text-sm font-semibold text-[#F2C29A] mb-3">Price Range</h4>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          value={filters.minPrice}
                          onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
                        />
                        <span className="text-[#EAE0D5]/50">-</span>
                        <input
                          type="number"
                          placeholder="Max"
                          value={filters.maxPrice}
                          onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
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
                </div>
              </aside>

              {/* Products Grid */}
              <div className="flex-1">
                {/* Results Count */}
                <p className="text-sm text-[#EAE0D5]/50 mb-4">
                  Showing {filteredProducts.length} products
                </p>

                {/* Products */}
                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-[3/4] bg-[#B76E79]/10 rounded-2xl mb-3" />
                        <div className="h-4 bg-[#B76E79]/10 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-[#B76E79]/10 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[#EAE0D5]/50">No products found</p>
                    <button
                      onClick={clearFilters}
                      className="mt-4 text-[#B76E79] hover:text-[#F2C29A] transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className={`
                  grid gap-4 md:gap-6
                  ${viewMode === 'grid'
                      ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                      : 'grid-cols-1'
                    }
                `}>
                    {filteredProducts.map(product => (
                      <Link
                        key={product.id}
                        href={`/products/${product.slug || product.id}`}
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
                          relative overflow-hidden
                          ${viewMode === 'list' ? 'w-32 h-32 flex-shrink-0' : 'aspect-[3/4]'}
                        `}>
                            <div className="absolute inset-0 bg-[#7A2F57]/20 flex items-center justify-center">
                              <span className="text-[#B76E79]/30 text-sm">Image</span>
                            </div>
                            {product.is_new && (
                              <span className="absolute top-2 left-2 px-2 py-1 bg-[#7A2F57]/80 text-[#F2C29A] text-xs rounded-lg">
                                New
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-4">
                            <p className="text-xs text-[#B76E79] mb-1">{product.category}</p>
                            <h3 className="font-medium text-[#EAE0D5] group-hover:text-[#F2C29A] transition-colors line-clamp-2">
                              {product.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="font-semibold text-[#F2C29A]">{formatCurrency(product.price)}</span>
                              {product.mrp > product.price && (
                                <span className="text-sm text-[#EAE0D5]/50 line-through">
                                  {formatCurrency(product.mrp)}
                                </span>
                              )}
                            </div>
                            {product.rating && (
                              <div className="flex items-center gap-1 mt-2">
                                <span className="text-yellow-400">★</span>
                                <span className="text-sm text-[#EAE0D5]/70">{product.rating}</span>
                                <span className="text-xs text-[#EAE0D5]/50">({product.reviews})</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Footer />
        </div>
      </div>


    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-pulse text-[#8A6A5C]">Loading products...</div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}

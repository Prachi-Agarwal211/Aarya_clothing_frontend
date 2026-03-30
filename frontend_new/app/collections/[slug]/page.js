'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  ChevronDown,
  ArrowLeft,
  X,
  Grid,
  List,
} from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import { productsApi, collectionsApi, wishlistApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/ui/Toast';
import logger from '@/lib/logger';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
];

const PRICE_RANGES = [
  { value: '', label: 'All Prices' },
  { value: '0-200', label: 'Under ₹200' },
  { value: '200-300', label: '₹200 - ₹300' },
  { value: '300-400', label: '₹300 - ₹400' },
  { value: '400-500', label: '₹400 - ₹500' },
  { value: '500-700', label: '₹500 - ₹700' },
  { value: '700-1000', label: '₹700 - ₹1000' },
  { value: '1000+', label: 'Above ₹1000' },
];

export default function CollectionPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug;
  const { addItem, openCart } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({
    priceRange: '',
    maxPrice: '',
    sort: 'newest',
    search: '',
  });

  // Handle add to cart
  const handleAddToCart = async (productData) => {
    try {
      await addItem(productData.id, productData.quantity || 1, {
        id: productData.variantId
      });
      toast.success('Added to Cart', `${productData.name} has been added to your cart`);
      openCart();
    } catch (error) {
      toast.error('Error', error.message || 'Failed to add item to cart');
    }
  };

  // Handle wishlist - requires authentication
  const handleWishlist = async (product) => {
    // Check if user is authenticated first
    if (!isAuthenticated) {
      toast.error('Login Required', 'Please login to add items to your wishlist');
      return;
    }

    try {
      // Check if already in wishlist
      const isInWishlist = await wishlistApi.check(product.id);

      if (isInWishlist?.in_wishlist) {
        await wishlistApi.remove(product.id);
        toast.success('Removed from Wishlist', `${product.name} removed from your wishlist`);
      } else {
        await wishlistApi.add(product.id);
        toast.success('Added to Wishlist', `${product.name} added to your wishlist`);
      }
    } catch (error) {
      toast.error('Error', error.message || 'Failed to update wishlist');
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch category first to get the ID
      const catData = await collectionsApi.getBySlug(slug);
      setCategory(catData);

      // Fetch products filtered by category_id (backend filtering)
      const response = await productsApi.list({
        category_id: catData.id,
        limit: 100
      });

      const allProducts = Array.isArray(response)
        ? response
        : (response?.items || response?.products || []);
      setProducts(allProducts);
    } catch (err) {
      logger.error('Error fetching collection data:', err);
      setError('Failed to load collection. Please try again.');
      toast?.error('Error', 'Failed to load products');
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
    const price = product.price || 0;
    
    // Handle price range filter
    if (filters.priceRange) {
      if (filters.priceRange === '0-200' && price >= 200) return false;
      else if (filters.priceRange === '200-300' && (price < 200 || price > 300)) return false;
      else if (filters.priceRange === '300-400' && (price < 300 || price > 400)) return false;
      else if (filters.priceRange === '400-500' && (price < 400 || price > 500)) return false;
      else if (filters.priceRange === '500-700' && (price < 500 || price > 700)) return false;
      else if (filters.priceRange === '700-1000' && (price < 700 || price > 1000)) return false;
      else if (filters.priceRange === '1000+' && price < 1000) return false;
    }
    
    // Handle max price filter
    if (filters.maxPrice && price > parseInt(filters.maxPrice)) return false;
    
    // Handle search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (product.name || '').toLowerCase().includes(search);
    }
    
    return true;
  }).sort((a, b) => {
    switch (filters.sort) {
      case 'price-low': return (a.price || 0) - (b.price || 0);
      case 'price-high': return (b.price || 0) - (a.price || 0);
      case 'rating': return (b.rating || 0) - (a.rating || 0);
      case 'popular': return (b.reviews_count || 0) - (a.reviews_count || 0);
      default: return (b.id || 0) - (a.id || 0);
    }
  });

  const clearFilters = () => {
    setFilters({
      priceRange: '',
      maxPrice: '',
      sort: 'newest',
      search: '',
    });
  };

  const hasActiveFilters = filters.priceRange || filters.maxPrice || filters.search;

  // Check if collection exists
  if (!loading && !category) {
    return (
      <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
        <div className="relative z-10 page-wrapper">
          <EnhancedHeader />
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            <div className="text-center py-20">
              <h1 className="text-3xl md:text-4xl font-bold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Collection Not Found
              </h1>
              <p className="text-[#EAE0D5]/60 mb-8">
                The collection you&apos;re looking for doesn&apos;t exist or has been removed.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#7A2F57] text-[#F2C29A] rounded-xl hover:bg-[#7A2F57]/80 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </div>
          </div>
          <div className="mt-16">
            <Footer />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="page-content">
          {/* Collection Header - compact and clean */}
          <div className="container mx-auto px-4 sm:px-6 md:px-8 pt-20 pb-6">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm text-[#EAE0D5]/60 hover:text-[#F2C29A] transition-colors mb-4"
              aria-label="Go back to previous page"
              type="button"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Collections
            </button>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-[#EAE0D5]/50 mb-5" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-[#F2C29A] transition-colors">Home</Link>
              <span className="text-[#EAE0D5]/30" aria-hidden="true">/</span>
              <Link href="/collections" className="hover:text-[#F2C29A] transition-colors">Collections</Link>
              <span className="text-[#EAE0D5]/30" aria-hidden="true">/</span>
              <span className="text-[#F2C29A]">{category?.name}</span>
            </nav>

            <div className="flex items-end gap-6">
              {category?.image_url && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#B76E79]/20 flex-shrink-0 hidden sm:block">
                  <Image
                    src={category.image_url}
                    alt={category.name}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              )}
              <div>
                <h1
                  className="text-3xl md:text-4xl font-bold text-[#F2C29A]"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  {category?.name}
                </h1>
                {category?.description && (
                  <p className="text-[#EAE0D5]/60 mt-1.5 max-w-2xl text-sm md:text-base">
                    {category.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="container mx-auto px-4 sm:px-6 md:px-8 pb-16">
            {/* Toolbar - single row with all controls */}
            <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-[#B76E79]/10">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
                <input
                  type="text"
                  placeholder="Search in collection..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors text-sm"
                />
              </div>

              {/* Price Range Dropdown */}
              <div className="relative">
                <select
                  value={filters.priceRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceRange: e.target.value }))}
                  className="appearance-none pl-3 pr-8 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 transition-colors cursor-pointer text-sm min-w-[140px]"
                >
                  {PRICE_RANGES.map(range => (
                    <option key={range.value} value={range.value} className="bg-[#0B0608]">{range.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#EAE0D5]/50 pointer-events-none" />
              </div>

              {/* Max Price Input */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Max ₹"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                  className="w-24 px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
                />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
                  className="appearance-none pl-3 pr-8 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 transition-colors cursor-pointer text-sm"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value} className="bg-[#0B0608]">{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#EAE0D5]/50 pointer-events-none" />
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#B76E79] hover:text-[#F2C29A] border border-[#B76E79]/20 rounded-xl hover:border-[#B76E79]/40 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}

              {/* Results count */}
              <span className="ml-auto text-sm text-[#EAE0D5]/40">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
              </span>
            </div>

            {/* Products Grid - full width, no sidebar */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[3/4] bg-[#B76E79]/10 rounded-2xl mb-3" />
                    <div className="h-4 bg-[#B76E79]/10 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-[#B76E79]/10 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#EAE0D5]/50 mb-4">No products found in this collection</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-6 py-2 text-sm text-[#B76E79] hover:text-[#F2C29A] border border-[#B76E79]/20 rounded-xl hover:border-[#B76E79]/40 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className={`grid gap-4 md:gap-5 ${
                viewMode === 'grid'
                  ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                  : 'grid-cols-1'
              }`}>
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
                      <div className={`relative overflow-hidden ${viewMode === 'list' ? 'w-28 h-28 flex-shrink-0' : 'aspect-[3/4]'}`}>
                        {(product.primary_image || product.image_url) ? (
                          <Image
                            src={product.primary_image || product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[#1A1114] flex items-center justify-center">
                            <span className="text-[#B76E79]/30 text-xs">No Image</span>
                          </div>
                        )}
                        {(product.is_new || product.is_new_arrival) && (
                          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-[#7A2F57]/80 text-[#F2C29A] text-xs rounded-md">New</span>
                        )}
                        {product.discount_percentage > 0 && (
                          <span className="absolute top-2 right-2 z-10 px-2 py-0.5 bg-[#B76E79]/80 text-white text-xs rounded-md">{product.discount_percentage}% OFF</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <h3 className="font-medium text-[#EAE0D5] group-hover:text-[#F2C29A] transition-colors line-clamp-2 text-sm">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="font-semibold text-[#F2C29A] text-sm">{formatCurrency(product.price)}</span>
                          {product.mrp > product.price && (
                            <span className="text-xs text-[#EAE0D5]/40 line-through">{formatCurrency(product.mrp)}</span>
                          )}
                        </div>
                        {product.rating > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-yellow-400 text-xs">★</span>
                            <span className="text-xs text-[#EAE0D5]/60">{product.rating}</span>
                            <span className="text-xs text-[#EAE0D5]/40">({product.reviews_count || 0})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Footer />
        </div>
      </div>
    </main>
  );
}

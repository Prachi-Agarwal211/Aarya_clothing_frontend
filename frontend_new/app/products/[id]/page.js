'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Heart,
  Share2,
  Truck,
  Shield,
  RotateCcw,
  ChevronRight,
  Minus,
  Plus,
  Check,
  Star,
  MessageCircle,
  AlertCircle,
  Ruler,
} from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import SizeGuideModal from '@/components/product/SizeGuideModal';
import RelatedProducts from '@/components/product/RelatedProducts';
import { productsApi, reviewsApi, wishlistApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id;
  const { showAlert } = useAlertToast();
  const { addItem, openCart } = useCart();
  const { user, isAuthenticated } = useAuth();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name, text: product?.description, url });
      } catch (e) {
        if (e.name !== 'AbortError') showAlert('Could not share', 'error');
      }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      showAlert('Link copied to clipboard!', 'success');
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  const handleImageTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
  const handleImageTouchEnd = (e) => {
    if (touchStartX === null || !product?.images?.length) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 40) return;
    setSelectedImage(prev =>
      dx < 0
        ? (prev + 1) % product.images.length
        : (prev - 1 + product.images.length) % product.images.length
    );
    setTouchStartX(null);
  };

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  // Update selected variant when size or color changes
  useEffect(() => {
    if (product && product.inventory) {
      const variant = product.inventory.find(
        (inv) => inv.size === selectedSize && (!selectedColor || inv.color === selectedColor.name)
      );
      setSelectedVariant(variant);
    }
  }, [selectedSize, selectedColor, product]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);

      let productData;
      try {
        // Try fetching by ID (if productId is a number)
        if (!isNaN(productId)) {
          productData = await productsApi.get(productId);
        } else {
          // If not a number, try by slug directly
          productData = await productsApi.getBySlug(productId);
        }
      } catch (err) {
        // If ID fetch fails or wasn't a number, try by slug
        if (isNaN(productId) || err.status === 404) {
          productData = await productsApi.getBySlug(productId);
        } else {
          throw err;
        }
      }

      const product = productData.product || productData;

      // Derive sizes & colors from inventory if not provided as top-level arrays
      if (!product.sizes || product.sizes.length === 0) {
        const sizesFromInv = [...new Set(
          (product.inventory || []).map(i => i.size).filter(Boolean)
        )];
        product.sizes = sizesFromInv;
      }
      if (!product.colors || product.colors.length === 0) {
        const colorsFromInv = [...new Map(
          (product.inventory || [])
            .filter(i => i.color)
            .map(i => [i.color, { name: i.color, hex: '#B76E79' }])
        ).values()];
        product.colors = colorsFromInv;
      }

      setProduct(product);

      // Canonical redirect: if accessed by numeric ID and product has a non-numeric slug, redirect to slug URL
      const isNumericId = /^\d+$/.test(String(productId));
      if (product.slug && isNumericId && String(product.id) === String(productId) && product.slug !== String(productId)) {
        router.replace(`/products/${product.slug}`, { scroll: false });
      }

      // Fetch reviews
      const reviewsData = await reviewsApi.list(product.id);
      setReviews(reviewsData.reviews || reviewsData || []);

      // Auto-select first available size/color
      if (product.sizes?.length > 0) setSelectedSize(product.sizes[0]);
      if (product.colors?.length > 0) setSelectedColor(product.colors[0]);

      // Check if in wishlist
      if (isAuthenticated) {
        try {
          const wishlistCheck = await wishlistApi.check(product.id);
          setIsWishlisted(wishlistCheck.in_wishlist);
        } catch (err) {
          // Ignore wishlist check errors
        }
      }
    } catch (err) {
      logger.error('Error fetching product:', err);
      setError('Failed to load product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/auth/login?redirect_url=${encodeURIComponent(currentPath)}`;
      }
      return;
    }

    const hasSizes = product?.sizes?.length > 0;
    if (hasSizes && !selectedSize) {
      showAlert('Please select a size');
      return;
    }

    try {
      setAddingToCart(true);
      // Pass the actual variant ID from our matching logic
      await addItem(product.id, quantity, { id: selectedVariant?.id });
      openCart();
    } catch (err) {
      logger.error('Error adding to cart:', err);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/auth/login?redirect_url=${encodeURIComponent(currentPath)}`;
      }
      return;
    }

    try {
      if (isWishlisted) {
        await wishlistApi.remove(product.id);
      } else {
        await wishlistApi.add(product.id);
      }
      setIsWishlisted(!isWishlisted);
    } catch (err) {
      logger.error('Error updating wishlist:', err);
      // Don't toggle on error - show feedback instead
      if (err.message?.includes('401')) {
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname + window.location.search;
          window.location.href = `/auth/login?redirect_url=${encodeURIComponent(currentPath)}`;
        }
      }
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

  // Calculate discount percentage
  const discountPercent = product?.mrp > product?.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  if (loading) {
    return (
      <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
        {/* Background is now handled by root layout */}
        <div className="relative z-10">
          <EnhancedHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse grid md:grid-cols-2 gap-8">
              <div className="aspect-[3/4] bg-[#B76E79]/10 rounded-2xl" />
              <div className="space-y-4">
                <div className="h-8 bg-[#B76E79]/10 rounded w-3/4" />
                <div className="h-4 bg-[#B76E79]/10 rounded w-1/2" />
                <div className="h-6 bg-[#B76E79]/10 rounded w-1/4" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
        <div className="relative z-10">
          <EnhancedHeader />
          <div className="container mx-auto px-4 py-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[#B76E79]" />
            <h1 className="text-2xl text-[#F2C29A] mb-4">{error}</h1>
            <div className="flex gap-4 justify-center">
              <button
                onClick={fetchProduct}
                className="px-6 py-2 bg-[#7A2F57] text-white rounded-lg hover:bg-[#6A1F47]"
              >
                Try Again
              </button>
              <Link href="/products" className="px-6 py-2 border border-[#B76E79] text-[#B76E79] rounded-lg hover:bg-[#B76E79]/10">
                Back to Products
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
        {/* Background is now handled by root layout */}
        <div className="relative z-10">
          <EnhancedHeader />
          <div className="container mx-auto px-4 py-8 text-center">
            <h1 className="text-2xl text-[#F2C29A] mb-4">Product Not Found</h1>
            <Link href="/products" className="text-[#B76E79] hover:text-[#F2C29A]">
              Back to Products
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      {/* Background is now handled by root layout */}

      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 header-spacing pb-bottom-nav lg:pb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-6">
            <Link href="/" className="text-[#EAE0D5]/50 hover:text-[#EAE0D5]">Home</Link>
            <ChevronRight className="w-4 h-4 text-[#EAE0D5]/30" />
            <Link href="/collections" className="text-[#EAE0D5]/50 hover:text-[#EAE0D5]">Collections</Link>
            {(product.collection_slug || product.collection_name || product.category) && (
              <>
                <ChevronRight className="w-4 h-4 text-[#EAE0D5]/30" />
                {product.collection_slug ? (
                  <Link href={`/collections/${product.collection_slug}`} className="text-[#EAE0D5]/50 hover:text-[#EAE0D5]">
                    {product.collection_name || product.category}
                  </Link>
                ) : (
                  <span className="text-[#EAE0D5]/50">{product.collection_name || product.category}</span>
                )}
              </>
            )}
            <ChevronRight className="w-4 h-4 text-[#EAE0D5]/30" />
            <span className="text-[#F2C29A] truncate max-w-[200px]">{product.name}</span>
          </nav>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Product Images */}
            <div className="space-y-4">
              {/* Main Image — swipeable on mobile */}
              <div
                className="relative aspect-[3/4] bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden swipe-x"
                onTouchStart={handleImageTouchStart}
                onTouchEnd={handleImageTouchEnd}
              >
                {product.images && product.images.length > 0 && product.images[selectedImage]?.image_url ? (
                  <Image
                    src={product.images[selectedImage].image_url}
                    alt={product.images[selectedImage].alt_text || product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[#B76E79]/30">No Image Available</span>
                  </div>
                )}
                {(product.is_new || product.is_new_arrival) && (
                  <span className="absolute top-4 left-4 px-3 py-1.5 bg-[#7A2F57]/80 text-[#F2C29A] text-sm rounded-lg">
                    New Arrival
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="absolute top-4 right-4 px-3 py-1.5 bg-[#B76E79]/80 text-white text-sm rounded-lg">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>

              {/* Thumbnail Gallery */}
              {product.images && product.images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {product.images.map((img, idx) => (
                    <button
                      key={img.id || `thumb-${idx}`}
                      onClick={() => setSelectedImage(idx)}
                      className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${selectedImage === idx
                        ? 'border-[#B76E79]'
                        : 'border-[#B76E79]/20 hover:border-[#B76E79]/40'
                        }`}
                    >
                      <Image
                        src={img.image_url}
                        alt={img.alt_text || `${product.name} ${idx + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              {/* Title & Rating */}
              <div>
                <p className="text-sm text-[#B76E79] mb-2">{product.collection_name || product.category}</p>
                <h1
                  className="text-2xl md:text-3xl font-bold text-[#F2C29A]"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  {product.name}
                </h1>
                <div className="flex items-center gap-4 mt-3">
                  {(product.rating ?? 0) > 0 ? (
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < Math.floor(product.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-[#EAE0D5]/20'}`}
                        />
                      ))}
                      <span className="text-sm text-[#EAE0D5]/70 ml-1">
                        {product.rating ?? 0} ({product.reviews_count ?? 0} reviews)
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-[#EAE0D5]/50">No reviews yet</p>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[#F2C29A]">{formatCurrency(product.price)}</span>
                {product.mrp > product.price && (
                  <>
                    <span className="text-lg text-[#EAE0D5]/50 line-through">{formatCurrency(product.mrp)}</span>
                    <span className="text-sm text-[#B76E79]">Save {formatCurrency(product.mrp - product.price)}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-green-400 mt-1">
                ✓ Final price - includes all taxes and shipping
              </p>

              {/* Color Selection */}
              {product.colors && product.colors.length > 0 && (
                <div>
                  <p className="text-sm text-[#EAE0D5]/70 mb-2">Color: <span className="text-[#EAE0D5]">{selectedColor?.name || 'Select'}</span></p>
                  <div className="flex gap-3">
                    {product.colors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setSelectedColor(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${selectedColor?.name === color.name
                          ? 'border-[#F2C29A] scale-110'
                          : 'border-[#B76E79]/20 hover:border-[#B76E79]/40'
                          }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-[#EAE0D5]/70">Size: <span className="text-[#EAE0D5]">{selectedSize || 'Select'}</span></p>
                  <button 
                    onClick={() => setShowSizeGuide(true)}
                    className="text-sm text-[#B76E79] hover:text-[#F2C29A] flex items-center gap-1 transition-colors"
                  >
                    <Ruler className="w-4 h-4" />
                    Size Guide
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes?.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-lg border transition-all ${selectedSize === size
                        ? 'bg-[#7A2F57]/30 border-[#B76E79] text-[#F2C29A]'
                        : 'bg-[#0B0608]/40 border-[#B76E79]/20 text-[#EAE0D5]/70 hover:border-[#B76E79]/40'
                        }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <p className="text-sm text-[#EAE0D5]/70 mb-2">Quantity</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-[#B76E79]/20 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2.5 text-[#EAE0D5]/70 hover:text-[#EAE0D5] hover:bg-[#B76E79]/10 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-[#EAE0D5]">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stock_quantity || 10, quantity + 1))}
                      className="p-2.5 text-[#EAE0D5]/70 hover:text-[#EAE0D5] hover:bg-[#B76E79]/10 transition-colors"
                      disabled={quantity >= (product.stock_quantity || 10)}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.in_stock || addingToCart}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingToCart ? 'Adding...' : 'Add to Cart'}
                </button>
                <button
                  onClick={handleWishlist}
                  className={`p-3.5 rounded-xl border transition-all ${isWishlisted
                    ? 'bg-[#B76E79]/20 border-[#B76E79] text-[#B76E79]'
                    : 'border-[#B76E79]/20 text-[#EAE0D5]/70 hover:border-[#B76E79]/40 hover:text-[#EAE0D5]'
                    }`}
                >
                  <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
                </button>
                <button onClick={handleShare} className="p-3.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:border-[#B76E79]/40 hover:text-[#EAE0D5] transition-all" aria-label="Share product">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-4 gap-2 pt-6 border-t border-[#B76E79]/15">
                <div className="text-center group">
                  <Truck className="w-5 h-5 mx-auto text-[#B76E79] mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] uppercase tracking-wider text-[#EAE0D5]/60 font-medium">Free Shipping</p>
                </div>
                <div className="text-center group">
                  <Shield className="w-5 h-5 mx-auto text-[#B76E79] mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] uppercase tracking-wider text-[#EAE0D5]/60 font-medium">Secure SSL</p>
                </div>
                <div className="text-center group">
                  <RotateCcw className="w-5 h-5 mx-auto text-[#B76E79] mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] uppercase tracking-wider text-[#EAE0D5]/60 font-medium">7-Day Return</p>
                </div>
                <div className="text-center group">
                  <Check className="w-5 h-5 mx-auto text-[#B76E79] mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] uppercase tracking-wider text-[#EAE0D5]/60 font-medium">100% Genuine</p>
                </div>
              </div>

              {/* SKU */}
              <p className="text-sm text-[#EAE0D5]/50">SKU: {product.sku}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-12">
            <div className="flex gap-6 border-b border-[#B76E79]/15">
              {['description', 'details', 'reviews'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium capitalize transition-colors ${activeTab === tab
                    ? 'text-[#F2C29A] border-b-2 border-[#B76E79]'
                    : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]'
                    }`}
                >
                  {tab} {tab === 'reviews' && `(${reviews ? reviews.length : 0})`}
                </button>
              ))}
            </div>

            <div className="py-6">
              {activeTab === 'description' && (
                <div className="prose prose-invert max-w-none">
                  <p className="text-[#EAE0D5]/80 leading-relaxed">{product.description}</p>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-[#B76E79]/10">
                      <span className="text-[#EAE0D5]/50">Material</span>
                      <span className="text-[#EAE0D5]">{product.material || 'Premium Quality'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#B76E79]/10">
                      <span className="text-[#EAE0D5]/50">Weight</span>
                      <span className="text-[#EAE0D5]">{product.weight || 'Standard'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#B76E79]/10">
                      <span className="text-[#EAE0D5]/50">Dimensions</span>
                      <span className="text-[#EAE0D5]">{product.dimensions || 'Standard'}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[#F2C29A] mb-2">Care Instructions</h4>
                    <p className="text-[#EAE0D5]/70 text-sm">{product.care_instructions || 'Dry clean recommended'}</p>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-6">
                  {/* Review Summary */}
                  <div className="flex items-center gap-6 p-4 bg-[#0B0608]/40 rounded-xl">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-[#F2C29A]">{product.rating}</p>
                      <div className="flex items-center justify-center gap-0.5 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < Math.floor(product.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-[#EAE0D5]/20'}`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-[#EAE0D5]/50 mt-1">{product.reviews_count} reviews</p>
                    </div>
                    <button className="ml-auto px-4 py-2 bg-[#7A2F57]/30 text-[#F2C29A] rounded-lg hover:bg-[#7A2F57]/40 transition-colors">
                      Write a Review
                    </button>
                  </div>

                  {/* Reviews List */}
                  <div className="space-y-4">
                    {Array.isArray(reviews) && reviews.map((review, reviewIdx) => (
                      <div key={review.id || `review-${reviewIdx}`} className="p-4 bg-[#0B0608]/40 rounded-xl">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-[#EAE0D5]">{review.user || review.user_id || 'Anonymous'}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${i < (review.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-[#EAE0D5]/20'}`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-[#EAE0D5]/50">{review.date || new Date(review.created_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[#EAE0D5]/70 mt-2 text-sm">{review.comment || review.text || ''}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <button className="flex items-center gap-1 text-xs text-[#EAE0D5]/50 hover:text-[#EAE0D5]">
                            <Check className="w-3 h-3" />
                            Helpful ({review.helpful || review.helpful_count || 0})
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!reviews || reviews.length === 0) && (
                      <p className="text-[#EAE0D5]/50 text-center py-4">No reviews yet. Be the first to review this product!</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <RelatedProducts productId={product?.id} collectionId={product?.collection_id} />
        <Footer />
      </div>

      {/* Mobile Sticky Add-to-Cart Bar */}
      {product && (
        <div className="fixed bottom-nav-offset inset-x-0 lg:hidden bg-[#0B0608]/95 backdrop-blur-md border-t border-[#B76E79]/15 px-3 pt-3 pb-safe-or-3 z-[110] flex items-center gap-3"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[#F2C29A] font-semibold text-sm line-clamp-1">{product.name}</p>
            <p className="text-[#F2C29A] font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.price)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!product.in_stock || addingToCart}
            className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {!product.in_stock ? 'Out of Stock' : addingToCart ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
      )}

      {/* Size Guide Modal */}
      <SizeGuideModal 
        isOpen={showSizeGuide} 
        onClose={() => setShowSizeGuide(false)} 
        category={product?.category?.toLowerCase() || 'kurta'}
      />
    </main>
  );
}

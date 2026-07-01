'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Truck,
  Shield,
  ChevronRight,
  Minus,
  Plus,
  Check,
  Star,
  AlertCircle,
  Ruler,
  ShoppingBag,
  RotateCcw,
} from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import SizeGuideModal from '@/components/product/SizeGuideModal';
import RelatedProducts from '@/components/product/RelatedProducts';
import ReviewForm from '@/components/review/ReviewForm';
import ProductShareButton from '@/components/product/ProductShareButton';
import { reviewsApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';
import { getColorName, getHexFromName } from '@/lib/colorMap';

// Clear, user-facing instruction (single source of truth for this message)
const VARIANT_SELECTION_INSTRUCTION = "Select size and color to check availability and add to cart";

const HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;

const normalizeHex = (value) => {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!HEX_COLOR_RE.test(v)) return null;
  return v.toUpperCase();
};

const normalizeColorName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const variantMatchesColor = (inv, colorKey) => {
  if (!inv || !colorKey) return true;
  const invHex = normalizeHex(inv.color_hex);
  if (invHex) return invHex === colorKey;
  return false;
};

export default function ProductDetailClient({ initialProduct, initialReviews }) {
  const router = useRouter();
  const { showAlert } = useAlertToast();
  const { addItem, openCart } = useCart();
  const { isAuthenticated } = useAuth();

  // Fix 1: Sync product state with incoming prop so data stays fresh
  const [product, setProduct] = useState(initialProduct);
  const [heroError, setHeroError] = useState(false);
  const [thumbErrors, setThumbErrors] = useState({});
  const [reviews, setReviews] = useState(initialReviews || []);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  // Sync when parent passes a new product (e.g. after revalidation)
  useEffect(() => {
    if (initialProduct) setProduct(initialProduct);
  }, [initialProduct]);

  const handleReviewSuccess = async () => {
    setShowReviewForm(false);
    try {
      const reviewsData = await reviewsApi.list(product.id);
      setReviews(reviewsData || []);
      showAlert('Review submitted successfully!', 'success');
    } catch (err) {
      logger.error('Failed to reload reviews:', err);
    }
  };

  const findVariantImageForColor = (color) => {
    if (!color || !product) return null;
    const variant = (product.inventory || []).find((v) => {
      if (!v?.image_url) return false;
      const vHex = normalizeHex(v.color_hex);
      const cHex = normalizeHex(color.hex);
      return vHex === cHex;
    });
    return variant?.image_url || null;
  };

  const selectColor = (color) => {
    setSelectedColor(color);
    const variantImage = findVariantImageForColor(color);
    if (!variantImage || !product?.images?.length) return;
    const matchIdx = product.images.findIndex((img) => img.image_url === variantImage);
    if (matchIdx >= 0) setSelectedImage(matchIdx);
  };

  const handleImageTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
  const handleImageTouchEnd = (e) => {
    if (touchStartX === null || !product?.images?.length) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 80) return;
    setSelectedImage(prev =>
      dx < 0
        ? (prev + 1) % product.images.length
        : (prev - 1 + product.images.length) % product.images.length
    );
    setTouchStartX(null);
  };

  const selectedColorKey = selectedColor ? normalizeHex(selectedColor.hex) : null;

  const getMatchingVariant = (size, colorKey = selectedColorKey) => {
    if (!product?.inventory?.length) return null;
    const targetName = normalizeColorName(selectedColor?.name);
    return product.inventory.find((inv) => {
      if (inv.size !== size) return false;
      if (!colorKey) return true;
      const invHex = normalizeHex(inv.color_hex);
      if (invHex && invHex === colorKey) return true;
      // Fallback: match by color name when hex is missing or is fallback grey
      if (targetName && normalizeColorName(inv.color) === targetName) return true;
      return false;
    }) || null;
  };

  const getVariantStockStatus = (variant) => {
    if (!variant || variant.in_stock === false) return 'out_of_stock';
    if (typeof variant.available_quantity === 'number' && variant.available_quantity <= 3) return 'low_stock';
    return 'in_stock';
  };

  const colorHasAnyStock = (color) => {
    if (!product?.inventory?.length || !color) return true;
    const selHex = normalizeHex(color.hex);
    return product.inventory.some((inv) => (normalizeHex(inv.color_hex) || selHex) === selHex && inv.in_stock);
  };

  // Fix 3: Consolidated initialization — runs once when product loads,
  // then separately when the user actively changes size/color.
  // Uses an "initialized" flag to avoid the cascading re-render loop.
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!product || initialized) return;

    // Auto-select first color with stock
    if (product.colors?.length && !selectedColor) {
      const firstWithStock = product.colors.find(c => colorHasAnyStock(c)) || product.colors[0];
      if (firstWithStock) setSelectedColor(firstWithStock);
    }
    // NOTE: We DO NOT auto-select size on load. Forcing the user to actively
    // select their size prevents sizing mistakes (critical for premium ethnic wear)
    // and ensures the variant instruction banner/alerts function properly.
    setInitialized(true);
  }, [product, initialized, selectedColor, selectedSize]);

  // Update variant when size or color changes (user-initiated or initialized)
  useEffect(() => {
    if (!product?.inventory?.length) return;
    const colorKey = selectedColor ? normalizeHex(selectedColor.hex) : null;
    const targetName = normalizeColorName(selectedColor?.name);
    const variant = product.inventory.find((inv) => {
      if (inv.size !== selectedSize) return false;
      if (!colorKey) return true;
      const invHex = normalizeHex(inv.color_hex);
      if (invHex && invHex === colorKey) return true;
      if (targetName && normalizeColorName(inv.color) === targetName) return true;
      return false;
    }) || null;
    setSelectedVariant(variant);
  }, [selectedSize, selectedColor, product]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/auth/login?redirect_url=${encodeURIComponent(currentPath)}`);
      return;
    }

    if ((product?.sizes?.length > 0 || product?.colors?.length > 0) && !selectedVariant) {
      showAlert(VARIANT_SELECTION_INSTRUCTION);
      return;
    }

    const variant = getMatchingVariant(selectedSize, selectedColorKey) || selectedVariant;
    if (!variant?.in_stock) {
      showAlert('Selected variant is out of stock', 'error');
      return;
    }

    try {
      setAddingToCart(true);
      await addItem(product.id, quantity, { id: variant.id });
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
      openCart();
    } catch (err) {
      logger.error('Error adding to cart:', err);
    } finally {
      setAddingToCart(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const renderDescription = (desc) => {
    if (!desc) return <p className="text-[#F5F5F5]/50 italic">No description available.</p>;
    return desc.split(/\n\s*\n/).filter(Boolean).map((p, i) => (
      <p key={i} className="text-[#F5F5F5]/80 leading-relaxed mb-3">
        {p.split('\n').map((line, j) => <React.Fragment key={j}>{j > 0 && <br />}{line}</React.Fragment>)}
      </p>
    ));
  };

  const discountPercent = product?.mrp > product?.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <main className="min-h-screen text-[#F5F5F5] selection:bg-[#FFD700] selection:text-[#000000]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 header-spacing pb-bottom-nav lg:pb-8">
          <nav className="flex items-center gap-2 text-sm mb-6">
            <Link href="/" className="text-[#F5F5F5]/50 hover:text-[#F5F5F5]">Home</Link>
            <ChevronRight className="w-4 h-4 text-[#F5F5F5]/30" />
            <Link href="/collections" className="text-[#F5F5F5]/50 hover:text-[#F5F5F5]">Collections</Link>
            <ChevronRight className="w-4 h-4 text-[#F5F5F5]/30" />
            <span className="text-[#FFD700] truncate max-w-[200px]">{product.name}</span>
          </nav>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div className="space-y-4 w-full min-w-0">
              <div
                className="relative aspect-[3/4] bg-[#1A1A1A] border border-[#E07B8B]/15 rounded-2xl overflow-hidden"
                onTouchStart={handleImageTouchStart}
                onTouchEnd={handleImageTouchEnd}
              >
                {(() => {
                  const variantImage = findVariantImageForColor(selectedColor);
                  const heroSrc = (product.images && product.images[selectedImage]?.image_url) || variantImage || product.image_url || product.primary_image;
                  return heroSrc && !heroError ? (
                    <Image
                      src={heroSrc}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                      onError={() => setHeroError(true)}
                    />
                  ) : <div className="absolute inset-0 flex items-center justify-center text-[#E07B8B]/30"><ShoppingBag className="w-12 h-12" /></div>;
                })()}
                {discountPercent > 0 && (
                  <span className="absolute top-4 right-4 px-3 py-1.5 bg-[#E07B8B]/80 text-white text-sm rounded-lg">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>

              {product.images?.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scroll-snap-x snap-mandatory w-full max-w-full">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedImage(idx); setHeroError(false); }}
                      className={`relative flex-shrink-0 w-20 h-20 bg-[#1A1A1A] rounded-xl overflow-hidden border-2 transition-all ${selectedImage === idx ? 'border-[#E07B8B]' : 'border-[#E07B8B]/20'}`}
                    >
                      {thumbErrors[idx] ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]/60 text-[#E07B8B]/30">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                      ) : (
                        <Image
                          src={img.image_url}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                          onError={() => setThumbErrors(prev => ({ ...prev, [idx]: true }))}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-sm text-[#E07B8B] mb-1">{product.collection_name || product.category}</p>
                <h1 className="text-2xl md:text-3xl font-bold text-[#FFD700]" style={{ fontFamily: 'Cinzel, serif' }}>{product.name}</h1>
                <div className="flex items-center gap-1 mt-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-[#F5F5F5]/20'}`} />
                  ))}
                  <span className="text-sm text-[#F5F5F5]/70 ml-2">({product.reviews_count || 0} reviews)</span>
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[#FFD700]">{formatCurrency(product.price)}</span>
                {product.mrp > product.price && <span className="text-lg text-[#F5F5F5]/50 line-through">{formatCurrency(product.mrp)}</span>}
              </div>

              {/* Clear user instruction — only shown when the product actually has variants */}
              {(product.sizes?.length > 0 || product.colors?.length > 0) && !selectedVariant && (
                <p className="text-sm text-[#FFD700]/90 bg-[#9333EA]/10 border border-[#E07B8B]/20 rounded-lg px-3 py-2">
                  {VARIANT_SELECTION_INSTRUCTION}
                </p>
              )}

              {product.colors?.length > 0 && (
                <div>
                  <p className="text-sm text-[#F5F5F5]/70 mb-2">Color: {selectedColor?.display_name || selectedColor?.name}</p>
                  <div className="flex gap-3">
                    {product.colors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => colorHasAnyStock(color) && selectColor(color)}
                        disabled={!colorHasAnyStock(color)}
                        className={`w-11 h-11 rounded-full border-2 transition-all ${normalizeHex(selectedColor?.hex) === normalizeHex(color.hex) ? 'border-[#FFD700] scale-110 shadow-[0_0_15px_rgba(242,194,154,0.4)]' : 'border-[#E07B8B]/20'} ${!colorHasAnyStock(color) ? 'opacity-30' : ''}`}
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-[#F5F5F5]/70">Size: {selectedSize || 'Select'}</p>
                  <button onClick={() => setShowSizeGuide(true)} className="text-sm text-[#E07B8B] flex items-center gap-1 hover:text-[#FFD700] transition-colors"><Ruler className="w-4 h-4" /> Size Guide</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes?.map((size) => {
                    const variant = getMatchingVariant(size);
                    const inStock = !!variant?.in_stock;
                    const stockStatus = getVariantStockStatus(variant);
                    return (
                      <button
                        key={size}
                        onClick={() => inStock && setSelectedSize(size)}
                        disabled={!inStock}
                        className={`relative px-4 py-2.5 rounded-xl border-2 transition-all duration-300 min-w-[52px] ${selectedSize === size ? 'bg-gradient-to-b from-[#9333EA]/40 to-[#9333EA]/20 border-[#FFD700] text-[#FFD700] shadow-[0_0_20px_rgba(242,194,154,0.15)] scale-105' : 'bg-[#0A0A0A]/40 border-[#E07B8B]/20 text-[#F5F5F5]/70 hover:border-[#E07B8B]/50 hover:text-[#F5F5F5]'} ${!inStock ? 'opacity-30 border-dashed' : ''}`}
                      >
                        <span className="text-sm font-medium">{size}</span>
                        {stockStatus === 'low_stock' && inStock && (
                          <span className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-amber-400 rounded-full" title="Low stock" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center gap-4">
                <p className="text-sm text-[#F5F5F5]/70">Quantity</p>
                <div className="flex items-center border-2 border-[#E07B8B]/20 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 flex items-center justify-center text-[#F5F5F5]/50 hover:text-[#FFD700] hover:bg-[#9333EA]/20 transition-all disabled:opacity-30"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 h-10 flex items-center justify-center text-[#FFD700] font-semibold text-sm border-x-2 border-[#E07B8B]/20">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => Math.min(10, q + 1))}
                    disabled={quantity >= 10}
                    className="w-10 h-10 flex items-center justify-center text-[#F5F5F5]/50 hover:text-[#FFD700] hover:bg-[#9333EA]/20 transition-all disabled:opacity-30"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.in_stock || addingToCart}
                  className={`flex-1 py-4 font-semibold rounded-xl transition-all duration-500 relative overflow-hidden ${addedToCart ? 'bg-green-600 text-white scale-[0.98]' : 'bg-gradient-to-r from-[#9333EA] to-[#E07B8B] text-white hover:shadow-[0_8px_30px_rgba(122,47,87,0.4)] hover:scale-[1.02] active:scale-[0.98]'} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none`}
                >
                  <span className={`flex items-center justify-center gap-2 transition-all duration-300 ${addedToCart ? 'translate-y-0 opacity-100' : addingToCart ? '-translate-y-8 opacity-0' : 'translate-y-0 opacity-100'}`}>
                    {!product.in_stock ? 'Out of Stock' : 'Add to Cart'}
                    {!product.in_stock ? null : <ShoppingBag className="w-5 h-5" />}
                  </span>
                  {addingToCart && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>
                    </span>
                  )}
                  {addedToCart && (
                    <span className="absolute inset-0 flex items-center justify-center gap-2 animate-scale-in">
                      <Check className="w-5 h-5" /> Added!
                    </span>
                  )}
                </button>
                <ProductShareButton product={product} />
              </div>

              {/* Premium Trust Badges */}
              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[#E07B8B]/15">
                <div className="text-center group cursor-default">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#9333EA]/10 border border-[#E07B8B]/15 flex items-center justify-center group-hover:border-[#E07B8B]/40 group-hover:bg-[#9333EA]/20 transition-all">
                    <Truck className="w-5 h-5 text-[#E07B8B]" />
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5F5F5]/60">Free Shipping</p>
                </div>
                <div className="text-center group cursor-default">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#9333EA]/10 border border-[#E07B8B]/15 flex items-center justify-center group-hover:border-[#E07B8B]/40 group-hover:bg-[#9333EA]/20 transition-all">
                    <Shield className="w-5 h-5 text-[#E07B8B]" />
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5F5F5]/60">Secure SSL</p>
                </div>
                <div className="text-center group cursor-default">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#9333EA]/10 border border-[#E07B8B]/15 flex items-center justify-center group-hover:border-[#E07B8B]/40 group-hover:bg-[#9333EA]/20 transition-all">
                    <RotateCcw className="w-5 h-5 text-[#E07B8B]" />
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5F5F5]/60">Easy Returns</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <div className="flex gap-6 border-b border-[#E07B8B]/15">
              {['description', 'reviews'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 text-sm font-medium capitalize transition-all duration-300 relative ${activeTab === tab ? 'text-[#FFD700]' : 'text-[#F5F5F5]/50 hover:text-[#F5F5F5]/80'}`}>
                  {tab}
                  {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#9333EA] to-[#FFD700] rounded-full" />}
                </button>
              ))}
            </div>
            <div className="py-6">
              {activeTab === 'description' && <div className="prose prose-invert max-w-none">{renderDescription(product.description)}</div>}
              {activeTab === 'reviews' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-[#0A0A0A]/40 rounded-xl">
                    <div>
                      <p className="text-4xl font-bold text-[#FFD700]">{product.rating || '0'}</p>
                      <p className="text-sm text-[#F5F5F5]/50">{reviews.length} reviews</p>
                    </div>
                    <button onClick={() => setShowReviewForm(!showReviewForm)} className="px-4 py-2 bg-[#9333EA]/30 text-[#FFD700] rounded-lg">{showReviewForm ? 'Cancel' : 'Write a Review'}</button>
                  </div>
                  {showReviewForm && <ReviewForm productId={product.id} onSuccess={handleReviewSuccess} onCancel={() => setShowReviewForm(false)} />}
                  <div className="space-y-4">
                    {reviews.map((r, i) => (
                      <div key={i} className="p-4 bg-[#0A0A0A]/40 rounded-xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{r.user || 'Anonymous'}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`w-3 h-3 ${s <= Math.floor(r.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-[#F5F5F5]/20'}`} />
                              ))}
                              <span className="text-xs text-[#F5F5F5]/50 ml-1">{r.rating}/5</span>
                            </div>
                          </div>
                          <span className="text-xs text-[#F5F5F5]/50 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm mt-2 text-[#F5F5F5]/70">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <RelatedProducts productId={product.id} collectionId={product.collection_id} />
        <Footer />
      </div>

      {product && (
        <div className="fixed inset-x-0 lg:hidden bg-[#0A0A0A]/95 backdrop-blur-md border-t border-[#E07B8B]/15 px-3 py-3 z-[101] flex items-center gap-3 bottom-nav-offset">
          <div className="flex-1 min-w-0">
            <p className="text-[#FFD700] font-semibold text-sm line-clamp-1">{product.name}</p>
            <p className="text-[#FFD700] font-bold">{formatCurrency(product.price)}</p>
          </div>
          <button onClick={handleAddToCart} disabled={!product.in_stock || addingToCart} className="px-5 py-2.5 bg-gradient-to-r from-[#9333EA] to-[#E07B8B] text-white font-semibold rounded-xl text-sm flex items-center gap-2">
            {addingToCart ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg> Adding...</>
            ) : !product.in_stock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      )}

      <SizeGuideModal isOpen={showSizeGuide} onClose={() => setShowSizeGuide(false)} category={product?.category?.toLowerCase() || 'kurta'} />
    </main>
  );
}

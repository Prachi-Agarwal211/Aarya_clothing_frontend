'use client';

import React, { useState, useEffect } from 'react';
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
import ProductReviews from '@/components/product/ProductReviews';
import ProductShareButton from '@/components/product/ProductShareButton';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';

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

  const openReviewsTab = () => {
    setActiveTab('reviews');
    // Allow tab panel to paint, then scroll under fixed header
    requestAnimationFrame(() => {
      document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
    if (!desc) return <p className="text-[#F5F0E8]/50 italic">No description available.</p>;
    return desc.split(/\n\s*\n/).filter(Boolean).map((p, i) => (
      <p key={i} className="text-[#F5F0E8]/80 leading-relaxed mb-3">
        {p.split('\n').map((line, j) => <React.Fragment key={j}>{j > 0 && <br />}{line}</React.Fragment>)}
      </p>
    ));
  };

  const discountPercent = product?.mrp > product?.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  const variantStock = selectedVariant ? getVariantStockStatus(selectedVariant) : null;
  const materialLabel = product?.material || product?.fabric || product?.fabric_type;
  const imageCount = product?.images?.length || 0;

  return (
    <main
      id="main-content"
      className="min-h-screen text-[#F5F0E8] bg-transparent selection:bg-[#1E3A5F]/50 selection:text-[#F7F4EE]"
    >
      <div className="relative z-10 page-wrapper route-fade">
        <EnhancedHeader />

        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-5 sm:py-8 header-spacing header-spacing-page pb-bottom-nav lg:pb-12">
          {/* Breadcrumb — clear of fixed solid header */}
          <nav
            className="pdp-reveal flex items-center gap-2 text-xs sm:text-sm mb-5 sm:mb-8"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="text-[#C8BFAF] hover:text-white transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#8A919C]" aria-hidden="true" />
            <Link href="/products" className="text-[#C8BFAF] hover:text-white transition-colors">Products</Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#8A919C]" aria-hidden="true" />
            <span className="text-white/90 truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
          </nav>

          {/* Editorial atelier grid: immersive gallery + sticky buy column */}
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14">
            <div className="pdp-reveal pdp-delay-1 lg:col-span-7 space-y-4 w-full min-w-0">
              <div
                className="relative aspect-[3/4] bg-[#161616] border border-white/[0.04] rounded-2xl overflow-hidden pdp-gallery"
                onTouchStart={handleImageTouchStart}
                onTouchEnd={handleImageTouchEnd}
              >
                {(() => {
                  const variantImage = findVariantImageForColor(selectedColor);
                  const heroSrc =
                    (product.images && product.images[selectedImage]?.image_url) ||
                    variantImage ||
                    product.image_url ||
                    product.primary_image;
                  return heroSrc && !heroError ? (
                    <Image
                      key={heroSrc}
                      src={heroSrc}
                      alt={product.name}
                      fill
                      className="object-cover pdp-gallery-img"
                      sizes="(max-width: 768px) 100vw, 55vw"
                      priority
                      onError={() => setHeroError(true)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[#8A919C]/40">
                      <ShoppingBag className="w-12 h-12" />
                    </div>
                  );
                })()}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0D0D0D]/85 via-[#0D0D0D]/30 to-transparent"
                  aria-hidden="true"
                />
                {discountPercent > 0 && (
                  <span className="absolute top-4 left-4 px-3 py-1.5 text-[11px] tracking-[0.14em] uppercase rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-[#F7F4EE]">
                    {discountPercent}% OFF
                  </span>
                )}
                {imageCount > 1 && (
                  <span className="absolute bottom-4 right-4 px-2.5 py-1 text-[11px] tracking-wider rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[#F5F0E8]/90 tabular-nums">
                    {selectedImage + 1} / {imageCount}
                  </span>
                )}
              </div>

              {imageCount > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide w-full max-w-full">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedImage(idx);
                        setHeroError(false);
                      }}
                      aria-label={`View image ${idx + 1}`}
                      aria-current={selectedImage === idx ? 'true' : undefined}
                      className={`relative flex-shrink-0 w-[72px] h-[72px] sm:w-20 sm:h-20 bg-[#161616] rounded-xl overflow-hidden border transition-all duration-300 ${
                        selectedImage === idx
                          ? 'border-[#D4AF37]/70 ring-1 ring-[#D4AF37]/30 scale-[1.02]'
                          : 'border-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      {thumbErrors[idx] ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#111111] text-[#8A919C]/40">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                      ) : (
                        <Image
                          src={img.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="80px"
                          onError={() => setThumbErrors((prev) => ({ ...prev, [idx]: true }))}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sticky buy panel — atelier feel */}
            <div className="pdp-reveal pdp-delay-2 lg:col-span-5 space-y-6 lg:sticky lg:top-24 lg:self-start">
              <div className="lg:panel-matte lg:rounded-2xl lg:p-6 lg:space-y-6 space-y-6">
                <div>
                  <p className="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-[#3D5A80] mb-2 font-medium">
                    {product.collection_name || product.category || 'Aarya Collection'}
                  </p>
                  <h1
                    className="text-2xl sm:text-3xl md:text-[2rem] text-white leading-snug"
                    style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif', fontWeight: 400 }}
                  >
                    {product.name}
                  </h1>
                  <button
                  type="button"
                  onClick={openReviewsTab}
                  className="flex items-center gap-1 mt-3 group text-left"
                  aria-label="See customer reviews"
                >
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(product.rating || 0)
                            ? 'text-[#D4AF37] fill-[#D4AF37]'
                            : 'text-[#F5F0E8]/20'
                        }`}
                      />
                    ))}
                    <span className="text-sm text-[#C8BFAF] ml-2 group-hover:text-[#D4AF37] transition-colors underline-offset-2 group-hover:underline">
                      {product.reviews_count || reviews.length || 0} reviews
                    </span>
                  </button>
                </div>

                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    className="text-3xl sm:text-4xl text-[#D4AF37] tracking-wide"
                    style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 500 }}
                  >
                    {formatCurrency(product.price)}
                  </span>
                  {product.mrp > product.price && (
                    <span className="text-lg text-[#C8BFAF]/60 line-through">
                      {formatCurrency(product.mrp)}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-xs uppercase tracking-wider text-[#3D5A80] bg-[#1E3A5F]/25 border border-[#3D5A80]/30 px-2 py-0.5 rounded-full">
                      Save {discountPercent}%
                    </span>
                  )}
                </div>

                <div className="hairline-gold w-full max-w-[12rem]" aria-hidden="true" />

                {/* Spec chips — unique product identity strip */}
                {(materialLabel || product.sku || product.brand) && (
                  <div className="flex flex-wrap gap-2">
                    {materialLabel && (
                      <span className="text-[11px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#C8BFAF]">
                        {materialLabel}
                      </span>
                    )}
                    {product.sku && (
                      <span className="text-[11px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#C8BFAF]">
                        SKU {product.sku}
                      </span>
                    )}
                  </div>
                )}

                {(product.sizes?.length > 0 || product.colors?.length > 0) && !selectedVariant && (
                  <p className="text-sm text-[#F5F0E8] bg-[#1E3A5F]/20 border border-[#3D5A80]/35 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#A8B4C8]" aria-hidden="true" />
                    <span>{VARIANT_SELECTION_INSTRUCTION}</span>
                  </p>
                )}

                {selectedVariant && variantStock === 'low_stock' && (
                  <p className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-2.5">
                    Only a few left — reserve yours before stock runs out.
                  </p>
                )}

                {product.colors?.length > 0 && (
                  <div>
                    <p className="text-sm text-[#C8BFAF] mb-2">
                      Color:{' '}
                      <span className="text-[#F5F0E8]">
                        {selectedColor?.display_name || selectedColor?.name || '—'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-3" role="listbox" aria-label="Color">
                      {product.colors.map((color) => {
                        const selected =
                          normalizeHex(selectedColor?.hex) === normalizeHex(color.hex);
                        const available = colorHasAnyStock(color);
                        return (
                          <button
                            key={color.name}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            aria-label={color.display_name || color.name}
                            onClick={() => available && selectColor(color)}
                            disabled={!available}
                            className={`w-11 h-11 rounded-full border-2 transition-all duration-300 ${
                              selected
                                ? 'border-[#D4AF37] scale-110 shadow-[0_0_16px_rgba(212,175,55,0.35)]'
                                : 'border-[#A8B4C8]/20 hover:border-[#A8B4C8]/45'
                            } ${!available ? 'opacity-30 cursor-not-allowed' : ''}`}
                            style={{ backgroundColor: color.hex }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-[#C8BFAF]">
                      Size:{' '}
                      <span className="text-[#F5F0E8]">{selectedSize || 'Select'}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowSizeGuide(true)}
                      className="text-sm text-[#A8B4C8] flex items-center gap-1 hover:text-[#D4AF37] transition-colors min-h-[44px]"
                    >
                      <Ruler className="w-4 h-4" /> Size Guide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2" role="listbox" aria-label="Size">
                    {product.sizes?.map((size) => {
                      const variant = getMatchingVariant(size);
                      const inStock = !!variant?.in_stock;
                      const stockStatus = getVariantStockStatus(variant);
                      const isSelected = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => inStock && setSelectedSize(size)}
                          disabled={!inStock}
                          className={`relative px-4 py-2.5 rounded-xl border-2 transition-all duration-300 min-w-[52px] min-h-[44px] ${
                            isSelected
                              ? 'bg-gradient-to-b from-[#1E3A5F]/40 to-[#1E3A5F]/20 border-[#D4AF37] text-[#D4AF37] shadow-[0_0_18px_rgba(212,175,55,0.12)] scale-105'
                              : 'bg-[#111111]/40 border-[#A8B4C8]/20 text-[#F5F0E8]/70 hover:border-[#A8B4C8]/50 hover:text-[#F5F0E8]'
                          } ${!inStock ? 'opacity-30 border-dashed cursor-not-allowed' : ''}`}
                        >
                          <span className="text-sm font-medium">{size}</span>
                          {stockStatus === 'low_stock' && inStock && (
                            <span
                              className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-[#D4AF37] rounded-full"
                              title="Low stock"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <p className="text-sm text-[#C8BFAF]">Quantity</p>
                  <div className="flex items-center border-2 border-[#A8B4C8]/20 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="w-11 h-11 flex items-center justify-center text-[#F5F0E8]/50 hover:text-[#D4AF37] hover:bg-[#1E3A5F]/20 transition-all disabled:opacity-30"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-11 h-11 flex items-center justify-center text-[#D4AF37] font-semibold text-sm border-x-2 border-[#A8B4C8]/20 tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) =>
                          Math.min(selectedVariant?.available_quantity || 10, q + 1)
                        )
                      }
                      disabled={quantity >= (selectedVariant?.available_quantity || 10)}
                      aria-label="Increase quantity"
                      className="w-11 h-11 flex items-center justify-center text-[#F5F0E8]/50 hover:text-[#D4AF37] hover:bg-[#1E3A5F]/20 transition-all disabled:opacity-30"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!product.in_stock || addingToCart}
                    className={`flex-1 min-h-[52px] py-4 font-semibold rounded-xl transition-all duration-300 relative overflow-hidden ${
                      addedToCart
                        ? 'bg-emerald-700 text-white scale-[0.98]'
                        : 'bg-white text-[#0D0D0D] hover:bg-[#F7F4EE] border border-white/90 hover:shadow-[0_8px_28px_rgba(255,255,255,0.12)] hover:scale-[1.01] active:scale-[0.98]'
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none`}
                  >
                    <span
                      className={`flex items-center justify-center gap-2 transition-all duration-300 ${
                        addedToCart
                          ? 'translate-y-0 opacity-100'
                          : addingToCart
                            ? '-translate-y-8 opacity-0'
                            : 'translate-y-0 opacity-100'
                      }`}
                    >
                      {!product.in_stock ? 'Out of Stock' : 'Add to Cart'}
                      {product.in_stock ? <ShoppingBag className="w-5 h-5" /> : null}
                    </span>
                    {addingToCart && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                          />
                        </svg>
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

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/[0.06]">
                  {[
                    { Icon: Truck, label: 'Free Shipping' },
                    { Icon: Shield, label: 'Secure SSL' },
                    { Icon: RotateCcw, label: 'Easy Returns' },
                  ].map(({ Icon, label }) => (
                    <div key={label} className="text-center group cursor-default">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#1E3A5F]/15 border border-[#3D5A80]/25 flex items-center justify-center group-hover:border-[#3D5A80]/50 group-hover:bg-[#1E3A5F]/25 transition-all">
                        <Icon className="w-5 h-5 text-[#A8B4C8]" />
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-[#C8BFAF]">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Details + reviews */}
          <div className="pdp-reveal pdp-delay-3 mt-12 lg:mt-16">
            <div className="flex gap-6 sm:gap-8 border-b border-white/[0.08]" role="tablist">
              {[
                { id: 'description', label: 'Description' },
                {
                  id: 'reviews',
                  label: `Reviews (${product.reviews_count || reviews.length || 0})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 text-sm font-medium transition-all duration-300 relative min-h-[44px] ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'text-[#C8BFAF] hover:text-[#F5F0E8]'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#1E3A5F] to-[#D4AF37] rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <div className="py-6 sm:py-8" role="tabpanel">
              {activeTab === 'description' && (
                <div key="description" className="pdp-tab-panel prose prose-invert max-w-none">
                  {renderDescription(product.description)}
                  {(product.material || product.care_instructions) && (
                    <div className="mt-8 grid sm:grid-cols-2 gap-4 not-prose">
                      {product.material && (
                        <div className="panel-matte rounded-xl p-4 border border-white/[0.05]">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#3D5A80] mb-1">Material</p>
                          <p className="text-sm text-[#F5F0E8]">{product.material}</p>
                        </div>
                      )}
                      {product.care_instructions && (
                        <div className="panel-matte rounded-xl p-4 border border-white/[0.05]">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#3D5A80] mb-1">Care</p>
                          <p className="text-sm text-[#F5F0E8]">{product.care_instructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'reviews' && (
                <div key="reviews" className="pdp-tab-panel">
                  <ProductReviews
                    productId={product.id}
                    productRating={product.rating || product.average_rating}
                    reviewsCount={product.reviews_count}
                    initialReviews={reviews}
                    onReviewsChange={(next) => {
                      setReviews(next);
                      showAlert('Review submitted — it may appear after approval.', 'success');
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <RelatedProducts productId={product.id} collectionId={product.collection_id} />
        <Footer />
      </div>

      {product && (
        <div className="fixed inset-x-0 lg:hidden bg-[#111111]/95 backdrop-blur-md border-t border-white/[0.06] px-3 py-3 z-[101] flex items-center gap-3 bottom-nav-offset">
          <div className="flex-1 min-w-0">
            <p className="text-[#F5F0E8] font-medium text-sm line-clamp-1">{product.name}</p>
            <p className="text-[#D4AF37] font-bold">{formatCurrency(product.price)}</p>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!product.in_stock || addingToCart}
            className="min-h-[44px] px-5 py-2.5 bg-white text-[#0D0D0D] font-semibold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 border border-white/90"
          >
            {addingToCart ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                  />
                </svg>{' '}
                Adding...
              </>
            ) : !product.in_stock ? (
              'Out of Stock'
            ) : (
              'Add to Cart'
            )}
          </button>
        </div>
      )}

      <SizeGuideModal
        isOpen={showSizeGuide}
        onClose={() => setShowSizeGuide(false)}
        category={product?.category?.toLowerCase() || 'kurta'}
      />
    </main>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Share2,
  Truck,
  Shield,
  ChevronRight,
  Minus,
  Plus,
  Check,
  Star,
  AlertCircle,
  Ruler,
} from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import SizeGuideModal from '@/components/product/SizeGuideModal';
import RelatedProducts from '@/components/product/RelatedProducts';
import ReviewForm from '@/components/review/ReviewForm';
import { reviewsApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';
import { getColorName, getHexFromName } from '@/lib/colorMap';

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

  const [product] = useState(initialProduct);
  const [reviews, setReviews] = useState(initialReviews || []);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
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
    if (Math.abs(dx) < 40) return;
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

  useEffect(() => {
    if (product?.inventory?.length) {
      setSelectedVariant(getMatchingVariant(selectedSize, selectedColorKey));
    }
  }, [selectedSize, selectedColorKey, product]);

  useEffect(() => {
    if (!product?.sizes?.length || selectedSize) return;
    const firstAvailable = product.sizes.find((size) => getMatchingVariant(size)) || product.sizes[0];
    if (firstAvailable) setSelectedSize(firstAvailable);
  }, [product, selectedSize]);

  useEffect(() => {
    if (!product?.colors?.length || selectedColor) return;
    const firstWithStock = product.colors.find(c => colorHasAnyStock(c)) || product.colors[0];
    if (firstWithStock) setSelectedColor(firstWithStock);
  }, [product, selectedColor]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/auth/login?redirect_url=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (product?.sizes?.length > 0 && !selectedSize) {
      showAlert('Please select a size');
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
    if (!desc) return <p className="text-[#EAE0D5]/50 italic">No description available.</p>;
    return desc.split(/\n\s*\n/).filter(Boolean).map((p, i) => (
      <p key={i} className="text-[#EAE0D5]/80 leading-relaxed mb-3">
        {p.split('\n').map((line, j) => <React.Fragment key={j}>{j > 0 && <br />}{line}</React.Fragment>)}
      </p>
    ));
  };

  const discountPercent = product?.mrp > product?.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 header-spacing pb-bottom-nav lg:pb-8">
          <nav className="flex items-center gap-2 text-sm mb-6">
            <Link href="/" className="text-[#EAE0D5]/50 hover:text-[#EAE0D5]">Home</Link>
            <ChevronRight className="w-4 h-4 text-[#EAE0D5]/30" />
            <Link href="/collections" className="text-[#EAE0D5]/50 hover:text-[#EAE0D5]">Collections</Link>
            <ChevronRight className="w-4 h-4 text-[#EAE0D5]/30" />
            <span className="text-[#F2C29A] truncate max-w-[200px]">{product.name}</span>
          </nav>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div className="space-y-4">
              <div
                className="relative aspect-[3/4] bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden"
                onTouchStart={handleImageTouchStart}
                onTouchEnd={handleImageTouchEnd}
              >
                {(() => {
                  const variantImage = findVariantImageForColor(selectedColor);
                  const heroSrc = (product.images && product.images[selectedImage]?.image_url) || variantImage || product.image_url || product.primary_image;
                  return heroSrc ? (
                    <Image
                      src={heroSrc}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                    />
                  ) : <div className="absolute inset-0 flex items-center justify-center text-[#B76E79]/30">No Image</div>;
                })()}
                {discountPercent > 0 && (
                  <span className="absolute top-4 right-4 px-3 py-1.5 bg-[#B76E79]/80 text-white text-sm rounded-lg">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>

              {product.images?.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${selectedImage === idx ? 'border-[#B76E79]' : 'border-[#B76E79]/20'}`}
                    >
                      <Image src={img.image_url} alt={product.name} fill className="object-cover" sizes="80px" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-sm text-[#B76E79] mb-1">{product.collection_name || product.category}</p>
                <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>{product.name}</h1>
                <div className="flex items-center gap-1 mt-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-[#EAE0D5]/20'}`} />
                  ))}
                  <span className="text-sm text-[#EAE0D5]/70 ml-2">({product.reviews_count || 0} reviews)</span>
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[#F2C29A]">{formatCurrency(product.price)}</span>
                {product.mrp > product.price && <span className="text-lg text-[#EAE0D5]/50 line-through">{formatCurrency(product.mrp)}</span>}
              </div>

              {product.colors?.length > 0 && (
                <div>
                  <p className="text-sm text-[#EAE0D5]/70 mb-2">Color: {selectedColor?.display_name || selectedColor?.name}</p>
                  <div className="flex gap-3">
                    {product.colors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => colorHasAnyStock(color) && selectColor(color)}
                        disabled={!colorHasAnyStock(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${normalizeHex(selectedColor?.hex) === normalizeHex(color.hex) ? 'border-[#F2C29A] scale-110' : 'border-[#B76E79]/20'} ${!colorHasAnyStock(color) ? 'opacity-30' : ''}`}
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-[#EAE0D5]/70">Size: {selectedSize || 'Select'}</p>
                  <button onClick={() => setShowSizeGuide(true)} className="text-sm text-[#B76E79] flex items-center gap-1"><Ruler className="w-4 h-4" /> Size Guide</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes?.map((size) => {
                    const variant = getMatchingVariant(size);
                    const inStock = !!variant?.in_stock;
                    return (
                      <button
                        key={size}
                        onClick={() => inStock && setSelectedSize(size)}
                        disabled={!inStock}
                        className={`px-4 py-2 rounded-lg border transition-all ${selectedSize === size ? 'bg-[#7A2F57]/30 border-[#B76E79] text-[#F2C29A]' : 'bg-[#0B0608]/40 border-[#B76E79]/20 text-[#EAE0D5]/70'} ${!inStock ? 'opacity-30' : ''}`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.in_stock || addingToCart}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                  {!product.in_stock ? 'Out of Stock' : addingToCart ? 'Adding...' : 'Add to Cart'}
                </button>
                <button onClick={handleShare} className="p-3.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70"><Share2 className="w-5 h-5" /></button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-6 border-t border-[#B76E79]/15">
                <div className="text-center"><Truck className="w-5 h-5 mx-auto text-[#B76E79] mb-1" /><p className="text-[10px] uppercase text-[#EAE0D5]/60">Free Shipping</p></div>
                <div className="text-center"><Shield className="w-5 h-5 mx-auto text-[#B76E79] mb-1" /><p className="text-[10px] uppercase text-[#EAE0D5]/60">Secure SSL</p></div>
                <div className="text-center"><Check className="w-5 h-5 mx-auto text-[#B76E79] mb-1" /><p className="text-[10px] uppercase text-[#EAE0D5]/60">100% Genuine</p></div>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <div className="flex gap-6 border-b border-[#B76E79]/15">
              {['description', 'details', 'reviews'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'text-[#F2C29A] border-b-2 border-[#B76E79]' : 'text-[#EAE0D5]/50'}`}>{tab}</button>
              ))}
            </div>
            <div className="py-6">
              {activeTab === 'description' && <div className="prose prose-invert max-w-none">{renderDescription(product.description)}</div>}
              {activeTab === 'reviews' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-[#0B0608]/40 rounded-xl">
                    <div>
                      <p className="text-4xl font-bold text-[#F2C29A]">{product.rating || '0'}</p>
                      <p className="text-sm text-[#EAE0D5]/50">{reviews.length} reviews</p>
                    </div>
                    <button onClick={() => setShowReviewForm(!showReviewForm)} className="px-4 py-2 bg-[#7A2F57]/30 text-[#F2C29A] rounded-lg">{showReviewForm ? 'Cancel' : 'Write a Review'}</button>
                  </div>
                  {showReviewForm && <ReviewForm productId={product.id} onSuccess={handleReviewSuccess} onCancel={() => setShowReviewForm(false)} />}
                  <div className="space-y-4">
                    {reviews.map((r, i) => (
                      <div key={i} className="p-4 bg-[#0B0608]/40 rounded-xl">
                        <div className="flex justify-between">
                          <p className="font-medium">{r.user || 'Anonymous'}</p>
                          <span className="text-xs text-[#EAE0D5]/50">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm mt-2 text-[#EAE0D5]/70">{r.comment}</p>
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
        <div className="fixed inset-x-0 lg:hidden bg-[#0B0608]/95 backdrop-blur-md border-t border-[#B76E79]/15 px-3 py-3 z-[105] flex items-center gap-3" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex-1 min-w-0">
            <p className="text-[#F2C29A] font-semibold text-sm line-clamp-1">{product.name}</p>
            <p className="text-[#F2C29A] font-bold">{formatCurrency(product.price)}</p>
          </div>
          <button onClick={handleAddToCart} disabled={!product.in_stock || addingToCart} className="px-5 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl text-sm">
            {!product.in_stock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      )}

      <SizeGuideModal isOpen={showSizeGuide} onClose={() => setShowSizeGuide(false)} category={product?.category?.toLowerCase() || 'kurta'} />
    </main>
  );
}

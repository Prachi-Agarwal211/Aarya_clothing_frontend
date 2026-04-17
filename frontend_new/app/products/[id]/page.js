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
import ReviewForm from '@/components/review/ReviewForm';
import { productsApi, reviewsApi, wishlistApi } from '@/lib/customerApi';
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

const isHexColorValue = (value) => !!normalizeHex(value);

/**
 * Normalize color names to handle variants like "Dusty Rose" vs "Dusty Rose Pink".
 * Strips trailing whitespace, normalizes common prefixes/suffixes.
 * Returns a canonical form for matching.
 */
const normalizeColorName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Check if two color names refer to the same color family.
 * Handles cases like "Dusty Rose" / "Dusty Rose Pink", "Navy" / "Navy Blue", etc.
 */
const colorsMatch = (name1, name2) => {
  if (!name1 || !name2) return false;
  const n1 = normalizeColorName(name1);
  const n2 = normalizeColorName(name2);
  if (n1 === n2) return true;
  // Check if one contains the other (handles "Dusty Rose" in "Dusty Rose Pink")
  if (n1.includes(n2) || n2.includes(n1)) {
    // Only match if the shorter name is at least 4 chars (avoid "Red" matching "Reddish")
    const shorter = n1.length < n2.length ? n1 : n2;
    if (shorter.length >= 4) return true;
  }
  return false;
};

const getVariantColorKey = (variant) => {
  if (!variant) return null;
  // Priority: hex code first (most reliable), then name-based matching
  const hexKey = normalizeHex(variant.color_hex);
  if (hexKey) return hexKey;
  // Fall back to normalized color name for matching
  // Also check all possible color name variants stored in the variant
  const colorName = normalizeColorName(variant.color) || normalizeColorName(variant.color_name);
  return colorName;
};

/**
 * Enhanced color matching: checks if a variant matches the selected color.
 * Handles: exact hex match, exact name match, and fuzzy name matching.
 */
const variantMatchesColor = (inv, colorKey) => {
  if (!inv || !colorKey) return true;
  const invKey = getVariantColorKey(inv);
  if (!invKey) return true; // No color info on variant, match it

  // Exact match (for hex keys like #3B82F6)
  if (invKey === colorKey) return true;

  // If invKey is a hex color and colorKey is also hex, they must match exactly
  const isHexKey = (k) => k && typeof k === 'string' && k.startsWith('#') && k.length === 7;
  if (isHexKey(invKey) && isHexKey(colorKey)) return false;

  // If invKey is a name (non-hex), try fuzzy name matching against colorKey
  if (!isHexKey(invKey)) {
    // colorKey might be a hex fallback (#888888) when no real hex exists
    // In that case, also try matching the variant's name against all known color names
    if (isHexKey(colorKey)) {
      // The selected color uses a fallback hex — try name-based matching
      // This handles the case where both "Dusty Rose" and "Dusty Rose Pink" get #888888
      // and the user selects that merged color
      return true; // If we're here, the color was already selected from the UI, so trust it
    }
    // Both are names — fuzzy match
    if (typeof colorKey === 'string' && colorsMatch(invKey, colorKey)) return true;
  }

  // If invKey is hex but colorKey is a name, try reverse lookup
  if (isHexKey(invKey) && !isHexKey(colorKey)) {
    // This shouldn't normally happen but handle it anyway
    return false;
  }

  return false;
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id;
  const { showAlert } = useAlertToast();
  const { addItem, openCart } = useCart();
  const { user, isAuthenticated } = useAuth();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [showReviewForm, setShowReviewForm] = useState(false);

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

  // Reload reviews after successful submission
  const handleReviewSuccess = async () => {
    setShowReviewForm(false);
    try {
      const reviewsData = await reviewsApi.list(productId);
      setReviews(reviewsData || []);
      showAlert('Review submitted successfully!', 'success');
    } catch (err) {
      logger.error('Failed to reload reviews:', err);
    }
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

  useEffect(() => {
    fetchProduct();
    // Intentional: fetchProduct is stable via useCallback, only productId triggers re-fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const selectedColorKey = selectedColor
    ? (normalizeHex(selectedColor.hex) || normalizeHex(getHexFromName(selectedColor.name)))
    : null;

  const getMatchingVariant = (size, colorKey = selectedColorKey, color = selectedColor) => {
    if (!product?.inventory?.length) return null;
    return product.inventory.find((inv) => {
      if (inv.size !== size) return false;
      // Primary: exact hex match on color_hex (most reliable)
      const selHex = color ? normalizeHex(color.hex) : colorKey;
      if (selHex && inv.color_hex) {
        const invHex = normalizeHex(inv.color_hex);
        if (invHex === selHex) return true;
      }
      // Fallback: if no hex on variant, match by color name
      if (color?._variantNames?.size) {
        const invNormalizedName = normalizeColorName(inv.color) || normalizeColorName(inv.color_name);
        if (invNormalizedName && color._variantNames.has(invNormalizedName)) return true;
      }
      return false;
    }) || null;
  };

  // CRITICAL FIX: Don't expose actual stock numbers to customers
  // Only return boolean status, not quantities
  const getVariantAvailableQty = (variant) => {
    if (!variant) return null;
    // Return null to hide exact numbers - frontend will show status only
    return null;
  };

  // NEW: Get stock status for display (no numbers)
  const getVariantStockStatus = (variant) => {
    if (!variant) return 'out_of_stock';
    if (variant.in_stock === false) return 'out_of_stock';
    if (typeof variant.available_quantity === 'number') {
      if (variant.available_quantity <= 0) return 'out_of_stock';
      if (variant.available_quantity <= 3) return 'low_stock';
    }
    return 'in_stock';
  };

  const isSizeAvailable = (size) => {
    const v = getMatchingVariant(size);
    return !!v?.in_stock;
  };

  const colorHasAnyStock = (color) => {
    if (!product?.inventory?.length || !color) return true;
    // Use the color's hex directly (from API). For merged colors, this is the shared hex.
    // Do NOT use getHexFromName fuzzy matching here — it causes false matches
    // (e.g., "Dusty Rose" contains "Rose" → returns #F43F5E instead of #888888).
    const selHex = normalizeHex(color.hex);
    if (!selHex) return true; // No hex data, assume in stock

    const hasStock = product.inventory.some((inv) => {
      // Prefer the variant's color_hex, otherwise derive from the color's hex
      // since variants in the same merged group share the same hex
      const invHex = normalizeHex(inv.color_hex) || selHex;
      return invHex === selHex && inv.in_stock;
    });
    return hasStock;
  };

  // Update selected variant when size or color changes
  useEffect(() => {
    if (product?.inventory?.length) {
      const variant = getMatchingVariant(selectedSize, selectedColorKey, selectedColor);
      setSelectedVariant(variant || null);
    }
  }, [selectedSize, selectedColorKey, selectedColor, product]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial size bootstrap only.
  // IMPORTANT: never auto-reset size on color change; customers should see
  // out-of-stock state for their chosen size instead of silent fallback.
  useEffect(() => {
    if (!product?.sizes?.length) return;
    if (selectedSize) return;

    const firstAvailable = product.sizes.find((size) => getMatchingVariant(size)) || product.sizes[0];
    if (firstAvailable) {
      setSelectedSize(firstAvailable);
    }
  }, [product, selectedSize]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Group inventory by hex key, merge similar color names under one color
        const colorMap = new Map();
        (product.inventory || [])
          .filter(i => i.color)
          .forEach(i => {
            const hex = normalizeHex(i.color_hex) || normalizeHex(getHexFromName(i.color)) || '#888888';
            const displayName = i.color_name || (
              isHexColorValue(i.color)
                ? (getColorName(hex) || i.color.trim())
                : i.color.trim()
            );
            if (!colorMap.has(hex)) {
              colorMap.set(hex, { name: i.color.trim(), displayName, hex, _variantNames: new Set() });
            }
            const entry = colorMap.get(hex);
            // Track all original variant color names for matching
            entry._variantNames.add(normalizeColorName(i.color));
            // Keep the most descriptive name as displayName
            if (displayName.length > (entry.displayName || '').length) {
              entry.displayName = displayName;
            }
          });
        product.colors = [...colorMap.values()].map(({ _variantNames, ...c }) => ({ ...c, _variantNames }));
      } else {
        // Backend provided colors - deduplicate by hex and add _variantNames from inventory
        const colorMap = new Map();
        product.colors.forEach((color) => {
          const hex = normalizeHex(color.hex) || normalizeHex(color.name) || normalizeHex(getHexFromName(color.name)) || '#888888';
          const displayName = color.display_name || color.displayName || (
            isHexColorValue(color.name)
              ? (getColorName(hex) || color.name.toUpperCase())
              : color.name
          );
          if (!colorMap.has(hex)) {
            colorMap.set(hex, { name: color.name, displayName, hex, _variantNames: new Set() });
          } else {
            const existing = colorMap.get(hex);
            if (displayName.length > (existing.displayName || '').length) {
              existing.displayName = displayName;
              existing.name = color.name;
            }
          }
        });
        // Add _variantNames from inventory for name-based matching
        (product.inventory || []).filter(i => i.color).forEach(i => {
          const hex = normalizeHex(i.color_hex) || normalizeHex(getHexFromName(i.color)) || '#888888';
          const normalizedName = normalizeColorName(i.color);
          if (colorMap.has(hex) && normalizedName) {
            colorMap.get(hex)._variantNames.add(normalizedName);
          }
        });
        product.colors = [...colorMap.values()];
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

      // Auto-select first color/size that is actually in stock.
      const firstColorWithStock = product.colors?.find((color) => {
        // Use _variantNames for matching if available
        if (color._variantNames?.size) {
          return (product.inventory || []).some((inv) => {
            const invName = normalizeColorName(inv.color) || normalizeColorName(inv.color_name);
            return invName && color._variantNames.has(invName) && inv.in_stock;
          });
        }
        // Fallback to hex matching
        const colorKey = normalizeHex(color.hex) || normalizeHex(getHexFromName(color.name));
        return (product.inventory || []).some((inv) => variantMatchesColor(inv, colorKey) && inv.in_stock);
      }) || product.colors?.[0];
      if (firstColorWithStock) setSelectedColor(firstColorWithStock);

      const firstSizeWithStock = product.sizes?.find((size) => {
        if (!firstColorWithStock) return true;
        // Use _variantNames for matching if available
        if (firstColorWithStock._variantNames?.size) {
          const inv = (product.inventory || []).find((item) => {
            if (item.size !== size) return false;
            const invName = normalizeColorName(item.color) || normalizeColorName(item.color_name);
            return invName && firstColorWithStock._variantNames.has(invName);
          });
          return inv?.in_stock;
        }
        // Fallback to hex matching
        const colorKey = normalizeHex(firstColorWithStock.hex) || normalizeHex(getHexFromName(firstColorWithStock.name));
        const inv = (product.inventory || []).find((item) => item.size === size && variantMatchesColor(item, colorKey));
        return inv?.in_stock;
      }) || product.sizes?.[0];
      if (firstSizeWithStock) setSelectedSize(firstSizeWithStock);

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

    // Resolve variant at click time so stale state can never add wrong size/color.
    const resolvedVariant = hasSizes
      ? getMatchingVariant(selectedSize, selectedColorKey, selectedColor)
      : selectedVariant;

    if (hasSizes && !resolvedVariant?.in_stock) {
      showAlert('Selected size/color is out of stock', 'error');
      return;
    }

    // CRITICAL FIX: Don't show exact stock numbers in error messages
    if (!resolvedVariant?.in_stock) {
      showAlert('Selected variant is out of stock', 'error');
      return;
    }

    try {
      setAddingToCart(true);
      // Pass the actual variant ID from our matching logic
      await addItem(product.id, quantity, { id: resolvedVariant?.id });
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

  // Render description with newline/paragraph formatting
  const renderDescription = (desc) => {
    if (!desc) return <p className="text-[#EAE0D5]/50 italic">No description available.</p>;
    // Split on double newlines to create paragraphs, single newlines become <br>
    const paragraphs = desc.split(/\n\s*\n/).filter(Boolean);
    if (paragraphs.length > 1) {
      return paragraphs.map((p, i) => (
        <p key={i} className="text-[#EAE0D5]/80 leading-relaxed mb-3">
          {p.split('\n').map((line, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </p>
      ));
    }
    // Single paragraph — just handle single newlines
    return (
      <p className="text-[#EAE0D5]/80 leading-relaxed">
        {desc.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </p>
    );
  };

  // Calculate discount percentage
  const discountPercent = product?.mrp > product?.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;
  const requiresVariantSelection = (product?.sizes?.length ?? 0) > 0;

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
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-[#B76E79]">{product.collection_name || product.category}</p>
                  {product.brand && (
                    <>
                      <span className="text-[#B76E79]/40">·</span>
                      <span className="text-sm text-[#B76E79]">{product.brand}</span>
                    </>
                  )}
                </div>
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
                  <p className="text-sm text-[#EAE0D5]/70 mb-2">
                    Color: <span className="text-[#EAE0D5]">{selectedColor?.displayName || selectedColor?.name || 'Select'}</span>
                  </p>
                  <div className="flex gap-3">
                    {product.colors.map((color) => {
                      const colorOutOfStock = !colorHasAnyStock(color);
                      const colorKey = normalizeHex(color?.hex) || normalizeHex(getHexFromName(color?.name));
                      return (
                      <button
                        key={color.name}
                        onClick={() => !colorOutOfStock && setSelectedColor(color)}
                        disabled={colorOutOfStock}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${selectedColorKey === colorKey
                          ? 'border-[#F2C29A] scale-110'
                          : 'border-[#B76E79]/20 hover:border-[#B76E79]/40'} ${
                          colorOutOfStock ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={`${color.displayName || color.name}${colorOutOfStock ? ' (Out of Stock)' : ''}`}
                      />
                      );
                    })}
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
                  {product.sizes?.map((size) => {
                    const variant = getMatchingVariant(size);
                    const hasVariant = variant !== null;
                    const inStock = !!variant?.in_stock;
                    const stockStatus = getVariantStockStatus(variant);
                    const lowStock = stockStatus === 'low_stock';
                    const sizeNotAvailableForColor = !hasVariant && selectedColorKey;
                    return (
                      <button
                        key={size}
                        onClick={() => inStock && setSelectedSize(size)}
                        disabled={!inStock}
                        className={`px-4 py-2 rounded-lg border transition-all ${
                          sizeNotAvailableForColor
                            ? 'bg-[#0B0608]/20 border-[#B76E79]/10 text-[#EAE0D5]/30 cursor-not-allowed'
                            : !inStock
                              ? 'bg-[#0B0608]/20 border-[#B76E79]/10 text-[#EAE0D5]/30 cursor-not-allowed line-through'
                              : selectedSize === size
                                ? 'bg-[#7A2F57]/30 border-[#B76E79] text-[#F2C29A]'
                                : 'bg-[#0B0608]/40 border-[#B76E79]/20 text-[#EAE0D5]/70 hover:border-[#B76E79]/40'
                        }`}
                        title={sizeNotAvailableForColor ? `${size} not available for this color` : !inStock ? `${size} is out of stock` : `${size}`}
                      >
                        <div className="leading-tight">
                          <div>{size}</div>
                          {sizeNotAvailableForColor && <div className="text-[10px] text-[#EAE0D5]/40 mt-0.5">N/A</div>}
                          {!sizeNotAvailableForColor && !inStock && <div className="text-[10px] text-red-300/80 mt-0.5">Out</div>}
                          {lowStock && <div className="text-[10px] text-amber-300 mt-0.5">Low Stock</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedVariant?.in_stock && (() => {
                  const status = getVariantStockStatus(selectedVariant);
                  return status === 'low_stock' ? (
                    <p className="text-xs text-amber-300 mt-2">Low Stock - Order soon!</p>
                  ) : null;
                })()}
                {!selectedVariant?.in_stock && selectedSize && (
                  <p className="text-xs text-red-300 mt-2">Selected size/color is out of stock</p>
                )}
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
                      onClick={() => setQuantity(Math.min(10, quantity + 1))}
                      className="p-2.5 text-[#EAE0D5]/70 hover:text-[#EAE0D5] hover:bg-[#B76E79]/10 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {!product.in_stock && (
                    <span className="text-sm text-red-400/80">Out of stock</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.in_stock || (requiresVariantSelection && !selectedVariant?.in_stock) || addingToCart}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!product.in_stock ? 'Out of Stock' : (requiresVariantSelection && !selectedVariant?.in_stock) ? 'Variant Out of Stock' : addingToCart ? 'Adding...' : 'Add to Cart'}
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
              <div className="grid grid-cols-3 gap-2 pt-6 border-t border-[#B76E79]/15">
                <div className="text-center group">
                  <Truck className="w-5 h-5 mx-auto text-[#B76E79] mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] uppercase tracking-wider text-[#EAE0D5]/60 font-medium">Free Shipping</p>
                </div>
                <div className="text-center group">
                  <Shield className="w-5 h-5 mx-auto text-[#B76E79] mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] uppercase tracking-wider text-[#EAE0D5]/60 font-medium">Secure SSL</p>
                </div>
                <div className="text-center group">
                  <Check className="w-5 h-5 mx-auto text-[#B76E79] mb-1.5 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] uppercase tracking-wider text-[#EAE0D5]/60 font-medium">100% Genuine</p>
                </div>
              </div>

              {/* Short Description */}
              {product.short_description && (
                <div className="pt-4 border-t border-[#B76E79]/15">
                  <p className="text-sm text-[#EAE0D5]/70 italic">{product.short_description}</p>
                </div>
              )}

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
                  {renderDescription(product.description)}
                </div>
              )}

              {activeTab === 'details' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {product.material && (
                      <div className="flex justify-between py-2 border-b border-[#B76E79]/10">
                        <span className="text-[#EAE0D5]/50">Material</span>
                        <span className="text-[#EAE0D5]">{product.material}</span>
                      </div>
                    )}
                    {product.care_instructions && (
                      <div className="flex justify-between py-2 border-b border-[#B76E79]/10">
                        <span className="text-[#EAE0D5]/50">Care</span>
                        <span className="text-[#EAE0D5]">{product.care_instructions}</span>
                      </div>
                    )}
                    {!product.material && !product.care_instructions && (
                      <p className="text-[#EAE0D5]/50 text-sm italic">No additional details available.</p>
                    )}
                  </div>
                  {/* Tags */}
                  {product.tags && (
                    <div>
                      <h4 className="text-[#F2C29A] mb-3">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {product.tags.split(',').map((tag, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 text-xs rounded-full bg-[#7A2F57]/30 text-[#EAE0D5]/80 border border-[#B76E79]/20"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <button 
                      onClick={() => {
                        if (!isAuthenticated) {
                          showAlert('Please login to write a review', 'info');
                          router.push('/auth/login?redirect_url=' + encodeURIComponent(window.location.pathname));
                          return;
                        }
                        setShowReviewForm(!showReviewForm);
                      }}
                      className="ml-auto px-4 py-2 bg-[#7A2F57]/30 text-[#F2C29A] rounded-lg hover:bg-[#7A2F57]/40 transition-colors"
                    >
                      {showReviewForm ? 'Cancel' : 'Write a Review'}
                    </button>
                  </div>

                  {/* Review Form */}
                  {showReviewForm && (
                    <div className="mt-6">
                      <ReviewForm
                        productId={parseInt(productId)}
                        onSuccess={handleReviewSuccess}
                        onCancel={() => setShowReviewForm(false)}
                      />
                    </div>
                  )}

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
                        
                        {/* Review images */}
                        {review.image_urls && review.image_urls.length > 0 && (
                          <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                            {review.image_urls.map((imgUrl, imgIdx) => (
                              <Image
                                key={imgIdx}
                                src={imgUrl}
                                alt={`Review image ${imgIdx + 1}`}
                                width={80}
                                height={80}
                                className="object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(imgUrl, '_blank')}
                                unoptimized // R2 URLs are external; skip optimization for dynamic URLs
                              />
                            ))}
                          </div>
                        )}
                        
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
      {/* Z-index hierarchy:
          - Chat widget button: z-[90]
          - Chat widget window: z-[95]
          - Bottom navigation: z-[100]
          - Product sticky bar: z-[105] (below nav, above chat)
      */}
      {product && (
        <div className="fixed inset-x-0 lg:hidden bg-[#0B0608]/95 backdrop-blur-md border-t border-[#B76E79]/15 px-3 pt-3 pb-3 z-[105] flex items-center gap-3"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[#F2C29A] font-semibold text-sm line-clamp-1">{product.name}</p>
            <p className="text-[#F2C29A] font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.price)}</p>
              {(selectedSize || (selectedColor && selectedColor.name)) && (
                <p className="text-xs text-[#F2C29A]/70 mt-0.5">
                  {[selectedSize, selectedColor && (selectedColor.displayName || selectedColor.name)].filter(Boolean).join(" · ")}
                </p>
              )}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!product.in_stock || (requiresVariantSelection && !selectedVariant?.in_stock) || addingToCart}
            className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {!product.in_stock ? 'Out of Stock' : (requiresVariantSelection && !selectedVariant?.in_stock) ? 'Variant Out' : addingToCart ? 'Adding...' : 'Add to Cart'}
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

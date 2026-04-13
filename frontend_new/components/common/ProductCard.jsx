'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Heart, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/ui/Toast';
import { useViewport } from '@/lib/hooks/useViewport';
import { AddToCartButton } from '@/components/cart/CartAnimation';
import { wishlistApi } from '@/lib/customerApi';
import { getCoreBaseUrl } from '@/lib/baseApi';

/**
 * Ensure image URL is usable. Backend returns full R2 URLs.
 */
const ensureFullUrl = (url) => {
  if (!url) return '/placeholder-image.jpg';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseUrl = getCoreBaseUrl();
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const ProductCard = ({ 
  product, 
  className, 
  priority = false, 
  isWishlisted: initialWishlistStatus 
}) => {
  // Support both old shape {id,name,price,image,category,isNew,originalPrice}
  // and new DB-driven shape {id,name,price,mrp,image_url,collection_name,is_new_arrival,discount_percentage}
  const id = product.id;
  const name = product.name;
  const price = product.price;
  const image = product.image_url || product.image || '';
  const category = product.collection_name || product.category || '';
  const isNew = product.is_new_arrival ?? product.isNew ?? false;
  const originalPrice = product.mrp || product.originalPrice;
  
  // Support both controlled (parent-managed) and uncontrolled (self-managed) modes
  const [internalWishlistStatus, setInternalWishlistStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use prop if provided, otherwise manage internally
  const isWishlisted = initialWishlistStatus !== undefined 
    ? initialWishlistStatus 
    : internalWishlistStatus;

  const { isMobile } = useViewport();
  const { addItem, openCart } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();

  // Validate product ID - prevent null/undefined URLs
  const productHref = id ? `/products/${id}` : '/products';

  // Detect if we're on landing page to change button text
  // Check pathname AND hash fragment for hash-routed landing pages
  const isLandingPage = typeof window !== 'undefined' && (
    window.location.pathname === '/' ||
    window.location.hash?.startsWith('#new-arrivals') ||
    window.location.hash?.startsWith('#collections')
  );
  const addToCartButtonText = isLandingPage ? 'View Details' : 'Add to Cart';

  // Internal wishlist check (fallback when prop not provided)
  useEffect(() => {
    // If parent provides wishlist status, don't check internally
    if (initialWishlistStatus !== undefined) {
      return;
    }

    // Only check wishlist if user is authenticated
    if (!isAuthenticated) {
      setInternalWishlistStatus(false);
      return;
    }

    const checkWishlist = async () => {
      try {
        const result = await wishlistApi.check(id);
        setInternalWishlistStatus(result.is_wishlisted || result.in_wishlist || false);
      } catch (e) {
        console.warn('[ProductCard] Wishlist check failed:', e.message);
      }
    };
    checkWishlist();
  }, [id, isAuthenticated, initialWishlistStatus]);

  const handleAddToCart = async (productData) => {
    // On landing page / new arrivals, navigate to product page for size selection
    // This ensures customers select the correct size before adding to cart
    if (isLandingPage) {
      // Client-side navigation to product detail page where user can select size
      router.push(productHref);
      return;
    }

    // On product browsing pages, require authentication and add to cart
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/auth/login?redirect_url=${encodeURIComponent(currentPath)}`;
      }
      return;
    }

    try {
      await addItem(
        productData.id || id,
        productData.quantity || 1,
        productData.variantId ? { id: productData.variantId } : null
      );
      toast.success('Added to Cart', `${productData.name || name} has been added to your cart`);
      openCart();
    } catch (error) {
      toast.error('Error', 'Failed to add item to cart');
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

    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isWishlisted) {
        await wishlistApi.remove(id);
        setInternalWishlistStatus(false);
        toast.success('Removed from Wishlist', `${name} removed from your wishlist`);
      } else {
        await wishlistApi.add(id);
        setInternalWishlistStatus(true);
        toast.success('Added to Wishlist', `${name} added to your wishlist`);
      }
    } catch (error) {
      // Fall back to local state toggle if API fails
      setInternalWishlistStatus(!internalWishlistStatus);
      toast.error('Error', error.message || 'Failed to update wishlist. Please login to use wishlist.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={cn("group relative w-full product-card-enhanced", className)}>
        <div className="relative aspect-[3/4] overflow-hidden bg-[#1A1A1A] rounded-2xl">
          {/* Tappable image area — navigates to product on mobile */}
          <Link href={productHref} className="absolute inset-0 z-10 lg:pointer-events-none" aria-label={`View ${name}`} />

          {/* Premium New Badge with Animation */}
          {isNew && (
            <div className="absolute top-4 left-4 z-20">
              <span className="relative px-4 py-1.5 text-xs tracking-[0.2em] text-[#050203] bg-gradient-to-r from-[#F2C29A] via-[#EAE0D5] to-[#F2C29A] font-cinzel font-semibold rounded-full overflow-hidden">
                <span className="relative z-10">NEW</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
              </span>
            </div>
          )}

          {/* Sale Badge */}
          {originalPrice && originalPrice > price && (
            <div className="absolute top-4 left-4 z-20">
              <span className="px-3 py-1 text-xs tracking-wider text-white bg-[#7A2F57] font-medium rounded-full">
                {Math.round((1 - price / originalPrice) * 100)}% OFF
              </span>
            </div>
          )}

          {/* Premium Wishlist Button with Glow */}
          <button
            onClick={handleWishlist}
            className={cn(
              "absolute top-4 right-4 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center transition-all duration-500 opacity-100 lg:opacity-0 transform lg:translate-x-4 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 rounded-full bg-[#0B0608]/60 backdrop-blur-sm border hover:shadow-[0_0_20px_rgba(242,194,154,0.3)]",
              isWishlisted
                ? "opacity-100 translate-x-0 text-[#F2C29A] border-[#F2C29A]/50"
                : "text-[#EAE0D5] border-[#B76E79]/20 hover:text-[#F2C29A] hover:border-[#F2C29A]/50"
            )}
          >
            <Heart className={cn("w-5 h-5", isWishlisted && "fill-current")} />
          </button>

          {/* Product Image - Optimized with proper loading strategy */}
          <Image
            src={ensureFullUrl(image)}
            alt={name}
            fill
            sizes="(max-width: 640px) 280px, (max-width: 1024px) 320px, 360px"
            className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
            priority={priority}
            quality={75}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
          />

          {/* Mobile: subtle gradient at bottom for add-to-cart (NO blur, NO full overlay) */}
          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end p-3 lg:hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-[#050203]/90 via-[#050203]/40 to-transparent rounded-b-2xl" />
            <AddToCartButton
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddToCart(product);
              }}
              className="relative w-full min-h-[44px] bg-gradient-to-r from-[#EAE0D5] to-[#F2C29A] text-[#050203] rounded-full active:scale-95 flex items-center justify-center gap-2 font-medium transition-transform"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>{addToCartButtonText}</span>
            </AddToCartButton>
          </div>

          {/* Desktop: hover overlay with centered actions (hidden on mobile) */}
          <div className="absolute inset-0 bg-[#050203]/50 hidden lg:flex opacity-0 group-hover:opacity-100 transition-all duration-500 flex-row items-center justify-center gap-4 backdrop-blur-[4px] rounded-2xl">
            <AddToCartButton
              onClick={(e) => {
                e.preventDefault();
                handleAddToCart(product);
              }}
              className="p-4 bg-gradient-to-r from-[#EAE0D5] to-[#F2C29A] text-[#050203] rounded-full transform translate-y-6 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100 hover:shadow-[0_0_30px_rgba(242,194,154,0.5)] active:scale-95 flex items-center justify-center"
              title={isLandingPage ? "View product details and select size" : "Add to cart"}
            >
              <ShoppingBag className="w-5 h-5" />
            </AddToCartButton>
          </div>

          {/* Bottom Gradient Line Animation */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7A2F57] via-[#B76E79] to-[#F2C29A] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-30" />
        </div>

        {/* Premium Product Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-[#B76E79] uppercase tracking-[0.2em] mb-2 font-medium">{category}</p>
          <Link href={productHref}>
            <h3 className="text-lg font-cinzel text-[#EAE0D5] group-hover:text-[#F2C29A] transition-colors duration-300 truncate px-2 hover:drop-shadow-[0_0_10px_rgba(242,194,154,0.3)]">
              {name}
            </h3>
          </Link>
          {/* Color dots */}
          {product.colors && product.colors.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {product.colors.slice(0, 4).map((color) => (
                <div
                  key={color.name}
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: color.hex || '#888888' }}
                  title={color.name}
                />
              ))}
              {product.colors.length > 4 && (
                <span className="text-xs text-[#EAE0D5]/40">+{product.colors.length - 4}</span>
              )}
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="font-playfair text-[#F2C29A] text-lg font-medium tracking-wide">
              ₹{price?.toLocaleString()}
            </p>
            {originalPrice && originalPrice > price && (
              <p className="text-sm text-[#8B7B8F] line-through">
                ₹{originalPrice?.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductCard;

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OptimizedImage from '../ui/OptimizedImage';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddToCartButton } from '@/components/cart/CartAnimation';

/**
 * Image URL helper. cloudflareLoader handles the R2 prefixing.
 */
const ensureFullUrl = (url) => url || '';

const ProductCard = ({ product, className, priority = false }) => {
  // Support both old shape {id,name,price,image,category,isNew,originalPrice}
  // and new DB-driven shape {id,name,price,mrp,image_url,collection_name,is_new_arrival,discount_percentage}
  const id = product.id;
  const name = product.name;
  const price = product.price;
  const image = product.image_url || product.image || '';
  const category = product.collection_name || product.category || '';
  const isNew = product.is_new_arrival ?? product.isNew ?? false;
  const originalPrice = product.mrp || product.originalPrice;


  const router = useRouter();

  // Build product URL from slug first (preferred), then id
  const productHandle = product.slug || id;
  const productHref = productHandle ? `/products/${productHandle}` : '/products';

  // Always navigate to product page from hover — users must select size & color
  const handleAddToCart = async (productData) => {
    router.push(productHref);
  };

  const addToCartButtonText = 'View Details';

  return (
    <>
      <div className={cn("group relative w-full product-card-enhanced", className)}>
        <div className="relative aspect-[3/4] overflow-hidden bg-[#1A1A1A] rounded-2xl">
          {/* Tappable image area — navigates to product on mobile */}
          <Link href={productHref} className="absolute inset-0 z-10 lg:pointer-events-none" aria-label={`View ${name}`} />

          {/* Sale Badge — top-right so it doesn't overlap NEW */}
          {originalPrice && originalPrice > price && (
            <div className="absolute top-4 right-4 z-20">
              <span className="px-3 py-1 text-xs tracking-wider text-white bg-[#9333EA] font-medium rounded-full">
                {Math.round((1 - price / originalPrice) * 100)}% OFF
              </span>
            </div>
          )}

          {/* Premium New Badge with Animation — top-left */}
          {isNew && (
            <div className="absolute top-4 left-4 z-20">
              <span className="relative px-4 py-1.5 text-xs tracking-[0.2em] text-[#000000] bg-gradient-to-r from-[#FFD700] via-[#F5F5F5] to-[#FFD700] font-cinzel font-semibold rounded-full overflow-hidden">
                <span className="relative z-10">NEW</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
              </span>
            </div>
          )}

          {/* Product Image - Optimized with proper loading strategy */}
          <OptimizedImage
            src={ensureFullUrl(image)}
            alt={name}
            fill
            sizes="(max-width: 640px) 280px, (max-width: 1024px) 320px, 360px"
            className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
            priority={priority}
            blur={true}
            fallbackSrc="/placeholder-image.jpg"
          />

          {/* Mobile: subtle gradient at bottom for add-to-cart (NO blur, NO full overlay) */}
          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end p-3 lg:hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-[#000000]/90 via-[#000000]/40 to-transparent rounded-b-2xl" />
            <AddToCartButton
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddToCart(product);
              }}
              className="relative w-full min-h-[44px] bg-gradient-to-r from-[#F5F5F5] to-[#FFD700] text-[#000000] rounded-full active:scale-95 flex items-center justify-center gap-2 font-medium transition-transform"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>{addToCartButtonText}</span>
            </AddToCartButton>
          </div>

          {/* Desktop: hover overlay with richer micro-interactions */}
          <div className="absolute inset-0 bg-[#000000]/60 hidden lg:flex opacity-0 group-hover:opacity-100 transition-all duration-500 flex-col items-center justify-center gap-4 backdrop-blur-[6px] rounded-2xl">
            <AddToCartButton
              onClick={(e) => {
                e.preventDefault();
                handleAddToCart(product);
              }}
              className="p-4 bg-gradient-to-r from-[#F5F5F5] to-[#FFD700] text-[#000000] rounded-full transform translate-y-6 scale-90 opacity-0 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 delay-100 hover:shadow-[0_0_40px_rgba(242,194,154,0.5)] active:scale-95 flex items-center justify-center"
              title="View product details and select size"
            >
              <ShoppingBag className="w-5 h-5" />
            </AddToCartButton>
            {/* Quick-view price on hover */}
            <span className="text-[#FFD700] text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-500 delay-200 translate-y-4 group-hover:translate-y-0" style={{ fontFamily: 'Playfair Display, serif' }}>
              {originalPrice && originalPrice > price ? (
                <>
                  <span className="line-through text-[#F5F5F5]/40 mr-2">₹{originalPrice?.toLocaleString()}</span>
                  ₹{price?.toLocaleString()}
                </>
              ) : (
                <>₹{price?.toLocaleString()}</>
              )}
            </span>
          </div>

          {/* Bottom Gradient Line Animation */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9333EA] via-[#E07B8B] to-[#FFD700] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-30" />
        </div>

        {/* Premium Product Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-[#E07B8B] uppercase tracking-[0.2em] mb-2 font-medium">{category}</p>
          <Link href={productHref}>
            <h3 className="text-lg font-cinzel text-[#F5F5F5] group-hover:text-[#FFD700] transition-colors duration-300 truncate px-2 hover:drop-shadow-[0_0_10px_rgba(242,194,154,0.3)]">
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
                  title={color.display_name || color.displayName || color.color_name || color.name}
                />
              ))}
              {product.colors.length > 4 && (
                <span className="text-xs text-[#F5F5F5]/40">+{product.colors.length - 4}</span>
              )}
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="font-playfair text-[#FFD700] text-lg font-medium tracking-wide">
              ₹{price?.toLocaleString()}
            </p>
            {originalPrice && originalPrice > price && (
              <p className="text-sm text-[#737373] line-through">
                ₹{originalPrice?.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Custom comparator: only re-render when the product ID, priority, or className changes.
 * product is a new object reference on every parent render (from _enrich_product),
 * so shallow comparison would never prevent re-renders.
 */
const areEqual = (prev, next) => (
  prev.product?.id === next.product?.id &&
  prev.priority === next.priority &&
  prev.className === next.className
);

const MemoizedProductCard = React.memo(ProductCard, areEqual);
MemoizedProductCard.displayName = 'ProductCard';

export default MemoizedProductCard;

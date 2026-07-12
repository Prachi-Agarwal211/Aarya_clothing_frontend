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

/**
 * ProductCard — sleek, borderless, deep aesthetic.
 * No white glow / product-card-enhanced underline. Hover lifts with dark soft shadow.
 */
const ProductCard = ({ product, className, priority = false }) => {
  const id = product.id;
  const name = product.name;
  const price = product.price;
  const image = product.image_url || product.image || '';
  const category = product.collection_name || product.category || '';
  const isNew = product.is_new_arrival ?? product.isNew ?? false;
  const originalPrice = product.mrp || product.originalPrice;

  const router = useRouter();
  const productHandle = product.slug || id;
  const productHref = productHandle ? `/products/${productHandle}` : '/products';

  const handleAddToCart = async () => {
    router.push(productHref);
  };

  const addToCartButtonText = 'View Details';
  const onSale = originalPrice && originalPrice > price;

  return (
    <div
      className={cn(
        'group relative w-full flex flex-col gap-4 rounded-2xl',
        'transition-all duration-500 ease-out',
        'hover:-translate-y-2',
        'hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]',
        className
      )}
    >
      {/* Image frame — deep, near-invisible structure (no shared view-transition-name; only PDP hero uses pdp-gallery) */}
      <div
        className={cn(
          'relative aspect-[3/4] overflow-hidden rounded-2xl',
          'bg-[#111111]',
          'border border-white/[0.03]',
          'transition-[border-color,box-shadow] duration-500',
          'group-hover:border-white/[0.08]'
        )}
      >
        <Link
          href={productHref}
          className="absolute inset-0 z-10 lg:pointer-events-none"
          aria-label={`View ${name}`}
        />

        {/* Sale badge — frosted glass */}
        {onSale && (
          <div className="absolute top-3 right-3 z-20">
            <span
              className={cn(
                'inline-flex px-2.5 py-1 text-[10px] sm:text-xs tracking-[0.12em] uppercase',
                'rounded-full font-medium text-[#F5F0E8]',
                'bg-black/45 backdrop-blur-md border border-white/10'
              )}
            >
              {Math.round((1 - price / originalPrice) * 100)}% OFF
            </span>
          </div>
        )}

        {/* NEW badge — frosted glass (not solid yellow) */}
        {isNew && (
          <div className="absolute top-3 left-3 z-20">
            <span
              className={cn(
                'inline-flex px-2.5 py-1 text-[10px] sm:text-xs tracking-[0.18em] uppercase',
                'rounded-full font-medium text-[#F0D78C]',
                'bg-black/45 backdrop-blur-md border border-[#D4AF37]/20'
              )}
            >
              NEW
            </span>
          </div>
        )}

        <OptimizedImage
          src={ensureFullUrl(image)}
          alt={name}
          fill
          sizes="(max-width: 640px) 280px, (max-width: 1024px) 320px, 360px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          priority={priority}
          blur={true}
          fallbackSrc="/placeholder-image.svg"
        />

        {/* Mobile CTA */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end p-3 lg:hidden">
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D]/95 via-[#0D0D0D]/45 to-transparent rounded-b-2xl"
            aria-hidden="true"
          />
          <AddToCartButton
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddToCart();
            }}
            className="relative w-full min-h-[44px] bg-[#D4AF37] text-[#0D0D0D] rounded-full active:scale-95 flex items-center justify-center gap-2 font-medium transition-transform"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>{addToCartButtonText}</span>
          </AddToCartButton>
        </div>

        {/* Desktop hover — soft dark veil, no white glow */}
        <div className="absolute inset-0 hidden lg:flex opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex-col items-center justify-center gap-3 bg-[#0D0D0D]/55 rounded-2xl">
          <AddToCartButton
            onClick={(e) => {
              e.preventDefault();
              handleAddToCart();
            }}
            className={cn(
              'p-3.5 rounded-full flex items-center justify-center',
              'bg-[#D4AF37] text-[#0D0D0D]',
              'transform translate-y-4 scale-95 opacity-0',
              'group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100',
              'transition-all duration-500 delay-75',
              'active:scale-95'
            )}
            title="View product details and select size"
          >
            <ShoppingBag className="w-5 h-5" />
          </AddToCartButton>
          <span
            className="text-[#D4AF37] text-sm opacity-0 group-hover:opacity-100 transition-all duration-500 delay-150 translate-y-3 group-hover:translate-y-0"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            {onSale ? (
              <>
                <span className="line-through text-[#F5F0E8]/35 mr-2">
                  ₹{originalPrice?.toLocaleString()}
                </span>
                ₹{price?.toLocaleString()}
              </>
            ) : (
              <>₹{price?.toLocaleString()}</>
            )}
          </span>
        </div>
      </div>

      {/* Product meta — breathing room, elegant type */}
      <div className="px-1 pb-1 text-center space-y-1.5">
        {category ? (
          <p
            className="text-[10px] sm:text-[11px] text-[#8A919C] uppercase tracking-[0.22em] font-medium"
            style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
          >
            {category}
          </p>
        ) : null}
        <Link href={productHref} className="block">
          <h3
            className="text-base sm:text-lg text-white group-hover:text-[#D4AF37] transition-colors duration-300 line-clamp-2 px-1 leading-snug"
            style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif', fontWeight: 400 }}
          >
            {name}
          </h3>
        </Link>
        {product.colors && product.colors.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            {product.colors.slice(0, 4).map((color) => (
              <div
                key={color.name}
                className="w-2.5 h-2.5 rounded-full border border-white/15"
                style={{ backgroundColor: color.hex || '#888888' }}
                title={color.display_name || color.displayName || color.color_name || color.name}
              />
            ))}
            {product.colors.length > 4 && (
              <span className="text-[10px] text-[#8A919C]">+{product.colors.length - 4}</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-center gap-2 pt-0.5">
          <p
            className="text-[#D4AF37] text-base sm:text-lg tracking-wide"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 500 }}
          >
            ₹{price?.toLocaleString()}
          </p>
          {onSale && (
            <p className="text-sm text-[#8A919C] line-through">
              ₹{originalPrice?.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const areEqual = (prev, next) => (
  prev.product?.id === next.product?.id &&
  prev.priority === next.priority &&
  prev.className === next.className
);

const MemoizedProductCard = React.memo(ProductCard, areEqual);
MemoizedProductCard.displayName = 'ProductCard';

export default MemoizedProductCard;

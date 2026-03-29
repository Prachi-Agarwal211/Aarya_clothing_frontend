'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, Trash2, ShoppingCart, Eye, RefreshCw } from 'lucide-react';
import { wishlistApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

export default function WishlistPage() {
  const router = useRouter();
  const { addItem, openCart } = useCart();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect_url=/profile/wishlist');
      return;
    }
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated, authLoading]);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await wishlistApi.list();
      setWishlist(data.wishlist || data || []);
    } catch (err) {
      logger.error('Error fetching wishlist:', err);
      setError('Failed to load wishlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId) => {
    try {
      await wishlistApi.remove(productId);
      setWishlist(prev => prev.filter(item => item.product_id !== productId));
    } catch (err) {
      logger.error('Error removing from wishlist:', err);
      setError('Failed to remove item. Please try again.');
    }
  };

  const handleAddToCart = async (item) => {
    try {
      await addItem(item.product_id, 1);
      openCart();
    } catch (err) {
      logger.error('Error adding to cart:', err);
      setError('Failed to add to cart. Please try again.');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const productHref = (item) => `/products/${item.product?.slug || item.product_id}`;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#F2C29A]">My Wishlist</h2>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between gap-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchWishlist} className="flex items-center gap-1.5 text-sm text-[#F2C29A] hover:opacity-80 transition-opacity flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-[#B76E79]/10 rounded-2xl mb-3" />
              <div className="h-4 bg-[#B76E79]/10 rounded w-3/4 mb-2" />
              <div className="h-4 bg-[#B76E79]/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : wishlist.length === 0 ? (
        <div className="p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl text-center">
          <Heart className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
          <p className="text-[#EAE0D5]/50 mb-2">Your wishlist is empty</p>
          <p className="text-sm text-[#EAE0D5]/40 mb-4">Save items you love by clicking the heart icon</p>
          <Link
            href="/products"
            className="inline-block px-8 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity font-semibold"
          >
            Explore All Products
          </Link>
          <div className="flex justify-center gap-4 mt-8">
            <Link href="/#new-arrivals" className="text-sm text-[#F2C29A] hover:underline decoration-[#F2C29A]/30 underline-offset-8 uppercase tracking-[0.2em] font-cinzel">New Arrivals</Link>
            <span className="text-[#B76E79]/30">•</span>
            <Link href="/#collections" className="text-sm text-[#F2C29A] hover:underline decoration-[#F2C29A]/30 underline-offset-8 uppercase tracking-[0.2em] font-cinzel">Collections</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlist.map((item) => {
            const product = item.product || {};
            return (
            <div
              key={item.id}
              className="group bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden hover:border-[#B76E79]/30 transition-all"
            >
              {/* Image */}
              <Link href={productHref(item)} className="block relative aspect-[3/4]">
                {product.image_url || product.primary_image ? (
                  <Image
                    src={product.image_url || product.primary_image}
                    alt={product.name || 'Product'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#7A2F57]/10 flex items-center justify-center">
                    <span className="text-[#B76E79]/30 text-sm">No Image</span>
                  </div>
                )}

                {/* Out of Stock Badge */}
                {!product.in_stock && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="px-3 py-1 bg-red-500/80 text-white text-sm rounded-lg">
                      Out of Stock
                    </span>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(item.product_id);
                    }}
                    className="p-2 bg-[#0B0608]/80 backdrop-blur-sm rounded-full text-[#B76E79] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    href={productHref(item)}
                    className="p-2 bg-[#0B0608]/80 backdrop-blur-sm rounded-full text-[#EAE0D5]/70 hover:text-[#EAE0D5] transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>
              </Link>

              {/* Info */}
              <div className="p-3">
                <Link
                  href={productHref(item)}
                  className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors line-clamp-2 text-sm"
                >
                  {product.name || 'Product'}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[#F2C29A] font-medium">{formatCurrency(product.price || 0)}</span>
                  {product.mrp > product.price && (
                    <span className="text-xs text-[#EAE0D5]/50 line-through">
                      {formatCurrency(product.mrp)}
                    </span>
                  )}
                </div>

                {/* Add to Cart */}
                <button
                  onClick={() => handleAddToCart(item)}
                  disabled={!product.in_stock}
                  className="w-full mt-3 py-2 flex items-center justify-center gap-2 bg-[#7A2F57]/30 text-[#F2C29A] rounded-lg hover:bg-[#7A2F57]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Lock, Package, Check } from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import { getColorName } from '@/lib/colorMap';

function CartPage() {
  const { cart, loading: cartLoading, updateQuantity, removeItem, clearCart, refreshCart } = useCart();
  const [removingId, setRemovingId] = React.useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const initialCartLoadDoneRef = useRef(false);
  const redirectTimerRef = useRef(null);

  const handleRemove = async (productId, variantId) => {
    const key = `${productId}_${variantId || 0}`;
    setRemovingId(key);
    setTimeout(() => removeItem(productId, variantId), 280);
  };

  const handleDecrement = (item) => {
    if (item.quantity <= 1) {
      handleRemove(item.product_id, item.variant_id);
    } else {
      updateQuantity(item.product_id, item.quantity - 1, item.variant_id);
    }
  };

  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  // Auth + cart boot flow (avoid redirect/fetch race flicker on mobile)
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (isAuthenticated) {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      setIsRedirecting(false);

      // Load only once on initial auth confirmation to avoid double-sync flicker.
      if (!initialCartLoadDoneRef.current) {
        initialCartLoadDoneRef.current = true;
        refreshCart();
      }
      return;
    }

    // Reset this when session is gone so future auth can re-trigger load.
    initialCartLoadDoneRef.current = false;
    setIsRedirecting(true);

    // Small delay avoids transient auth state flips causing in-out navigation.
    if (!redirectTimerRef.current) {
      redirectTimerRef.current = setTimeout(() => {
        const currentPath = typeof window !== 'undefined'
          ? window.location.pathname + window.location.search + window.location.hash
          : '/cart';
        window.location.href = `/auth/login?redirect_url=${encodeURIComponent(currentPath)}`;
      }, 220);
    }
  }, [refreshCart, isAuthenticated, authLoading]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatColorLabel = (color) => {
    if (!color || typeof color !== 'string') return '';
    const trimmed = color.trim();
    if (!trimmed) return '';
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      return getColorName(trimmed) || 'Custom';
    }
    return trimmed;
  };

  const itemCount = cart?.items?.length || 0;
  const hasCartItems = itemCount > 0;

  if (authLoading || isRedirecting) {
    return (
      <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
        <div className="relative z-10 page-wrapper">
          <EnhancedHeader />
          <div className="page-content">
            <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 lg:py-12 pb-32 lg:pb-12">
              <div className="animate-pulse grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 bg-[#B76E79]/10 rounded-2xl" />
                  ))}
                </div>
                <div className="h-64 bg-[#B76E79]/10 rounded-2xl" />
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      {/* Background is now handled by root layout */}

      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 lg:py-12 pb-32 lg:pb-12">
            {/* Page Header */}
            <div className="mb-8">
              <h1
                className="text-3xl md:text-4xl font-bold text-[#F2C29A]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Shopping Cart
              </h1>
              <p className="text-[#EAE0D5]/60 mt-2">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} in your cart
              </p>
            </div>

            {/* Cart Summary */}
            {cart?.subtotal > 0 && (
              <div className="mb-8 p-4 bg-gradient-to-r from-green-500/10 to-transparent border-l-4 border-green-500/50 rounded-r-2xl">
                <p className="text-sm font-medium text-green-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  All prices include taxes and shipping. No hidden charges.
                </p>
              </div>
            )}

            {cartLoading ? (
              <div className="animate-pulse grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 bg-[#B76E79]/10 rounded-2xl" />
                  ))}
                </div>
                <div className="h-64 bg-[#B76E79]/10 rounded-2xl" />
              </div>
            ) : !cart?.items || cart.items.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="w-20 h-20 text-[#B76E79]/30 mx-auto mb-6" />
                <h2 className="text-xl text-[#F2C29A] mb-2">Your cart is empty</h2>
                <p className="text-[#EAE0D5]/50 mb-6">Looks like you haven&apos;t added anything to your cart yet.</p>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity font-semibold"
                >
                  Explore All Products
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <div className="flex justify-center gap-4 mt-8">
                  <Link href="/#new-arrivals" className="text-sm text-[#F2C29A] hover:underline decoration-[#F2C29A]/30 underline-offset-8 uppercase tracking-[0.2em] font-cinzel">New Arrivals</Link>
                  <span className="text-[#B76E79]/30">•</span>
                  <Link href="/#collections" className="text-sm text-[#F2C29A] hover:underline decoration-[#F2C29A]/30 underline-offset-8 uppercase tracking-[0.2em] font-cinzel">Collections</Link>
                </div>
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Cart Items */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Header */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm text-[#EAE0D5]/50">
                    <div className="col-span-6">Product</div>
                    <div className="col-span-2 text-center">Price</div>
                    <div className="col-span-2 text-center">Quantity</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>

                  {/* Items */}
                  {cart.items.map((item) => {
                    const itemKey = `${item.product_id}_${item.variant_id || 0}`;
                    return (
                    <div
                      key={itemKey}
                      className={`grid grid-cols-12 gap-4 p-4 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl transition-all duration-300 ${
                        removingId === itemKey ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
                      }`}
                    >
                      {/* Product Info */}
                      <div className="col-span-12 md:col-span-6 flex gap-4">
                        <Link
                          href={`/products/${item.product_id}`}
                          className="relative w-24 h-28 bg-[#7A2F57]/10 rounded-xl overflow-hidden flex-shrink-0"
                        >
                          {item.image && item.image !== '' ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="96px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-xs text-[#B76E79]/30">No Image</span>
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/products/${item.product_id}`}
                            className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors font-medium line-clamp-2"
                          >
                            {item.name}
                          </Link>
                          {(item.size || item.color) && (
                            <p className="text-sm text-[#EAE0D5]/50 mt-1">
                              {item.size && <span>Size: {item.size}</span>}
                              {item.size && item.color && <span> • </span>}
                              {item.color && <span>Color: {formatColorLabel(item.color)}</span>}
                            </p>
                          )}
                          <button
                            onClick={() => removeItem(item.product_id, item.variant_id)}
                            className="flex items-center gap-1 mt-2 text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors md:hidden"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="col-span-4 md:col-span-2 flex items-center md:justify-center">
                        <span className="md:hidden text-[#EAE0D5]/50 mr-2">Price:</span>
                        <span className="text-[#EAE0D5]">{formatCurrency(item.price)}</span>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-4 md:col-span-2 flex items-center md:justify-center">
                        <div className="flex items-center border border-[#B76E79]/20 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleDecrement(item)}
                            className="p-2 text-[#EAE0D5]/50 hover:text-[#B76E79] transition-colors"
                            title={item.quantity <= 1 ? 'Remove item' : 'Decrease quantity'}
                          >
                            {item.quantity <= 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                          </button>
                          <span className="w-10 text-center text-[#EAE0D5]">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.variant_id)}
                            className="p-2 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-2">
                        <span className="md:hidden text-[#EAE0D5]/50">Total:</span>
                        <span className="text-[#F2C29A] font-medium">{formatCurrency(item.price * item.quantity)}</span>
                        <button
                          onClick={() => handleRemove(item.product_id, item.variant_id)}
                          className="hidden md:block p-1.5 text-[#EAE0D5]/30 hover:text-[#B76E79] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                  })}

                  {/* Clear Cart */}
                  <div className="flex justify-end">
                    <button
                      onClick={clearCart}
                      className="text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors"
                    >
                      Clear Cart
                    </button>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="lg:col-span-1">
                  <div className="sticky top-24 p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl space-y-6">
                    <h2 className="text-lg font-semibold text-[#F2C29A]">Order Summary</h2>

                    {/* Totals */}
                    <div className="space-y-3 pt-4 border-t border-[#B76E79]/10">
                      <div className="flex justify-between">
                        <span className="text-[#EAE0D5]/70">Subtotal</span>
                        <span className="text-[#EAE0D5]">{formatCurrency(cart.subtotal)}</span>
                      </div>
                      {cart.discount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#EAE0D5]/70">Discount</span>
                          <span className="text-green-400">-{formatCurrency(cart.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#EAE0D5]/70">Shipping</span>
                        <span className="text-[#EAE0D5]">
                          {cart.shipping > 0 ? formatCurrency(cart.shipping) : 'Free'}
                        </span>
                      </div>
                      <div className="flex justify-between pt-3 border-t border-[#B76E79]/10">
                        <span className="text-[#EAE0D5] font-medium">Total</span>
                        <span className="text-[#F2C29A] font-bold text-xl">{formatCurrency(cart.total)}</span>
                      </div>
                    </div>

                    {/* Checkout Button */}
                    <Link
                      href="/checkout"
                      className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Proceed to Checkout
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    {/* Continue Shopping */}
                    <Link
                      href="/products"
                      className="block text-center text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors"
                    >
                      Continue Shopping
                    </Link>

                    {/* Trust Badges */}
                    <div className="pt-4 border-t border-[#B76E79]/10">
                      <div className="flex items-center justify-center gap-6 text-xs text-[#EAE0D5]/50">
                        <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#B76E79]/60" />Secure</span>
                        <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-[#B76E79]/60" />Free Shipping</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>

      {/* Mobile Sticky Checkout Bar Placeholder (prevents layout shift) */}
      <div className="lg:hidden h-[90px] w-full" aria-hidden="true" />

      {/* Mobile Sticky Checkout Bar */}
      <div
        className={`fixed bottom-nav-offset inset-x-0 lg:hidden bg-[#0B0608]/95 backdrop-blur-md border-t border-[#B76E79]/15 p-4 z-[110] transition-all duration-300 ${
          hasCartItems ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
        style={{ minHeight: '90px' }}
        aria-hidden={!hasCartItems}
      >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#EAE0D5]/70 text-sm">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
            <span className="text-[#F2C29A] font-bold text-lg">{formatCurrency(cart.total)}</span>
          </div>
          <Link
            href="/checkout"
            className={`flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl transition-opacity ${
              hasCartItems ? 'hover:opacity-90' : 'pointer-events-none opacity-70'
            }`}
          >
            Proceed to Checkout
            <ArrowRight className="w-4 h-4" />
          </Link>
      </div>
    </main>
  );
}

export default CartPage;

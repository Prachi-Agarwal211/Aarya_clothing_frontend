'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Check, ChevronRight } from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import { useCart } from '@/lib/cartContext';
import { cn } from '@/lib/utils';

export default function CheckoutLayout({ children }) {
  const pathname = usePathname();
  const { cart, itemCount, refreshCart } = useCart();

  // Fetch cart once when checkout mounts
  useEffect(() => {
    refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      {/* Background is now handled by root layout */}

      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            {/* Page Header */}
            <div className="mb-12">
              <h1
                className="text-3xl md:text-4xl font-bold text-[#F2C29A] text-center mb-10"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Checkout
              </h1>

              {/* Progress Stepper */}
              <div className="max-w-2xl mx-auto relative px-4">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-[#B76E79]/20 -translate-y-1/2" />
                <div
                  className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] -translate-y-1/2 transition-all duration-700 ease-in-out"
                  style={{
                    width: pathname.includes('payment') ? '66.6%' :
                      pathname.includes('confirm') ? '100%' : '33.3%'
                  }}
                />

                <div className="relative flex justify-between items-center text-xs font-medium uppercase tracking-[0.2em]">
                  {[
                    { id: 'address', name: 'Address', icon: Check, path: '/checkout' },
                    { id: 'payment', name: 'Payment', icon: Check, path: '/checkout/payment' },
                    { id: 'confirm', name: 'Confirm', icon: Check, path: '/checkout/confirm' }
                  ].map((step, idx) => {
                    const isActive = pathname === step.path || (step.id === 'address' && pathname === '/checkout');
                    const isCompleted = (step.id === 'address' && (pathname.includes('payment') || pathname.includes('confirm'))) ||
                      (step.id === 'payment' && pathname.includes('confirm'));

                    return (
                      <div key={step.id} className="flex flex-col items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10",
                          isCompleted ? "bg-[#B76E79] border-[#B76E79] text-white" :
                            isActive ? "bg-[#050203] border-[#F2C29A] text-[#F2C29A] ring-4 ring-[#F2C29A]/10" :
                              "bg-[#050203] border-[#B76E79]/30 text-[#EAE0D5]/30 shadow-inner"
                        )}>
                          {isCompleted ? <Check className="w-5 h-5" /> : <span>{idx + 1}</span>}
                        </div>
                        <span className={cn(
                          "transition-colors duration-300 text-[10px] sm:text-xs text-center leading-tight",
                          isActive || isCompleted ? "text-[#F2C29A]" : "text-[#EAE0D5]/30"
                        )}>
                          {step.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="lg:col-span-2 order-1">
                {children}
              </div>

              {/* Order Summary Sidebar */}
              <div className="lg:col-span-1 order-2">
                <div className="sticky top-28 p-4 sm:p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl space-y-4">
                  <h2 className="text-lg font-semibold text-[#F2C29A]">Order Summary</h2>

                  {/* Items Preview */}
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {cart?.items?.map((item) => (
                      <div key={item.id || `${item.product_id}_${item.variant_id}`} className="flex gap-4 group">
                        <div className="relative w-16 h-20 bg-[#1A1A1A] rounded-xl flex-shrink-0 overflow-hidden border border-[#B76E79]/10">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name || item.product_name}
                              fill
                              className="object-cover transition-transform group-hover:scale-110"
                              sizes="64px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-[#B76E79]/30">No Image</div>
                          )}
                          <span className="absolute -top-1 -right-1 bg-[#F2C29A] text-[#050203] text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                            {item.quantity}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                          <p className="text-sm font-medium text-[#EAE0D5] line-clamp-2 leading-snug group-hover:text-[#F2C29A] transition-colors">
                            {item.name || item.product_name}
                          </p>
                          <p className="text-[11px] text-[#B76E79] mt-1 space-x-2">
                            {item.size && <span>Size: {item.size}</span>}
                            {item.color && <span>• Color: {item.color}</span>}
                          </p>
                        </div>
                        <div className="text-right py-1">
                          <span className="text-sm font-semibold text-[#F2C29A]">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-2.5 pt-6 border-t border-[#B76E79]/20">
                    {cart?.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#EAE0D5]/60 italic">Discount</span>
                        <span className="text-green-400">-{formatCurrency(cart.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-4 border-t border-[#B76E79]/20">
                      <span className="text-[#F2C29A] font-cinzel text-lg tracking-wider">Total</span>
                      <span className="text-[#F2C29A] font-bold text-2xl drop-shadow-[0_0_10px_rgba(242,194,154,0.3)]">
                        {formatCurrency(cart?.total)}
                      </span>
                    </div>
                    <p className="text-xs text-[#EAE0D5]/40 text-center">
                      Includes all taxes & free shipping
                    </p>
                  </div>

                  {/* Trust Badge for Secure Checkout */}
                  <div className="pt-4 flex items-center justify-center gap-2 text-[10px] text-[#B76E79]/40 uppercase tracking-widest">
                    <Check className="w-3 h-3" />
                    <span>Secure SSL Encrypted Checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}

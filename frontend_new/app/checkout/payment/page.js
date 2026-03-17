'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ChevronRight, Lock, Shield, Check, AlertCircle, ShoppingBag, X } from 'lucide-react';
import { paymentApi, cartApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

/**
 * CheckoutPaymentPage — Razorpay integration.
 * Flow:
 *  1. Backend creates Razorpay order → returns { id, amount, currency }
 *  2. Frontend loads Razorpay checkout.js → opens modal
 *  3. On success handler receives { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *  4. Backend verifies HMAC signature → redirect to /checkout/confirm
 */
export default function CheckoutPaymentPage() {
  const router = useRouter();
  const { cart, isAuthenticated } = useCart();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [stockError, setStockError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/checkout/payment');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const addressId = sessionStorage.getItem('checkout_address_id');
    if (!addressId) {
      router.push('/checkout');
    }
  }, [router]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const formatCurrencyLocal = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);

  const loadRazorpaySDK = () =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(window.Razorpay);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
      document.head.appendChild(script);
    });

  const handlePayment = async () => {
    try {
      setProcessing(true);
      setError(null);

      // 1. Validate stock
      try {
        const stockValidation = await cartApi.validateStock();
        if (stockValidation?.out_of_stock?.length > 0) {
          setStockError({ items: stockValidation.out_of_stock });
          setProcessing(false);
          return;
        }
      } catch (stockErr) {
        setError(stockErr.message || 'Items in your cart are out of stock.');
        setProcessing(false);
        return;
      }

      const addressId = sessionStorage.getItem('checkout_address_id');
      if (!addressId) {
        setError('Please select a delivery address');
        router.push('/checkout');
        return;
      }

      // 2. Get Razorpay key_id from backend config
      let keyId;
      try {
        const config = await paymentApi.getConfig();
        keyId = config?.razorpay?.key_id;
        if (!keyId) throw new Error('Payment not configured');
      } catch (err) {
        setError('Payment service unavailable. Please try again.');
        setProcessing(false);
        return;
      }

      // 3. Create Razorpay order on backend (amount in paise)
      let orderData;
      try {
        orderData = await paymentApi.createRazorpayOrder({
          amount: Math.round((cart.total || 0) * 100),
          currency: 'INR',
          receipt: `cart_${Date.now()}`,
        });
      } catch (err) {
        setError('Failed to initialize payment. Please try again.');
        logger.error('Razorpay create order error:', err);
        setProcessing(false);
        return;
      }

      if (!orderData?.id) {
        setError('Payment initialization failed. Please try again.');
        setProcessing(false);
        return;
      }

      // 4. Load Razorpay SDK and open modal
      const RazorpayClass = await loadRazorpaySDK();

      await new Promise((resolve, reject) => {
        const customerName = user?.profile?.full_name || user?.full_name || user?.username || 'Customer';
        const customerEmail = user?.email || '';
        const customerPhone = user?.profile?.phone || user?.phone || '';

        const rzp = new RazorpayClass({
          key: keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          order_id: orderData.id,
          name: 'Aarya Clothing',
          description: 'Premium Ethnic Wear',
          image: '/logo.png',
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone,
          },
          theme: { color: '#B76E79' },
          modal: {
            ondismiss: () => {
              setProcessing(false);
              resolve();
            },
          },
          handler: async (response) => {
            try {
              // 5. Verify signature on backend
              const verifyData = await paymentApi.verifyRazorpaySignature({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });

              if (verifyData?.success) {
                sessionStorage.setItem('payment_id', response.razorpay_payment_id);
                sessionStorage.setItem('razorpay_order_id', response.razorpay_order_id);
                router.push('/checkout/confirm');
              } else {
                setError('Payment verification failed. Contact support if amount was deducted.');
                setProcessing(false);
              }
            } catch (verifyErr) {
              logger.error('Razorpay verify error:', verifyErr);
              setError('Payment verification failed. Contact support if amount was deducted.');
              setProcessing(false);
            }
            resolve();
          },
        });

        rzp.on('payment.failed', (response) => {
          logger.error('Razorpay payment failed:', response.error);
          setError(response.error?.description || 'Payment failed. Please try again.');
          setProcessing(false);
          resolve();
        });

        rzp.open();
      });

    } catch (err) {
      logger.error('Payment error:', err);
      setError('Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Out of Stock Modal */}
      {stockError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative bg-[#0B0608] border border-[#B76E79]/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <button
              onClick={() => setStockError(null)}
              className="absolute top-4 right-4 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-[#F2C29A] mb-2">Items Out of Stock</h3>
              <p className="text-[#EAE0D5]/70 mb-6">
                Sorry, the following items are no longer available:
              </p>
              <div className="space-y-3 mb-6">
                {stockError.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <ShoppingBag className="w-5 h-5 text-red-400 shrink-0" />
                    <span className="text-[#EAE0D5] text-sm truncate">
                      {item.name || item.product_name || `Product #${item.product_id}`}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setStockError(null); router.push('/cart'); }}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                Return to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h2 className="text-xl font-semibold text-[#F2C29A] mb-6">Payment Method</h2>
        <div className="relative p-4 border rounded-xl bg-[#7A2F57]/20 border-[#B76E79]">
          <div className="absolute top-3 right-3">
            <Check className="w-5 h-5 text-[#B76E79]" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl">💳</span>
            <div>
              <p className="font-medium text-[#F2C29A]">Razorpay</p>
              <p className="text-sm text-[#EAE0D5]/70">UPI, Cards, Net Banking, Wallets &amp; more</p>
            </div>
          </div>
        </div>
      </div>

      {/* Razorpay info */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-[#B76E79]" />
          <span className="text-sm text-[#EAE0D5]/70">Secure payment powered by Razorpay</span>
        </div>
        <p className="text-[#EAE0D5]/70 text-sm">
          Click &quot;Pay Now&quot; to open the secure Razorpay checkout. You can pay using:
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet'].map((m) => (
            <span key={m} className="px-3 py-1 bg-[#7A2F57]/20 text-[#EAE0D5]/70 text-sm rounded-full">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Order Cost Breakdown */}
      <div className="p-5 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h3 className="text-sm font-semibold text-[#F2C29A] mb-4 uppercase tracking-wider">Payment Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#EAE0D5]/60">Subtotal</span>
            <span className="text-[#EAE0D5]">{formatCurrency(cart?.subtotal)}</span>
          </div>
          {cart?.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-[#EAE0D5]/60">Discount</span>
              <span className="text-green-400">-{formatCurrency(cart.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#EAE0D5]/60">Shipping</span>
            <span className="text-[#EAE0D5]">{cart?.shipping > 0 ? formatCurrency(cart.shipping) : 'FREE'}</span>
          </div>
          {cart?.igst_amount > 0 ? (
            <div className="flex justify-between">
              <span className="text-[#EAE0D5]/60">IGST (Inter-state GST)</span>
              <span className="text-[#EAE0D5]">{formatCurrencyLocal(cart.igst_amount)}</span>
            </div>
          ) : (cart?.cgst_amount > 0 || cart?.sgst_amount > 0) ? (
            <>
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/60">CGST</span>
                <span className="text-[#EAE0D5]">{formatCurrencyLocal(cart?.cgst_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/60">SGST</span>
                <span className="text-[#EAE0D5]">{formatCurrencyLocal(cart?.sgst_amount)}</span>
              </div>
            </>
          ) : cart?.gst_amount > 0 ? (
            <div className="flex justify-between">
              <span className="text-[#EAE0D5]/60">GST</span>
              <span className="text-[#EAE0D5]">{formatCurrencyLocal(cart.gst_amount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between pt-3 mt-1 border-t border-[#B76E79]/20 font-semibold text-base">
            <span className="text-[#F2C29A]">Total Payable</span>
            <span className="text-[#F2C29A]">{formatCurrency(cart?.total)}</span>
          </div>
        </div>
        {cart?.delivery_state && (
          <p className="mt-3 text-xs text-[#EAE0D5]/40">
            Place of Supply: {cart.delivery_state} — GST invoice will be generated on payment
          </p>
        )}
      </div>

      {/* Security Info */}
      <div className="p-4 bg-[#7A2F57]/10 border border-[#B76E79]/10 rounded-xl">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#B76E79]" />
          <div>
            <p className="text-sm text-[#F2C29A]">100% Secure Payments</p>
            <p className="text-xs text-[#EAE0D5]/50">Your payment information is encrypted and secure</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Pay Button */}
      <div className="flex justify-end">
        <button
          onClick={handlePayment}
          disabled={processing}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {processing ? (
            'Processing...'
          ) : (
            <>
              {`Pay ${formatCurrency(cart?.total)}`}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

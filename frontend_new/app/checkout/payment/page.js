'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ChevronRight, Lock, Shield, Check, AlertCircle, ShoppingBag, X } from 'lucide-react';
import { paymentApi, cartApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

/**
 * CheckoutPaymentPage — Cashfree Payments JS SDK integration.
 * Flow:
 *  1. Backend creates Cashfree order → returns payment_session_id
 *  2. Frontend loads Cashfree JS SDK → opens drop-in checkout
 *  3. On success, backend verifies → redirect to /checkout/confirm
 */
export default function CheckoutPaymentPage() {
  const router = useRouter();
  const { cart, isAuthenticated } = useCart();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState('cashfree');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [stockError, setStockError] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/checkout/payment');
    }
  }, [isAuthenticated, router]);

  // Check for address
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

  const loadCashfreeSDK = () =>
    new Promise((resolve, reject) => {
      if (window.Cashfree) return resolve(window.Cashfree);
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.onload = () => resolve(window.Cashfree);
      script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
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

      const customerName = user?.profile?.full_name || user?.full_name || user?.username || 'Customer';
      const customerPhone = user?.profile?.phone || user?.phone || '9999999999';

      // 2. Create Cashfree order on backend
      let orderData;
      try {
        orderData = await paymentApi.createOrder({
          amount: cart.total,
          currency: 'INR',
          customer_name: customerName,
          customer_email: user?.email || '',
          customer_phone: customerPhone,
        });
      } catch (err) {
        setError('Failed to initialize payment. Please try again.');
        logger.error('Cashfree create order error:', err);
        setProcessing(false);
        return;
      }

      if (!orderData?.payment_session_id) {
        setError('Payment initialization failed. Please try again.');
        setProcessing(false);
        return;
      }

      // Store order_id for verification after payment
      sessionStorage.setItem('cashfree_order_id', orderData.order_id);

      // 3. Load Cashfree JS SDK and open drop-in
      try {
        await loadCashfreeSDK();
        const cashfree = new window.Cashfree({ mode: 'production' });

        const checkoutOptions = {
          paymentSessionId: orderData.payment_session_id,
          redirectTarget: '_modal',
        };

        const result = await cashfree.checkout(checkoutOptions);

        if (result.error) {
          setError(result.error.message || 'Payment failed. Please try again.');
          logger.error('Cashfree payment error:', result.error);
          setProcessing(false);
          return;
        }

        if (result.redirect) {
          // Payment redirected - will come back via return_url
          return;
        }

        // 4. Payment completed - verify on backend
        const verifyData = await paymentApi.verify({ order_id: orderData.order_id });

        if (verifyData?.success) {
          sessionStorage.setItem('payment_id', verifyData.cf_payment_id || '');
          sessionStorage.setItem('cashfree_order_id', orderData.order_id);
          router.push('/checkout/confirm');
        } else {
          setError(verifyData?.error || 'Payment verification failed. Contact support if amount was deducted.');
        }
      } catch (err) {
        setError('Payment failed. Please try again.');
        logger.error('Cashfree SDK error:', err);
      }
    } catch (err) {
      logger.error('Payment error:', err);
      setError('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const paymentMethods = [
    {
      id: 'cashfree',
      name: 'Cashfree Payments',
      description: 'Pay using UPI, Cards, Net Banking, Wallets',
      icon: '💳',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ====== Out of Stock Modal ====== */}
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
      {/* Payment Method Selection */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h2 className="text-xl font-semibold text-[#F2C29A] mb-6">Payment Method</h2>

        <div className="space-y-4">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              onClick={() => setPaymentMethod(method.id)}
              className={`relative p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === method.id
                ? 'bg-[#7A2F57]/20 border-[#B76E79]'
                : 'bg-[#0B0608]/40 border-[#B76E79]/15 hover:border-[#B76E79]/30'
                }`}
            >
              {paymentMethod === method.id && (
                <div className="absolute top-3 right-3">
                  <Check className="w-5 h-5 text-[#B76E79]" />
                </div>
              )}

              <div className="flex items-center gap-4">
                <span className="text-2xl">{method.icon}</span>
                <div>
                  <p className="font-medium text-[#F2C29A]">{method.name}</p>
                  <p className="text-sm text-[#EAE0D5]/70">{method.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cashfree payment info */}
      {paymentMethod === 'cashfree' && (
        <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]/70">Secure payment powered by Cashfree Payments</span>
          </div>

          <p className="text-[#EAE0D5]/70 text-sm">
            Click &quot;Pay Now&quot; to open the secure Cashfree checkout. You can pay using:
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            {['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet'].map((method) => (
              <span
                key={method}
                className="px-3 py-1 bg-[#7A2F57]/20 text-[#EAE0D5]/70 text-sm rounded-full"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      )}

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
          {/* GST breakdown */}
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

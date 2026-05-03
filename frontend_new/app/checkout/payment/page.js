'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, ChevronRight, Lock, Shield, Check, AlertCircle, ShoppingBag, X, RotateCcw, RefreshCw, QrCode, Clock, Timer } from 'lucide-react';
import { paymentApi, cartApi, userApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';
import Image from 'next/image';

// Razorpay configuration
const LOGO_URL = 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png';
const RAZORPAY_BUTTON_TEXT = 'Pay Now';

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
  const { cart } = useCart();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [stockError, setStockError] = useState(null);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [redirectProcessing, setRedirectProcessing] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('razorpay'); // 'razorpay' or 'upi_qr'
  const [paymentConfig, setPaymentConfig] = useState(null);
  const cachedKeyIdRef = React.useRef(null);
  const cachedConfigIdRef = React.useRef(null);

  // QR Code payment states
  const [qrPaymentState, setQrPaymentState] = useState('idle'); // 'idle', 'generating', 'waiting', 'paid', 'expired', 'error'
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrTransactionId, setQrTransactionId] = useState(null);
  const [qrExpiresAt, setQrExpiresAt] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [qrError, setQrError] = useState(null);
  const pollingRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect_url=/checkout/payment');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const addressId = sessionStorage.getItem('checkout_address_id');
    if (!addressId) {
      router.push('/checkout');
    }
  }, [router]);

  // Show error returned by redirect-callback (e.g. ?error=verification_failed)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const errParam = params.get('error');
    if (errParam) {
      const messages = {
        verification_failed: 'Payment signature verification failed. Please try again.',
        payment_failed: 'Payment was not completed. Please try again.',
        payment_cancelled: 'Payment was cancelled. You can try again below.',
        server_error: 'A server error occurred. Please try again.',
      };
      setError(messages[errParam] || 'Payment failed. Please try again.');
    }
  }, []);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const formatCurrencyLocal = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);

  // Pre-fetch payment config on mount to cache key_id and check gateway availability
  useEffect(() => {
    let cancelled = false;
    const prefetchConfig = async () => {
      try {
        const config = await paymentApi.getConfig();
        if (!cancelled) {
          setPaymentConfig(config);
          cachedKeyIdRef.current = config?.razorpay?.key_id || null;
          cachedConfigIdRef.current = config?.razorpay?.checkout_config_id || null;
          setRazorpayReady(true);
        }
      } catch {
        // Silent fail — handleDirectPayment fetches config on demand
      }
    };
    prefetchConfig();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * DIRECT PAYMENT — the primary payment method.
   *
   * Submits a hidden HTML form directly to Razorpay's hosted checkout endpoint
   * (https://api.razorpay.com/v1/checkout/embedded) WITHOUT loading checkout.js.
   *
   * Why this works when the modal/SDK-redirect does NOT:
   * Razorpay's checkout.js always creates a hidden iframe to api.razorpay.com
   * FIRST (even with redirect:true) to initialise the session. This iframe is
   * blocked by Edge Enhanced Tracking Protection, uBlock Origin, Kaspersky Web
   * Protection and similar tools, causing chrome-error:// and the
   * "Unsafe attempt to load URL" console error that breaks BOTH modal AND SDK-
   * redirect modes simultaneously.
   *
   * A plain HTML form POST is a top-level navigation — not an iframe, not a
   * cross-origin script — so it is never intercepted by tracker blockers.
   * This is Razorpay's officially supported "Checkout without JS SDK" approach.
   *
   * IMPORTANT: Uses standard checkout endpoint (NOT embedded) to ensure ALL
   * payment methods including UPI, Cards, Net Banking, and Wallets are shown.
   */
  const handleDirectPayment = async () => {
    try {
      setRedirectProcessing(true);
      setError(null);

      // Generate idempotency key BEFORE payment to prevent duplicate orders
      const idempotencyKey = `order_${user?.id || 'guest'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('checkout_idempotency_key', idempotencyKey);
      logger.info('Generated idempotency key:', idempotencyKey);

      // Validate stock (backend returns { valid, out_of_stock, message })
      try {
        const stockValidation = await cartApi.validateStock();
        if (stockValidation?.valid === false) {
          if (stockValidation?.out_of_stock?.length > 0) {
            setStockError({ items: stockValidation.out_of_stock });
          } else {
            setError(stockValidation?.message || 'Your cart cannot be checked out.');
          }
          setRedirectProcessing(false);
          return;
        }
      } catch (stockErr) {
        setError(stockErr.message || 'Items in your cart are out of stock.');
        setRedirectProcessing(false);
        return;
      }

      const addressId = sessionStorage.getItem('checkout_address_id');
      if (!addressId) {
        setError('Please select a delivery address');
        router.push('/checkout');
        return;
      }

      // key_id + config_id cached from preload; fallback to fresh fetch
      let keyId = cachedKeyIdRef.current;
      if (!keyId) {
        try {
          const config = await paymentApi.getConfig();
          keyId = config?.razorpay?.key_id;
          cachedKeyIdRef.current = keyId;
          cachedConfigIdRef.current = config?.razorpay?.checkout_config_id || null;
        } catch { /* handled below */ }
        if (!keyId) {
          setError('Payment service unavailable. Please try again.');
          setRedirectProcessing(false);
          return;
        }
      }

      // Create Razorpay order on our backend
      let orderData;
      try {
        const addressString = sessionStorage.getItem('checkout_address_string');
        const cartSnapshot = cart.items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.price,
          name: item.name,
          size: item.size,
          color: item.color,
          image_url: item.image
        }));

        orderData = await paymentApi.createRazorpayOrder({
          amount: Math.round((cart.total || 0) * 100),
          currency: 'INR',
          receipt: `cart_${Date.now()}`,
          cart_snapshot: cartSnapshot,
          shipping_address: addressString,
          notes: {
            subtotal: String(cart.subtotal),
            discount_applied: String(cart.discount || 0),
            shipping_cost: String(cart.shipping || 0)
          }
        });
      } catch (orderErr) {
        logger.error('Order creation error:', orderErr);
        setError('Failed to initialise payment. Please try again.');
        setRedirectProcessing(false);
        return;
      }

      if (!orderData?.id) {
        setError('Payment initialisation failed. Please try again.');
        setRedirectProcessing(false);
        return;
      }

      // Store pending_order_id if returned (from backend gateway_response)
      const pendingOrderId = orderData?.gateway_response?.pending_order_id;
      if (pendingOrderId) {
        sessionStorage.setItem('pending_order_id', pendingOrderId);
        logger.info('Stored pending_order_id:', pendingOrderId);
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aaryaclothing.in';
      const customerName  = user?.profile?.full_name || user?.full_name || user?.username || '';
      const customerEmail = user?.email || '';
      const customerPhone = user?.profile?.phone   || user?.phone        || '';

      // Build a hidden form and submit it directly to Razorpay.
      // No checkout.js, no iframe — pure top-level navigation.
      const form = document.createElement('form');
      form.method = 'POST';
      // Official Razorpay hosted checkout endpoint (supports UPI, Cards, Net Banking, Wallets)
      form.action = 'https://api.razorpay.com/v1/checkout/embedded';

      const addField = (name, value) => {
        const input  = document.createElement('input');
        input.type   = 'hidden';
        input.name   = name;
        input.value  = String(value ?? '');
        form.appendChild(input);
      };

      // Required fields for Razorpay checkout
      addField('key_id',            keyId);
      addField('order_id',          orderData.id);
      addField('amount',            orderData.amount);
      addField('currency',          orderData.currency || 'INR');
      addField('name',              'Aarya Clothing');
      addField('description',       'Premium Ethnic Wear');
      addField('buttontext',        RAZORPAY_BUTTON_TEXT);
      addField('image',             LOGO_URL);
      addField('prefill[name]',     customerName);
      addField('prefill[email]',    customerEmail);
      addField('prefill[contact]',  customerPhone);
      addField('theme[color]',      '#B76E79');
      
      // Callback URLs
      addField('callback_url',      `${origin}/api/v1/payments/razorpay/redirect-callback`);
      addField('cancel_url',        `${origin}/checkout/payment?error=payment_cancelled`);
      
      // Redirect mode - sends user to Razorpay hosted page
      addField('redirect',          'true');
      addField('redirect_behavior', 'redirect');

      // Add idempotency key for duplicate order prevention
      const storedIdempotencyKey = sessionStorage.getItem('checkout_idempotency_key');
      if (storedIdempotencyKey) {
        addField('idempotency_key', storedIdempotencyKey);
      }

      // NOTE: checkout_config_id is NOT passed as form field
      // It's already included in the ORDER when created by backend
      // Razorpay uses the config from the order itself

      document.body.appendChild(form);
      form.submit();
      // Browser navigates away — redirectProcessing stays true intentionally

    } catch (err) {
      logger.error('Direct payment error:', err);
      setError('Payment failed. Please try again.');
      setRedirectProcessing(false);
    }
  };

  // Razorpay hosted checkout + UPI QR supported

  // ==================== QR Code Payment Functions ====================

  /**
   * Start QR code payment - creates QR code and starts polling
   */
  const handleQrPayment = async () => {
    try {
      setQrPaymentState('generating');
      setQrError(null);

      // Validate stock
      try {
        const stockValidation = await cartApi.validateStock();
        if (stockValidation?.valid === false) {
          if (stockValidation?.out_of_stock?.length > 0) {
            setStockError({ items: stockValidation.out_of_stock });
          } else {
            setQrError(stockValidation?.message || 'Your cart cannot be checked out.');
          }
          setQrPaymentState('idle');
          return;
        }
      } catch (stockErr) {
        setQrError(stockErr.message || 'Items in your cart are out of stock.');
        setQrPaymentState('idle');
        return;
      }

      const addressId = sessionStorage.getItem('checkout_address_id');
      if (!addressId) {
        setQrError('Please select a delivery address');
        router.push('/checkout');
        return;
      }

      // Update cart with shipping address for order creation fallback
      const addressString = sessionStorage.getItem('checkout_address_string');
      if (addressString) {
        try {
          await cartApi.updateShippingAddress(addressString);
        } catch (addrErr) {
          logger.warn('Failed to update cart shipping address:', addrErr?.message);
        }
      }

      const amountInPaise = Math.round((cart.total || 0) * 100);
      const cartSnapshot = cart.items.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        name: item.name,
        size: item.size,
        color: item.color,
        image_url: item.image
      }));

      // Create QR code
      const qrResponse = await paymentApi.createQrCode({
        amount: amountInPaise,
        description: `Aarya Clothing Order - ${user?.email || 'Customer'}`,
        cart_snapshot: cartSnapshot,
        shipping_address: addressString,
        notes: {
          order_id: '0',  // Will be updated when order is created
          user_id: user?.id?.toString() || '0',
          cart_total: cart.total?.toString() || '0',
          subtotal: String(cart.subtotal),
          discount_applied: String(cart.discount || 0),
          shipping_cost: String(cart.shipping || 0)
        }
      });

      if (!qrResponse?.qr_code_id || !qrResponse?.image_url) {
        throw new Error('Invalid QR code response from server');
      }

      // Store pending_order_id from QR response
      // Backend: notes["pending_order_id"] = str(pending_id)
      const qrPendingId = qrResponse?.notes?.pending_order_id;
      if (qrPendingId) {
        sessionStorage.setItem('pending_order_id', qrPendingId);
      }

      setQrCodeData(qrResponse);
      setQrTransactionId(qrResponse.transaction_id);
      setQrExpiresAt(qrResponse.expires_at);
      setQrPaymentState('waiting');

      // Start polling for payment status
      startQrPolling(qrResponse.qr_code_id);

      // Start countdown timer
      startQrTimer(qrResponse.expires_at);

      logger.info('QR code payment started:', qrResponse.qr_code_id);

    } catch (err) {
      logger.error('QR payment error:', err);
      setQrError(err.message || 'Failed to generate QR code. Please try again.');
      setQrPaymentState('error');
    }
  };

  /**
   * Poll QR code status every 3 seconds
   */
  const startQrPolling = (qrCodeId) => {
    // Clear any existing polling
    stopQrPolling();

    pollingRef.current = setInterval(async () => {
      try {
        const status = await paymentApi.checkQrStatus(qrCodeId);

        if (status.status === 'paid') {
          stopQrPolling();
          stopQrTimer();
          setQrPaymentState('paid');

          // Redirect to confirmation after short delay
          setTimeout(() => {
            // Only include payment_id if Razorpay actually returned one
            const paymentIdParam = status.payment_id ? `&payment_id=${status.payment_id}` : '';
            router.push(`/checkout/confirm?qr_code_id=${qrCodeId}${paymentIdParam}`);
          }, 1500);
        } else if (status.status === 'expired') {
          stopQrPolling();
          stopQrTimer();
          setQrPaymentState('expired');
        }
      } catch (err) {
        logger.error('QR status poll error:', err);
        // Don't stop polling on transient errors
      }
    }, 3000); // Poll every 3 seconds
  };

  /**
   * Stop QR polling
   */
  const stopQrPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  /**
   * Start countdown timer for QR expiry
   */
  const startQrTimer = (expiresAtTimestamp) => {
    stopQrTimer();

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = expiresAtTimestamp - now;

      if (remaining <= 0) {
        stopQrTimer();
        setTimeRemaining(0);
        return;
      }

      setTimeRemaining(remaining);
    };

    updateTimer(); // Update immediately
    timerRef.current = setInterval(updateTimer, 1000);
  };

  /**
   * Stop QR timer
   */
  const stopQrTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  /**
   * Cancel QR payment
   */
  const cancelQrPayment = () => {
    stopQrPolling();
    stopQrTimer();
    setQrPaymentState('idle');
    setQrCodeData(null);
    setQrTransactionId(null);
    setQrExpiresAt(null);
    setTimeRemaining(null);
    setQrError(null);
  };

  /**
   * Cleanup polling and timer on unmount
   */
  useEffect(() => {
    return () => {
      stopQrPolling();
      stopQrTimer();
    };
  }, []);

  /**
   * Format time remaining for display
   */
  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

      {/* Payment Gateway Selection */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h2 className="text-xl font-semibold text-[#F2C29A] mb-4">Select Payment Method</h2>
        <div className="space-y-3">
          {/* Razorpay Option */}
          <button
            onClick={() => setSelectedGateway('razorpay')}
            className={`w-full p-4 border-2 rounded-xl transition-all text-left ${
              selectedGateway === 'razorpay'
                ? 'border-[#F2C29A] bg-[#F2C29A]/10'
                : 'border-[#B76E79]/30 hover:border-[#F2C29A]/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="gateway"
                checked={selectedGateway === 'razorpay'}
                onChange={() => setSelectedGateway('razorpay')}
                className="w-4 h-4 mt-1"
              />
              <div className="flex-1">
                <p className="font-semibold text-[#F2C29A]">Pay Online</p>
                <p className="text-sm text-[#EAE0D5]/60 mt-1">UPI, Cards, Net Banking, Wallets</p>
              </div>
              {selectedGateway === 'razorpay' && (
                <Check className="w-5 h-5 text-[#F2C29A]" />
              )}
            </div>
          </button>

          {/* UPI QR Code Option */}
          <button
            onClick={() => setSelectedGateway('upi_qr')}
            className={`w-full p-4 border-2 rounded-xl transition-all text-left ${
              selectedGateway === 'upi_qr'
                ? 'border-[#F2C29A] bg-[#F2C29A]/10'
                : 'border-[#B76E79]/30 hover:border-[#F2C29A]/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="gateway"
                checked={selectedGateway === 'upi_qr'}
                onChange={() => setSelectedGateway('upi_qr')}
                className="w-4 h-4 mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#F2C29A]" />
                  <p className="font-semibold text-[#F2C29A]">UPI QR Code</p>
                </div>
                <p className="text-sm text-[#EAE0D5]/60 mt-1">Scan with any UPI app (5 min expiry)</p>
              </div>
              {selectedGateway === 'upi_qr' && (
                <Check className="w-5 h-5 text-[#F2C29A]" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Payment Method Info */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h2 className="text-xl font-semibold text-[#F2C29A] mb-4">Payment Details</h2>
        <div className="relative p-4 border rounded-xl bg-[#7A2F57]/20 border-[#B76E79]">
          <div className="absolute top-3 right-3">
            <Check className="w-5 h-5 text-[#B76E79]" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl">💳</span>
            <div>
              <p className="font-medium text-[#F2C29A]">Razorpay</p>
              <p className="text-sm text-[#EAE0D5]/70">UPI, Cards, Net Banking, Wallets & more</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment info */}
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
        <h3 className="text-sm font-semibold text-[#F2C29A] mb-4 uppercase tracking-wider">Order Summary</h3>
        <div className="space-y-2 text-sm">
          {cart?.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-[#EAE0D5]/60">Discount Applied</span>
              <span className="text-green-400">-{formatCurrency(cart.discount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-3 mt-1 border-t border-[#B76E79]/20 font-semibold text-base">
            <span className="text-[#F2C29A]">Total Payable</span>
            <span className="text-[#F2C29A]">{formatCurrency(cart?.total)}</span>
          </div>
          <p className="text-xs text-[#EAE0D5]/40 pt-1">
            Inclusive of all taxes &amp; free shipping
          </p>
        </div>
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

      {/* Return Policy Info */}
      <div className="p-4 bg-[#F2C29A]/5 border border-[#F2C29A]/10 rounded-xl">
        <div className="flex items-center gap-3">
          <RotateCcw className="w-5 h-5 text-[#F2C29A]" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm text-[#F2C29A]">Return Protection</p>
                <p className="text-xs text-[#EAE0D5]/50">Defective items? Submit return with video proof within 7 days. <Link href="/returns" className="underline hover:text-[#F2C29A]">Learn more</Link></p>
              </div>
            </div>
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

      {/* QR Code Payment UI */}
      {selectedGateway === 'upi_qr' && (
        <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
          <h2 className="text-xl font-semibold text-[#F2C29A] mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            UPI QR Code Payment
          </h2>

          {/* Generating State */}
          {qrPaymentState === 'generating' && (
            <div className="text-center py-8">
              <svg className="animate-spin w-12 h-12 mx-auto mb-4 text-[#F2C29A]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
              </svg>
              <p className="text-[#EAE0D5]/70">Generating QR code...</p>
            </div>
          )}

          {/* Waiting for Payment State */}
          {qrPaymentState === 'waiting' && qrCodeData && (
            <div className="space-y-6">
              {/* QR Code Display */}
              <div className="flex flex-col items-center">
                <div className="p-6 bg-white rounded-xl mb-4">
                  <Image
                    src={qrCodeData.image_url}
                    alt="UPI QR Code"
                    width={280}
                    height={280}
                    unoptimized
                    priority
                  />
                </div>
                <p className="text-[#EAE0D5]/70 text-sm text-center">
                  Scan with any UPI app (Google Pay, PhonePe, Paytm, etc.)
                </p>
              </div>

              {/* Timer Display */}
              {timeRemaining !== null && timeRemaining > 0 && (
                <div className="flex items-center justify-center gap-2 p-4 bg-[#7A2F57]/20 border border-[#B76E79]/30 rounded-xl">
                  <Timer className="w-5 h-5 text-[#F2C29A]" />
                  <span className="text-[#F2C29A] font-mono text-lg">
                    {formatTimeRemaining(timeRemaining)}
                  </span>
                  <span className="text-[#EAE0D5]/60 text-sm">remaining</span>
                </div>
              )}

              {/* Payment Status */}
              <div className="flex items-center justify-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Clock className="w-5 h-5 text-blue-400 animate-pulse" />
                <p className="text-blue-300 text-sm">Waiting for payment...</p>
              </div>

              {/* Cancel Button */}
              <button
                onClick={cancelQrPayment}
                className="w-full px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 font-medium rounded-xl hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel Payment
              </button>
            </div>
          )}

          {/* Paid State */}
          {qrPaymentState === 'paid' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-green-400 mb-2">Payment Successful!</h3>
              <p className="text-[#EAE0D5]/70">Redirecting to confirmation...</p>
            </div>
          )}

          {/* Expired State */}
          {qrPaymentState === 'expired' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-2">QR Code Expired</h3>
              <p className="text-[#EAE0D5]/70 mb-4">The QR code has expired. Please generate a new one.</p>
              <button
                onClick={handleQrPayment}
                className="px-6 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                Generate New QR Code
              </button>
            </div>
          )}

          {/* Error State */}
          {qrPaymentState === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-red-400 mb-2">Payment Failed</h3>
              <p className="text-[#EAE0D5]/70 mb-4">{qrError || 'An error occurred during payment'}</p>
              <button
                onClick={cancelQrPayment}
                className="px-6 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Idle State - Show Pay Button */}
          {qrPaymentState === 'idle' && (
            <button
              onClick={handleQrPayment}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <QrCode className="w-5 h-5" />
              Generate QR Code - {formatCurrency(cart?.total)}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Pay Button - Razorpay redirect (Non-QR) */}
      {selectedGateway !== 'upi_qr' && (
        <div className="space-y-3">
          <button
            onClick={handleDirectPayment}
            disabled={processing || redirectProcessing}
            className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {redirectProcessing ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                {`Pay ${formatCurrency(cart?.total)} Securely`}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-center text-xs text-[#EAE0D5]/40">
            Secure checkout powered by Razorpay • UPI, Cards, Net Banking, Wallets
          </p>
        </div>
      )}
    </div>
  );
}

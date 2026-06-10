'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, Package, Truck, MapPin, Clock, AlertCircle, ShoppingBag, Receipt, Printer, Loader2 } from 'lucide-react';
import { ordersApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

const POLL_INTERVAL = 2000; // 2 seconds
const POLL_TIMEOUT = 60000; // 60 seconds max wait

export default function CheckoutConfirmPage() {
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [paymentRegistered, setPaymentRegistered] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const isRegisteringRef = useRef(false);
  const mountedRef = useRef(false);
  const pollTimerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isRegisteringRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // CRITICAL: Store URL payment params to sessionStorage on mount IMMEDIATELY —
  // before any auth check or redirect. This prevents params from being lost if
  // the user gets redirected to login and comes back.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlPaymentId  = params.get('payment_id');
    const urlOrderId    = params.get('razorpay_order_id');
    const urlSignature  = params.get('razorpay_signature');
    const urlQrCodeId   = params.get('qr_code_id');
    if (urlPaymentId && urlPaymentId !== 'null') sessionStorage.setItem('payment_id', urlPaymentId);
    if (urlOrderId && urlOrderId !== 'null') sessionStorage.setItem('razorpay_order_id', urlOrderId);
    if (urlSignature && urlSignature !== 'null') sessionStorage.setItem('payment_signature', urlSignature);
    if (urlQrCodeId && urlQrCodeId !== 'null') sessionStorage.setItem('qr_code_id', urlQrCodeId);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect_url=/checkout/confirm');
    }
  }, [authLoading, isAuthenticated, router]);

  // Poll for order by payment_id
  const pollForOrder = useCallback(async (pid) => {
    const startTime = Date.now();

    const poll = async () => {
      if (!mountedRef.current) return;

      try {
        const result = await ordersApi.getByPayment(pid);

        // Check if we got an order (has id field) vs { found: false }
        if (result && (result.id || result.order_id)) {
          const foundOrder = result.order || result;
          if (mountedRef.current) {
            setOrder(foundOrder);
            setPolling(false);
            setLoading(false);
            sessionStorage.setItem('order_created', foundOrder?.id || 'done');
            // Clear cart & session on success
            try {
              await clearCart();
            } catch (cartErr) {
              logger.warn('Failed to clear cart:', cartErr.message);
            }
            sessionStorage.removeItem('checkout_address_id');
            sessionStorage.removeItem('payment_id');
            sessionStorage.removeItem('razorpay_order_id');
            sessionStorage.removeItem('payment_signature');
            sessionStorage.removeItem('qr_code_id');
            sessionStorage.removeItem('pending_order_id');
          }
          return;
        }

        // Order not yet created — check timeout
        if (Date.now() - startTime >= POLL_TIMEOUT) {
          if (mountedRef.current) {
            setError(
              'Your payment was successful, but order creation is taking longer than expected. ' +
              'Please check your orders page in a few minutes. ' +
              'Payment ID: ' + pid
            );
            setPolling(false);
            setLoading(false);
          }
          return;
        }

        // Poll again
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL);
      } catch (pollErr) {
        logger.warn('Poll error, retrying:', pollErr?.message);
        if (Date.now() - startTime < POLL_TIMEOUT && mountedRef.current) {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL);
        } else if (mountedRef.current) {
          setError(
            'Unable to confirm your order status. Please check your orders page. ' +
            'Payment ID: ' + pid
          );
          setPolling(false);
          setLoading(false);
        }
      }
    };

    poll();
  }, [clearCart]);

  // Main effect: register payment then poll
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    // Idempotency: if order already created, just fetch it
    const alreadyCreated = sessionStorage.getItem('order_created');
    if (alreadyCreated && alreadyCreated !== 'error') {
      (async () => {
        try {
          const existing = await ordersApi.getById(parseInt(alreadyCreated));
          if (existing && mountedRef.current) setOrder(existing.order || existing);
        } catch (err) {
          logger.warn('Failed to fetch existing order:', err?.message);
        }
        if (mountedRef.current) setLoading(false);
      })();
      return;
    }

    registerAndPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const registerAndPoll = async () => {
    if (isRegisteringRef.current) return;
    isRegisteringRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const addressId = sessionStorage.getItem('checkout_address_id');
      const txnId = sessionStorage.getItem('payment_id');
      const razorpayOrderId = sessionStorage.getItem('razorpay_order_id');
      const paymentSignature = sessionStorage.getItem('payment_signature');
      const qrCodeId = sessionStorage.getItem('qr_code_id');

      // Validate we have enough info
      if (!addressId) {
        setError('Missing delivery address. Please start checkout again.');
        setTimeout(() => router.push('/checkout'), 3000);
        return;
      }

      if (!qrCodeId && (!txnId || !razorpayOrderId || !paymentSignature)) {
        setError(
          'Payment information missing. For card/UPI checkout we need payment id, order id, and signature. Please complete payment again.',
        );
        setTimeout(() => router.push('/checkout/payment'), 3000);
        return;
      }

      const payload = {
        address_id: parseInt(addressId),
        payment_method: 'razorpay',
        transaction_id: txnId || undefined,
        razorpay_order_id: razorpayOrderId || undefined,
        razorpay_signature: paymentSignature || undefined,
        pending_order_id: sessionStorage.getItem('pending_order_id')
          ? parseInt(sessionStorage.getItem('pending_order_id'))
          : undefined,
      };
      if (qrCodeId) payload.qr_code_id = qrCodeId;
      logger.info('Registering payment payload:', JSON.stringify({ address_id: payload.address_id, has_txn: !!payload.transaction_id, has_qr: !!payload.qr_code_id, has_sig: !!payload.razorpay_signature }));

      logger.info(
        `Registering payment: transaction_id=${txnId || 'N/A'} ` +
        `razorpay_order_id=${razorpayOrderId || 'N/A'} qr_code_id=${qrCodeId || 'N/A'}`
      );

      // ── STEP 1: Register the payment (signature verify + cart snapshot) ──
      let result;
      try {
        result = await ordersApi.registerPayment(payload);
        logger.info('Payment registration result:', result);
      } catch (regErr) {
        // Payment registration failed — but the user may have already paid.
        // Try polling for the order anyway (webhook may have created it).
        const pid = txnId || qrCodeId;
        if (pid) {
          logger.warn('Payment registration failed, attempting to poll for order via webhook:', regErr?.message);
          setPolling(true);
          pollForOrder(pid);
          return;
        }
        throw regErr;
      }

      // Check if order already existed (webhook processed first)
      if (result?.status === 'success' && result?.order) {
        const existingOrder = result.order;
        setOrder(existingOrder);
        setLoading(false);
        sessionStorage.setItem('order_created', existingOrder?.id || 'done');
        try { await clearCart(); } catch (e) { /* non-fatal */ }
        sessionStorage.removeItem('checkout_address_id');
        sessionStorage.removeItem('payment_id');
        sessionStorage.removeItem('razorpay_order_id');
        sessionStorage.removeItem('payment_signature');
        sessionStorage.removeItem('qr_code_id');
        sessionStorage.removeItem('pending_order_id');
        return;
      }

      // ── STEP 2: Payment registered — start polling for order ──
      const pid = result?.payment_id || txnId;
      if (!pid) {
        setError('Payment registration succeeded but no payment ID was returned.');
        setLoading(false);
        return;
      }

      setPaymentId(pid);
      setPaymentRegistered(true);
      setPolling(true);

      // Start polling
      pollForOrder(pid);

    } catch (err) {
      logger.error('Error registering payment:', err);
      sessionStorage.removeItem('order_created');

      const detail = err?.response?.data?.detail || err?.data?.detail || err?.message || '';
      const pid = sessionStorage.getItem('payment_id') || 'N/A';

      if (detail.toLowerCase().includes('stock') || detail.toLowerCase().includes('inventory') || detail.toLowerCase().includes('unavailable')) {
        setError('Sorry, one or more items in your order are now out of stock. Your payment was successful but order could not be created. Please contact support with Payment ID: ' + pid);
      } else if (detail.toLowerCase().includes('payment') || detail.toLowerCase().includes('signature') || detail.toLowerCase().includes('verification')) {
        setError('Payment verification failed. If money was deducted, please contact support with Payment ID: ' + pid + '. We will recover your order.');
      } else if (detail.toLowerCase().includes('cart')) {
        setError('Cart issue. Please try checkout again or contact support.');
      } else if (detail.toLowerCase().includes('address')) {
        setError('Address issue. Please try checkout again or contact support.');
      } else {
        setError(
          'Payment registration failed. Payment ID: ' + pid +
          '. If money was deducted, contact support at support@aaryaclothing.com with this Payment ID.'
        );
      }
      sessionStorage.removeItem('checkout_address_id');
      setLoading(false);
    } finally {
      isRegisteringRef.current = false;
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

  // Show unified processing state — single clear message for all loading phases
  if (loading && !order) {
    const steps = [
      { label: 'Payment verified', done: paymentRegistered },
      { label: 'Creating your order', done: false },
      { label: 'Sending confirmation', done: false },
    ];
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#7A2F57]/30 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#F2C29A] animate-spin" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-[#F2C29A]">Processing Your Order</h3>
          <p className="text-[#EAE0D5]/70 max-w-md">
            {paymentRegistered
              ? 'Payment confirmed! Creating your order...'
              : 'Verifying your payment...'}
          </p>
        </div>
        {/* Progress steps */}
        <div className="w-full max-w-xs space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                step.done ? 'bg-green-500/20' : (i === 1 && paymentRegistered) ? 'bg-[#7A2F57]/30' : 'bg-[#B76E79]/10'
              }`}>
                {step.done ? (
                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (i === 1 && paymentRegistered) ? (
                  <div className="w-2 h-2 rounded-full bg-[#F2C29A] animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-[#B76E79]/20" />
                )}
              </div>
              <span className={`text-sm ${
                step.done ? 'text-green-400' : (i === 1 && paymentRegistered) ? 'text-[#F2C29A]' : 'text-[#EAE0D5]/40'
              }`}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error with retry
  if (error && !order) {
    return (
      <div className="space-y-6">
        <div className="p-8 bg-[#0B0608]/40 backdrop-blur-md border border-red-500/20 rounded-2xl text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
          <p className="text-[#EAE0D5]/70 mb-4">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                isRegisteringRef.current = false;
                setError(null);
                setLoading(true);
                registerAndPoll();
              }}
              className="px-6 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
            <Link
              href="/profile/orders"
              className="px-6 py-2 border border-[#B76E79]/30 text-[#B76E79] rounded-xl hover:border-[#B76E79]/60 hover:text-[#F2C29A] transition-colors text-center"
            >
              Check My Orders
            </Link>
          </div>
        </div>
        <div className="p-4 bg-[#7A2F57]/10 border border-[#B76E79]/10 rounded-xl text-center">
          <p className="text-sm text-[#EAE0D5]/70">
            If the problem persists, contact us at{' '}
            <a href="mailto:support@aaryaclothing.com" className="text-[#B76E79] hover:text-[#F2C29A]">
              support@aaryaclothing.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── Order confirmed — show success page ──
  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>

        <h2 className="text-2xl font-bold text-[#F2C29A] mb-2">Order Confirmed!</h2>
        <p className="text-[#EAE0D5]/70 mb-4">
          Thank you for your order. We&apos;ve received your order and will process it shortly.
        </p>

        {order?.order_number && (
          <div className="inline-block px-4 py-2 bg-[#7A2F57]/20 rounded-lg">
            <span className="text-sm text-[#EAE0D5]/70">Order Number: </span>
            <span className="font-mono font-semibold text-[#F2C29A]">{order.order_number}</span>
          </div>
        )}
      </div>

      {/* Order Timeline */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h3 className="text-lg font-semibold text-[#F2C29A] mb-4">What&apos;s Next?</h3>

        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#7A2F57]/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-[#F2C29A]">Order Confirmed</p>
              <p className="text-sm text-[#EAE0D5]/70">Your order has been placed successfully</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#B76E79]/20 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-[#B76E79]" />
            </div>
            <div>
              <p className="font-medium text-[#EAE0D5]">Processing</p>
              <p className="text-sm text-[#EAE0D5]/70">We&apos;re preparing your order for shipment</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#B76E79]/10 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-[#EAE0D5]/50" />
            </div>
            <div>
              <p className="font-medium text-[#EAE0D5]/50">Shipped</p>
              <p className="text-sm text-[#EAE0D5]/50">Your order is on its way</p>
            </div>
          </div>
        </div>

        {order?.estimated_delivery && (
          <div className="mt-6 p-4 bg-[#7A2F57]/10 rounded-xl">
            <p className="text-sm text-[#EAE0D5]/70">Estimated Delivery</p>
            <p className="text-lg font-semibold text-[#F2C29A]">{order.estimated_delivery}</p>
          </div>
        )}
      </div>

      {/* Order Invoice */}
      {order && (
        <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
          {/* Invoice Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#B76E79]" />
              <h3 className="text-lg font-semibold text-[#F2C29A]">Order Invoice</h3>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#B76E79]/30 text-[#B76E79] text-sm rounded-lg hover:border-[#B76E79] hover:text-[#F2C29A] transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 bg-[#7A2F57]/10 rounded-xl text-sm">
            <div>
              <p className="text-[#EAE0D5]/50 text-xs mb-0.5">Invoice Number</p>
              <p className="text-[#F2C29A] font-mono font-semibold">{order.invoice_number || `INV-${order.id}`}</p>
            </div>
            <div>
              <p className="text-[#EAE0D5]/50 text-xs mb-0.5">Order Number</p>
              <p className="text-[#EAE0D5] font-mono">{order.order_number}</p>
            </div>
            <div>
              <p className="text-[#EAE0D5]/50 text-xs mb-0.5">Date</p>
              <p className="text-[#EAE0D5]">{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
            <div>
              <p className="text-[#EAE0D5]/50 text-xs mb-0.5">Payment Method</p>
              <p className="text-[#EAE0D5] capitalize">{order.payment_method || 'Razorpay'}</p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3 mb-6">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 py-3 border-b border-[#B76E79]/10 last:border-0">
                <div className="w-10 h-10 bg-[#7A2F57]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-[#B76E79]/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#EAE0D5] text-sm font-medium truncate">{item.product_name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-[#EAE0D5]/50">
                    {item.size && <span>Size: {item.size}</span>}
                    {item.color && (
                      <span className="inline-flex items-center gap-1">
                        {item.color_hex && (
                          <span className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: item.color_hex }} />
                        )}
                        {item.color}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#EAE0D5]/50 mt-0.5">
                    {formatCurrency(item.unit_price || item.price)} × {item.quantity}
                  </p>
                </div>
                <p className="text-[#F2C29A] text-sm font-semibold">{formatCurrency(item.price)}</p>
              </div>
            ))}
          </div>

          {/* Cost Breakdown */}
          <div className="space-y-2 pt-4 border-t border-[#B76E79]/10 text-sm">
            <div className="flex justify-between pt-3 border-t border-[#B76E79]/10 text-base font-bold">
              <span className="text-[#F2C29A]">Total Paid</span>
              <span className="text-[#F2C29A]">{formatCurrency(order.total_amount ?? order.total)}</span>
            </div>
            <p className="text-xs text-[#EAE0D5]/40 pt-1">
              Price shown is final - includes all taxes and shipping. No hidden charges.
            </p>
          </div>

          {/* Delivery Address */}
          {order.shipping_address && (
            <div className="pt-4 mt-4 border-t border-[#B76E79]/10">
              <h4 className="text-xs font-medium text-[#EAE0D5]/50 uppercase tracking-wider mb-2">Delivery Address</h4>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#B76E79] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">{order.shipping_address}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/profile/orders"
          className="flex-1 py-3 text-center border border-[#B76E79]/20 text-[#B76E79] rounded-xl hover:border-[#B76E79]/40 hover:text-[#F2C29A] transition-colors"
        >
          View All Orders
        </Link>
        <Link
          href="/products"
          className="flex-1 py-3 text-center bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          Continue Shopping
          <ShoppingBag className="w-4 h-4" />
        </Link>
      </div>

      {/* Support */}
      <div className="p-4 bg-[#7A2F57]/10 border border-[#B76E79]/10 rounded-xl text-center">
        <p className="text-sm text-[#EAE0D5]/70">
          Need help? Contact us at{' '}
          <a href="mailto:support@aaryaclothing.com" className="text-[#B76E79] hover:text-[#F2C29A]">
            support@aaryaclothing.com
          </a>
        </p>
      </div>
    </div>
  );
}

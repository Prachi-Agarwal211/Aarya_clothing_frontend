'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, Package, Truck, MapPin, ChevronRight, ShoppingBag, AlertCircle, Receipt, Printer } from 'lucide-react';
import { ordersApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

export default function CheckoutConfirmPage() {
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isCreatingRef = useRef(false); // Prevent concurrent order creation (useRef avoids stale closure bug)
  const mountedRef = useRef(false); // Prevent state updates after unmount

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect_url=/checkout/confirm');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
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

      // For redirect-mode payments, payment details are sent as URL params
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      
      // Razorpay params
      const urlPaymentId  = params.get('payment_id');
      const urlOrderId    = params.get('razorpay_order_id');
      const urlSignature  = params.get('razorpay_signature');
      
      // Cashfree params (NEW)
      const cashfreeOrderId = params.get('cashfree_order_id');
      const cashfreePaymentId = params.get('cashfree_payment_id');
      const cashfreeReferenceId = params.get('cashfree_reference_id');
      const cashfreeStatus = params.get('cashfree_status');
      
      // Store in session storage for order creation
      if (urlPaymentId) sessionStorage.setItem('payment_id', urlPaymentId);
      if (urlOrderId)   sessionStorage.setItem('razorpay_order_id', urlOrderId);
      if (urlSignature) sessionStorage.setItem('payment_signature', urlSignature);
      
      // Store Cashfree params (NEW)
      if (cashfreeOrderId) sessionStorage.setItem('cashfree_order_id', cashfreeOrderId);
      if (cashfreePaymentId) sessionStorage.setItem('cashfree_payment_id', cashfreePaymentId);
      if (cashfreeReferenceId) sessionStorage.setItem('cashfree_reference_id', cashfreeReferenceId);
      if (cashfreeStatus) sessionStorage.setItem('cashfree_status', cashfreeStatus);
      
      createOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const createOrder = async () => {
    // Prevent concurrent order creation calls
    if (isCreatingRef.current) {
      logger.warn('Order creation already in progress - ignoring duplicate call');
      return;
    }

    isCreatingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const addressId = sessionStorage.getItem('checkout_address_id');

      // Razorpay params
      const paymentId = sessionStorage.getItem('payment_id');           // pay_xxx
      const razorpayOrderId = sessionStorage.getItem('razorpay_order_id'); // order_xxx
      const paymentSignature = sessionStorage.getItem('payment_signature'); // HMAC sig

      // Cashfree params (NEW)
      const cashfreeOrderId = sessionStorage.getItem('cashfree_order_id');
      const cashfreePaymentId = sessionStorage.getItem('cashfree_payment_id');
      const cashfreeReferenceId = sessionStorage.getItem('cashfree_reference_id');
      const cashfreeStatus = sessionStorage.getItem('cashfree_status');

      // Idempotency guard: prevent double-order on page refresh
      const alreadyCreated = sessionStorage.getItem('order_created');
      if (alreadyCreated && alreadyCreated !== 'error') {
        // Order was already created — fetch it to show the confirmation
        try {
          const existing = await ordersApi.getById(parseInt(alreadyCreated));
          if (existing) setOrder(existing.order || existing);
        } catch (_) { /* non-fatal */ }
        setLoading(false);
        return;
      }

      if (!addressId) {
        setError('Missing delivery address. Please start checkout again.');
        setTimeout(() => router.push('/checkout'), 3000);
        return;
      }

      // Check if we have payment info from either gateway
      const hasRazorpayPayment = paymentId || razorpayOrderId;
      const hasCashfreePayment = cashfreeOrderId || cashfreePaymentId;

      if (!hasRazorpayPayment && !hasCashfreePayment) {
        setError('Payment information missing. Please complete payment first.');
        setTimeout(() => router.push('/checkout/payment'), 3000);
        return;
      }

      // ✅ CRITICAL FIX: Clear old payment params BEFORE creating order
      // This prevents mixing old + new payment data which causes verification failures
      logger.info('Clearing old payment params before order creation');
      sessionStorage.removeItem('payment_id');
      sessionStorage.removeItem('razorpay_order_id');
      sessionStorage.removeItem('payment_signature');
      sessionStorage.removeItem('cashfree_order_id');
      sessionStorage.removeItem('cashfree_payment_id');
      sessionStorage.removeItem('cashfree_reference_id');
      sessionStorage.removeItem('cashfree_status');

      // Re-store fresh payment params (they're still in URL)
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      if (params.get('payment_id')) sessionStorage.setItem('payment_id', params.get('payment_id'));
      if (params.get('razorpay_order_id')) sessionStorage.setItem('razorpay_order_id', params.get('razorpay_order_id'));
      if (params.get('razorpay_signature')) sessionStorage.setItem('payment_signature', params.get('razorpay_signature'));
      if (params.get('cashfree_order_id')) sessionStorage.setItem('cashfree_order_id', params.get('cashfree_order_id'));
      if (params.get('cashfree_payment_id')) sessionStorage.setItem('cashfree_payment_id', params.get('cashfree_payment_id'));
      if (params.get('cashfree_reference_id')) sessionStorage.setItem('cashfree_reference_id', params.get('cashfree_reference_id'));

      // Determine payment method and prepare order data
      const paymentMethod = hasCashfreePayment ? 'cashfree' : 'razorpay';

      const orderPayload = {
        address_id: parseInt(addressId),
        payment_method: paymentMethod,
      };

      // Add Razorpay details
      if (hasRazorpayPayment) {
        orderPayload.transaction_id = paymentId;
        orderPayload.razorpay_order_id = razorpayOrderId;
        orderPayload.razorpay_signature = paymentSignature;
      }

      // Add Cashfree details (NEW)
      if (hasCashfreePayment) {
        orderPayload.transaction_id = cashfreePaymentId;
        orderPayload.cashfree_order_id = cashfreeOrderId;
        orderPayload.cashfree_payment_id = cashfreePaymentId;
        orderPayload.cashfree_reference_id = cashfreeReferenceId;
      }

      logger.info(
        `Creating order: payment_method=${paymentMethod} transaction_id=${orderPayload.transaction_id} ` +
        `razorpay_order_id=${orderPayload.razorpay_order_id || 'N/A'}`
      );

      // Create order — backend verifies payment before recording
      const orderData = await ordersApi.create(orderPayload);

      const createdOrder = orderData.order || orderData;
      setOrder(createdOrder);

      // Mark order as created to prevent double-order on refresh
      sessionStorage.setItem('order_created', createdOrder?.id || 'done');

      // Clear cart and session
      try {
        await clearCart();
      } catch (cartErr) {
        logger.warn('Failed to clear cart after order creation:', cartErr.message);
      }
      sessionStorage.removeItem('checkout_address_id');
      sessionStorage.removeItem('payment_id');
      sessionStorage.removeItem('razorpay_order_id');
      sessionStorage.removeItem('payment_signature');
      sessionStorage.removeItem('cashfree_order_id');
      sessionStorage.removeItem('cashfree_payment_id');
      sessionStorage.removeItem('cashfree_reference_id');
      sessionStorage.removeItem('cashfree_status');
    } catch (err) {
      logger.error('Error creating order:', err);
      // Clear the idempotency guard so the user can retry
      sessionStorage.removeItem('order_created');
      
      const detail = err?.response?.data?.detail || err?.data?.detail || err?.message || '';
      const paymentId = sessionStorage.getItem('payment_id') || 'N/A';
      
      // ✅ IMPROVED: Better error messages with payment ID for support reference
      if (detail.toLowerCase().includes('stock') || detail.toLowerCase().includes('inventory') || detail.toLowerCase().includes('unavailable')) {
        setError('Sorry, one or more items in your order are now out of stock. Your payment was successful but order could not be created. Please contact support with Payment ID: ' + paymentId);
      } else if (detail.toLowerCase().includes('payment') || detail.toLowerCase().includes('signature') || detail.toLowerCase().includes('verification')) {
        setError('Payment verification failed. If money was deducted, please contact support with Payment ID: ' + paymentId + '. We will recover your order.');
      } else if (detail.toLowerCase().includes('cart')) {
        setError('Order created but cart could not be cleared. Please refresh the page. Your order is confirmed.');
      } else if (detail.toLowerCase().includes('address')) {
        setError('Address issue. Please try checkout again or contact support.');
      } else {
        setError(
          'Order creation failed. Payment ID: ' + paymentId + 
          '. If money was deducted, contact support at support@aaryaclothing.com with this Payment ID.'
        );
      }
      
      // Don't clear payment params on error - user might need them for support
      // Only clear address
      sessionStorage.removeItem('checkout_address_id');
    } finally {
      isCreatingRef.current = false;
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B76E79]"></div>
      </div>
    );
  }

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
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-[#7A2F57]/10 rounded-xl text-sm">
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
                  </div>
                  <p className="text-xs text-[#EAE0D5]/50 mt-0.5">
                    {formatCurrency(item.unit_price || item.price)} × {item.quantity}
                  </p>
                </div>
                <p className="text-[#F2C29A] text-sm font-semibold">{formatCurrency(item.price)}</p>
              </div>
            ))}
          </div>

          {/* Cost Breakdown - Simplified */}
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

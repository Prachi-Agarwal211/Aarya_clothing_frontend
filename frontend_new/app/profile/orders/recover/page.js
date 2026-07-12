'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Package, RefreshCw, ShieldCheck } from 'lucide-react';
import { ordersApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

/**
 * Customer self-serve recovery when payment succeeded but order is missing.
 * Pre-fills from query string / sessionStorage when arriving from confirm page.
 */
export default function RecoverOrderPage() {
  const router = useRouter();
  const [paymentId, setPaymentId] = useState('');
  const [razorpayOrderId, setRazorpayOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromUrlPay = params.get('payment_id');
    const fromUrlOrder = params.get('razorpay_order_id');
    const fromSessionPay = sessionStorage.getItem('payment_id');
    const fromSessionOrder = sessionStorage.getItem('razorpay_order_id');
    if (fromUrlPay || fromSessionPay) setPaymentId(fromUrlPay || fromSessionPay || '');
    if (fromUrlOrder || fromSessionOrder) setRazorpayOrderId(fromUrlOrder || fromSessionOrder || '');
  }, []);

  const handleRecover = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const pay = (paymentId || '').trim();
      if (!pay) {
        throw new Error('Payment ID is required (starts with pay_ or txn_ or qr_)');
      }

      // Prefer dedicated recovery API when we have order_xxx; otherwise poll by payment
      let result = null;
      const roid = (razorpayOrderId || '').trim();
      if (roid) {
        logger.info(`Order recovery: payment_id=${pay} order_id=${roid}`);
        result = await ordersApi.recoverFromPayment(pay, roid);
      } else {
        logger.info(`Order lookup by payment only: ${pay}`);
        result = await ordersApi.getByPayment(pay);
        if (!result || (!result.id && !result.order_id && !result.found)) {
          throw new Error(
            'Order not found yet. Add your Razorpay Order ID (order_xxx) if you have it, or wait a few minutes and try again. Your payment is safe.',
          );
        }
      }

      const order = result.order || result;
      setSuccess({
        message: 'Order found / recovered successfully!',
        order,
      });
      logger.info(`Order recovery successful: order_id=${order?.id}`);
    } catch (err) {
      logger.error('Order recovery failed:', err);
      const detail =
        err?.response?.data?.detail ||
        err?.data?.detail ||
        err?.message ||
        'Failed to recover order. Please contact support.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 sm:px-0 pb-24 sm:pb-8">
      <div className="p-6 sm:p-8 bg-[#111111]/60 backdrop-blur-md border border-[#A8B4C8]/20 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h2
            className="text-xl sm:text-2xl font-bold text-[#D4AF37]"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Recover Your Order
          </h2>
        </div>

        <div className="mb-6 p-4 bg-[#1E3A5F]/10 border border-[#A8B4C8]/15 rounded-xl">
          <p className="text-sm text-[#F5F0E8]/75 leading-relaxed">
            Paid but no confirmation? That is usually a short network delay — your money is safe.
            Enter the Payment ID from your bank/UPI SMS or Razorpay email. Order ID helps but is optional for lookup.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400 mb-1">Could not recover yet</p>
              <p className="text-sm text-red-300/80">{error}</p>
              <p className="text-xs text-[#F5F0E8]/50 mt-2">
                Next: wait 2–5 minutes, try again, or email support@aaryaclothing.com with your Payment ID.
              </p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-400 mb-1">Order ready</p>
              <p className="text-sm text-green-300/80 mb-2">{success.message}</p>
              <p className="text-sm text-green-300/80">
                Order #{' '}
                <span className="font-mono">
                  {success.order?.id || success.order?.order_number || '—'}
                </span>
              </p>
              <button
                type="button"
                onClick={() => router.push('/profile/orders')}
                className="mt-3 min-h-[44px] px-4 py-2 bg-[#D4AF37] text-black rounded-lg hover:bg-[#D4AF37]/90 transition-colors text-sm font-medium"
              >
                View My Orders
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleRecover} className="space-y-4">
          <div>
            <label htmlFor="payment-id" className="block text-sm font-medium text-[#F5F0E8]/70 mb-2">
              Payment ID <span className="text-[#A8B4C8]">*</span>
            </label>
            <input
              id="payment-id"
              type="text"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="pay_xxxxxxxxxxxxx or txn_qr_..."
              autoComplete="off"
              className="w-full min-h-[48px] px-4 py-3 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-[#F5F0E8] placeholder-[#F5F0E8]/30 focus:outline-none focus:border-[#D4AF37]/50 text-base"
              required
            />
            <p className="mt-1.5 text-xs text-[#F5F0E8]/45">
              From UPI/bank SMS, Razorpay email, or the checkout confirmation screen
            </p>
          </div>

          <div>
            <label htmlFor="razorpay-order-id" className="block text-sm font-medium text-[#F5F0E8]/70 mb-2">
              Razorpay Order ID <span className="text-[#F5F0E8]/40">(optional)</span>
            </label>
            <input
              id="razorpay-order-id"
              type="text"
              value={razorpayOrderId}
              onChange={(e) => setRazorpayOrderId(e.target.value)}
              placeholder="order_xxxxxxxxxxxxx"
              autoComplete="off"
              className="w-full min-h-[48px] px-4 py-3 bg-[#111111]/60 border border-[#A8B4C8]/20 rounded-xl text-[#F5F0E8] placeholder-[#F5F0E8]/30 focus:outline-none focus:border-[#D4AF37]/50 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] py-3 bg-[#D4AF37] text-black font-medium rounded-xl hover:bg-[#D4AF37]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Recovering…
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Recover Order
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#A8B4C8]/10">
          <p className="text-sm text-[#F5F0E8]/65 text-center">
            Need help?{' '}
            <a
              href="mailto:support@aaryaclothing.com"
              className="text-[#A8B4C8] hover:text-[#D4AF37]"
            >
              support@aaryaclothing.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Package, RefreshCw } from 'lucide-react';
import { ordersApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

export default function RecoverOrderPage() {
  const router = useRouter();
  const [paymentId, setPaymentId] = useState('');
  const [razorpayOrderId, setRazorpayOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleRecover = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!paymentId || !razorpayOrderId) {
        throw new Error('Payment ID and Razorpay Order ID are required');
      }

      logger.info(`Attempting order recovery: payment_id=${paymentId} order_id=${razorpayOrderId}`);
      
      const result = await ordersApi.recoverFromPayment(paymentId, razorpayOrderId);
      
      setSuccess({
        message: 'Order recovered successfully!',
        order: result.order || result,
      });

      logger.info(`Order recovery successful: order_id=${result.id}`);
    } catch (err) {
      logger.error('Order recovery failed:', err);
      setError(
        err?.response?.data?.detail || 
        err?.message || 
        'Failed to recover order. Please contact support.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h2 className="text-2xl font-bold text-[#F2C29A] mb-4">Recover Your Order</h2>
        
        <div className="mb-6 p-4 bg-[#7A2F57]/10 border border-[#B76E79]/10 rounded-xl">
          <p className="text-sm text-[#EAE0D5]/70">
            Use this page if you completed payment but didn&apos;t receive an order confirmation.
            This can happen due to network issues or service interruptions.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400 mb-1">Recovery Failed</p>
              <p className="text-sm text-red-300/80">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-400 mb-1">Order Recovered!</p>
              <p className="text-sm text-green-300/80 mb-2">{success.message}</p>
              <p className="text-sm text-green-300/80">
                Order Number: <span className="font-mono">{success.order?.order_number}</span>
              </p>
              <button
                onClick={() => router.push(`/profile/orders/${success.order?.id}`)}
                className="mt-3 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm"
              >
                View Order Details
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleRecover} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#EAE0D5]/70 mb-2">
              Payment ID (pay_xxx)
            </label>
            <input
              type="text"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="pay_xxxxxxxxxxxxx"
              className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40"
              required
            />
            <p className="mt-1 text-xs text-[#EAE0D5]/50">
              You can find this in your Razorpay payment confirmation email or SMS
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#EAE0D5]/70 mb-2">
              Razorpay Order ID (order_xxx)
            </label>
            <input
              type="text"
              value={razorpayOrderId}
              onChange={(e) => setRazorpayOrderId(e.target.value)}
              placeholder="order_xxxxxxxxxxxxx"
              className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Recovering Order...
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Recover Order
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#B76E79]/10">
          <p className="text-sm text-[#EAE0D5]/70 text-center">
            Need help? Contact us at{' '}
            <a 
              href="mailto:support@aaryaclothing.com" 
              className="text-[#B76E79] hover:text-[#F2C29A]"
            >
              support@aaryaclothing.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

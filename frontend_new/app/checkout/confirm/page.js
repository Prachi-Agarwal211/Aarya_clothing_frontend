'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, Package, Truck, MapPin, ChevronRight, ShoppingBag, AlertCircle, Receipt, Printer } from 'lucide-react';
import { ordersApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

export default function CheckoutConfirmPage() {
  const router = useRouter();
  const { cart, clearCart, isAuthenticated } = useCart();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/checkout/confirm');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      createOrder();
    }
  }, [isAuthenticated]);

  const createOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      const addressId = sessionStorage.getItem('checkout_address_id');
      const paymentId = sessionStorage.getItem('payment_id');
      const cashfreeOrderId = sessionStorage.getItem('cashfree_order_id');

      if (!addressId) {
        setError('Missing delivery address. Please start checkout again.');
        setTimeout(() => router.push('/checkout'), 3000);
        return;
      }

      // Create order
      const orderData = await ordersApi.create({
        address_id: parseInt(addressId),
        payment_method: 'cashfree',
        payment_id: paymentId || cashfreeOrderId,
        cashfree_order_id: cashfreeOrderId,
      });

      setOrder(orderData.order || orderData);

      // Clear cart and session
      clearCart();
      sessionStorage.removeItem('checkout_address_id');
      sessionStorage.removeItem('payment_id');
      sessionStorage.removeItem('cashfree_order_id');
    } catch (err) {
      logger.error('Error creating order:', err);
      // Surface specific error from backend (e.g. stock-out, payment verification failure)
      const detail = err?.response?.data?.detail || err?.data?.detail || err?.message || '';
      if (detail.toLowerCase().includes('stock') || detail.toLowerCase().includes('inventory') || detail.toLowerCase().includes('unavailable')) {
        setError('Sorry, one or more items in your order are now out of stock. Please go back to your cart and try again.');
      } else if (detail.toLowerCase().includes('payment')) {
        setError('Payment verification failed. Please contact support if you were charged.');
      } else {
        setError(detail || 'Failed to create order. Please contact support.');
      }
    } finally {
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

      {/* Tax Invoice */}
      {order && (
        <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
          {/* Invoice Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#B76E79]" />
              <h3 className="text-lg font-semibold text-[#F2C29A]">Tax Invoice</h3>
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
              <p className="text-[#EAE0D5] capitalize">{order.payment_method || 'Cashfree'}</p>
            </div>
            {order.place_of_supply && (
              <div>
                <p className="text-[#EAE0D5]/50 text-xs mb-0.5">Place of Supply</p>
                <p className="text-[#EAE0D5]">{order.place_of_supply}</p>
              </div>
            )}
            {order.customer_gstin && (
              <div>
                <p className="text-[#EAE0D5]/50 text-xs mb-0.5">Your GSTIN</p>
                <p className="text-[#EAE0D5] font-mono text-xs">{order.customer_gstin}</p>
              </div>
            )}
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
                    {item.sku && <span>SKU: {item.sku}</span>}
                    {item.size && <span>Size: {item.size}</span>}
                    {item.hsn_code && <span>HSN: {item.hsn_code}</span>}
                  </div>
                  <p className="text-xs text-[#EAE0D5]/50 mt-0.5">
                    {formatCurrency(item.unit_price || item.price)} × {item.quantity}
                    {item.gst_rate && <span className="ml-2 text-[#B76E79]/70">GST {item.gst_rate}%</span>}
                  </p>
                </div>
                <p className="text-[#F2C29A] text-sm font-semibold">{formatCurrency(item.price)}</p>
              </div>
            ))}
          </div>

          {/* Cost Breakdown */}
          <div className="space-y-2 pt-4 border-t border-[#B76E79]/10 text-sm">
            {order.subtotal != null && (
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/60">Subtotal</span>
                <span className="text-[#EAE0D5]">{formatCurrency(order.subtotal)}</span>
              </div>
            )}
            {order.discount_applied > 0 && (
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/60">Discount</span>
                <span className="text-green-400">-{formatCurrency(order.discount_applied)}</span>
              </div>
            )}
            {order.shipping_cost >= 0 && (
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/60">Shipping</span>
                <span className="text-[#EAE0D5]">
                  {parseFloat(order.shipping_cost) > 0 ? formatCurrency(order.shipping_cost) : 'FREE'}
                </span>
              </div>
            )}
            {/* GST breakdown */}
            {parseFloat(order.igst_amount) > 0 ? (
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/60">IGST</span>
                <span className="text-[#EAE0D5]">{formatCurrency(order.igst_amount)}</span>
              </div>
            ) : (parseFloat(order.cgst_amount) > 0 || parseFloat(order.sgst_amount) > 0) ? (
              <>
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/60">CGST</span>
                  <span className="text-[#EAE0D5]">{formatCurrency(order.cgst_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/60">SGST</span>
                  <span className="text-[#EAE0D5]">{formatCurrency(order.sgst_amount)}</span>
                </div>
              </>
            ) : parseFloat(order.gst_amount) > 0 ? (
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/60">GST</span>
                <span className="text-[#EAE0D5]">{formatCurrency(order.gst_amount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between pt-3 border-t border-[#B76E79]/10 text-base font-bold">
              <span className="text-[#F2C29A]">Total Paid</span>
              <span className="text-[#F2C29A]">{formatCurrency(order.total)}</span>
            </div>
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

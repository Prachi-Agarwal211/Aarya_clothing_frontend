'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import { commerceClient } from '@/lib/baseApi';

const STATUS_CONFIG = {
  confirmed:  { label: 'Order Confirmed',  icon: Package,     color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  shipped:    { label: 'Shipped',          icon: Truck,       color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  delivered:  { label: 'Delivered',        icon: CheckCircle, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  cancelled:  { label: 'Cancelled',        icon: XCircle,     color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
};

export default function GuestOrderTrackingPage() {
  const params = useParams();
  const token = params.token;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const data = await commerceClient.get(`/api/v1/orders/track/${token}`);
        setOrder(data);
      } catch (err) {
        console.error('Failed to load guest order:', err);
        setError('Order not found. Please check your tracking link.');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchOrder();
  }, [token]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const statusCfg = order ? (STATUS_CONFIG[order.status] || STATUS_CONFIG.confirmed) : null;

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing max-w-2xl">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-[#EAE0D5]/50 mb-8">
              <Link href="/" className="hover:text-[#F2C29A] transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#EAE0D5]">Order Tracking</span>
            </nav>

            <h1
              className="text-3xl md:text-4xl text-[#F2C29A] mb-8"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Track Your Order
            </h1>

            {loading && (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-[#B76E79] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-red-400 mb-4">{error}</p>
                <Link
                  href="/"
                  className="inline-block px-6 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
                >
                  Go to Homepage
                </Link>
              </div>
            )}

            {order && statusCfg && (
              <div className="space-y-6">
                {/* Status Card */}
                <div className={`p-6 ${statusCfg.bg} border ${statusCfg.border} rounded-2xl flex items-center gap-4`}>
                  <statusCfg.icon className={`w-10 h-10 ${statusCfg.color} flex-shrink-0`} />
                  <div>
                    <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-wider mb-1">Order Status</p>
                    <p className={`text-xl font-semibold ${statusCfg.color}`}>{statusCfg.label}</p>
                    <p className="text-sm text-[#EAE0D5]/50 mt-0.5">Order #{order.order_id}</p>
                  </div>
                </div>

                {/* Tracking Number */}
                {order.tracking_number && (
                  <div className="p-5 bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-2xl flex items-center gap-3">
                    <Truck className="w-5 h-5 text-[#B76E79] flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-wider">Tracking Number</p>
                      <p className="text-[#F2C29A] font-mono font-medium">{order.tracking_number}</p>
                    </div>
                  </div>
                )}

                {/* Order Summary */}
                <div className="bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#B76E79]/10">
                    <h2 className="font-semibold text-[#EAE0D5]">Order Summary</h2>
                  </div>

                  <div className="divide-y divide-[#B76E79]/10">
                    {order.items?.map((item, i) => (
                      <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-[#EAE0D5] truncate">{item.product_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.size && (
                              <span className="text-xs text-[#EAE0D5]/50 bg-[#B76E79]/10 px-2 py-0.5 rounded-full">
                                {item.size}
                              </span>
                            )}
                            {item.color && (
                              <span className="text-xs text-[#EAE0D5]/50 bg-[#B76E79]/10 px-2 py-0.5 rounded-full">
                                {item.color}
                              </span>
                            )}
                            <span className="text-xs text-[#EAE0D5]/40">× {item.quantity}</span>
                          </div>
                        </div>
                        <span className="text-[#F2C29A] font-semibold flex-shrink-0">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="px-5 py-4 border-t border-[#B76E79]/15 flex items-center justify-between">
                    <span className="font-semibold text-[#EAE0D5]">Total</span>
                    <span className="text-lg font-bold text-[#F2C29A]">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-[#B76E79]" />
                      <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-wider">Order Date</p>
                    </div>
                    <p className="text-[#EAE0D5] font-medium">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-[#B76E79]" />
                      <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-wider">Items</p>
                    </div>
                    <p className="text-[#EAE0D5] font-medium">{order.items?.length ?? 0} item{order.items?.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div className="text-center pt-4 pb-12">
                  <Link
                    href="/products"
                    className="inline-block px-6 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </div>
            )}

          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}

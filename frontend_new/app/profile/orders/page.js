'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, ChevronRight, Eye, Truck, Clock, CheckCircle, XCircle, RotateCcw, Hash, Download, Printer } from 'lucide-react';
import { ordersApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import { useCart } from '@/lib/cartContext';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';

const STATUS_CONFIG = {
  confirmed: { label: 'Processing Your Order', color: 'text-purple-400', bg: 'bg-purple-400/10', icon: Clock },
  shipped:   { label: 'Shipped', color: 'text-cyan-400', bg: 'bg-cyan-400/10', icon: Truck },
  delivered: { label: 'Delivered', color: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle },
  cancelled: { label: 'Order Cancelled', color: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle },
};

export default function OrdersPage() {
  const router = useRouter();
  const { showAlert } = useAlertToast();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { addItem, openCart } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [reordering, setReordering] = useState(null); // Track which order is being reordered

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/profile/orders');
      return;
    }
    if (isAuthenticated) fetchOrders();
  }, [isAuthenticated, authLoading]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await ordersApi.list();
      setOrders(data.orders || data || []);
    } catch (err) {
      logger.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
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

  // Format date
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['confirmed', 'shipped'].includes(order.status);
    return order.status === filter;
  });

  const handleReorder = async (order) => {
    try {
      setReordering(order.id);

      // Sequence the additions to avoid potential race conditions in cart state
      for (const item of (order.items || [])) {
        await addItem(item.product_id, item.quantity, { id: item.variant_id });
      }

      openCart();
    } catch (err) {
      logger.error('Error reordering:', err);
      showAlert('Failed to add items to cart. Some products might be out of stock.');
    } finally {
      setReordering(null);
    }
  };

  const handleDownloadInvoice = async (orderId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showAlert('Please login to download invoice', 'error');
        return;
      }

      const response = await fetch(`/api/v1/orders/${orderId}/invoice`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${invoiceNumber || orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading invoice:', error);
      showAlert('Failed to download invoice. Please try again.', 'error');
    }
  };

  const handlePrintInvoice = async (orderId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showAlert('Please login to print invoice', 'error');
        return;
      }

      // Open invoice in new window for printing
      const response = await fetch(`/api/v1/orders/${orderId}/invoice`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      logger.error('Error printing invoice:', error);
      showAlert('Failed to print invoice. Please try again.', 'error');
    }
  };

  const eventSourcesRef = useRef({});
  const [updatedOrderId, setUpdatedOrderId] = useState(null);

  useEffect(() => {
    if (!orders.length) return;

    const activeOrders = orders.filter(
      o => !['delivered', 'cancelled'].includes(o.status)
    );

    activeOrders.forEach(order => {
      // Skip if already subscribed
      if (eventSourcesRef.current[order.id]) return;

      try {
        const es = new EventSource(`/api/v1/orders/${order.id}/events`);

        es.addEventListener('status_update', (event) => {
          try {
            const data = JSON.parse(event.data);
            setOrders(prev =>
              prev.map(o =>
                o.id === data.order_id
                  ? { ...o, status: data.status, tracking_number: data.tracking_number || o.tracking_number }
                  : o
              )
            );
            // Brief highlight animation
            setUpdatedOrderId(data.order_id);
            setTimeout(() => setUpdatedOrderId(null), 1500);
          } catch (e) {
            console.warn('SSE parse error:', e);
          }
        });

        es.onerror = () => {
          // Auto-reconnect is built into EventSource spec
          console.warn(`SSE reconnecting for order ${order.id}`);
        };

        eventSourcesRef.current[order.id] = es;
      } catch (e) {
        // EventSource not supported or blocked — silent fail
      }
    });

    return () => {
      // Cleanup all EventSource connections on unmount
      Object.values(eventSourcesRef.current).forEach(es => es.close());
      eventSourcesRef.current = {};
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#F2C29A]">My Orders</h2>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm"
        >
          <option value="all">All Orders</option>
          <option value="active">Active Orders</option>
          <option value="confirmed">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-32 bg-[#B76E79]/10 rounded-2xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl text-center">
          <Package className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
          <p className="text-[#EAE0D5]/50">No orders found</p>
          <Link
            href="/products"
            className="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.confirmed;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={order.id}
                className={`p-4 bg-[#0B0608]/40 backdrop-blur-md border rounded-2xl transition-all duration-500 ${updatedOrderId === order.id
                  ? 'border-[#F2C29A]/60 ring-1 ring-[#F2C29A]/30'
                  : 'border-[#B76E79]/15 hover:border-[#B76E79]/30'
                  }`}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-[#F2C29A]">{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusConfig.bg} ${statusConfig.color} flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-sm text-[#EAE0D5]/70">
                      {order.items_count} item{order.items_count > 1 ? 's' : ''} • {formatDate(order.created_at)}
                    </p>
                  </div>

                  {/* Items Preview */}
                  <div className="flex items-center gap-2">
                    {order.items?.slice(0, 3).map((item, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-14 bg-[#7A2F57]/10 rounded-lg flex items-center justify-center"
                      >
                        <Package className="w-5 h-5 text-[#B76E79]/30" />
                      </div>
                    ))}
                    {order.items_count > 3 && (
                      <div className="w-12 h-14 bg-[#7A2F57]/10 rounded-lg flex items-center justify-center text-xs text-[#EAE0D5]/50">
                        +{order.items_count - 3}
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="text-right">
                    <p className="text-lg font-semibold text-[#F2C29A]">{formatCurrency(order.total)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownloadInvoice(order.id, order.invoice_number)}
                      className="flex items-center gap-1 px-4 py-2 bg-[#B76E79]/10 text-[#B76E79] hover:bg-[#B76E79]/20 hover:text-[#F2C29A] rounded-xl transition-all"
                      title="Download Invoice"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Invoice</span>
                    </button>
                    <button
                      onClick={() => handlePrintInvoice(order.id)}
                      className="flex items-center gap-1 px-4 py-2 bg-[#B76E79]/10 text-[#B76E79] hover:bg-[#B76E79]/20 hover:text-[#F2C29A] rounded-xl transition-all"
                      title="Print Invoice"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="hidden sm:inline">Print</span>
                    </button>
                    <button
                      onClick={() => handleReorder(order)}
                      disabled={reordering === order.id}
                      className="flex items-center gap-1 px-4 py-2 bg-[#B76E79]/10 text-[#B76E79] hover:bg-[#B76E79]/20 hover:text-[#F2C29A] rounded-xl transition-all disabled:opacity-50"
                    >
                      <RotateCcw className={`w-4 h-4 ${reordering === order.id ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">Reorder</span>
                    </button>
                    <Link
                      href={`/profile/orders/${order.id}`}
                      className="flex items-center gap-1 px-4 py-2 text-[#EAE0D5]/70 hover:text-[#F2C29A] transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  </div>
                </div>

                {/* Shipped: Show POD/Tracking prominently */}
                {order.status === 'shipped' && (
                  <div className="mt-3 pt-3 border-t border-[#B76E79]/10 space-y-1.5">
                    {order.tracking_number && (
                      <div className="flex items-center gap-2 p-2.5 bg-cyan-400/5 border border-cyan-400/20 rounded-xl">
                        <Hash className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-widest">POD / Tracking Number</p>
                          <p className="text-sm font-mono font-semibold text-cyan-300">{order.tracking_number}</p>
                        </div>
                      </div>
                    )}
                    {order.estimated_delivery && (
                      <p className="text-sm text-[#EAE0D5]/60">
                        <Truck className="w-4 h-4 inline mr-1 text-cyan-400" />
                        Estimated delivery: {formatDate(order.estimated_delivery)}
                      </p>
                    )}
                  </div>
                )}
                {order.status === 'delivered' && order.delivered_at && (
                  <div className="mt-3 pt-3 border-t border-[#B76E79]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-[#EAE0D5]/70">
                      <CheckCircle className="w-4 h-4 inline mr-1 text-green-400" />
                      Delivered on: {formatDate(order.delivered_at)}
                    </p>
                    <Link
                      href={`/profile/returns/create?order=${order.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[#B76E79] hover:text-[#F2C29A] bg-[#B76E79]/10 rounded-lg hover:bg-[#B76E79]/20 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Return/Exchange
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

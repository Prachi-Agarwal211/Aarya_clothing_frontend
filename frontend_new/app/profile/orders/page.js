'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, ChevronRight, Truck, Clock, CheckCircle, XCircle, Hash, Download, Printer } from 'lucide-react';
import { ordersApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';
import { getErrorMessage, logError } from '@/lib/errorHandlers';

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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null); // Track expanded order for item details

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect_url=/profile/orders');
      return;
    }
    if (isAuthenticated) fetchOrders();
  }, [isAuthenticated, authLoading]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await ordersApi.list();
      // Handle multiple response shapes: array, paginated {items, ...}, {orders, ...}, or {data, ...}
      let ordersList;
      if (Array.isArray(data)) {
        ordersList = data;
      } else if (data && typeof data === 'object') {
        ordersList = data.items || data.orders || data.data || [];
        // If paginated, the items themselves might be nested
        if (!Array.isArray(ordersList) && data.results) {
          ordersList = Array.isArray(data.results) ? data.results : [];
        }
      } else {
        ordersList = [];
      }
      setOrders(ordersList);
    } catch (err) {
      logError('ProfileOrders', 'loading orders', err, { 
        endpoint: '/api/v1/customer/orders'
      });
      
      setError(getErrorMessage(err, 'load orders', {
        authMsg: 'Your session has expired. Please log in again.',
        permissionMsg: 'You do not have permission to view orders.',
        notFoundMsg: 'No orders found.',
        networkMsg: 'Cannot connect to server. Please check your connection.'
      }));
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

  const toggleOrderDetails = (orderId) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId);
  };

  const handleDownloadInvoice = async (orderId, invoiceNumber) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/invoice`, {
        method: 'GET',
        credentials: 'include',
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
      logError('ProfileOrders', 'downloading invoice', error, { 
        orderId,
        invoiceNumber
      });
      showAlert(getErrorMessage(error, 'download invoice', {
        authMsg: 'Your session has expired. Please log in again.',
        permissionMsg: 'You do not have permission to download this invoice.',
        notFoundMsg: 'Invoice not found.',
        networkMsg: 'Cannot connect to server. Please check your connection.'
      }), 'error');
    }
  };

  const handlePrintInvoice = async (orderId) => {
    try {
      // Open invoice in new window for printing
      const response = await fetch(`/api/v1/orders/${orderId}/invoice`, {
        method: 'GET',
        credentials: 'include',
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
      logError('ProfileOrders', 'printing invoice', error, { 
        orderId
      });
      showAlert(getErrorMessage(error, 'print invoice', {
        authMsg: 'Your session has expired. Please log in again.',
        permissionMsg: 'You do not have permission to print this invoice.',
        notFoundMsg: 'Invoice not found.',
        networkMsg: 'Cannot connect to server. Please check your connection.'
      }), 'error');
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
                  ? {
                      ...o,
                      status: data.status,
                      tracking_number: data.tracking_number || o.tracking_number,
                      courier_name: data.courier_name || o.courier_name,
                    }
                  : o
              )
            );
            // Brief highlight animation
            setUpdatedOrderId(data.order_id);
            setTimeout(() => setUpdatedOrderId(null), 1500);
          } catch (e) {
            logger.warn('SSE parse error:', e);
          }
        });

        es.onerror = () => {
          // Auto-reconnect is built into EventSource spec
          logger.warn(`SSE reconnecting for order ${order.id}`);
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
                        className="relative w-12 h-14 bg-[#7A2F57]/10 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
                      >
                        {(item.image_url || item.product_image || item.image) ? (
                          <Image
                            src={item.image_url || item.product_image || item.image}
                            alt={item.product_name || item.name || ''}
                            fill
                            className="object-cover"
                            sizes="48px"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <Package className="w-5 h-5 text-[#B76E79]/30" />
                        )}
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
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleDownloadInvoice(order.id, order.invoice_number)}
                      className="flex items-center gap-1 px-2.5 sm:px-4 py-2 bg-[#B76E79]/10 text-[#B76E79] hover:bg-[#B76E79]/20 hover:text-[#F2C29A] rounded-xl transition-all"
                      title="Download Invoice"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm">Invoice</span>
                    </button>
                    <button
                      onClick={() => handlePrintInvoice(order.id)}
                      className="flex items-center gap-1 px-2.5 sm:px-4 py-2 bg-[#B76E79]/10 text-[#B76E79] hover:bg-[#B76E79]/20 hover:text-[#F2C29A] rounded-xl transition-all"
                      title="Print Invoice"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm">Print</span>
                    </button>
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
                    {order.courier_name && (
                      <div className="flex items-center gap-2 p-2.5 bg-purple-400/5 border border-purple-400/20 rounded-xl">
                        <Truck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-widest">Courier Service</p>
                          <p className="text-sm font-semibold text-purple-300">{order.courier_name}</p>
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
                  </div>
                )}

                {/* Expandable Item Details */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#B76E79]/10">
                    <button
                      onClick={() => toggleOrderDetails(order.id)}
                      className="flex items-center gap-2 text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors w-full"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${expandedOrder === order.id ? 'rotate-90' : ''}`} />
                      {expandedOrder === order.id ? 'Hide' : 'Show'} {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    </button>

                    {expandedOrder === order.id && (
                      <div className="mt-3 space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-[#0B0608]/60 rounded-xl">
                            {/* Product Image */}
                            <div className="relative w-16 h-20 bg-[#7A2F57]/10 rounded-lg overflow-hidden flex-shrink-0">
                              {item.image_url ? (
                                <Image
                                  src={item.image_url}
                                  alt={item.product_name || 'Product'}
                                  fill
                                  className="object-cover"
                                  sizes="64px"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className="absolute inset-0 flex items-center justify-center" style={{ display: 'none' }}>
                                <Package className="w-6 h-6 text-[#B76E79]/30" />
                              </div>
                              {!item.image_url && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-[#B76E79]/30" />
                                </div>
                              )}
                            </div>

                            {/* Item Details */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[#F2C29A] text-sm truncate">{item.product_name || 'Product'}</p>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#EAE0D5]/60">
                                {item.size && <span className="px-1.5 py-0.5 bg-[#7A2F57]/20 rounded">Size: {item.size}</span>}
                                {item.color && <span className="px-1.5 py-0.5 bg-[#7A2F57]/20 rounded">Color: {item.color}</span>}
                                {item.sku && <span className="px-1.5 py-0.5 bg-[#7A2F57]/20 rounded font-mono">SKU: {item.sku}</span>}
                              </div>
                              <div className="mt-2 flex items-center gap-3 text-sm">
                                <span className="text-[#EAE0D5]/60">Qty: {item.quantity}</span>
                                {item.unit_price && <span className="text-[#EAE0D5]/60">@ {formatCurrency(item.unit_price)} each</span>}
                                <span className="font-semibold text-[#F2C29A]">{formatCurrency(item.price)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

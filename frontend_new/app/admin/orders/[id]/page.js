'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  CreditCard,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  Copy,
  MessageSquare,
} from 'lucide-react';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/shared/StatusBadge';
import { ordersApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

// Active order flow (cancelled is shown separately)
const STATUS_FLOW = ['confirmed', 'shipped', 'delivered'];

// Status labels — what the admin sees vs what customer sees
const STATUS_ADMIN_LABELS = {
  confirmed: 'Confirmed (Awaiting Shipment)',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Valid status transitions — must match backend order_service.py
const VALID_TRANSITIONS = {
  'confirmed': ['shipped', 'cancelled'],
  'shipped':   ['delivered'],
  'delivered': [],  // Terminal — returns handled by Returns module
  'cancelled': [],
};

export default function OrderDetailPage({ params }) {
  const router = useRouter();
  const orderId = use(params).id;
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [podNumber, setPodNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [trackingHistory, setTrackingHistory] = useState([]);

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [data, trackingData] = await Promise.all([
        ordersApi.get(orderId),
        ordersApi.getTracking(orderId).catch(() => ({ tracking: [] }))
      ]);
      setOrder(data);
      setTrackingHistory(trackingData.tracking || []);
    } catch (err) {
      logger.error('Error fetching order:', err);
      setError('Failed to load order details. Please try again.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async () => {
    if (!newStatus) return;
    if (newStatus === 'shipped' && !podNumber.trim()) {
      setError('POD number is required when marking order as shipped.');
      return;
    }
    try {
      setUpdating(true);
      setError(null);
      await ordersApi.updateStatus(orderId, {
        status: newStatus,
        pod_number: podNumber.trim() || undefined,
        notes: notes || undefined,
      });
      await fetchOrder();
      setShowStatusModal(false);
      setNewStatus('');
      setPodNumber('');
      setNotes('');
    } catch (err) {
      logger.error('Error updating status:', err);
      setError(err?.message || 'Failed to update status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status index
  const getStatusIndex = (status) => {
    return STATUS_FLOW.indexOf(status?.toLowerCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[#EAE0D5]">Order not found</h2>
        <Link href="/admin/orders" className="text-[#B76E79] hover:text-[#F2C29A] mt-2 inline-block">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  const shippingAddressString = order.order.shipping_address || 'No address provided';
  const currentStatusIndex = getStatusIndex(order.order.status);
  const paymentMethodLabel = order.order.payment_method ? order.order.payment_method.toUpperCase() : 'Unknown';
  const paymentStatus = (() => {
    if (order.order.status === 'cancelled') return 'failed';
    if (order.order.transaction_id) return 'paid';
    if (['shipped', 'delivered'].includes(order.order.status)) return 'paid';
    return 'pending';
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 
              className="text-2xl md:text-3xl font-bold text-[#F2C29A]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Order #{order.order.id}
            </h1>
            <p className="text-[#EAE0D5]/60 mt-1">
              Placed on {formatDate(order.order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.order.status} />
          <button
            onClick={() => {
              setNewStatus(order.order.status);
              setShowStatusModal(true);
            }}
            className="px-4 py-2 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors"
          >
            Update Status
          </button>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
          Order Timeline
        </h2>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STATUS_FLOW.map((status, index) => {
            const isCompleted = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            
            return (
              <div key={status} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${isCompleted 
                        ? 'bg-[#7A2F57]/30 border-2 border-[#B76E79]' 
                        : 'bg-[#0B0608]/60 border border-[#B76E79]/20'
                      }
                      ${isCurrent ? 'ring-2 ring-[#F2C29A]/30' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-[#F2C29A]" />
                    ) : (
                      <span className="text-[#EAE0D5]/40 text-sm">{index + 1}</span>
                    )}
                  </div>
                  <span className={`mt-2 text-xs capitalize ${isCompleted ? 'text-[#F2C29A]' : 'text-[#EAE0D5]/40'}`}>
                    {status}
                  </span>
                </div>
                {index < STATUS_FLOW.length - 1 && (
                  <div
                    className={`w-16 md:w-24 h-0.5 mx-2 ${
                      index < currentStatusIndex ? 'bg-[#B76E79]' : 'bg-[#B76E79]/20'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
              Order Items
            </h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 bg-[#0B0608]/60 border border-[#B76E79]/10 rounded-xl"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#0B0608]/40 flex-shrink-0 border border-[#B76E79]/10">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.product_name || 'Product'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#7A2F57]/20">
                        <Package className="w-8 h-8 text-[#B76E79]/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[#EAE0D5] truncate">{item.product_name}</h3>
                    <p className="text-sm text-[#EAE0D5]/60">
                      {item.size && <span>Size: {item.size}</span>}
                      {item.color && <span className="ml-2">Color: {item.color}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium text-[#EAE0D5]">{formatCurrency(item.price)}</p>
                    <p className="text-sm text-[#EAE0D5]/60">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary - Simplified: Total Only */}
            <div className="mt-6 pt-6 border-t border-[#B76E79]/15">
              <div className="flex justify-between text-lg font-semibold text-[#F2C29A]">
                <span>Total</span>
                <span>{formatCurrency(order.order.total_amount)}</span>
              </div>
              <p className="text-xs text-[#EAE0D5]/40 mt-2">
                Price shown is final - includes all taxes and shipping
              </p>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
              Payment Information
            </h2>
            <div className="space-y-4">
              {/* Payment Method and Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-[#B76E79]" />
                  <div>
                    <p className="text-[#EAE0D5]">{paymentMethodLabel}</p>
                    <p className="text-sm text-[#EAE0D5]/60">{order.order.transaction_id || 'TXN_PENDING'}</p>
                  </div>
                </div>
                <PaymentStatusBadge status={paymentStatus} />
              </div>

              {/* Razorpay Payment Details */}
              {order.order.razorpay_payment_id && (
                <div className="bg-[#7A2F57]/20 border border-[#B76E79]/20 rounded-xl p-4">
                  <p className="text-xs text-[#B76E79] mb-2 font-semibold">RAZORPAY DETAILS</p>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div>
                      <span className="text-[#EAE0D5]/60">Payment ID:</span>
                      <p className="text-[#F2C29A] font-mono">{order.order.razorpay_payment_id}</p>
                    </div>
                    <div>
                      <span className="text-[#EAE0D5]/60">Order ID:</span>
                      <p className="text-[#F2C29A] font-mono">{order.order.razorpay_order_id}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cashfree Payment Details */}
              {order.order.cashfree_order_id && (
                <div className="bg-[#7A2F57]/20 border border-[#B76E79]/20 rounded-xl p-4">
                  <p className="text-xs text-[#B76E79] mb-2 font-semibold">CASHFREE DETAILS</p>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div>
                      <span className="text-[#EAE0D5]/60">Order ID:</span>
                      <p className="text-[#F2C29A] font-mono">{order.order.cashfree_order_id}</p>
                    </div>
                    <div>
                      <span className="text-[#EAE0D5]/60">Reference ID:</span>
                      <p className="text-[#F2C29A] font-mono">{order.order.cashfree_reference_id}</p>
                    </div>
                    {order.order.cashfree_payment_id && (
                      <div>
                        <span className="text-[#EAE0D5]/60">Payment ID:</span>
                        <p className="text-[#F2C29A] font-mono">{order.order.cashfree_payment_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
              Customer
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#7A2F57]/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#B76E79]" />
                </div>
                <div>
                  <p className="font-medium text-[#EAE0D5]">{order.customer?.full_name || 'Customer'}</p>
                  <p className="text-sm text-[#EAE0D5]/60">ID: #{order.customer?.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[#EAE0D5]/70">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{order.customer?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-[#EAE0D5]/70">
                <Phone className="w-4 h-4" />
                <span className="text-sm">{order.customer?.phone}</span>
              </div>
              <Link
                href={`/admin/customers/${order.customer?.id}`}
                className="block text-center text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors"
              >
                View Customer Profile →
              </Link>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
              Shipping Address
            </h2>
            <div className="space-y-2 text-[#EAE0D5]/70 whitespace-pre-wrap">
              <p>{shippingAddressString}</p>
            </div>
          </div>

          {/* POD / Tracking Number — shown when shipped */}
          {order.order.tracking_number && ['shipped', 'delivered'].includes(order.order.status) && (
            <div className="bg-cyan-400/5 backdrop-blur-md border border-cyan-400/20 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                POD / Tracking
              </h2>
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-widest mb-1">Proof of Delivery Number</p>
                  <p className="font-mono font-bold text-cyan-300 text-lg">{order.order.tracking_number}</p>
                  <p className="text-xs text-[#EAE0D5]/40 mt-1">Shown to customer for tracking</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
              Quick Actions
            </h2>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 text-[#EAE0D5] transition-colors">
                <MessageSquare className="w-4 h-4" />
                <span>Contact Customer</span>
              </button>
              {order.order.status === 'shipped' && (
                <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 text-[#EAE0D5] transition-colors">
                  <Truck className="w-4 h-4" />
                  <span>Print Shipping Label</span>
                </button>
              )}
              {order.order.status === 'confirmed' && (
                <button
                  onClick={async () => {
                    if (!confirm('Cancel this order? This cannot be undone.')) return;
                    try {
                      setUpdating(true);
                      await ordersApi.updateStatus(orderId, { status: 'cancelled', notes: 'Cancelled via quick action' });
                      await fetchOrder();
                    } catch (err) { setError(err?.message || 'Failed to cancel order.'); }
                    finally { setUpdating(false); }
                  }}
                  disabled={updating}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:border-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{updating ? 'Cancelling...' : 'Cancel Order'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Order History / Audit Trail */}
          <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
              Order History
            </h2>
            {trackingHistory.length === 0 ? (
              <p className="text-sm text-[#EAE0D5]/50">No history available</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {trackingHistory.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-3 border-b border-[#B76E79]/10 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-[#B76E79] mt-2 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#EAE0D5] capitalize">{entry.status}</span>
                        <span className="text-xs text-[#EAE0D5]/40">
                          {new Date(entry.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-[#EAE0D5]/60 mt-1">{entry.notes}</p>
                      )}
                      {entry.location && (
                        <p className="text-xs text-[#B76E79]/70 mt-1">📍 {entry.location}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowStatusModal(false)} />
          <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
              Update Order Status
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#EAE0D5]/70 mb-2">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                >
                  <option value="">Select new status...</option>
                  {order && VALID_TRANSITIONS[order.order.status]?.map(s => (
                    <option key={s} value={s} className="bg-[#0B0608]">
                      {STATUS_ADMIN_LABELS[s] || s}
                    </option>
                  ))}
                </select>
                {order && VALID_TRANSITIONS[order.order.status]?.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">No further status changes available for this order.</p>
                )}
              </div>

              {newStatus === 'shipped' && (
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">
                    POD / Tracking Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={podNumber}
                    onChange={(e) => setPodNumber(e.target.value)}
                    placeholder="e.g. DTDC1234567890"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                  />
                  <p className="text-xs text-[#EAE0D5]/40 mt-1">This POD number will be displayed to the customer for tracking.</p>
                </div>
              )}

              <div>
                <label className="block text-sm text-[#EAE0D5]/70 mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this status change..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowStatusModal(false)}
                className="flex-1 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateStatus}
                disabled={updating || !newStatus || (newStatus === 'shipped' && !podNumber.trim())}
                className="flex-1 px-4 py-2.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

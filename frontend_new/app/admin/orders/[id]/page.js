'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Package, User, CreditCard, Truck, CheckCircle,
  XCircle, Phone, Mail, MessageSquare,
} from 'lucide-react';
import {
  OrderStatusBadge, PaymentStatusBadge,
} from '@/components/admin/shared/StatusBadge';
import { ordersApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';
import OrderStatusModal from '@/components/admin/orders/OrderStatusModal';

const STATUS_FLOW = ['confirmed', 'shipped', 'delivered'];
const R2_BASE_URL = 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev';

const getImageUrl = (url) => {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${R2_BASE_URL}/${url.replace(/^\//, '')}`;
};

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount || 0);

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export default function OrderDetailPage({ params }) {
  const router = useRouter();
  const orderId = use(params).id;
  const { showAlert } = useAlertToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [trackingHistory, setTrackingHistory] = useState([]);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, trackingData] = await Promise.all([
        ordersApi.get(orderId),
        ordersApi.getTracking(orderId).catch(() => ({ tracking: [] })),
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
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleQuickCancel = async () => {
    if (!confirm('Cancel this order? This cannot be undone.')) return;
    try {
      setUpdating(true);
      await ordersApi.updateStatus(orderId, {
        status: 'cancelled',
        notes: 'Cancelled via quick action',
      });
      await fetchOrder();
    } catch (err) {
      setError(err?.message || 'Failed to cancel order.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Loader />;
  if (!order) return <NotFound />;

  const o = order.order;
  const currentStatusIndex = STATUS_FLOW.indexOf(o.status?.toLowerCase());
  const paymentStatus = derivePaymentStatus(o);

  return (
    <div className="space-y-6">
      <Header
        order={o}
        onBack={() => router.back()}
        onUpdate={() => setStatusOpen(true)}
      />

      <Timeline currentStatusIndex={currentStatusIndex} />

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ItemsCard items={order.items} total={o.total_amount} />
          <PaymentCard order={o} status={paymentStatus} />
        </div>

        <div className="space-y-6">
          <CustomerCard customer={order.customer} />
          <AddressCard address={o.shipping_address} />
          {o.tracking_number && ['shipped', 'delivered'].includes(o.status) && (
            <TrackingCard tracking={o.tracking_number} />
          )}
          <QuickActions
            status={o.status}
            updating={updating}
            onCancel={handleQuickCancel}
          />
          <HistoryCard entries={trackingHistory} />
        </div>
      </div>

      <OrderStatusModal
        open={statusOpen}
        orderId={orderId}
        currentStatus={o.status}
        onClose={() => setStatusOpen(false)}
        onUpdated={fetchOrder}
        onError={(msg) => showAlert(msg)}
      />
    </div>
  );
}

function derivePaymentStatus(o) {
  if (o.status === 'cancelled') return 'failed';
  if (o.transaction_id) return 'paid';
  if (['shipped', 'delivered'].includes(o.status)) return 'paid';
  return 'pending';
}

function Loader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#EAE0D5]/70">Loading order details...</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="text-center py-12">
      <Package className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-[#EAE0D5]">Order not found</h2>
      <Link
        href="/admin/orders"
        className="text-[#B76E79] hover:text-[#F2C29A] mt-2 inline-block"
      >
        ← Back to orders
      </Link>
    </div>
  );
}

function Header({ order, onBack, onUpdate }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#F2C29A]"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Order #{order.id}
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Placed on {formatDate(order.created_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <OrderStatusBadge status={order.status} />
        <button
          onClick={onUpdate}
          className="px-4 py-2 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors"
        >
          Update status
        </button>
      </div>
    </div>
  );
}

function Timeline({ currentStatusIndex }) {
  return (
    <Section title="Order timeline">
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {STATUS_FLOW.map((status, index) => {
          const isCompleted = index <= currentStatusIndex;
          const isCurrent = index === currentStatusIndex;
          return (
            <div key={status} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center
                    ${isCompleted
                      ? 'bg-[#7A2F57]/30 border-2 border-[#B76E79]'
                      : 'bg-[#0B0608]/60 border border-[#B76E79]/20'}
                    ${isCurrent ? 'ring-2 ring-[#F2C29A]/30' : ''}`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-[#F2C29A]" />
                  ) : (
                    <span className="text-[#EAE0D5]/40 text-sm">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-2 text-xs capitalize ${
                    isCompleted ? 'text-[#F2C29A]' : 'text-[#EAE0D5]/40'
                  }`}
                >
                  {status}
                </span>
              </div>
              {index < STATUS_FLOW.length - 1 && (
                <div
                  className={`w-16 md:w-24 h-0.5 mx-2 ${
                    index < currentStatusIndex
                      ? 'bg-[#B76E79]'
                      : 'bg-[#B76E79]/20'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ItemsCard({ items, total }) {
  return (
    <Section title="Order items">
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 p-4 bg-[#0B0608]/60 border border-[#B76E79]/10 rounded-xl"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#0B0608]/40 flex-shrink-0 border border-[#B76E79]/10">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getImageUrl(item.image_url)}
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
              <h3 className="font-medium text-[#EAE0D5] truncate">
                {item.product_name}
              </h3>
              <p className="text-sm text-[#EAE0D5]/60">
                {item.size && <span>Size: {item.size}</span>}
                {item.color && <span className="ml-2">Color: {item.color}</span>}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-medium text-[#EAE0D5]">{formatINR(item.price)}</p>
              <p className="text-sm text-[#EAE0D5]/60">Qty: {item.quantity}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-[#B76E79]/15">
        <div className="flex justify-between text-lg font-semibold text-[#F2C29A]">
          <span>Total</span>
          <span>{formatINR(total)}</span>
        </div>
        <p className="text-xs text-[#EAE0D5]/40 mt-2">
          Price shown is final — includes all taxes and shipping
        </p>
      </div>
    </Section>
  );
}

function PaymentCard({ order, status }) {
  const label = order.payment_method ? order.payment_method.toUpperCase() : 'Unknown';
  return (
    <Section title="Payment information">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-[#B76E79]" />
            <div>
              <p className="text-[#EAE0D5]">{label}</p>
              <p className="text-sm text-[#EAE0D5]/60">
                {order.transaction_id || 'TXN_PENDING'}
              </p>
            </div>
          </div>
          <PaymentStatusBadge status={status} />
        </div>

        {order.razorpay_payment_id && (
          <PaymentDetailBlock
            label="RAZORPAY DETAILS"
            rows={[
              ['Payment ID', order.razorpay_payment_id],
              ['Order ID', order.razorpay_order_id],
            ]}
          />
        )}

        {order.cashfree_order_id && (
          <PaymentDetailBlock
            label="CASHFREE DETAILS"
            rows={[
              ['Order ID', order.cashfree_order_id],
              ['Reference ID', order.cashfree_reference_id],
              ['Payment ID', order.cashfree_payment_id],
            ].filter(([, v]) => Boolean(v))}
          />
        )}
      </div>
    </Section>
  );
}

function PaymentDetailBlock({ label, rows }) {
  return (
    <div className="bg-[#7A2F57]/20 border border-[#B76E79]/20 rounded-xl p-4">
      <p className="text-xs text-[#B76E79] mb-2 font-semibold">{label}</p>
      <div className="grid grid-cols-1 gap-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <span className="text-[#EAE0D5]/60">{k}:</span>
            <p className="text-[#F2C29A] font-mono">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerCard({ customer }) {
  return (
    <Section title="Customer">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#7A2F57]/30 flex items-center justify-center">
            <User className="w-5 h-5 text-[#B76E79]" />
          </div>
          <div>
            <p className="font-medium text-[#EAE0D5]">
              {customer?.full_name || 'Customer'}
            </p>
            <p className="text-sm text-[#EAE0D5]/60">ID: #{customer?.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[#EAE0D5]/70">
          <Mail className="w-4 h-4" />
          <span className="text-sm">{customer?.email}</span>
        </div>
        <div className="flex items-center gap-3 text-[#EAE0D5]/70">
          <Phone className="w-4 h-4" />
          <span className="text-sm">{customer?.phone}</span>
        </div>
      </div>
    </Section>
  );
}

function AddressCard({ address }) {
  return (
    <Section title="Shipping address">
      <div className="space-y-2 text-[#EAE0D5]/70 whitespace-pre-wrap">
        <p>{address || 'No address provided'}</p>
      </div>
    </Section>
  );
}

function TrackingCard({ tracking }) {
  return (
    <div className="bg-cyan-400/5 backdrop-blur-md border border-cyan-400/20 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-[#F2C29A] mb-3 font-cinzel">
        POD / Tracking
      </h2>
      <div className="flex items-start gap-3">
        <Truck className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-widest mb-1">
            Proof of delivery number
          </p>
          <p className="font-mono font-bold text-cyan-300 text-lg">{tracking}</p>
          <p className="text-xs text-[#EAE0D5]/40 mt-1">
            Shown to customer for tracking
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickActions({ status, updating, onCancel }) {
  return (
    <Section title="Quick actions">
      <div className="space-y-2">
        <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 text-[#EAE0D5] transition-colors">
          <MessageSquare className="w-4 h-4" />
          <span>Contact customer</span>
        </button>
        {status === 'shipped' && (
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 text-[#EAE0D5] transition-colors">
            <Truck className="w-4 h-4" />
            <span>Print shipping label</span>
          </button>
        )}
        {status === 'confirmed' && (
          <button
            onClick={onCancel}
            disabled={updating}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:border-red-500/30 text-red-400 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            <span>{updating ? 'Cancelling...' : 'Cancel order'}</span>
          </button>
        )}
      </div>
    </Section>
  );
}

function HistoryCard({ entries }) {
  return (
    <Section title="Order history">
      {entries.length === 0 ? (
        <p className="text-sm text-[#EAE0D5]/50">No history available</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 pb-3 border-b border-[#B76E79]/10 last:border-0"
            >
              <div className="w-2 h-2 rounded-full bg-[#B76E79] mt-2 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#EAE0D5] capitalize">
                    {entry.status}
                  </span>
                  <span className="text-xs text-[#EAE0D5]/40">
                    {new Date(entry.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
                {entry.notes && (
                  <p className="text-xs text-[#EAE0D5]/60 mt-1">{entry.notes}</p>
                )}
                {entry.location && (
                  <p className="text-xs text-[#B76E79]/70 mt-1">
                    📍 {entry.location}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
      <h2
        className="text-lg font-semibold text-[#F2C29A] mb-4"
        style={{ fontFamily: 'Cinzel, serif' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, ShoppingBag, IndianRupee, Calendar,
  CheckCircle, AlertCircle, Clock, ExternalLink, Copy, Check,
  Loader2, RefreshCw, Power, Eye,
} from 'lucide-react';
import { usersApi, ordersApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import Pagination from '@/components/admin/Pagination';

const R2_BASE_URL = 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev';
const PAGE_SIZE = 20;

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${R2_BASE_URL}/${url.replace(/^\//, '')}`;
};

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const initials = (name) =>
  name
    ? name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

const statusTone = (s) => {
  switch ((s || '').toLowerCase()) {
    case 'delivered':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'shipped':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'processing':
    case 'confirmed':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'cancelled':
    case 'failed':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-[#7A2F57]/20 text-[#EAE0D5]/70 border-[#B76E79]/30';
  }
};

export default function CustomerDetailPage({ params }) {
  const router = useRouter();
  const customerId = React.use(params).id;

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await usersApi.get(customerId);
      setCustomer(data);
    } catch (err) {
      logger.error('Failed to load customer', err);
      setError(err?.message || 'Failed to load customer.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const data = await ordersApi.list({
        user_id: customerId,
        page: ordersPage,
        limit: PAGE_SIZE,
      });
      setOrders(data.orders || data.items || []);
      setOrdersTotal(data.total ?? data.count ?? data.orders?.length ?? 0);
    } catch (err) {
      logger.error('Failed to load orders', err);
    } finally {
      setOrdersLoading(false);
    }
  }, [customerId, ordersPage]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCopy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      logger.error('Copy failed', err);
    }
  };

  const handleToggleStatus = async () => {
    if (!customer) return;
    const next = !customer.is_active;
    if (
      !window.confirm(
        `${next ? 'Activate' : 'Deactivate'} ${customer.full_name || customer.email}?`,
      )
    ) {
      return;
    }
    setStatusBusy(true);
    try {
      await usersApi.updateStatus(customer.id, next);
      showToast(`Customer ${next ? 'activated' : 'deactivated'}.`);
      fetchCustomer();
    } catch (err) {
      showToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#B76E79]/60 animate-spin" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/admin/customers')}
          className="flex items-center gap-2 text-sm text-[#EAE0D5]/70 hover:text-[#F2C29A]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to customers
        </button>
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error || 'Customer not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm ${toast.type === 'error' ? 'bg-red-500/90' : 'bg-green-500/90'}`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <button
          onClick={() => router.push('/admin/customers')}
          className="flex items-center gap-2 text-sm text-[#EAE0D5]/70 hover:text-[#F2C29A]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to customers
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchCustomer();
              fetchOrders();
            }}
            className="p-2.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={`w-5 h-5 ${loading || ordersLoading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={handleToggleStatus}
            disabled={statusBusy}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors disabled:opacity-50 ${customer.is_active ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'}`}
          >
            {statusBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            {customer.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <Link
            href={`/admin/orders?user_id=${customer.id}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" /> All orders
          </Link>
        </div>
      </div>

      <ProfileHeader
        customer={customer}
        copied={copied}
        onCopy={handleCopy}
      />

      <StatsGrid customer={customer} />

      <AccountInfo customer={customer} />

      <OrdersSection
        orders={orders}
        loading={ordersLoading}
        page={ordersPage}
        total={ordersTotal}
        onPageChange={setOrdersPage}
      />
    </div>
  );
}

function ProfileHeader({ customer, copied, onCopy }) {
  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {initials(customer.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#F2C29A] font-cinzel">
            {customer.full_name || '—'}
          </h1>
          <p className="text-sm text-[#EAE0D5]/50">@{customer.username}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${customer.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}
            >
              {customer.is_active ? 'Active' : 'Inactive'}
            </span>
            {customer.email_verified && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Email verified
              </span>
            )}
            {customer.phone_verified && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Phone verified
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <ContactCard
          icon={<Mail className="w-3 h-3" />}
          label="Email"
          value={customer.email}
          href={customer.email ? `mailto:${customer.email}` : null}
          copied={copied === 'email'}
          onCopy={() => onCopy(customer.email, 'email')}
        />
        <ContactCard
          icon={<Phone className="w-3 h-3" />}
          label="Phone"
          value={customer.phone}
          href={customer.phone ? `tel:${customer.phone}` : null}
          copied={copied === 'phone'}
          onCopy={() => customer.phone && onCopy(customer.phone, 'phone')}
        />
      </div>
    </div>
  );
}

function ContactCard({ icon, label, value, href, copied, onCopy }) {
  return (
    <div className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl p-4">
      <label className="text-xs text-[#EAE0D5]/50 flex items-center gap-1 mb-2">
        {icon} {label}
      </label>
      <div className="flex items-center gap-2">
        {value ? (
          <>
            <a
              href={href}
              className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors text-sm flex-1 truncate"
            >
              {value}
            </a>
            <button
              type="button"
              onClick={onCopy}
              className="p-2 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors"
              title={`Copy ${label.toLowerCase()}`}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </>
        ) : (
          <span className="text-[#EAE0D5]/40 text-sm">Not provided</span>
        )}
      </div>
    </div>
  );
}

function StatsGrid({ customer }) {
  const stats = [
    {
      icon: <ShoppingBag className="w-5 h-5 text-[#B76E79]" />,
      label: 'Total orders',
      value: customer.order_count || 0,
    },
    {
      icon: <IndianRupee className="w-5 h-5 text-[#B76E79]" />,
      label: 'Total spent',
      value: formatINR(customer.total_spent),
    },
    {
      icon: <Clock className="w-5 h-5 text-[#B76E79]" />,
      label: 'Last order',
      value: customer.last_order_date ? formatDate(customer.last_order_date) : 'Never',
      small: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-2xl p-4 flex items-center gap-4"
        >
          <div className="p-2.5 rounded-xl bg-[#7A2F57]/15 flex-shrink-0">{s.icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-wider">
              {s.label}
            </p>
            <p
              className={`font-bold text-[#F2C29A] ${s.small ? 'text-base' : 'text-2xl'}`}
            >
              {s.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountInfo({ customer }) {
  return (
    <div className="bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-[#EAE0D5] mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[#B76E79]" /> Account information
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Field label="Customer ID" value={`#${customer.id}`} />
        <Field label="Role" value={customer.role || 'customer'} capitalize />
        <Field label="Joined" value={formatDate(customer.created_at)} />
        <Field label="Last updated" value={formatDate(customer.updated_at)} />
      </div>
    </div>
  );
}

function Field({ label, value, capitalize = false }) {
  return (
    <div>
      <p className="text-[#EAE0D5]/50 text-xs">{label}</p>
      <p className={`text-[#EAE0D5] mt-0.5 ${capitalize ? 'capitalize' : ''}`}>
        {value || '—'}
      </p>
    </div>
  );
}

function OrdersSection({ orders, loading, page, total, onPageChange }) {
  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-[#B76E79]/10 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#F2C29A] font-cinzel flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" /> Order history
        </h2>
        {total > 0 && (
          <span className="text-xs text-[#EAE0D5]/50">{total} orders</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#B76E79]/60 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#EAE0D5]/40">
          <ShoppingBag className="w-10 h-10 mb-3" />
          <p>No orders for this customer yet.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[#B76E79]/5">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
          <div className="p-4 border-t border-[#B76E79]/10">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={onPageChange}
            />
          </div>
        </>
      )}
    </div>
  );
}

function OrderRow({ order }) {
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="flex items-center justify-between p-4 hover:bg-[#B76E79]/5 transition-colors gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-[#0B0608] border border-[#B76E79]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {order.items?.[0]?.image_url ? (
            <img
              src={getImageUrl(order.items[0].image_url)}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <ShoppingBag className="w-4 h-4 text-[#B76E79]/40" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#EAE0D5]">
            #{order.order_number || order.id}
          </p>
          <p className="text-xs text-[#EAE0D5]/50">
            {formatDate(order.created_at)}
            {order.items?.length ? ` · ${order.items.length} item(s)` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-medium text-[#F2C29A]">
          {formatINR(order.total_amount)}
        </span>
        <span
          className={`px-2 py-1 rounded-full text-xs border capitalize ${statusTone(order.status)}`}
        >
          {order.status || 'pending'}
        </span>
        <Eye className="w-4 h-4 text-[#EAE0D5]/40" />
      </div>
    </Link>
  );
}

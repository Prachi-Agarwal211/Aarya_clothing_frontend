'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Eye,
  Package,
} from 'lucide-react';
import DataTable from '@/components/admin/shared/DataTable';
import { OrderStatusBadge } from '@/components/admin/shared/StatusBadge';
import { ordersApi } from '@/lib/adminApi';
import { getErrorMessage, logError } from '@/lib/errorHandlers';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function StaffOrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  const getPaymentStatus = (order) => {
    if (order.payment_status) return order.payment_status;
    if (order.status === 'refunded') return 'refunded';
    if (order.status === 'cancelled') return 'failed';
    if (order.transaction_id || ['processing', 'shipped', 'delivered', 'returned'].includes(order.status)) {
      return 'paid';
    }
    return 'pending';
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: status || undefined,
        search: search || undefined,
      };

      const data = await ordersApi.list(params);

      setOrders(data.orders || data || []);
      setPagination(prev => ({
        ...prev,
        total: data.total || data.length || 0,
      }));
    } catch (err) {
      logError('StaffOrders', 'loading orders', err, { 
        endpoint: '/api/v1/admin/orders',
        params: JSON.stringify(params)
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

  useEffect(() => {
    fetchOrders();
  }, [status, search, pagination.page, pagination.limit]);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Table columns
  const columns = [
    {
      key: 'id',
      label: 'Order ID',
      render: (item) => `#${item.id}`,
    },
    {
      key: 'customer_name',
      label: 'Customer',
    },
    {
      key: 'items',
      label: 'Items',
      render: (item) => `${item.item_count || item.items?.length || 0} items`,
    },
    {
      key: 'total',
      label: 'Amount',
      render: (item) => `₹${(item.total_amount || 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <OrderStatusBadge status={item.status} />,
    },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (item) => {
        const paymentStatus = getPaymentStatus(item);

        return (
        <span className={`px-2 py-1 rounded text-xs ${
          paymentStatus === 'paid' 
            ? 'bg-green-500/20 text-green-400' 
            : paymentStatus === 'refunded'
              ? 'bg-orange-500/20 text-orange-400'
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {paymentStatus}
        </span>
      );
      },
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (item) => new Date(item.created_at).toLocaleDateString('en-IN'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex gap-2">
          <Link
            href={`/admin/orders/${item.id}`}
            className="p-1.5 text-[#F2C29A] hover:text-white transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#EAE0D5]" style={{ fontFamily: 'Cinzel, serif' }}>
            Order Management
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            View and manage customer orders
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7D77]" />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
            className="w-full pl-10 pr-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#8B7D77] focus:outline-none focus:border-[#F2C29A]"
          />
        </div>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#F2C29A]"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-[#1a1a1a] rounded" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : orders.length > 0 ? (
          <DataTable columns={columns} data={orders} />
        ) : (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-[#8B7D77] mx-auto mb-3" />
            <p className="text-[#EAE0D5]/60">No orders found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-[#EAE0D5]/60">
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
            className="px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

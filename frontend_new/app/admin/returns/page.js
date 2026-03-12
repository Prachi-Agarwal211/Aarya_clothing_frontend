'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  RotateCcw, Package, Eye, ChevronRight, Clock, CheckCircle, XCircle, 
  Truck, AlertCircle, Search, Filter, Download, RefreshCw, ArrowUpDown
} from 'lucide-react';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import { returnsApi } from '@/lib/adminApi';
import { 
  STATUS_CONFIG, 
  REASON_LABELS, 
  STATUS_OPTIONS,
  RETURN_STATUS,
  getStatusConfig,
  getReasonLabel 
} from '@/lib/returnConstants';
import logger from '@/lib/logger';

// Icon mapping for status config
const ICON_MAP = {
  Clock,
  CheckCircle,
  XCircle,
  Package,
  AlertCircle,
  Truck,
};

const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'return', label: 'Returns' },
  { value: 'exchange', label: 'Exchanges' },
];

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: '',
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await returnsApi.list(filters);
      setReturns(data.returns || data || []);
    } catch (err) {
      logger.error('Error fetching returns:', err);
      setError('Failed to load returns. Please try again.');
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

  // Filter and sort returns
  const filteredReturns = returns
    .filter(ret => {
      if (filters.status !== 'all' && ret.status !== filters.status) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return (
          `RET-${ret.id.toString().padStart(6, '0')}`.toLowerCase().includes(search) ||
          `#${ret.order_id}`.toLowerCase().includes(search) ||
          ret.description?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  // Calculate stats using correct status values
  const stats = {
    total: returns.length,
    requested: returns.filter(r => r.status === RETURN_STATUS.REQUESTED).length,
    approved: returns.filter(r => r.status === RETURN_STATUS.APPROVED).length,
    received: returns.filter(r => r.status === RETURN_STATUS.RECEIVED).length,
    refunded: returns.filter(r => r.status === RETURN_STATUS.REFUNDED).length,
    totalValue: returns.reduce((sum, r) => sum + (r.refund_amount || 0), 0),
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#F2C29A]">Returns & Exchanges</h1>
            <p className="text-[#EAE0D5]/50 mt-1">Manage customer return and exchange requests</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchReturns}
              className="flex items-center gap-2 px-4 py-2 bg-[#7A2F57]/20 text-[#EAE0D5] rounded-xl hover:bg-[#7A2F57]/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#7A2F57]/20 text-[#EAE0D5] rounded-xl hover:bg-[#7A2F57]/30 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-xl">
            <p className="text-sm text-[#EAE0D5]/50">Total Requests</p>
            <p className="text-2xl font-bold text-[#F2C29A]">{stats.total}</p>
          </div>
          <div className="p-4 bg-[#0B0608]/40 backdrop-blur-md border border-yellow-500/20 rounded-xl">
            <p className="text-sm text-[#EAE0D5]/50">Requested</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.requested}</p>
          </div>
          <div className="p-4 bg-[#0B0608]/40 backdrop-blur-md border border-blue-500/20 rounded-xl">
            <p className="text-sm text-[#EAE0D5]/50">Approved</p>
            <p className="text-2xl font-bold text-blue-400">{stats.approved}</p>
          </div>
          <div className="p-4 bg-[#0B0608]/40 backdrop-blur-md border border-purple-500/20 rounded-xl">
            <p className="text-sm text-[#EAE0D5]/50">Received</p>
            <p className="text-2xl font-bold text-purple-400">{stats.received}</p>
          </div>
          <div className="p-4 bg-[#0B0608]/40 backdrop-blur-md border border-green-500/20 rounded-xl">
            <p className="text-sm text-[#EAE0D5]/50">Refunded</p>
            <p className="text-2xl font-bold text-green-400">{stats.refunded}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-xl">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/30" />
                <input
                  type="text"
                  placeholder="Search by return #, order #, description..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40"
                />
              </div>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
            >
              {STATUS_OPTIONS.map(status => (
                <option key={status.value} value={status.value} className="bg-[#0B0608]">{status.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Returns Table */}
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#B76E79]/15">
                  <th className="text-left p-4 text-[#EAE0D5]/50 font-medium">
                    <button onClick={() => handleSort('id')} className="flex items-center gap-1 hover:text-[#EAE0D5]">
                      Return # <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-[#EAE0D5]/50 font-medium">Order #</th>
                  <th className="text-left p-4 text-[#EAE0D5]/50 font-medium">Reason</th>
                  <th className="text-left p-4 text-[#EAE0D5]/50 font-medium">
                    <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-[#EAE0D5]">
                      Status <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-[#EAE0D5]/50 font-medium">
                    <button onClick={() => handleSort('refund_amount')} className="flex items-center gap-1 hover:text-[#EAE0D5]">
                      Amount <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-[#EAE0D5]/50 font-medium">
                    <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 hover:text-[#EAE0D5]">
                      Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-right p-4 text-[#EAE0D5]/50 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-[#B76E79]/10">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="p-4">
                          <div className="animate-pulse h-4 bg-[#B76E79]/10 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <RotateCcw className="w-12 h-12 text-[#B76E79]/30 mx-auto mb-3" />
                      <p className="text-[#EAE0D5]/50">No return requests found</p>
                    </td>
                  </tr>
                ) : (
                  filteredReturns.map((ret) => {
                    const statusConfig = getStatusConfig(ret.status);
                    const StatusIcon = ICON_MAP[statusConfig.icon] || Clock;
                    
                    return (
                      <tr key={ret.id} className="border-b border-[#B76E79]/10 hover:bg-[#7A2F57]/5">
                        <td className="p-4">
                          <span className="font-mono text-[#F2C29A]">RET-{ret.id.toString().padStart(6, '0')}</span>
                        </td>
                        <td className="p-4">
                          <Link href={`/admin/orders/${ret.order_id}`} className="text-[#B76E79] hover:underline">
                            #{ret.order_id}
                          </Link>
                        </td>
                        <td className="p-4 text-[#EAE0D5]/70 text-sm">
                          {getReasonLabel(ret.reason)}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${statusConfig.bg} ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="p-4 text-[#F2C29A] font-medium">
                          {formatCurrency(ret.refund_amount)}
                        </td>
                        <td className="p-4 text-[#EAE0D5]/70 text-sm">
                          {formatDate(ret.requested_at)}
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/admin/returns/${ret.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[#B76E79] hover:text-[#F2C29A] hover:bg-[#7A2F57]/20 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

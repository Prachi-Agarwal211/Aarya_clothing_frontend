'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RotateCcw, Eye, CheckCircle, XCircle, RefreshCw, Download, Square, CheckSquare, Video
} from 'lucide-react';
import DataTable from '@/components/admin/shared/DataTable';
import { ReturnStatusBadge } from '@/components/admin/shared/StatusBadge';
import { returnsApi } from '@/lib/adminApi';
import {
  RETURN_STATUS,
  getReasonLabel
} from '@/lib/returnConstants';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';

export default function AdminReturnsPage() {
  const router = useRouter();
  const { showAlert } = useAlertToast();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
  });
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

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

  // Filter returns
  const filteredReturns = returns.filter(ret => {
    if (filters.status && ret.status !== filters.status) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        `RET-${ret.id.toString().padStart(6, '0')}`.toLowerCase().includes(search) ||
        `#${ret.order_id}`.toLowerCase().includes(search) ||
        ret.description?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Calculate stats
  const stats = {
    requested: returns.filter(r => r.status === RETURN_STATUS.REQUESTED).length,
    approved: returns.filter(r => r.status === RETURN_STATUS.APPROVED).length,
    received: returns.filter(r => r.status === RETURN_STATUS.RECEIVED).length,
    refunded: returns.filter(r => r.status === RETURN_STATUS.REFUNDED).length,
  };

  // Selection helpers
  const allSelected = filteredReturns.length > 0 && filteredReturns.every(r => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filteredReturns.map(r => r.id)));
  const toggleOne = (id) => { 
    const s = new Set(selected); 
    s.has(id) ? s.delete(id) : s.add(id); 
    setSelected(s); 
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Handle quick approve
  const handleQuickApprove = async (id) => {
    try {
      await returnsApi.approve(id);
      await fetchReturns();
    } catch (err) {
      logger.error('Error approving return:', err);
      showAlert('Failed to approve return');
    }
  };

  // Handle quick reject
  const handleQuickReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await returnsApi.reject(id, reason);
      await fetchReturns();
    } catch (err) {
      logger.error('Error rejecting return:', err);
      showAlert('Failed to reject return');
    }
  };

  // Handle bulk approve
  const handleBulkApprove = async () => {
    if (!confirm(`Approve ${selected.size} return requests?`)) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selected).map(id => returnsApi.approve(id))
      );
      setSelected(new Set());
      await fetchReturns();
    } catch (err) {
      logger.error('Error bulk approving:', err);
      showAlert('Failed to approve some returns');
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle bulk reject
  const handleBulkReject = async () => {
    const reason = prompt('Enter rejection reason for all selected:');
    if (!reason) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selected).map(id => returnsApi.reject(id, reason))
      );
      setSelected(new Set());
      await fetchReturns();
    } catch (err) {
      logger.error('Error bulk rejecting:', err);
      showAlert('Failed to reject some returns');
    } finally {
      setBulkLoading(false);
    }
  };

  // Define columns for DataTable
  const columns = [
    {
      key: 'select',
      label: (
        <button onClick={toggleAll} className="text-[#EAE0D5]/60 hover:text-[#EAE0D5] flex items-center justify-center">
          {allSelected ? <CheckSquare className="w-4 h-4 text-[#B76E79]" /> : <Square className="w-4 h-4" />}
        </button>
      ),
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleOne(row.id); }}
          className="text-[#EAE0D5]/60 hover:text-[#EAE0D5] flex items-center justify-center p-1"
        >
          {selected.has(row.id) ? <CheckSquare className="w-4 h-4 text-[#B76E79]" /> : <Square className="w-4 h-4" />}
        </button>
      ),
    },
    {
      key: 'id',
      label: 'Return #',
      render: (value) => (
        <span className="font-mono text-[#F2C29A]">
          RET-{value.toString().padStart(6, '0')}
        </span>
      ),
    },
    {
      key: 'order_id',
      label: 'Order #',
      render: (value) => (
        <Link href={`/admin/orders/${value}`} className="text-[#B76E79] hover:underline">
          #{value}
        </Link>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <span className="text-[#EAE0D5]/70 text-sm">
            {getReasonLabel(value)}
          </span>
          {row.video_url ? (
            <span title="Video evidence submitted" className="flex items-center">
              <Video className="w-3.5 h-3.5 text-green-400" />
            </span>
          ) : (
            <span title="No video evidence" className="flex items-center">
              <Video className="w-3.5 h-3.5 text-red-400/50" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <ReturnStatusBadge status={value} />,
    },
    {
      key: 'refund_amount',
      label: 'Amount',
      render: (value) => (
        <span className="text-[#F2C29A] font-medium">
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      key: 'requested_at',
      label: 'Date',
      render: (value) => (
        <span className="text-[#EAE0D5]/70 text-sm">
          {formatDate(value)}
        </span>
      ),
    },
  ];

  // Dynamic actions per row
  const getActions = (row) => [
    {
      label: 'View Details',
      icon: Eye,
      onClick: () => router.push(`/admin/returns/${row.id}`),
    },
    ...(row.status === RETURN_STATUS.REQUESTED ? [
      {
        label: 'Approve',
        icon: CheckCircle,
        variant: 'success',
        onClick: () => handleQuickApprove(row.id),
      },
      {
        label: 'Reject',
        icon: XCircle,
        variant: 'danger',
        onClick: () => handleQuickReject(row.id),
      },
    ] : []),
  ];

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#F2C29A] font-['Cinzel']">Returns & Exchanges</h1>
            <p className="text-[#EAE0D5]/50 mt-1">Manage customer return and exchange requests</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchReturns}
              className="flex items-center gap-2 px-4 py-2 bg-[#7A2F57]/20 text-[#EAE0D5] rounded-2xl hover:bg-[#7A2F57]/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <div className="flex items-center gap-1 text-xs text-[#EAE0D5]/50">
              <Video className="w-3 h-3 text-green-400" />
              <span>Has Video</span>
              <Video className="w-3 h-3 text-red-400/50 ml-2" />
              <span>No Video</span>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#7A2F57]/20 text-[#EAE0D5] rounded-2xl hover:bg-[#7A2F57]/30 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Status Summary Cards (Clickable Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => handleFilterChange('status', filters.status === RETURN_STATUS.REQUESTED ? '' : RETURN_STATUS.REQUESTED)}
            className={`p-3 rounded-2xl border transition-all text-center ${
              filters.status === RETURN_STATUS.REQUESTED
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                : 'bg-[#0B0608]/40 border-[#B76E79]/15 text-[#EAE0D5]/70'
            }`}
          >
            <p className="text-lg font-bold">{stats.requested}</p>
            <p className="text-xs">Requested</p>
          </button>
          
          <button
            onClick={() => handleFilterChange('status', filters.status === RETURN_STATUS.APPROVED ? '' : RETURN_STATUS.APPROVED)}
            className={`p-3 rounded-2xl border transition-all text-center ${
              filters.status === RETURN_STATUS.APPROVED
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                : 'bg-[#0B0608]/40 border-[#B76E79]/15 text-[#EAE0D5]/70'
            }`}
          >
            <p className="text-lg font-bold">{stats.approved}</p>
            <p className="text-xs">Approved</p>
          </button>

          <button
            onClick={() => handleFilterChange('status', filters.status === RETURN_STATUS.RECEIVED ? '' : RETURN_STATUS.RECEIVED)}
            className={`p-3 rounded-2xl border transition-all text-center ${
              filters.status === RETURN_STATUS.RECEIVED
                ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                : 'bg-[#0B0608]/40 border-[#B76E79]/15 text-[#EAE0D5]/70'
            }`}
          >
            <p className="text-lg font-bold">{stats.received}</p>
            <p className="text-xs">Received</p>
          </button>

          <button
            onClick={() => handleFilterChange('status', filters.status === RETURN_STATUS.REFUNDED ? '' : RETURN_STATUS.REFUNDED)}
            className={`p-3 rounded-2xl border transition-all text-center ${
              filters.status === RETURN_STATUS.REFUNDED
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-[#0B0608]/40 border-[#B76E79]/15 text-[#EAE0D5]/70'
            }`}
          >
            <p className="text-lg font-bold">{stats.refunded}</p>
            <p className="text-xs">Refunded</p>
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-4 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
            <span className="text-sm text-[#EAE0D5]/60 mr-2">{selected.size} selected</span>
            
            <button
              onClick={handleBulkApprove}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            
            <button
              onClick={handleBulkReject}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>

            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70">
              Clear
            </button>
          </div>
        )}

        {/* DataTable */}
        <DataTable
          columns={columns}
          data={filteredReturns}
          getActions={getActions}
          loading={loading}
          pagination={true}
          emptyMessage="No return requests found"
          emptyIcon={RotateCcw}
        />
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Package,
  Eye,
  Truck,
  XCircle,
  CheckCircle,
  Square,
  CheckSquare,
  FileSpreadsheet,
  Hash,
  Upload,
  AlertCircle,
} from 'lucide-react';
import DataTable from '@/components/admin/shared/DataTable';
import { OrderStatusBadge } from '@/components/admin/shared/StatusBadge';
import { ordersApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

const STATUS_OPTIONS = [
  { value: '', label: 'All Orders' },
  { value: 'confirmed', label: 'Confirmed (Awaiting Shipment)' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [shipModal, setShipModal] = useState({ open: false, orderId: null, podNumber: '', notes: '' });
  const [podUpload, setPodUpload] = useState({ open: false, uploading: false, result: null, error: null });

  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    search: '',
  });

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await ordersApi.list({
        page,
        limit: 20,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      setOrders(data.orders || data || []);
      setTotal(data.total || 0);
    } catch (err) {
      logger.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({ status: '', search: '' });
    setPage(1);
  };

  const allSelected = orders.length > 0 && orders.every(o => selected.has(o.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(orders.map(o => o.id)));
  const toggleOne = (id) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };

  const handleBulkStatus = async (newStatus) => {
    if (!selected.size) return;
    if (newStatus === 'shipped') {
      const pod = prompt(`Enter POD number for ${selected.size} order(s):`);
      if (!pod || !pod.trim()) { alert('POD number is required.'); return; }
      if (!confirm(`Ship ${selected.size} order(s) with POD: ${pod}?`)) return;
      setBulkLoading(true);
      try {
        await ordersApi.bulkUpdate({ order_ids: [...selected], status: 'shipped', pod_number: pod.trim() });
        setSelected(new Set());
        fetchOrders();
      } catch (err) { setError(err?.message || 'Failed to update orders.'); }
      finally { setBulkLoading(false); }
      return;
    }
    if (!confirm(`Update ${selected.size} order(s) to ${newStatus}?`)) return;
    setBulkLoading(true);
    try {
      await ordersApi.bulkUpdate({ order_ids: [...selected], status: newStatus });
      setSelected(new Set());
      fetchOrders();
    } catch (err) {
      logger.error('Error updating orders:', err);
      setError(err?.message || 'Failed to update orders. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    if (newStatus === 'shipped') { handleShipClick(orderId); return; }
    if (!confirm(`Update order #${orderId} to "${newStatus}"?`)) return;
    try {
      setUpdatingOrder(orderId);
      await ordersApi.updateStatus(orderId, { status: newStatus });
      setOrders(prev => prev.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
    } catch (err) {
      logger.error('Error updating order status:', err);
      setError(err?.message || 'Failed to update order status.');
    } finally {
      setUpdatingOrder(null);
    }
  };

  // Get available status transitions — matches backend valid_transitions
  const getStatusActions = (currentStatus) => {
    const transitions = {
      'confirmed': ['shipped', 'cancelled'],
      'shipped':   ['delivered'],
      'delivered': [],  // Terminal — returns handled separately
      'cancelled': [],
    };
    return transitions[currentStatus] || [];
  };

  // Open ship modal instead of direct ship action
  const handleShipClick = (orderId) => {
    setShipModal({ open: true, orderId, podNumber: '', notes: '' });
  };

  const confirmShip = async () => {
    if (!shipModal.podNumber.trim()) {
      alert('POD number is required to ship an order.');
      return;
    }
    try {
      setUpdatingOrder(shipModal.orderId);
      await ordersApi.updateStatus(shipModal.orderId, {
        status: 'shipped',
        pod_number: shipModal.podNumber.trim(),
        notes: shipModal.notes || undefined,
      });
      setOrders(prev => prev.map(o =>
        o.id === shipModal.orderId ? { ...o, status: 'shipped', tracking_number: shipModal.podNumber.trim() } : o
      ));
      setShipModal({ open: false, orderId: null, podNumber: '', notes: '' });
    } catch (err) {
      logger.error('Error shipping order:', err);
      setError(err?.message || 'Failed to ship order.');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleExcelExport = () => {
    const url = ordersApi.exportExcel({ status: filters.status || undefined });
    window.location.href = url;
  };

  const handlePodTemplateDownload = () => {
    window.location.href = ordersApi.downloadPodTemplate();
  };

  const handlePodUpload = async (file) => {
    setPodUpload(prev => ({ ...prev, uploading: true, result: null, error: null }));
    try {
      const result = await ordersApi.uploadPodExcel(file);
      setPodUpload(prev => ({ ...prev, uploading: false, result }));
      fetchOrders();
    } catch (err) {
      setPodUpload(prev => ({ ...prev, uploading: false, error: err.message }));
    }
  };

  // Table columns
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
      label: 'Order ID',
      sortable: true,
      render: (value) => (
        <span className="font-medium text-[#F2C29A]">#{value}</span>
      ),
    },
    {
      key: 'user_id',
      label: 'Customer',
      sortable: true,
      render: (value, row) => (
        <div>
          <span className="text-[#EAE0D5]">{row.customer_name || `User #${value}`}</span>
          <span className="block text-xs text-[#EAE0D5]/50">{row.customer_email || 'customer@email.com'}</span>
        </div>
      ),
    },
    {
      key: 'total_amount',
      label: 'Amount',
      sortable: true,
      render: (value, row) => (
        <div>
          <span className="font-medium text-[#EAE0D5]">{formatCurrency(value)}</span>
          {row.discount_applied > 0 && (
            <span className="block text-xs text-green-400">-{formatCurrency(row.discount_applied)} off</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <OrderStatusBadge status={value} />,
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (value) => (
        <span className="text-[#EAE0D5]/70 text-sm">{formatDate(value)}</span>
      ),
    },
  ];

  // Dynamic table actions based on order status
  const getActions = (row) => {
    const baseActions = [
      {
        label: 'View Details',
        icon: Eye,
        onClick: () => router.push(`/admin/orders/${row.id}`),
      },
    ];

    const availableTransitions = getStatusActions(row.status);

    availableTransitions.forEach(status => {
      const actionMap = {
        'shipped':   { label: 'Ship Order (Enter POD)', icon: Truck, variant: 'info' },
        'delivered': { label: 'Mark Delivered', icon: Package, variant: 'success' },
        'cancelled': { label: 'Cancel Order', icon: XCircle, variant: 'danger' },
      };

      const action = actionMap[status];
      if (action) {
        baseActions.push({
          ...action,
          onClick: () => updateOrderStatus(row.id, status),
          disabled: updatingOrder === row.id,
        });
      }
    });

    return baseActions;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#F2C29A]"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Orders
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Manage and track all customer orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExcelExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
            title="Export orders to Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setPodUpload({ open: true, uploading: false, result: null, error: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors"
            title="Upload POD numbers via Excel"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">POD Upload</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
            <input
              type="text"
              placeholder="Search by Order ID or Customer..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="
                w-full pl-10 pr-4 py-2.5
                bg-[#0B0608]/60 border border-[#B76E79]/20
                rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40
                focus:outline-none focus:border-[#B76E79]/40
                transition-colors text-sm
              "
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="
                pl-10 pr-8 py-2.5
                bg-[#0B0608]/60 border border-[#B76E79]/20
                rounded-xl text-[#EAE0D5]
                focus:outline-none focus:border-[#B76E79]/40
                transition-colors text-sm appearance-none cursor-pointer
              "
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value} className="bg-[#0B0608]">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(filters.status || filters.search) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_OPTIONS.slice(1).map(status => {
          const count = orders.filter(o => o.status === status.value).length;
          return (
            <button
              key={status.value}
              onClick={() => handleFilterChange('status', filters.status === status.value ? '' : status.value)}
              className={`
                p-3 rounded-xl border transition-all text-center
                ${filters.status === status.value
                  ? 'bg-[#7A2F57]/20 border-[#B76E79]/30 text-[#F2C29A]'
                  : 'bg-[#0B0608]/40 border-[#B76E79]/15 text-[#EAE0D5]/70 hover:border-[#B76E79]/30'
                }
              `}
            >
              <p className="text-lg font-bold">{count}</p>
              <p className="text-xs capitalize">{status.label}</p>
            </button>
          );
        })}
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-4 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
          <span className="text-sm text-[#EAE0D5]/60 mr-2">{selected.size} selected</span>
          <button onClick={() => handleBulkStatus('shipped')} disabled={bulkLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 text-xs transition-colors disabled:opacity-50">
            <Truck className="w-3.5 h-3.5" /> Ship (Enter POD)
          </button>
          <button onClick={() => handleBulkStatus('delivered')} disabled={bulkLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs transition-colors disabled:opacity-50">
            <Package className="w-3.5 h-3.5" /> Mark Delivered
          </button>
          <button onClick={() => handleBulkStatus('cancelled')} disabled={bulkLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs transition-colors disabled:opacity-50">
            <XCircle className="w-3.5 h-3.5" /> Cancel
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70">Clear</button>
        </div>
      )}

      {/* Orders Table */}
      <DataTable
        columns={columns}
        data={orders}
        getActions={getActions}
        loading={loading}
        pagination={true}
        pageSize={20}
        onRowClick={(row) => router.push(`/admin/orders/${row.id}`)}
        emptyMessage="No orders found"
      />

      {/* POD Excel Upload Modal */}
      {podUpload.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !podUpload.uploading && setPodUpload({ open: false, uploading: false, result: null, error: null })} />
          <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-semibold text-[#F2C29A] mb-1" style={{ fontFamily: 'Cinzel, serif' }}>POD Excel Upload</h3>
            <p className="text-sm text-[#EAE0D5]/50 mb-5">Download the template, fill in POD/tracking numbers, then upload to bulk-ship confirmed orders.</p>

            {!podUpload.result ? (
              <div className="space-y-4">
                <button
                  onClick={handlePodTemplateDownload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#B76E79]/10 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Step 1: Download Confirmed Orders Template
                </button>
                <div className="relative">
                  <div className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-[#B76E79]/30 rounded-xl text-[#EAE0D5]/50 hover:border-[#B76E79]/50 transition-colors cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePodUpload(f); }}
                    onClick={() => document.getElementById('pod-file-input').click()}
                  >
                    {podUpload.uploading ? (
                      <><RefreshCw className="w-6 h-6 animate-spin text-[#B76E79]" /><p className="text-sm">Processing...</p></>
                    ) : (
                      <><Upload className="w-6 h-6" /><p className="text-sm font-medium">Step 2: Upload filled Excel</p><p className="text-xs">Click or drag & drop .xlsx file</p></>
                    )}
                  </div>
                  <input id="pod-file-input" type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={(e) => { const f = e.target.files[0]; if (f) handlePodUpload(f); }} />
                </div>
                {podUpload.error && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{podUpload.error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <p className="text-green-400 font-semibold">{podUpload.result.message}</p>
                  <p className="text-sm text-[#EAE0D5]/60 mt-1">{podUpload.result.updated} shipped · {podUpload.result.skipped} skipped</p>
                </div>
                {podUpload.result.errors?.length > 0 && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl max-h-32 overflow-y-auto">
                    <p className="text-xs text-yellow-400 font-semibold mb-1">Warnings ({podUpload.result.errors.length}):</p>
                    {podUpload.result.errors.map((e, i) => <p key={i} className="text-xs text-[#EAE0D5]/50">{e}</p>)}
                  </div>
                )}
                <button onClick={() => setPodUpload({ open: false, uploading: false, result: null, error: null })}
                  className="w-full py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white font-semibold">Done</button>
              </div>
            )}

            {!podUpload.result && (
              <button onClick={() => setPodUpload({ open: false, uploading: false, result: null, error: null })}
                disabled={podUpload.uploading}
                className="mt-4 w-full py-2 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/60 hover:text-[#EAE0D5]/80 transition-colors disabled:opacity-40">Cancel</button>
            )}
          </div>
        </div>
      )}

      {/* Ship Order Modal — POD Required */}
      {shipModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShipModal({ open: false, orderId: null, podNumber: '', notes: '' })} />
          <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-[#F2C29A] mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
              Ship Order #{shipModal.orderId}
            </h3>
            <p className="text-sm text-[#EAE0D5]/50 mb-5">Enter the POD (Proof of Delivery) / Courier tracking number. This will be shown to the customer.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#EAE0D5]/70 mb-1">POD / Tracking Number <span className="text-red-400">*</span></label>
                <div className="flex items-center border border-[#B76E79]/30 rounded-xl overflow-hidden">
                  <Hash className="w-4 h-4 text-[#B76E79] ml-3 flex-shrink-0" />
                  <input
                    type="text"
                    value={shipModal.podNumber}
                    onChange={(e) => setShipModal(prev => ({ ...prev, podNumber: e.target.value }))}
                    placeholder="e.g. DTDC1234567890"
                    autoFocus
                    className="flex-1 px-3 py-2.5 bg-transparent text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#EAE0D5]/70 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={shipModal.notes}
                  onChange={(e) => setShipModal(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Courier name, pickup date, etc."
                  className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShipModal({ open: false, orderId: null, podNumber: '', notes: '' })}
                className="flex-1 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmShip}
                disabled={!shipModal.podNumber.trim() || updatingOrder}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                <Truck className="w-4 h-4 inline mr-2" />
                {updatingOrder ? 'Shipping...' : 'Confirm Ship'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-pulse text-[#8A6A5C]">Loading orders...</div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}

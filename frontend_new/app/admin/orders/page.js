'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Filter, RefreshCw, Package, Eye, Truck, XCircle,
  Square, CheckSquare, FileSpreadsheet, Upload,
} from 'lucide-react';
import DataTable from '@/components/admin/shared/DataTable';
import { ordersApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import { useAlertToast } from '@/lib/useAlertToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import ShipOrderModal from '@/components/admin/orders/ShipOrderModal';
import PodUploadModal from '@/components/admin/orders/PodUploadModal';
import ExportOrdersModal from '@/components/admin/orders/ExportOrdersModal';
import { getRedirectForRole, USER_ROLES } from '@/lib/roles';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All orders' },
  { value: 'confirmed', label: 'Confirmed (awaiting shipment)' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_TRANSITIONS = {
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const STATUS_BUTTONS = [
  { value: 'confirmed', label: 'Confirmed', tone: 'blue' },
  { value: 'shipped',   label: 'Shipped',   tone: 'orange' },
  { value: 'delivered', label: 'Delivered', tone: 'green' },
  { value: 'cancelled', label: 'Cancelled', tone: 'red' },
];

const TONE_CLASSES = {
  blue:   { color: 'text-blue-400',   border: 'border-blue-500/20',   activeBg: 'bg-blue-500/20',   activeBorder: 'border-blue-500/40' },
  orange: { color: 'text-orange-400', border: 'border-orange-500/20', activeBg: 'bg-orange-500/20', activeBorder: 'border-orange-500/40' },
  green:  { color: 'text-green-400',  border: 'border-green-500/20',  activeBg: 'bg-green-500/20',  activeBorder: 'border-green-500/40' },
  red:    { color: 'text-red-400',    border: 'border-red-500/20',    activeBg: 'bg-red-500/20',    activeBorder: 'border-red-500/40' },
};

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useAlertToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [page, setPage] = useState(1);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [shipOrderId, setShipOrderId] = useState(null);
  const [podOpen, setPodOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ordersApi.list({
        page,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      });
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setStatusCounts(data.status_counts || {});
      setTotalRevenue(data.total_revenue || 0);
    } catch (err) {
      logger.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => { setPage(1); }, [statusFilter, debouncedSearch]);

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)));
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    if (newStatus === 'shipped') {
      setShipOrderId(orderId);
      return;
    }
    if (!confirm(`Update order #${orderId} to "${newStatus}"?`)) return;
    try {
      setUpdatingOrder(orderId);
      await ordersApi.updateStatus(orderId, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      showAlert('Order status updated', 'success');
      fetchOrders(); // Refresh to update counts
    } catch (err) {
      logger.error('Error updating order status:', err);
      showAlert(err?.message || 'Failed to update order status.', 'error');
    } finally {
       setUpdatingOrder(null);
    }
  };

  const deleteOrder = async (orderId) => {
    if (!confirm(`Are you sure you want to delete order #${orderId}? This will restore inventory quantities and cannot be undone.`)) {
      return;
    }
    
    try {
      await ordersApi.delete(orderId);
      showAlert('Order deleted successfully', 'success');
      fetchOrders();
    } catch (err) {
      logger.error('Error deleting order:', err);
      showAlert(err?.message || 'Failed to delete order.', 'error');
    }
  };

  const bulkDeleteOrders = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} selected order(s)? This action cannot be undone.`)) return;
    
    try {
      setBulkLoading(true);
      const result = await ordersApi.bulkDelete([...selected]);
      showAlert(result.message || `Deleted ${result.deleted} order(s)`, 'success');
      setSelected(new Set());
      fetchOrders();
    } catch (err) {
      logger.error('Error bulk deleting orders:', err);
      showAlert(err?.message || 'Failed to delete orders.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStatus = async (newStatus) => {
    if (!selected.size) return;

    if (newStatus === 'shipped') {
      const courier = prompt(
        `Enter delivery partner for ${selected.size} order(s) (Delhivery, BlueDart, ...):`,
      );
      if (!courier?.trim()) return showAlert('Delivery partner is required.');
      const pod = prompt(`Enter POD / tracking number for ${selected.size} order(s):`);
      if (!pod?.trim()) return showAlert('POD number is required.');
      if (!confirm(`Ship ${selected.size} order(s) via ${courier.trim()} (POD ${pod.trim()})?`)) return;
      setBulkLoading(true);
      try {
        await ordersApi.bulkUpdate({
          order_ids: [...selected],
          status: 'shipped',
          pod_number: pod.trim(),
          courier_name: courier.trim(),
        });
        setSelected(new Set());
        fetchOrders();
        showAlert('Orders marked as shipped', 'success');
      } catch (err) {
        showAlert(err?.message || 'Failed to update orders.', 'error');
      } finally {
        setBulkLoading(false);
      }
      return;
    }

    if (!confirm(`Update ${selected.size} order(s) to ${newStatus}?`)) return;
    setBulkLoading(true);
    try {
      await ordersApi.bulkUpdate({ order_ids: [...selected], status: newStatus });
      setSelected(new Set());
      fetchOrders();
      showAlert('Orders updated successfully', 'success');
    } catch (err) {
      logger.error('Error updating orders:', err);
      showAlert(err?.message || 'Failed to update orders.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const columns = [
    {
      key: 'select',
      label: (
        <button
          onClick={toggleAll}
          className="text-[#EAE0D5]/60 hover:text-[#EAE0D5] flex items-center justify-center"
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-[#B76E79]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
      ),
      sortable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleOne(row.id); }}
          className="text-[#EAE0D5]/60 hover:text-[#EAE0D5] flex items-center justify-center p-1"
        >
          {selected.has(row.id) ? (
            <CheckSquare className="w-4 h-4 text-[#B76E79]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
      ),
    },
    {
      key: 'order_number',
      label: 'Order #',
      sortable: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="text-[#F2C29A] font-medium">{v || `ORD-${row.id.toString().padStart(6, '0')}`}</span>
          <span className="text-[10px] text-[#EAE0D5]/40 font-mono uppercase truncate max-w-[80px]" title={row.razorpay_payment_id}>
            {row.razorpay_payment_id || 'ID: ' + row.id}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (v) => {
        const tone = STATUS_BUTTONS.find(b => b.value === v)?.tone || 'blue';
        const config = TONE_CLASSES[tone];
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${config.color} ${config.activeBg} ${config.activeBorder}`}>
            {v || 'unknown'}
          </span>
        );
      }
    },
    {
      key: 'customer_name',
      label: 'Customer',
      sortable: true,
      render: (v, row) => (
        <div className="flex flex-col max-w-[150px]">
          <span className="text-[#EAE0D5] truncate">{v || 'Guest'}</span>
          <span className="text-[10px] text-[#EAE0D5]/40 truncate">{row.customer_email}</span>
        </div>
      ),
    },
    {
      key: 'customer_phone',
      label: 'Phone',
      render: (v) => <span className="text-[#EAE0D5]/70 text-xs">{v || '-'}</span>,
    },
    {
      key: 'item_count',
      label: 'Items',
      sortable: true,
      render: (v) => <span className="text-[#EAE0D5]/80 font-mono">{v || 0}</span>,
    },
    {
      key: 'total_amount',
      label: 'Total (₹)',
      sortable: true,
      render: (v) => (
        <span className="font-medium text-[#EAE0D5]">
          ₹{Number(v || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (v) => (
        <span className="text-[#EAE0D5]/60 text-xs">{formatDate(v)}</span>
      ),
    },
  ];

  const getActions = (row) => {
    const actions = [
      {
        label: 'View details',
        icon: Eye,
        onClick: () => router.push(`/admin/orders/${row.id}`),
      },
    ];
    const transitions = STATUS_TRANSITIONS[row.status] || [];
    transitions.forEach((status) => {
      const meta = ACTION_META[status];
      if (!meta) return;
      actions.push({
        ...meta,
        onClick: () => updateOrderStatus(row.id, status),
        disabled: updatingOrder === row.id,
      });
    });

    if (!['shipped', 'delivered'].includes(row.status)) {
      actions.push({
        label: 'Delete order',
        icon: XCircle,
        onClick: () => deleteOrder(row.id),
        variant: 'danger',
      });
    }

    return actions;
  };

  return (
    <div className="space-y-6">
      <Header
        loading={loading}
        totalOrders={total}
        totalRevenue={totalRevenue}
        onRefresh={fetchOrders}
        onExport={() => setExportOpen(true)}
        onPodUpload={() => setPodOpen(true)}
      />

      <FiltersBar
        search={search}
        onSearch={setSearch}
        status={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <StatusSummary
        counts={statusCounts}
        active={statusFilter}
        onPick={(s) => setStatusFilter(s === statusFilter ? '' : s)}
      />

      <div className="flex items-center justify-between">
        {selected.size > 0 && (
          <BulkActionsBar
            count={selected.size}
            busy={bulkLoading}
            onShip={() => handleBulkStatus('shipped')}
            onDeliver={() => handleBulkStatus('delivered')}
            onCancel={() => handleBulkStatus('cancelled')}
            onClear={() => setSelected(new Set())}
          />
        )}

        {selected.size > 0 && (
          <button
            onClick={bulkDeleteOrders}
            disabled={bulkLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-500/30 text-red-500 rounded-xl hover:bg-red-600/20 transition-all text-sm font-medium disabled:opacity-50 ml-auto"
          >
            <XCircle size={16} />
            {bulkLoading ? 'Deleting...' : `Delete (${selected.size})`}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={orders}
        getActions={getActions}
        loading={loading}
        pagination
        pageSize={PAGE_SIZE}
        serverSide
        totalCount={total}
        page={page}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/admin/orders/${row.id}`)}
        emptyMessage="No orders found"
      />

      <ShipOrderModal
        orderId={shipOrderId}
        onClose={() => setShipOrderId(null)}
        onShipped={fetchOrders}
        onError={(msg) => showAlert(msg, 'error')}
      />

      <PodUploadModal
        open={podOpen}
        onClose={() => setPodOpen(false)}
        onUploaded={fetchOrders}
      />

      <ExportOrdersModal
        open={exportOpen}
        statusFilter={statusFilter}
        onClose={() => setExportOpen(false)}
        onError={(msg) => showAlert(msg, 'error')}
      />
    </div>
  );
}

const ACTION_META = {
  shipped:   { label: 'Ship order (enter POD)', icon: Truck, variant: 'info' },
  delivered: { label: 'Mark delivered',        icon: Package, variant: 'success' },
  cancelled: { label: 'Cancel order',          icon: XCircle, variant: 'danger' },
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Header({ loading, totalOrders, totalRevenue, onRefresh, onExport, onPodUpload }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            Orders
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">Manage and track all customer orders</p>
        </div>
        
        {/* Statistics Pills */}
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-full">
            <p className="text-[10px] text-[#EAE0D5]/40 uppercase tracking-tighter">Total Orders</p>
            <p className="text-sm font-bold text-[#F2C29A]">{totalOrders}</p>
          </div>
          <div className="px-3 py-1 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-full">
            <p className="text-[10px] text-[#EAE0D5]/40 uppercase tracking-tighter">Filtered Revenue</p>
            <p className="text-sm font-bold text-[#F2C29A]">₹{Number(totalRevenue || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
          title="Refresh orders"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7A2F57]/20 border border-[#B76E79]/25 text-[#F2C29A] hover:bg-[#7A2F57]/35 transition-colors"
          title="Export orders to Excel"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span className="hidden sm:inline text-sm font-medium">Export</span>
        </button>
        <button
          onClick={onPodUpload}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors"
          title="Upload POD numbers via Excel"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline text-sm font-medium">POD upload</span>
        </button>
      </div>
    </div>
  );
}

function FiltersBar({ search, onSearch, status, onStatusChange }) {
  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
          <input
            type="text"
            placeholder="Search by order id or customer..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full md:w-auto pl-10 pr-8 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 transition-colors text-sm appearance-none cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0B0608]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {(status || search) && (
          <button
            onClick={() => { onSearch(''); onStatusChange(''); }}
            className="px-4 py-2.5 text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function StatusSummary({ counts, active, onPick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STATUS_BUTTONS.map((status) => {
        const tone = TONE_CLASSES[status.tone];
        const isActive = active === status.value;
        const count = counts[status.value] || 0;
        
        return (
          <button
            key={status.value}
            onClick={() => onPick(status.value)}
            className={`p-4 rounded-xl border transition-all text-left ${
              isActive
                ? `${tone.activeBg} ${tone.activeBorder}`
                : `bg-[#0B0608]/40 ${tone.border} hover:${tone.activeBg}`
            }`}
          >
            <p className={`text-2xl font-bold ${tone.color}`}>{count}</p>
            <p className={`text-xs mt-0.5 font-medium ${isActive ? tone.color : 'text-[#EAE0D5]/60'}`}>
              {status.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function BulkActionsBar({ count, busy, onShip, onDeliver, onCancel, onClear }) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
      <span className="text-sm text-[#EAE0D5]/60 mr-2">{count} selected</span>
      <button
        onClick={onShip}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 text-xs transition-colors disabled:opacity-50"
      >
        <Truck className="w-3.5 h-3.5" /> Ship (enter POD)
      </button>
      <button
        onClick={onDeliver}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs transition-colors disabled:opacity-50"
      >
        <Package className="w-3.5 h-3.5" /> Mark delivered
      </button>
      <button
        onClick={onCancel}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs transition-colors disabled:opacity-50"
      >
        <XCircle className="w-3.5 h-3.5" /> Cancel
      </button>
      <button
        onClick={onClear}
        className="ml-auto text-xs text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70"
      >
        Clear
      </button>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 bg-[#B76E79]/10 rounded-lg w-48" />
          <div className="h-4 bg-[#B76E79]/10 rounded w-64" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-10 bg-[#B76E79]/10 rounded-xl" />
          <div className="h-10 w-24 bg-[#B76E79]/10 rounded-xl" />
          <div className="h-10 w-24 bg-[#B76E79]/10 rounded-xl" />
        </div>
      </div>

      {/* Status Summary Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-xl" />
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="h-16 bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-2xl" />

      {/* Table Skeleton */}
      <div className="bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-2xl h-[600px]" />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersContent />
    </Suspense>
  );
}

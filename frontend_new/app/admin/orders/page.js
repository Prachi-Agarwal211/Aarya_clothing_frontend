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

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All orders' },
  { value: 'confirmed', label: 'Confirmed (awaiting shipment)' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Allowed forward transitions — mirrors the backend `valid_transitions` map
// in admin order status handler. Keeping this in one place avoids drift.
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

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useAlertToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
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
      setOrders(data.orders || data || []);
      setTotal(data.total || 0);
    } catch (err) {
      logger.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Reset to page 1 whenever filters change so the new query starts at the top.
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
    } catch (err) {
      logger.error('Error updating order status:', err);
      setError(err?.message || 'Failed to update order status.');
    } finally {
      setUpdatingOrder(null);
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
      } catch (err) {
        setError(err?.message || 'Failed to update orders.');
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
    } catch (err) {
      logger.error('Error updating orders:', err);
      setError(err?.message || 'Failed to update orders. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const columns = buildColumns({
    selected,
    allSelected,
    toggleAll,
    toggleOne,
  });

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
    return actions;
  };

  return (
    <div className="space-y-6">
      <Header
        loading={loading}
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
        orders={orders}
        active={statusFilter}
        onPick={(s) => setStatusFilter(s === statusFilter ? '' : s)}
      />

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
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/admin/orders/${row.id}`)}
        emptyMessage="No orders found"
      />

      <ShipOrderModal
        orderId={shipOrderId}
        onClose={() => setShipOrderId(null)}
        onShipped={fetchOrders}
        onError={(msg) => showAlert(msg)}
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
        onError={(msg) => showAlert(msg)}
      />
    </div>
  );
}

const ACTION_META = {
  shipped:   { label: 'Ship order (enter POD)', icon: Truck, variant: 'info' },
  delivered: { label: 'Mark delivered',        icon: Package, variant: 'success' },
  cancelled: { label: 'Cancel order',          icon: XCircle, variant: 'danger' },
};

function buildColumns({ selected, allSelected, toggleAll, toggleOne }) {
  return [
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
      key: 'id',
      label: 'Order ID',
      sortable: true,
      render: (v) => <span className="font-medium text-[#F2C29A]">#{v}</span>,
    },
    {
      key: 'order_number',
      label: 'Order #',
      sortable: true,
      render: (v, row) => <span className="text-[#EAE0D5]">{v || row.id}</span>,
    },
    {
      key: 'customer_email',
      label: 'Customer email',
      sortable: true,
      render: (v) => <span className="text-[#EAE0D5]/80 text-sm">{v || '-'}</span>,
    },
    {
      key: 'customer_name',
      label: 'Customer name',
      sortable: true,
      render: (v) => <span className="text-[#EAE0D5]">{v || '-'}</span>,
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
      key: 'payment_method',
      label: 'Payment',
      render: (v) => (
        <span className="text-[#EAE0D5]/80 text-sm capitalize">{v || '-'}</span>
      ),
    },
    {
      key: 'tracking_number',
      label: 'POD / tracking',
      render: (v, row) => (
        <span className="text-[#EAE0D5]/80 text-sm">
          {v || row.pod_number || '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Order date',
      sortable: true,
      render: (v) => (
        <span className="text-[#EAE0D5]/70 text-sm">{formatDate(v)}</span>
      ),
    },
  ];
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Header({ loading, onRefresh, onExport, onPodUpload }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
          Orders
        </h1>
        <p className="text-[#EAE0D5]/60 mt-1">Manage and track all customer orders</p>
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

const TONE_CLASSES = {
  blue:   { color: 'text-blue-400',   border: 'border-blue-500/20',   activeBg: 'bg-blue-500/20',   activeBorder: 'border-blue-500/40' },
  orange: { color: 'text-orange-400', border: 'border-orange-500/20', activeBg: 'bg-orange-500/20', activeBorder: 'border-orange-500/40' },
  green:  { color: 'text-green-400',  border: 'border-green-500/20',  activeBg: 'bg-green-500/20',  activeBorder: 'border-green-500/40' },
  red:    { color: 'text-red-400',    border: 'border-red-500/20',    activeBg: 'bg-red-500/20',    activeBorder: 'border-red-500/40' },
};

function StatusSummary({ orders, active, onPick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STATUS_BUTTONS.map((status) => {
        const tone = TONE_CLASSES[status.tone];
        const count = orders.filter((o) => o.status === status.value).length;
        const isActive = active === status.value;
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

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <div className="animate-pulse text-[#8A6A5C]">Loading orders...</div>
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}

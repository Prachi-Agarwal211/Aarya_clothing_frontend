'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import {
  Search, RefreshCw, User, Eye, ShoppingBag,
  IndianRupee, AlertCircle, CheckSquare, Square, EyeOff, X,
  Download, ChevronUp, ChevronDown, Users,
} from 'lucide-react';
import { usersApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import { useDebounce } from '@/lib/hooks/useDebounce';
import Pagination from '@/components/admin/Pagination';
import CustomerRow from '@/components/admin/customers/CustomerRow';

const PAGE_SIZE = 20;

const COLUMNS = [
  { key: 'full_name', label: 'Customer', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'order_count', label: 'Orders', sortable: true },
  { key: 'total_spent', label: 'Total spent', sortable: true },
  { key: 'is_active', label: 'Status', sortable: true },
  { key: 'created_at', label: 'Joined', sortable: true },
];

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const escapeCSV = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const copyTimer = useRef(null);

  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  });
  const [sort, setSort] = useState({
    key: searchParams.get('sortBy') || '',
    direction: searchParams.get('sortOrder') || 'asc',
  });

  const debouncedSearch = useDebounce(filters.search, 400);

  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filters.status) params.set('status', filters.status);
    if (page > 1) params.set('page', String(page));
    if (sort.key) {
      params.set('sortBy', sort.key);
      params.set('sortOrder', sort.direction);
    }
    const qs = params.toString();
    window.history.replaceState({}, '', `${pathname}${qs ? `?${qs}` : ''}`);
  }, [debouncedSearch, filters.status, page, sort, pathname]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        role: 'customer',
        limit: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        ...(filters.status ? { is_active: filters.status === 'active' } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(sort.key ? { sort_by: sort.key, sort_order: sort.direction } : {}),
      };
      const [data, countData] = await Promise.all([
        usersApi.list(params),
        usersApi
          .count({
            role: 'customer',
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            ...(filters.status ? { is_active: filters.status === 'active' } : {}),
          })
          .catch(() => ({ count: 0 })),
      ]);
      setCustomers(data.users || data || []);
      setTotal(countData.count || data.users?.length || data.length || 0);
      setSelected(new Set());
    } catch (err) {
      logger.error('Error fetching customers', err);
      setError(err?.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters.status, sort]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    updateURL();
  }, [updateURL]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.status, sort.key, sort.direction]);

  useEffect(() => () => copyTimer.current && clearTimeout(copyTimer.current), []);

  const handleCopy = useCallback(async (text, key) => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      copyTimer.current = setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      logger.error('Copy failed', err);
    }
  }, []);

  const handleSort = (key) => {
    setSort((s) => ({
      key,
      direction: s.key === key && s.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const allSelected =
    customers.length > 0 && customers.every((c) => selected.has(c.id));

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(customers.map((c) => c.id)));

  const toggleOne = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };

  const handleBulkStatus = async (isActive) => {
    if (!selected.size) return;
    if (
      !window.confirm(
        `${isActive ? 'Activate' : 'Deactivate'} ${selected.size} selected customers?`,
      )
    )
      return;
    setBulkLoading(true);
    try {
      await usersApi.bulkStatus([...selected], isActive);
      setSelected(new Set());
      fetchCustomers();
    } catch (err) {
      setError(err?.message || 'Failed to update customers.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExport = () => {
    if (!customers.length) return;
    const headers = [
      'ID',
      'Name',
      'Username',
      'Email',
      'Phone',
      'Orders',
      'Total Spent',
      'Status',
      'Joined',
    ];
    const rows = customers.map((c) => [
      c.id,
      c.full_name,
      c.username,
      c.email,
      c.phone || '',
      c.order_count || 0,
      c.total_spent || 0,
      c.is_active ? 'Active' : 'Inactive',
      formatDate(c.created_at),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({ status: '', search: '' });
    setSort({ key: '', direction: 'asc' });
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Header
        loading={loading}
        onRefresh={fetchCustomers}
        onExport={handleExport}
        canExport={customers.length > 0}
      />

      <StatsRow
        total={total}
        active={customers.filter((c) => c?.is_active === true).length}
        revenue={customers.reduce((sum, c) => sum + (c?.total_spent || 0), 0)}
        orders={customers.reduce((sum, c) => sum + (c?.order_count || 0), 0)}
      />

      <FiltersBar
        filters={filters}
        setFilters={setFilters}
        clearFilters={clearFilters}
      />

      <BulkActionsBar
        allSelected={allSelected}
        selectedCount={selected.size}
        toggleAll={toggleAll}
        clearSelection={() => setSelected(new Set())}
        onActivate={() => handleBulkStatus(true)}
        onDeactivate={() => handleBulkStatus(false)}
        bulkLoading={bulkLoading}
      />

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#B76E79]/10">
                <th className="px-6 py-4 text-left w-10">
                  <button
                    onClick={toggleAll}
                    className="p-2 rounded hover:bg-[#B76E79]/10"
                    aria-label={
                      allSelected ? 'Deselect all' : 'Select all on page'
                    }
                  >
                    {allSelected ? (
                      <CheckSquare className="w-5 h-5 text-[#B76E79]" />
                    ) : (
                      <Square className="w-5 h-5 text-[#EAE0D5]/40" />
                    )}
                  </button>
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-4 text-left text-sm font-medium text-[#EAE0D5]/60 select-none ${col.sortable ? 'cursor-pointer hover:text-[#EAE0D5]' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <span className="text-[#B76E79]">
                          {sort.key === col.key ? (
                            sort.direction === 'asc' ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )
                          ) : (
                            <ChevronUp className="w-3 h-3 opacity-30" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-4 text-right text-sm font-medium text-[#EAE0D5]/60">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-6 py-20 text-center">
                    <RefreshCw className="w-8 h-8 text-[#B76E79]/50 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2}>
                    <EmptyState
                      hasFilters={Boolean(filters.search || filters.status)}
                      onClear={clearFilters}
                    />
                  </td>
                </tr>
              ) : (
                customers.map((row) => (
                  <CustomerRow
                    key={row.id}
                    row={row}
                    selected={selected.has(row.id)}
                    onToggleSelect={() => toggleOne(row.id)}
                    copied={copied}
                    onCopy={handleCopy}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onChange={setPage}
      />
    </div>
  );
}

/* ---------- subcomponents (kept inside file but small) ---------- */

function Header({ loading, onRefresh, onExport, canExport }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A] font-cinzel">
          Customers
        </h1>
        <p className="text-[#EAE0D5]/60 mt-1">
          {PAGE_SIZE} per page · click a row to open the full customer page
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          disabled={!canExport}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button
          onClick={onRefresh}
          className="p-2.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function StatsRow({ total, active, revenue, orders }) {
  const items = [
    { icon: <Users className="w-4 h-4 text-[#B76E79]" />, label: 'Total customers', value: total, accent: 'text-[#F2C29A]' },
    { icon: <User className="w-4 h-4 text-green-400" />, label: 'Active on page', value: active, accent: 'text-green-400' },
    { icon: <IndianRupee className="w-4 h-4 text-[#F2C29A]" />, label: 'Page revenue', value: formatINR(revenue), accent: 'text-[#F2C29A]' },
    { icon: <ShoppingBag className="w-4 h-4 text-[#B76E79]" />, label: 'Page orders', value: orders, accent: 'text-[#F2C29A]' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            {it.icon}
            <p className="text-[#EAE0D5]/60 text-sm">{it.label}</p>
          </div>
          <p className={`text-2xl font-bold ${it.accent}`}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

function FiltersBar({ filters, setFilters, clearFilters }) {
  const hasFilters = filters.search || filters.status;
  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
          />
          {filters.search && (
            <button
              onClick={() => setFilters((p) => ({ ...p, search: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#B76E79]/10 text-[#EAE0D5]/40 hover:text-[#EAE0D5]"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          className="px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm cursor-pointer min-w-[160px]"
        >
          <option value="" className="bg-[#0B0608]">All status</option>
          <option value="active" className="bg-[#0B0608]">Active</option>
          <option value="inactive" className="bg-[#0B0608]">Inactive</option>
        </select>
      </div>
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="text-xs text-[#EAE0D5]/50 hover:text-[#EAE0D5] mt-3"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

function BulkActionsBar({
  allSelected,
  selectedCount,
  toggleAll,
  clearSelection,
  onActivate,
  onDeactivate,
  bulkLoading,
}) {
  if (selectedCount === 0) return null;
  return (
    <div className="bg-[#7A2F57]/10 border border-[#B76E79]/30 rounded-xl p-3 flex flex-wrap items-center gap-3">
      <button
        onClick={toggleAll}
        className="flex items-center gap-2 text-sm text-[#EAE0D5]/70 hover:text-[#EAE0D5]"
      >
        {allSelected ? (
          <CheckSquare className="w-4 h-4 text-[#B76E79]" />
        ) : (
          <Square className="w-4 h-4" />
        )}
        Select all on page
      </button>
      <span className="text-sm text-[#EAE0D5]/60">{selectedCount} selected</span>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={onActivate}
          disabled={bulkLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs disabled:opacity-50"
        >
          <Eye className="w-3.5 h-3.5" /> Activate
        </button>
        <button
          onClick={onDeactivate}
          disabled={bulkLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs disabled:opacity-50"
        >
          <EyeOff className="w-3.5 h-3.5" /> Deactivate
        </button>
        <button
          onClick={clearSelection}
          className="text-xs text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-[#7A2F57]/20 flex items-center justify-center mb-4">
        <Users className="w-10 h-10 text-[#B76E79]/50" />
      </div>
      <h3 className="text-lg font-medium text-[#EAE0D5] mb-2">
        {hasFilters ? 'No customers match your filters' : 'No customers yet'}
      </h3>
      <p className="text-sm text-[#EAE0D5]/50 text-center max-w-sm mb-4">
        {hasFilters
          ? 'Try a different search term or clear the active filters.'
          : 'Customers will appear here once they register on the storefront.'}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="px-4 py-2 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

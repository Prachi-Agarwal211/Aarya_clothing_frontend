'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Filter,
  RefreshCw,
  User,
  Mail,
  Phone,
  Eye,
  ShoppingBag,
  IndianRupee,
  AlertCircle,
  CheckSquare,
  Square,
  EyeOff,
  X,
  Download,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  Users,
  Calendar,
} from 'lucide-react';
import { usersApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import { useDebounce } from '@/lib/hooks/useDebounce';
import CustomerDetailModal from '@/components/admin/customers/CustomerDetailModal';

// Empty State Component
function EmptyState({ searchTerm, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-[#7A2F57]/20 flex items-center justify-center mb-4">
        <Users className="w-10 h-10 text-[#B76E79]/50" />
      </div>
      <h3 className="text-lg font-medium text-[#EAE0D5] mb-2">
        {searchTerm ? 'No customers found' : 'No customers yet'}
      </h3>
      <p className="text-sm text-[#EAE0D5]/50 text-center max-w-sm mb-4">
        {searchTerm
          ? `No customers match "${searchTerm}". Try a different search term.`
          : 'Your customer list is empty. Customers will appear here when they register.'}
      </p>
      {searchTerm && (
        <button
          onClick={onClear}
          className="px-4 py-2 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm"
        >
          Clear Search
        </button>
      )}
    </div>
  );
}

// Filter Badge Component
function FilterBadge({ label, value, onRemove }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A2F57]/20 border border-[#B76E79]/30 text-sm text-[#EAE0D5]/80">
      <span className="text-[#EAE0D5]/50">{label}:</span>
      <span className="capitalize">{value}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 rounded hover:bg-[#B76E79]/20 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Initialize from URL params
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || '';
  const initialPage = parseInt(searchParams.get('page')) || 1;
  const initialSortBy = searchParams.get('sortBy') || '';
  const initialSortOrder = searchParams.get('sortOrder') || 'asc';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const copyTimeoutRef = useRef(null);
  
  const [filters, setFilters] = useState({
    status: initialStatus,
    search: initialSearch,
  });
  
  const [sortConfig, setSortConfig] = useState({
    key: initialSortBy,
    direction: initialSortOrder,
  });

  const pageSize = 10;

  // Debounce the search input
  const debouncedSearch = useDebounce(filters.search, 400);

  // Update URL when filters change
  const updateURL = useCallback((newFilters, newPage, newSort) => {
    const params = new URLSearchParams();
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.status) params.set('status', newFilters.status);
    if (newPage > 1) params.set('page', newPage.toString());
    if (newSort.key) {
      params.set('sortBy', newSort.key);
      params.set('sortOrder', newSort.direction);
    }
    
    const newUrl = `${pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [pathname]);

  // Fetch customers with server-side pagination, search, and sorting
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        role: 'customer',
        limit: pageSize,
        skip: (page - 1) * pageSize,
      };
      
      if (filters.status) {
        params.is_active = filters.status === 'active';
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (sortConfig.key) {
        params.sort_by = sortConfig.key;
        params.sort_order = sortConfig.direction;
      }
      
      const [data, countData] = await Promise.all([
        usersApi.list(params),
        usersApi.count({ 
          role: 'customer', 
          search: debouncedSearch || undefined,
          is_active: filters.status ? filters.status === 'active' : undefined,
        }).catch(() => ({ count: 0 })),
      ]);
      
      setCustomers(data.users || data || []);
      setTotal(countData.count || data.users?.length || data.length || 0);
      setSelected(new Set());
    } catch (err) {
      logger.error('Error fetching customers:', err);
      setError('Failed to load customers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters.status, sortConfig]);

  // Fetch customers when dependencies change
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Update URL when filters/page/sort change (separate from fetch to avoid circular dependencies)
  useEffect(() => {
    updateURL(filters, page, sortConfig);
  }, [filters, page, sortConfig, updateURL]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.status]);

  // Handle sort
  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Copy to clipboard with cleanup
  const handleCopy = useCallback(async (text, id) => {
    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  }, []);

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Bulk selection handlers
  const allSelected = customers.length > 0 && customers.every((c) => selected.has(c.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(customers.map((c) => c.id)));
    }
  };
  const toggleOne = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  // Bulk status update
  const handleBulkStatus = async (isActive) => {
    if (!selected.size) return;
    if (!confirm(`${isActive ? 'Activate' : 'Deactivate'} ${selected.size} selected customers?`)) return;
    
    setBulkLoading(true);
    try {
      await usersApi.bulkStatus([...selected], isActive);
      setSelected(new Set());
      fetchCustomers();
    } catch (err) {
      logger.error('Error updating customers:', err);
      setError(err?.message || 'Failed to update customers');
    } finally {
      setBulkLoading(false);
    }
  };

  // Escape CSV values to handle special characters
  const escapeCSV = (value) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Export to CSV
  const handleExport = () => {
    const headers = ['Name', 'Username', 'Email', 'Phone', 'Orders', 'Total Spent', 'Status', 'Joined'];
    const rows = customers.map((c) => [
      escapeCSV(c.full_name),
      escapeCSV(c.username),
      escapeCSV(c.email),
      escapeCSV(c.phone || 'N/A'),
      escapeCSV(c.order_count || 0),
      escapeCSV(c.total_spent || 0),
      escapeCSV(c.is_active ? 'Active' : 'Inactive'),
      escapeCSV(formatDate(c.created_at)),
    ]);
    
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ status: '', search: '' });
    setPage(1);
    setSortConfig({ key: '', direction: 'asc' });
  };

  // Table columns with sorting
  const columns = [
    {
      key: 'full_name',
      label: 'Customer',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center text-white text-sm font-bold">
            {getInitials(value)}
          </div>
          <div>
            <p className="font-medium text-[#EAE0D5]">{value}</p>
            <p className="text-xs text-[#EAE0D5]/50">@{row.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2 group">
          <a
            href={`mailto:${value}`}
            className="text-[#EAE0D5]/70 hover:text-[#F2C29A] transition-colors flex items-center gap-1"
            title="Send email"
          >
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[180px]">{value}</span>
          </a>
          <button
            onClick={() => handleCopy(value, `email-${row.id}`)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#B76E79]/10 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-all flex items-center justify-center"
            title="Copy email"
          >
            {copiedId === `email-${row.id}` ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (value) =>
        value ? (
          <a
            href={`tel:${value}`}
            className="text-[#EAE0D5]/70 hover:text-[#F2C29A] transition-colors flex items-center gap-1"
            title="Call customer"
          >
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{value}</span>
          </a>
        ) : (
          <span className="text-[#EAE0D5]/30">—</span>
        ),
    },
    {
      key: 'order_count',
      label: 'Orders',
      sortable: true,
      render: (value) => (
        <span className="flex items-center gap-1 text-[#EAE0D5]">
          <ShoppingBag className="w-4 h-4 text-[#B76E79]/50" />
          {value || 0}
        </span>
      ),
    },
    {
      key: 'total_spent',
      label: 'Total Spent',
      sortable: true,
      render: (value) => (
        <span className="flex items-center gap-1 font-medium text-[#F2C29A]">
          <IndianRupee className="w-3 h-3" />
          {(value || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
            value === true
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : 'bg-red-500/20 text-red-400 border-red-500/30'
          }`}
        >
          {value === true ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (value) => (
        <span className="text-[#EAE0D5]/60 text-sm flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(value)}
        </span>
      ),
    },
  ];

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      {/* Customer Detail Modal */}
      <CustomerDetailModal
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#F2C29A]"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Customers
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Manage your customer database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={customers.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={fetchCustomers}
            className="p-2.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[#B76E79]" />
            <p className="text-[#EAE0D5]/60 text-sm">Total Customers</p>
          </div>
          <p className="text-2xl font-bold text-[#F2C29A]">{total}</p>
        </div>
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-green-400" />
            <p className="text-[#EAE0D5]/60 text-sm">Active</p>
          </div>
          <p className="text-2xl font-bold text-green-400">
            {customers.filter((c) => c?.is_active === true).length}
            <span className="text-sm text-[#EAE0D5]/40 ml-1">on page</span>
          </p>
        </div>
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee className="w-4 h-4 text-[#F2C29A]" />
            <p className="text-[#EAE0D5]/60 text-sm">Page Revenue</p>
          </div>
          <p className="text-2xl font-bold text-[#F2C29A]">
            {formatCurrency(
              customers.reduce((sum, c) => sum + (c?.total_spent || 0), 0)
            )}
          </p>
        </div>
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-[#B76E79]" />
            <p className="text-[#EAE0D5]/60 text-sm">Page Orders</p>
          </div>
          <p className="text-2xl font-bold text-[#F2C29A]">
            {customers.reduce((sum, c) => sum + (c?.order_count || 0), 0)}
          </p>
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
              placeholder="Search by name, email, or username..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors text-sm"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#B76E79]/10 text-[#EAE0D5]/40 hover:text-[#EAE0D5] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
            className="px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 transition-colors text-sm appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="" className="bg-[#0B0608]">All Status</option>
            <option value="active" className="bg-[#0B0608]">Active</option>
            <option value="inactive" className="bg-[#0B0608]">Inactive</option>
          </select>
        </div>

        {/* Filter Badges */}
        {(filters.search || filters.status) && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[#B76E79]/10">
            <FilterBadge
              label="Search"
              value={filters.search}
              onRemove={() => setFilters((prev) => ({ ...prev, search: '' }))}
            />
            <FilterBadge
              label="Status"
              value={filters.status}
              onRemove={() => setFilters((prev) => ({ ...prev, status: '' }))}
            />
            <button
              onClick={clearFilters}
              className="text-xs text-[#EAE0D5]/50 hover:text-[#EAE0D5] ml-auto"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Bulk Actions & Pagination Info */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-[#B76E79]/10">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-[#EAE0D5]/70 hover:text-[#EAE0D5]"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-[#B76E79]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Select All on Page
            </button>

            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#EAE0D5]/60">{selected.size} selected</span>
                <button
                  onClick={() => handleBulkStatus(true)}
                  disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs transition-colors disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" /> Activate
                </button>
                <button
                  onClick={() => handleBulkStatus(false)}
                  disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs transition-colors disabled:opacity-50"
                >
                  <EyeOff className="w-3.5 h-3.5" /> Deactivate
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <p className="text-sm text-[#EAE0D5]/60">
            Showing {total > 0 ? startItem : 0}-{endItem} of {total} customers
          </p>
        </div>
      </div>

      {/* Customers Table */}
      <div className="space-y-4">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#B76E79]/10">
                  <th className="px-6 py-4 text-left w-10">
                    <button
                      onClick={toggleAll}
                      className="p-2 rounded hover:bg-[#B76E79]/10 touch-target"
                      aria-label={allSelected ? "Deselect all customers" : "Select all customers"}
                    >
                      {allSelected ? (
                        <CheckSquare className="w-5 h-5 text-[#B76E79]" />
                      ) : (
                        <Square className="w-5 h-5 text-[#EAE0D5]/40" />
                      )}
                    </button>
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-4 text-left text-sm font-medium text-[#EAE0D5]/60 cursor-pointer select-none"
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && (
                          <span className="text-[#B76E79]">
                            {sortConfig.key === col.key ? (
                              sortConfig.direction === 'asc' ? (
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
                  <th className="px-4 py-4 text-left text-sm font-medium text-[#EAE0D5]/60">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-6 py-20 text-center">
                      <RefreshCw className="w-8 h-8 text-[#B76E79]/50 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2}>
                      <EmptyState
                        searchTerm={debouncedSearch}
                        onClear={() => setFilters((prev) => ({ ...prev, search: '' }))}
                      />
                    </td>
                  </tr>
                ) : (
                  customers.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-[#B76E79]/5 hover:bg-[#B76E79]/5 transition-colors ${
                        selected.has(row.id) ? 'bg-[#B76E79]/10' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOne(row.id);
                          }}
                          className="p-2 rounded hover:bg-[#B76E79]/10 touch-target"
                          aria-label={selected.has(row.id) ? `Deselect customer ${row.full_name || row.id}` : `Select customer ${row.full_name || row.id}`}
                          aria-pressed={selected.has(row.id)}
                        >
                          {selected.has(row.id) ? (
                            <CheckSquare className="w-5 h-5 text-[#B76E79]" />
                          ) : (
                            <Square className="w-5 h-5 text-[#EAE0D5]/40" />
                          )}
                        </button>
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-4">
                          {col.render
                            ? col.render(row[col.key], row)
                            : row[col.key]}
                        </td>
                      ))}
                      <td className="px-4 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomerId(row.id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A2F57]/20 border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {total > pageSize && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-4 py-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-[#EAE0D5]/60">
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total || loading}
              className="px-4 py-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

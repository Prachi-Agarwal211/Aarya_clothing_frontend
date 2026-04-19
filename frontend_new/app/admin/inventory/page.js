'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package, Search, RefreshCw, AlertTriangle, XCircle,
  History, Loader2, X, CheckCircle,
} from 'lucide-react';
import { inventoryApi } from '@/lib/adminApi';
import { logError } from '@/lib/errorHandlers';
import InventoryRow from '@/components/admin/inventory/InventoryRow';
import Pagination from '@/components/admin/Pagination';

const TABS = ['All', 'Low Stock', 'Out of Stock', 'Movements'];
const PAGE_SIZE = 20;

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ total: 0, lowStock: 0, outOfStock: 0 });
  const debounceRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3500);
  }, []);

  // Debounce search input → reset to page 1 once it settles.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset page when switching tabs.
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const fetchStats = useCallback(async () => {
    try {
      const [allRes, lowRes, oosRes] = await Promise.all([
        inventoryApi.list({ page: 1, page_size: 1 }),
        inventoryApi.getLowStock(),
        inventoryApi.getOutOfStock(),
      ]);
      setStats({
        total: allRes?.total ?? 0,
        lowStock: lowRes?.total ?? (lowRes?.items?.length ?? 0),
        outOfStock: oosRes?.total ?? (oosRes?.items?.length ?? 0),
      });
    } catch (err) {
      logError('InventoryPage', 'fetching stats', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'Movements') {
        const data = await inventoryApi.getMovements({ limit: 100 });
        setMovements(data.movements || data.items || []);
        setItems([]);
        setTotal(0);
        return;
      }

      let data;
      if (activeTab === 'Low Stock') {
        data = await inventoryApi.getLowStock();
      } else if (activeTab === 'Out of Stock') {
        data = await inventoryApi.getOutOfStock();
      } else {
        data = await inventoryApi.list({
          page,
          page_size: PAGE_SIZE,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        });
      }

      const list = data.items || [];
      // Local search filter for tabs that don't support server-side search.
      const filtered = activeTab === 'All' || !debouncedSearch
        ? list
        : list.filter((it) => {
            const q = debouncedSearch.toLowerCase();
            return (
              it.product_name?.toLowerCase().includes(q) ||
              it.sku?.toLowerCase().includes(q) ||
              it.color?.toLowerCase().includes(q) ||
              it.size?.toLowerCase().includes(q)
            );
          });

      setItems(filtered);
      setTotal(activeTab === 'All' ? (data.total ?? filtered.length) : filtered.length);
    } catch (err) {
      logError('InventoryPage', 'fetching inventory', err, { activeTab, page });
      setError(err?.message || 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRowUpdated = useCallback(() => {
    showToast('Inventory updated.');
    fetchData();
    fetchStats();
  }, [fetchData, fetchStats, showToast]);

  const handleRowError = useCallback(
    (msg) => showToast(msg, 'error'),
    [showToast],
  );

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const showPagination = activeTab === 'All';
  const showSearch = activeTab !== 'Movements';

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm ${toast.type === 'error' ? 'bg-red-500/90' : 'bg-green-500/90'}`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A] font-cinzel">
            Inventory
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Inline edit stock and thresholds — every change is audited
          </p>
        </div>
        <button
          onClick={() => {
            fetchData();
            fetchStats();
          }}
          className="flex items-center gap-2 p-2.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors self-start"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<Package className="w-5 h-5 text-[#F2C29A]" />}
          label="Total SKUs"
          value={stats.total}
          tone="default"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
          label="Low stock"
          value={stats.lowStock}
          tone="warn"
          onClick={() => setActiveTab('Low Stock')}
        />
        <StatCard
          icon={<XCircle className="w-5 h-5 text-red-400" />}
          label="Out of stock"
          value={stats.outOfStock}
          tone="danger"
          onClick={() => setActiveTab('Out of Stock')}
        />
      </div>

      <div className="overflow-x-auto pb-1 -mx-1">
        <div className="flex gap-1 bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-xl p-1 w-fit min-w-full sm:min-w-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#7A2F57]/40 text-[#F2C29A] border border-[#B76E79]/30' : 'text-[#EAE0D5]/60 hover:text-[#EAE0D5]'}`}
            >
              {tab === 'Low Stock' ? (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {tab}
                </span>
              ) : tab === 'Out of Stock' ? (
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  {tab}
                </span>
              ) : tab === 'Movements' ? (
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  {tab}
                </span>
              ) : (
                tab
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {showSearch && (
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
            <input
              type="text"
              placeholder="Search by product name, SKU, size, or color..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#B76E79]/10 text-[#EAE0D5]/40 hover:text-[#EAE0D5] flex items-center justify-center"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Movements' ? (
        <MovementsTable
          movements={movements}
          loading={loading}
          formatDate={formatDate}
        />
      ) : (
        <>
          <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#B76E79]/50 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#EAE0D5]/40">
                <Package className="w-12 h-12 mb-3" />
                <p>
                  {debouncedSearch
                    ? `No results for "${debouncedSearch}"`
                    : activeTab === 'Low Stock'
                      ? 'No low-stock items — everything is well stocked.'
                      : activeTab === 'Out of Stock'
                        ? 'No out-of-stock items.'
                        : 'No inventory records found.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#B76E79]/5 text-[#EAE0D5]/40 text-xs uppercase tracking-wider font-bold">
                      <th className="px-4 py-3">Product / SKU</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Size</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Color</th>
                      <th className="px-4 py-3 text-center">Stock</th>
                      <th className="px-4 py-3 text-center hidden md:table-cell">
                        Reserved
                      </th>
                      <th className="px-4 py-3 text-center hidden lg:table-cell">
                        Threshold
                      </th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B76E79]/5">
                    {items.map((item) => (
                      <InventoryRow
                        key={item.id}
                        item={item}
                        onUpdated={handleRowUpdated}
                        onError={handleRowError}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showPagination && items.length > 0 && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tone, onClick }) {
  const toneClasses =
    tone === 'warn'
      ? 'from-amber-500/10 border-amber-500/20 hover:border-amber-500/40'
      : tone === 'danger'
        ? 'from-red-500/10 border-red-500/20 hover:border-red-500/40'
        : 'from-[#1a0c12] border-[#B76E79]/20';
  const valueColor =
    tone === 'warn' ? 'text-amber-400' : tone === 'danger' ? 'text-red-400' : 'text-[#F2C29A]';

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`bg-gradient-to-br ${toneClasses} to-[#0B0608] border rounded-2xl p-4 flex items-center gap-4 transition-colors text-left`}
    >
      <div className="p-2.5 rounded-xl bg-[#7A2F57]/15 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-[#EAE0D5]/50 text-xs uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      </div>
    </Tag>
  );
}

function MovementsTable({ movements, loading, formatDate }) {
  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-[#B76E79]/10">
        <h2 className="text-base font-semibold text-[#F2C29A] font-cinzel">
          Stock movement history
        </h2>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#B76E79]/50 animate-spin" />
        </div>
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#EAE0D5]/40">
          <History className="w-10 h-10 mb-3" />
          <p>No stock movements recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#B76E79]/5 text-[#EAE0D5]/40 text-xs uppercase tracking-wider font-bold">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Δ Stock</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3">When (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#B76E79]/5">
              {movements.map((m) => {
                const delta = m.delta ?? m.adjustment ?? 0;
                return (
                  <tr key={m.id} className="hover:bg-[#B76E79]/5 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-[#EAE0D5]">
                        {m.product_name || '—'}
                      </p>
                      <p className="text-xs text-[#EAE0D5]/40 font-mono">
                        {m.sku || `INV-${m.variant_id || m.inventory_id}`}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-sm font-bold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-[#EAE0D5]/50'}`}
                      >
                        {delta > 0 ? '+' : ''}
                        {delta}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[#7A2F57]/20 text-[#EAE0D5]/70 capitalize">
                        {m.reason || 'adjustment'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#EAE0D5]/50 max-w-[260px] truncate">
                      {m.notes || '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#EAE0D5]/50">
                      {formatDate(m.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

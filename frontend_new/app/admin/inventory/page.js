'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package, Search, RefreshCw, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, BarChart3, Plus, Edit2, Save,
  X, ArrowUpDown, History, CheckCircle, Loader2,
} from 'lucide-react';
import { inventoryApi, productsApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

const TABS = ['All', 'Low Stock', 'Out of Stock', 'Movements'];

function AdjustStockModal({ item, onClose, onSaved }) {
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('restock');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const adj = parseInt(adjustment);
    if (isNaN(adj) || adj === 0) {
      setError('Please enter a non-zero adjustment value.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await inventoryApi.adjustStock({ sku: item.sku, adjustment: adj, reason, notes });
      onSaved();
    } catch (err) {
      setError(err?.message || 'Failed to adjust stock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0608] border border-[#B76E79]/30 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#B76E79]/20">
          <h2 className="text-lg font-bold text-[#F2C29A] font-cinzel">Adjust Stock</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/60 hover:text-[#EAE0D5]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}
          <div className="p-3 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-xl text-sm space-y-1">
            <p className="text-[#EAE0D5]/60">Product: <span className="text-[#EAE0D5]">{item.product_name}</span></p>
            <p className="text-[#EAE0D5]/60">SKU: <span className="text-[#EAE0D5] font-mono">{item.sku}</span></p>
            <p className="text-[#EAE0D5]/60">Current Stock: <span className="text-[#F2C29A] font-bold">{item.quantity}</span></p>
          </div>

          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">
              Adjustment <span className="text-[#EAE0D5]/40">(positive = add, negative = remove)</span>
            </label>
            <input
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="e.g. 50 or -10"
              required
              className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm"
            />
            {adjustment && !isNaN(parseInt(adjustment)) && (
              <p className="text-xs mt-1 text-[#EAE0D5]/50">
                New stock will be: <span className="text-[#F2C29A] font-bold">{Math.max(0, item.quantity + parseInt(adjustment))}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm"
            >
              <option value="restock">Restock</option>
              <option value="sale">Sale / Order Fulfillment</option>
              <option value="return">Return / Refund</option>
              <option value="damage">Damage / Shrinkage</option>
              <option value="correction">Stock Correction</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add any notes..."
              className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditThresholdModal({ item, onClose, onSaved }) {
  const [threshold, setThreshold] = useState(item.low_stock_threshold || 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await inventoryApi.update(item.id, { low_stock_threshold: parseInt(threshold) });
      onSaved();
    } catch (err) {
      setError(err?.message || 'Failed to update threshold.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0608] border border-[#B76E79]/30 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-[#B76E79]/20">
          <h2 className="text-lg font-bold text-[#F2C29A] font-cinzel">Edit Alert Threshold</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/60 hover:text-[#EAE0D5]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}
          <p className="text-sm text-[#EAE0D5]/60">
            SKU: <span className="font-mono text-[#EAE0D5]">{item.sku}</span>
          </p>
          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">Low Stock Alert Threshold</label>
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm"
            />
            <p className="text-xs text-[#EAE0D5]/40 mt-1">Alert triggers when stock falls at or below this value</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockBadge({ quantity, threshold }) {
  if (quantity === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
        Out of Stock
      </span>
    );
  }
  if (quantity <= threshold) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
        Low Stock
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
      In Stock
    </span>
  );
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [adjustItem, setAdjustItem] = useState(null);
  const [editThresholdItem, setEditThresholdItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ total: 0, lowStock: 0, outOfStock: 0 });
  const allItemsCacheRef = React.useRef(null);
  const cacheTimestampRef = React.useRef(null);
  const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  const isCacheValid = () => {
    if (!allItemsCacheRef.current || !cacheTimestampRef.current) return false;
    return Date.now() - cacheTimestampRef.current < CACHE_EXPIRY_MS;
  };

  const invalidateCache = () => {
    allItemsCacheRef.current = null;
    cacheTimestampRef.current = null;
  };

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'Movements') {
        const data = await inventoryApi.getMovements({ limit: 50 });
        setMovements(data.movements || []);
      } else {
        let data;
        if (activeTab === 'Low Stock') {
          data = await inventoryApi.getLowStock();
        } else if (activeTab === 'Out of Stock') {
          data = await inventoryApi.getOutOfStock();
        } else {
          data = await inventoryApi.list({ limit: 500 });
          // Cache the full list for stats computation
          allItemsCacheRef.current = data.items || [];
          cacheTimestampRef.current = Date.now();
        }
        const currentItems = data.items || [];
        setItems(currentItems);

        // For stats: use cached All tab data if available and valid, otherwise fetch once
        let allItems = allItemsCacheRef.current;
        if (!allItems || allItems.length === 0 || !isCacheValid()) {
          if (activeTab === 'All') {
            allItems = currentItems;
          } else {
            const allData = await inventoryApi.list({ limit: 500 });
            allItems = allData.items || [];
            allItemsCacheRef.current = allItems;
            cacheTimestampRef.current = Date.now();
          }
        }
        const total = allItems.length;
        const low = allItems.filter(i => i.quantity > 0 && i.quantity <= (i.low_stock_threshold || 5)).length;
        const oos = allItems.filter(i => i.quantity === 0).length;
        setStats({ total, lowStock: low, outOfStock: oos });
      }
    } catch (err) {
      logger.error('Inventory fetch error:', err);
      setError(err?.message || 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdjusted = () => {
    setAdjustItem(null);
    showToast('Stock adjusted successfully.');
    fetchData();
  };

  const handleThresholdSaved = () => {
    setEditThresholdItem(null);
    showToast('Threshold updated.');
    fetchData();
  };

  const filtered = items.filter((item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      item.product_name?.toLowerCase().includes(s) ||
      item.sku?.toLowerCase().includes(s) ||
      item.size?.toLowerCase().includes(s) ||
      item.color?.toLowerCase().includes(s)
    );
  });

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm ${toast.type === 'error' ? 'bg-red-500/90' : 'bg-green-500/90'}`}>
          {toast.type === 'error'
            ? <AlertTriangle className="w-4 h-4 shrink-0" />
            : <CheckCircle className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Modals */}
      {adjustItem && (
        <AdjustStockModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSaved={handleAdjusted}
        />
      )}
      {editThresholdItem && (
        <EditThresholdModal
          item={editThresholdItem}
          onClose={() => setEditThresholdItem(null)}
          onSaved={handleThresholdSaved}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A] font-cinzel">Inventory</h1>
          <p className="text-[#EAE0D5]/60 mt-1">Manage stock levels, thresholds, and movements</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 p-2.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors self-start"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-[#1a0c12] to-[#0B0608] border border-[#B76E79]/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-[#7A2F57]/20 flex-shrink-0">
            <Package className="w-5 h-5 text-[#F2C29A]" />
          </div>
          <div>
            <p className="text-[#EAE0D5]/50 text-xs uppercase tracking-wider">Total SKUs</p>
            <p className="text-2xl font-bold text-[#F2C29A]">{stats.total}</p>
          </div>
        </div>
        <button
          className="bg-gradient-to-br from-amber-500/10 to-[#0B0608] border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 hover:border-amber-500/40 transition-colors text-left"
          onClick={() => setActiveTab('Low Stock')}
        >
          <div className="p-2.5 rounded-xl bg-amber-500/15 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[#EAE0D5]/50 text-xs uppercase tracking-wider">Low Stock</p>
            <p className="text-2xl font-bold text-amber-400">{stats.lowStock}</p>
          </div>
        </button>
        <button
          className="bg-gradient-to-br from-red-500/10 to-[#0B0608] border border-red-500/20 rounded-2xl p-4 flex items-center gap-4 hover:border-red-500/40 transition-colors text-left"
          onClick={() => setActiveTab('Out of Stock')}
        >
          <div className="p-2.5 rounded-xl bg-red-500/15 flex-shrink-0">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-[#EAE0D5]/50 text-xs uppercase tracking-wider">Out of Stock</p>
            <p className="text-2xl font-bold text-red-400">{stats.outOfStock}</p>
          </div>
        </button>
      </div>

      {/* Tabs - scrollable on mobile */}
      <div className="overflow-x-auto pb-1 -mx-1">
        <div className="flex gap-1 bg-[#0B0608]/40 border border-[#B76E79]/15 rounded-xl p-1 w-fit min-w-full sm:min-w-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab
                  ? 'bg-[#7A2F57]/40 text-[#F2C29A] border border-[#B76E79]/30'
                  : 'text-[#EAE0D5]/60 hover:text-[#EAE0D5]'
                }`}
            >
              {tab === 'Low Stock' ? (
                <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{tab}</span>
              ) : tab === 'Out of Stock' ? (
                <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />{tab}</span>
              ) : tab === 'Movements' ? (
                <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" />{tab}</span>
              ) : tab}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === 'Movements' && (
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[#B76E79]/10">
            <h2 className="text-base font-semibold text-[#F2C29A] font-cinzel">Stock Movement History</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#B76E79]/50 animate-spin" />
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#EAE0D5]/40">
              <History className="w-10 h-10 mb-3" />
              <p>No stock movements recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#B76E79]/5 text-[#EAE0D5]/40 text-xs uppercase tracking-wider font-bold">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Adjustment</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#B76E79]/5">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-[#B76E79]/5 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-[#EAE0D5]">{m.product_name}</p>
                        <p className="text-xs text-[#EAE0D5]/40 font-mono">{m.sku || `INV-${m.inventory_id}`}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-sm font-bold ${m.adjustment > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {m.adjustment > 0 ? '+' : ''}{m.adjustment}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#7A2F57]/20 text-[#EAE0D5]/70 capitalize">
                          {m.reason || 'adjustment'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#EAE0D5]/50 max-w-[200px] truncate">
                        {m.notes || '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#EAE0D5]/50">{formatDate(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inventory List Tabs */}
      {activeTab !== 'Movements' && (
        <>
          {/* Search */}
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
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#B76E79]/50 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#EAE0D5]/40">
                <Package className="w-12 h-12 mb-3" />
                <p>
                  {search
                    ? `No results for "${search}"`
                    : activeTab === 'Low Stock'
                      ? 'No low stock items — all items are well stocked!'
                      : activeTab === 'Out of Stock'
                        ? 'No out-of-stock items!'
                        : 'No inventory records found.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#B76E79]/5 text-[#EAE0D5]/40 text-xs uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 text-left">Product / SKU</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Size</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Color</th>
                      <th className="px-4 py-3 text-center">Stock</th>
                      <th className="px-4 py-3 text-center hidden md:table-cell">Reserved</th>
                      <th className="px-4 py-3 text-center hidden lg:table-cell">Threshold</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B76E79]/5">
                    {filtered.map((item, idx) => (
                      <tr key={item.id || `product-${item.product_id}-${idx}`} className="hover:bg-[#B76E79]/5 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-medium text-[#EAE0D5] text-sm">{item.product_name}</p>
                          {item.sku ? (
                            <p className="text-xs text-[#EAE0D5]/40 font-mono mt-0.5">{item.sku}</p>
                          ) : (
                            <p className="text-xs text-orange-400/70 font-mono mt-0.5">No inventory record</p>
                          )}
                          {/* Show size/color inline on mobile */}
                          <p className="text-xs text-[#EAE0D5]/50 mt-0.5 sm:hidden">
                            {[item.size, item.color].filter(Boolean).join(' · ') || item.sku ? 'Standard' : 'No inventory'}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#EAE0D5]/70 hidden sm:table-cell">
                          {item.size || <span className="text-[#EAE0D5]/30">—</span>}
                        </td>
                        <td className="px-4 py-4 text-sm text-[#EAE0D5]/70 hidden sm:table-cell">
                          {item.color || <span className="text-[#EAE0D5]/30">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {item.quantity !== null && item.quantity !== undefined ? (
                            <span className={`text-lg font-bold ${item.quantity === 0 ? 'text-red-400' : item.quantity <= item.low_stock_threshold ? 'text-orange-400' : 'text-[#F2C29A]'}`}>
                              {item.quantity}
                            </span>
                          ) : (
                            <span className="text-lg font-bold text-red-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center text-sm text-[#EAE0D5]/50 hidden md:table-cell">
                          {item.reserved_quantity || 0}
                        </td>
                        <td className="px-4 py-4 text-center hidden lg:table-cell">
                          {item.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-sm text-[#EAE0D5]/60">{item.low_stock_threshold || 5}</span>
                              <button
                                onClick={() => setEditThresholdItem(item)}
                                className="p-1 rounded hover:bg-[#B76E79]/10 text-[#EAE0D5]/30 hover:text-[#EAE0D5]/70 transition-colors flex items-center justify-center"
                                title="Edit threshold"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-orange-400/60">No record</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StockBadge quantity={item.quantity || 0} threshold={item.low_stock_threshold || 5} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          {item.id ? (
                            <button
                              onClick={() => setAdjustItem(item)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#7A2F57]/30 to-[#B76E79]/20 border border-[#B76E79]/20 text-[#F2C29A] hover:opacity-80 transition-opacity text-xs font-medium ml-auto"
                            >
                              <ArrowUpDown className="w-3 h-3" />
                              <span className="hidden sm:inline">Adjust</span>
                            </button>
                          ) : (
                            <Link
                              href={`/admin/products/${item.product_id}/edit`}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#7A2F57]/30 to-[#B76E79]/20 border border-[#B76E79]/20 text-[#F2C29A] hover:opacity-80 transition-opacity text-xs font-medium ml-auto"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span className="hidden sm:inline">Add Inventory</span>
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-sm text-[#EAE0D5]/40 text-right">
            {filtered.length} of {items.length} SKUs shown
          </p>
        </>
      )}
    </div>
  );
}

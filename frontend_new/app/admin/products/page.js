'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plus, Search, RefreshCw, Package, Edit, Trash2, Image as ImageIcon,
  AlertCircle, CheckSquare, Square, X, Save,
  Eye, EyeOff, Star, Sparkles, IndianRupee, ChevronDown,
  ChevronRight, Minus, Warehouse, Upload, XCircle, ArrowRight
} from 'lucide-react';
import { productsApi, collectionsApi, categoriesApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const stockBadge = (qty, threshold = 10) => {
  if (qty === 0) return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">Out of Stock</span>;
  if (qty <= threshold) return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Low Stock: {qty} left</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">In Stock: {qty} units</span>;
};

// ─── Modal: Bulk Price Update ────────────────────────────────────────────────
function BulkPriceModal({ selectedIds, onClose, onDone }) {
  const [mode, setMode] = useState('percentage');
  const [value, setValue] = useState('');
  const [mrp, setMrp] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { product_ids: selectedIds };
      if (mode === 'percentage') {
        if (value) payload.price_percentage = parseFloat(value);
        if (mrp) payload.mrp_percentage = parseFloat(mrp);
      } else if (mode === 'adjustment') {
        if (value) payload.price_adjustment = parseFloat(value);
        if (mrp) payload.mrp_adjustment = parseFloat(mrp);
      } else {
        if (value) payload.price = parseFloat(value);
        if (mrp) payload.mrp = parseFloat(mrp);
      }
      await productsApi.bulkPrice(payload);
      onDone();
    } catch (err) {
      setError(err?.message || 'Failed to update prices');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#0B0608] border border-[#B76E79]/30 sm:rounded-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#B76E79]/20 flex-shrink-0">
          <h2 className="text-lg font-bold text-[#F2C29A]">Bulk Price Update</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/60"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            <p className="text-sm text-[#EAE0D5]/60">{selectedIds.length} product(s) selected</p>
            {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-2">Update Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {[['percentage', '% Change'], ['adjustment', '± Amount'], ['set_price', 'Set Price']].map(([m, l]) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`py-2 rounded-lg text-xs border transition-colors ${mode === m ? 'bg-[#7A2F57]/40 border-[#B76E79]/50 text-[#F2C29A]' : 'border-[#B76E79]/20 text-[#EAE0D5]/60 hover:bg-[#B76E79]/10'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">
              {mode === 'percentage' ? 'Price Percentage (e.g. 10 = +10%, -5 = -5%)' : mode === 'adjustment' ? 'Price Amount (e.g. 100 = +₹100, -50 = -₹50)' : 'New Price (₹)'}
            </label>
            <input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm" placeholder="Leave empty to skip" />
          </div>
          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">
              {mode === 'percentage' ? 'MRP Percentage (e.g. 10 = +10%)' : mode === 'adjustment' ? 'MRP Amount (e.g. 100 = +₹100)' : 'New MRP (₹)'}
            </label>
            <input type="number" step="0.01" value={mrp} onChange={e => setMrp(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm" placeholder="Leave empty to skip" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <IndianRupee className="w-4 h-4" />}
              {saving ? 'Updating...' : 'Update Prices'}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
}
// ─── Modal: Variant Management ────────────────────────────────────────────────
function VariantModal({ product, variant, onClose, onSaved }) {
  const isEdit = !!variant;
  const [form, setForm] = useState({
    sku: variant?.sku || '', // Keep empty by default, will auto-generate if missing
    size: variant?.size || '',
    color: variant?.color || '',
    quantity: variant?.quantity || 0,
    low_stock_threshold: variant?.low_stock_threshold || 10,
    price: variant?.price || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Auto-generate Item Code (SKU) if not provided
      const finalSku = form.sku || `PRD-${product.id}-${(form.color || 'STD').substring(0, 3).toUpperCase()}-${(form.size || 'STD').toUpperCase()}-${Date.now().toString().slice(-4)}`;

      const payload = {
        sku: finalSku,
        size: form.size || 'Standard',
        color: form.color || 'Standard',
        quantity: parseInt(form.quantity) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 10,
      };
      if (form.price) payload.price = parseFloat(form.price);

      if (isEdit) {
        await productsApi.updateVariant(product.id, variant.id, payload);
      } else {
        await productsApi.createVariant(product.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err?.message || 'Failed to save variant');
    } finally {
      setSaving(false);
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 h-full">
      <div className="absolute inset-0 bg-[#0B0608]/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#0B0608] border border-[#B76E79]/20 sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#B76E79]/10 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
              {isEdit ? 'Edit Variant' : 'Add Variant'}
            </h2>
            <p className="text-sm text-[#EAE0D5]/50 mt-1">For {product?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#EAE0D5]/50 hover:text-[#EAE0D5] hover:bg-[#B76E79]/10 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id="variant-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#EAE0D5]/70 mb-2">Size</label>
                <input type="text" name="size" value={form.size} onChange={handleChange} placeholder="e.g. M, L, XL"
                  className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-[#EAE0D5]/70 mb-2">Color</label>
                <input type="text" name="color" value={form.color} onChange={handleChange} placeholder="e.g. Red, Blue"
                  className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-2">Item Code <span className="text-[#EAE0D5]/40">(optional - auto-generated)</span></label>
              <input type="text" name="sku" value={form.sku} onChange={handleChange} placeholder="Leave blank to auto-generate"
                className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#EAE0D5]/70 mb-2">Quantity in Stock</label>
                <input type="number" name="quantity" value={form.quantity} onChange={handleChange} min="0" required
                  className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-[#EAE0D5]/70 mb-2">Alert when stock drops below</label>
                <input type="number" name="low_stock_threshold" value={form.low_stock_threshold} onChange={handleChange} min="0" required
                  className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-2">Special Price for this Variant <span className="text-[#EAE0D5]/40">(optional)</span></label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#EAE0D5]/50">₹</span>
                <input type="number" name="price" value={form.price} onChange={handleChange} placeholder={`Default: ₹${product?.price}`} step="0.01"
                  className="w-full pl-8 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors" />
              </div>
              <p className="text-xs text-[#EAE0D5]/40 mt-1.5">Leave blank to use the main product price (₹{product?.price})</p>
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-6 border-t border-[#B76E79]/10 bg-[#0B0608] mt-auto flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm">
            Cancel
          </button>
          <button type="submit" form="variant-form" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Variant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Edit Product ────────────────────────────────────────────────────
function EditProductModal({ product, collections, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product.name || '',
    price: product.price || '',
    mrp: product.mrp || '',
    short_description: product.short_description || '',
    description: product.description || '',
    category_id: product.collection_id || product.category_id || '',
    brand: product.brand || '',
    is_active: product.is_active ?? true,
    is_featured: product.is_featured ?? false,
    is_new_arrival: product.is_new_arrival ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Product name is required'); return; }
    if (!form.price || parseFloat(form.price) <= 0) { setError('Valid price is required'); return; }
    setSaving(true);
    setError('');
    try {
      await productsApi.update(product.id, {
        name: form.name.trim(),
        base_price: parseFloat(form.price),
        mrp: form.mrp ? parseFloat(form.mrp) : null,
        short_description: form.short_description || null,
        description: form.description || null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        brand: form.brand || null,
        is_active: form.is_active,
        is_featured: form.is_featured,
        is_new_arrival: form.is_new_arrival,
      });
      onSaved();
    } catch (err) {
      setError(err?.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 h-full">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-[#0B0608] border border-[#B76E79]/30 sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#B76E79]/15 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Edit Product</h2>
            <p className="text-xs text-[#EAE0D5]/50 mt-0.5 truncate max-w-[240px]">{product.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/admin/products/${product.id}/edit`} target="_blank"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/50 hover:text-[#EAE0D5] hover:border-[#B76E79]/40 text-xs transition-colors"
              title="Open full edit page">
              Full Edit <ArrowRight className="w-3 h-3" />
            </Link>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

          <form id="edit-product-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Product Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required
                className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm" />
            </div>

            {/* Price & MRP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Price *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE0D5]/40 text-sm">₹</span>
                  <input type="number" name="price" value={form.price} onChange={handleChange} min="0.01" step="0.01" required
                    className="w-full pl-7 pr-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">MRP</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE0D5]/40 text-sm">₹</span>
                  <input type="number" name="mrp" value={form.mrp} onChange={handleChange} min="0" step="0.01"
                    className="w-full pl-7 pr-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm" />
                </div>
              </div>
            </div>

            {/* Collection */}
            <div>
              <label className="block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Collection</label>
              <select name="category_id" value={form.category_id} onChange={handleChange}
                className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm appearance-none">
                <option value="">— No Collection —</option>
                {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Brand</label>
              <input name="brand" value={form.brand} onChange={handleChange} placeholder="e.g. Aarya, FabIndia"
                className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm" />
            </div>

            {/* Short description */}
            <div>
              <label className="block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Short Description</label>
              <textarea name="short_description" value={form.short_description} onChange={handleChange} rows={2}
                className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm resize-none" />
            </div>

            {/* Full description */}
            <div>
              <label className="block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Full Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4}
                className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm resize-none" />
            </div>

            {/* Status toggles */}
            <div className="flex flex-wrap gap-4 pt-1">
              {[['is_active', 'Active', Eye], ['is_featured', 'Featured', Star], ['is_new_arrival', 'New Arrival', Sparkles]].map(([key, label, Icon]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name={key} checked={form[key]} onChange={handleChange} className="sr-only" />
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${form[key] ? 'bg-[#B76E79]' : 'bg-[#B76E79]/20'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${form[key] ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <span className="text-sm text-[#EAE0D5]/70">{label}</span>
                </label>
              ))}
            </div>
          </form>
        </div>

        {/* Footer — always visible */}
        <div className="p-4 sm:p-5 border-t border-[#B76E79]/15 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/60 hover:bg-[#B76E79]/10 text-sm transition-colors">Cancel</button>
          <button type="submit" form="edit-product-form" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Expandable Product Row ────────────────────────────────────────────────
// NOTE: Modals are intentionally NOT rendered here — they must live outside
// the <table>/<tbody> context or browsers break position:fixed. The parent
// ProductsPage owns modal state and renders modals at top level.
function ProductRow({ product, collections, onRefresh, selected, onToggleSelect, expanded, onToggleExpand, onEdit, onAddVariant, onEditVariant }) {
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [adjustingStock, setAdjustingStock] = useState(null);
  const [error, setError] = useState('');

  // Load variants when expanded
  useEffect(() => {
    if (expanded && product.id) {
      loadVariants();
    }
  }, [expanded, product.id]);

  const loadVariants = async () => {
    setLoadingVariants(true);
    try {
      const data = await productsApi.getVariants(product.id);
      setVariants(Array.isArray(data) ? data : (data?.variants || []));
    } catch {
      setVariants(product.inventory || []);
    } finally {
      setLoadingVariants(false);
    }
  };

  // Store reload function in ref so parent can trigger after variant save
  // (previously mutated product prop directly which is a React anti-pattern)
  const reloadVariantsRef = useRef(loadVariants);
  reloadVariantsRef.current = loadVariants;

  const handleQuickStockAdjust = async (variant, delta) => {
    setAdjustingStock(variant.id);
    try {
      await productsApi.adjustVariantStock(product.id, variant.id, delta, delta > 0 ? 'restock' : 'adjustment');
      setVariants(prev => prev.map(v =>
        v.id === variant.id ? { ...v, quantity: Math.max(0, v.quantity + delta) } : v
      ));
      onRefresh();
    } catch (err) {
      logger.error('Stock adjustment failed:', err);
      setError('Failed to adjust stock: ' + (err?.message || 'Unknown error'));
    } finally {
      setAdjustingStock(null);
    }
  };

  const handleDeleteVariant = async (variant) => {
    if (!confirm(`Delete this variant (Item Code: ${variant.sku})?`)) return;
    try {
      await productsApi.deleteVariant(product.id, variant.id);
      setVariants(prev => prev.filter(v => v.id !== variant.id));
      onRefresh();
    } catch (err) {
      logger.error('Delete variant failed:', err);
      setError('Failed to delete variant: ' + (err?.message || 'Unknown error'));
    }
  };

  const collectionName = collections.find(c => c.id === (product.collection_id || product.category_id))?.name || '-';

  return (
    <>
      {/* Main Row */}
      <tr className="border-b border-[#B76E79]/10 hover:bg-[#B76E79]/5 transition-colors">
        <td className="p-4">
          <button onClick={onToggleSelect} className="text-[#EAE0D5]/60 hover:text-[#EAE0D5]">
            {selected ? <CheckSquare className="w-4 h-4 text-[#B76E79]" /> : <Square className="w-4 h-4" />}
          </button>
        </td>
        <td className="p-4">
          {product.image_url ? (
            <div className="relative w-12 h-12">
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-cover rounded-lg border border-[#B76E79]/20"
                sizes="48px"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#7A2F57]/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-[#B76E79]/40" />
            </div>
          )}
        </td>
        <td className="p-4">
          <button onClick={onToggleExpand} className="flex items-center gap-2 text-left w-full">
            {expanded ? <ChevronDown className="w-4 h-4 text-[#B76E79]" /> : <ChevronRight className="w-4 h-4 text-[#EAE0D5]/40" />}
            <div>
              <p className="font-medium text-[#EAE0D5] text-sm">{product.name}</p>
              {product.sku && <p className="text-xs text-[#EAE0D5]/40 mt-0.5">Item Code: {product.sku}</p>}
            </div>
          </button>
          <div className="flex gap-1 mt-1 ml-6">
            {product.is_featured && <span className="px-1.5 py-0.5 rounded text-xs bg-[#7A2F57]/30 text-[#F2C29A] border border-[#B76E79]/20">Featured</span>}
            {product.is_new_arrival && <span className="px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400 border border-purple-500/20">New</span>}
          </div>
          {error && <p className="text-xs text-red-400 mt-1 ml-6">{error}</p>}
        </td>
        <td className="p-4 text-sm text-[#EAE0D5]/70">{collectionName !== '-' ? collectionName : 'Uncategorized'}</td>
        <td className="p-4 text-sm font-medium text-[#F2C29A]">{fmt(product.price)}</td>
        <td className="p-4">{stockBadge(product.total_stock || 0)}</td>
        <td className="p-4">
          <span className={`px-2 py-0.5 rounded-full text-xs ${product.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
            {product.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-1">
            {/* Edit button — calls parent callback, modal renders OUTSIDE table */}
            <button
              onClick={() => onEdit(product)}
              className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/60 hover:text-[#F2C29A] transition-colors flex items-center justify-center" title="Edit Product">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={onToggleExpand} className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/60 hover:text-[#EAE0D5] transition-colors flex items-center justify-center" title="Manage Variants / Stock">
              <Warehouse className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Variants Row */}
      {expanded && (
        <tr className="bg-[#0B0608]/60">
          <td colSpan={8} className="p-4">
            <div className="ml-12 border-l-2 border-[#B76E79]/30 pl-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-[#F2C29A]">Inventory Variants</h4>
                <button
                  onClick={() => onAddVariant(product, loadVariants)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#7A2F57]/20 border border-[#B76E79]/30 text-[#F2C29A] hover:bg-[#7A2F57]/40 text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Variant
                </button>
              </div>

              {loadingVariants ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 text-[#B76E79]/50 animate-spin" />
                </div>
              ) : variants.length === 0 ? (
                <div className="text-center py-4 text-[#EAE0D5]/40 text-sm">
                  No variants yet. Add size/color combinations.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#B76E79]/10">
                        <th className="p-2 text-left text-xs text-[#EAE0D5]/50 font-medium">Size</th>
                        <th className="p-2 text-left text-xs text-[#EAE0D5]/50 font-medium">Color</th>
                        <th className="p-2 text-left text-xs text-[#EAE0D5]/50 font-medium">Item Code</th>
                        <th className="p-2 text-left text-xs text-[#EAE0D5]/50 font-medium">Quantity</th>
                        <th className="p-2 text-left text-xs text-[#EAE0D5]/50 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => (
                        <tr key={v.id} className="border-b border-[#B76E79]/5">
                          <td className="p-2 text-xs text-[#EAE0D5]/70">{v.size || '-'}</td>
                          <td className="p-2 text-xs text-[#EAE0D5]/70">{v.color || '-'}</td>
                          <td className="p-2 text-xs font-mono text-[#EAE0D5]/50">{v.sku}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {stockBadge(v.quantity, v.low_stock_threshold)}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleQuickStockAdjust(v, -1)}
                                disabled={adjustingStock === v.id}
                                className="p-1 rounded hover:bg-red-500/10 text-red-400 disabled:opacity-50 flex items-center justify-center"
                                title="Decrease by 1"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleQuickStockAdjust(v, 1)}
                                disabled={adjustingStock === v.id}
                                className="p-1 rounded hover:bg-green-500/10 text-green-400 disabled:opacity-50 flex items-center justify-center"
                                title="Increase by 1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onEditVariant(product, v, loadVariants)}
                                className="p-1 rounded hover:bg-[#B76E79]/10 text-[#EAE0D5]/60 hover:text-[#EAE0D5] flex items-center justify-center"
                                title="Edit Variant"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteVariant(v)}
                                className="p-1 rounded hover:bg-red-500/10 text-red-400/60 hover:text-red-400 flex items-center justify-center"
                                title="Delete Variant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCollection, setFilterCollection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // ── Modal state lifted to page level so modals render OUTSIDE <table> ──
  // This is the critical fix: modals inside <tbody> break position:fixed
  const [editingProduct, setEditingProduct] = useState(null);      // For EditProductModal
  const [variantContext, setVariantContext] = useState(null);       // { product, variant, reloadFn }

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true); setError(null);
      const [pd, cd] = await Promise.all([productsApi.list({ limit: 200 }), collectionsApi.list()]);
      setProducts(Array.isArray(pd) ? pd : pd?.products || []);
      setCollections(Array.isArray(cd) ? cd : cd?.items || cd?.categories || cd?.collections || []);
    } catch { setError('Failed to load products.'); }
    finally { setLoading(false); }
  };

  const filtered = products.filter(p => {
    if (filterCollection && String(p.collection_id || p.category_id) !== filterCollection) return false;
    if (filterStatus === 'active' && !p.is_active) return false;
    if (filterStatus === 'inactive' && p.is_active) return false;
    if (filterStatus === 'low_stock' && !(p.total_stock > 0 && p.total_stock <= 10)) return false;
    if (filterStatus === 'out_of_stock' && p.total_stock !== 0) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.slug?.toLowerCase().includes(s);
    }
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(p => p.id)));
  const toggleOne = (id) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleExpand = (id) => { const e = new Set(expandedRows); e.has(id) ? e.delete(id) : e.add(id); setExpandedRows(e); };

  const handleBulkStatus = async (updates) => {
    if (!selected.size) return;
    setBulkLoading(true);
    try { await productsApi.bulkStatus({ product_ids: [...selected], ...updates }); setSelected(new Set()); fetchData(); }
    finally { setBulkLoading(false); }
  };

  const handleBulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} product(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    try { await productsApi.bulkDelete([...selected]); setSelected(new Set()); fetchData(); }
    finally { setBulkLoading(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await productsApi.delete(p.id);
      fetchData();
    } catch (err) {
      logger.error('Delete product failed:', err);
      setError('Failed to delete product: ' + (err?.message || 'Unknown error'));
    }
  };

  // Stats
  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    lowStock: products.filter(p => p.total_stock > 0 && p.total_stock <= 10).length,
    outOfStock: products.filter(p => p.total_stock === 0).length,
  };

  return (
    <div className="space-y-6">
      {/* ── Modals rendered at page root level — OUTSIDE <table> — critical for position:fixed ── */}
      {showBulkPrice && (
        <BulkPriceModal selectedIds={[...selected]}
          onClose={() => setShowBulkPrice(false)}
          onDone={() => { setShowBulkPrice(false); setSelected(new Set()); fetchData(); }} />
      )}

      {/* Edit Product Modal — lifted out of ProductRow */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          collections={collections}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); fetchData(); }}
        />
      )}

      {/* Variant Modal — lifted out of ProductRow */}
      {variantContext && (
        <VariantModal
          product={variantContext.product}
          variant={variantContext.variant}
          onClose={() => setVariantContext(null)}
          onSaved={() => {
            const reloadFn = variantContext.reloadFn;
            setVariantContext(null);
            if (reloadFn) reloadFn();
            fetchData();
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Products & Stocks</h1>
          <p className="text-[#EAE0D5]/60 mt-1">Manage products and stock levels</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/products/create"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white hover:opacity-90 transition-opacity text-sm font-semibold shadow-lg shadow-[#B76E79]/20"
          >
            <Plus className="w-4 h-4" /> Add Product
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: stats.total, color: 'text-[#F2C29A]', border: 'border-[#B76E79]/20', bg: 'bg-[#7A2F57]/10', Icon: Package },
          { label: 'Active', value: stats.active, color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/5', Icon: Eye },
          { label: 'Low Stock', value: stats.lowStock, color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/5', Icon: AlertCircle },
          { label: 'Out of Stock', value: stats.outOfStock, color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/5', Icon: XCircle },
        ].map(({ label, value, color, border, bg, Icon }) => (
          <div key={label} className={`${bg} backdrop-blur-md border ${border} rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#EAE0D5]/60 text-sm">{label}</p>
              <Icon className={`w-4 h-4 ${color} opacity-70`} />
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
            <input type="text" placeholder="Search products by name or item code…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm" />
          </div>
          <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)}
            className="px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm">
            <option value="">All Categories</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <button onClick={fetchData} className="p-2.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#B76E79]/10">
            <span className="text-sm text-[#EAE0D5]/60">{selected.size} selected</span>
            <button onClick={() => setShowBulkPrice(true)} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A2F57]/20 border border-[#B76E79]/30 text-[#F2C29A] hover:bg-[#7A2F57]/40 text-xs transition-colors disabled:opacity-50">
              <IndianRupee className="w-3.5 h-3.5" /> Bulk Price
            </button>
            <button onClick={() => handleBulkStatus({ is_active: true })} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs transition-colors disabled:opacity-50">
              <Eye className="w-3.5 h-3.5" /> Show in Store
            </button>
            <button onClick={() => handleBulkStatus({ is_active: false })} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 text-xs transition-colors disabled:opacity-50">
              <EyeOff className="w-3.5 h-3.5" /> Hide from Store
            </button>
            <button onClick={() => handleBulkStatus({ is_featured: true })} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A2F57]/20 border border-[#B76E79]/30 text-[#F2C29A] hover:bg-[#7A2F57]/40 text-xs transition-colors disabled:opacity-50">
              <Star className="w-3.5 h-3.5" /> Mark as Featured
            </button>
            <button onClick={() => handleBulkStatus({ is_new_arrival: true })} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 text-xs transition-colors disabled:opacity-50">
              <Sparkles className="w-3.5 h-3.5" /> Mark as New
            </button>
            <button onClick={handleBulkDelete} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs transition-colors disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70">Clear</button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-[#B76E79]/50 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#EAE0D5]/40">
            <Package className="w-12 h-12 mb-3" /><p>No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#B76E79]/15">
                  <th className="p-4 w-10">
                    <button onClick={toggleAll} className="text-[#EAE0D5]/60 hover:text-[#EAE0D5]">
                      {allSelected ? <CheckSquare className="w-4 h-4 text-[#B76E79]" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  {['Image', 'Product Name', 'Collection', 'Price', 'Inventory', 'Status', 'Actions'].map(h => (
                    <th key={h} className="p-4 text-left text-xs text-[#EAE0D5]/50 font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    collections={collections}
                    onRefresh={fetchData}
                    selected={selected.has(p.id)}
                    onToggleSelect={() => toggleOne(p.id)}
                    expanded={expandedRows.has(p.id)}
                    onToggleExpand={() => toggleExpand(p.id)}
                    onEdit={(product) => setEditingProduct(product)}
                    onAddVariant={(product, reloadFn) => setVariantContext({ product, variant: null, reloadFn })}
                    onEditVariant={(product, variant, reloadFn) => setVariantContext({ product, variant, reloadFn })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

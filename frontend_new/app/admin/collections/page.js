'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Plus, Search, RefreshCw, Layers, Edit, Trash2, Image as ImageIcon,
  AlertCircle, CheckSquare, Square, Upload, X, Save, Eye, EyeOff,
  Star, GripVertical, Tag,
} from 'lucide-react';
import { collectionsApi } from '@/lib/adminApi';

// ─── Modal: Add / Edit Category ───────────────────────────────────────────
function CollectionModal({ collection, onClose, onSaved }) {
  const isEdit = !!collection;
  const [form, setForm] = useState({
    name: collection?.name || '',
    description: collection?.description || '',
    display_order: collection?.display_order ?? 0,
    is_active: collection?.is_active ?? true,
    is_featured: collection?.is_featured ?? false,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(collection?.image_url || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let saved;
      const payload = { ...form, display_order: parseInt(form.display_order) || 0 };
      if (isEdit) {
        saved = await collectionsApi.update(collection.id, payload);
      } else {
        saved = await collectionsApi.create(payload);
      }
      // Upload image if selected
      if (imageFile && saved?.id) {
        await collectionsApi.uploadImage(saved.id, imageFile);
      }
      onSaved();
    } catch (err) {
      setError(err?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0608] border border-[#B76E79]/30 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[#B76E79]/20">
          <h2 className="text-xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            {isEdit ? 'Edit Category' : 'Add New Category'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/60 hover:text-[#EAE0D5]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-2">Category Image (R2)</label>
            <label
              className="relative border-2 border-dashed border-[#B76E79]/30 rounded-xl overflow-hidden cursor-pointer hover:border-[#B76E79]/60 transition-colors block"
              style={{ height: '140px' }}
            >
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Category image preview"
                  fill
                  className="object-cover"
                  sizes="140px"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <Upload className="w-8 h-8 text-[#B76E79]/40 mb-2" />
                  <p className="text-sm text-[#EAE0D5]/40">Click to upload image</p>
                  <p className="text-xs text-[#EAE0D5]/25 mt-1">Stored on Cloudflare R2</p>
                </div>
              )}
              {imagePreview && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Upload className="w-6 h-6 text-white" />
                  <span className="text-white text-sm ml-2">Change Image</span>
                </div>
              )}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">Category Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required
                placeholder="e.g., Formal Wear, Casual Collection"
                className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={2}
                className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm resize-none" />
            </div>
            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">Display Order</label>
              <input name="display_order" type="number" min="0" value={form.display_order} onChange={handleChange}
                className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm" />
            </div>
          </div>

          {/* Flags */}
          <div className="flex gap-6">
            {[['is_active', 'Active', Eye], ['is_featured', 'Featured on Homepage', Star]].map(([key, label, Icon]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name={key} checked={form[key]} onChange={handleChange} className="sr-only" />
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form[key] ? 'bg-[#B76E79] border-[#B76E79]' : 'border-[#B76E79]/30 bg-transparent'}`}>
                  {form[key] && <Icon className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-[#EAE0D5]/80">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : isEdit ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CollectionsPage() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editCollection, setEditCollection] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true); setError(null);
      const data = await collectionsApi.list({ active_only: false });
      setCollections(Array.isArray(data) ? data : data?.collections || []);
    } catch { setError('Failed to load categories.'); }
    finally { setLoading(false); }
  };

  const filtered = collections.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.slug?.toLowerCase().includes(s);
  });

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(c => c.id)));
  const toggleOne = (id) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };

  const handleBulkStatus = async (isActive) => {
    if (!selected.size) return;
    setBulkLoading(true);
    try {
      await collectionsApi.bulkStatus([...selected], isActive);
      setSelected(new Set());
      fetchData();
    } finally { setBulkLoading(false); }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete category "${c.name}"? Products in this category will be unassigned.`)) return;
    try { await collectionsApi.delete(c.id); fetchData(); }
    catch (err) { setError(err?.message || 'Failed to delete category.'); }
  };

  const handleReorder = async (id, newOrder) => {
    try {
      await collectionsApi.bulkReorder([{ id, display_order: newOrder }]);
      fetchData();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      {/* Modal */}
      {(showModal || editCollection) && (
        <CollectionModal
          collection={editCollection}
          onClose={() => { setShowModal(false); setEditCollection(null); }}
          onSaved={() => { setShowModal(false); setEditCollection(null); fetchData(); }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            Categories
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Manage product categories for organizing your catalog
          </p>
        </div>
        <button
          onClick={() => { setEditCollection(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/50 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          ['Total', collections.length, 'text-[#F2C29A]'],
          ['Active', collections.filter(c => c.is_active).length, 'text-green-400'],
          ['Featured', collections.filter(c => c.is_featured).length, 'text-yellow-400'],
        ].map(([label, val, cls]) => (
          <div key={label} className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4">
            <p className="text-[#EAE0D5]/60 text-sm">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filters + Bulk Actions */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
            <input
              type="text"
              placeholder="Search categories…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
            />
          </div>
          <button onClick={fetchData} className="p-2.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#B76E79]/10">
            <span className="text-sm text-[#EAE0D5]/60">{selected.size} selected</span>
            <button onClick={() => handleBulkStatus(true)} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs transition-colors disabled:opacity-50">
              <Eye className="w-3.5 h-3.5" /> Activate
            </button>
            <button onClick={() => handleBulkStatus(false)} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 text-xs transition-colors disabled:opacity-50">
              <EyeOff className="w-3.5 h-3.5" /> Deactivate
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70">
              Clear
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-[#B76E79]/50 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#EAE0D5]/40">
          <Layers className="w-12 h-12 mb-3" />
          <p>No categories found</p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#7A2F57]/20 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/40 text-sm transition-colors">
            <Plus className="w-4 h-4" /> Create First Category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            .map((c) => (
              <div key={c.id}
                className={`bg-[#0B0608]/40 backdrop-blur-md border rounded-2xl overflow-hidden transition-all ${
                  selected.has(c.id) ? 'border-[#B76E79]/50 ring-1 ring-[#B76E79]/30' : 'border-[#B76E79]/15 hover:border-[#B76E79]/30'
                }`}
              >
                {/* Image */}
                <div className="relative h-40 bg-[#7A2F57]/10">
                  {c.image_url ? (
                    <Image
                      src={c.image_url}
                      alt={c.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 33vw"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-[#B76E79]/20" />
                    </div>
                  )}
                  {/* Select checkbox overlay */}
                  <button
                    onClick={() => toggleOne(c.id)}
                    className="absolute top-3 left-3 p-1 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
                  >
                    {selected.has(c.id)
                      ? <CheckSquare className="w-4 h-4 text-[#B76E79]" />
                      : <Square className="w-4 h-4" />
                    }
                  </button>
                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {c.is_featured && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/80 text-yellow-900 font-medium">Featured</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-500/80 text-green-900' : 'bg-red-500/80 text-red-100'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#EAE0D5] truncate">{c.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-[#EAE0D5]/40 bg-[#B76E79]/10 px-2 py-0.5 rounded-full">
                        {c.product_count || 0} products
                      </span>
                    </div>
                  </div>
                  {c.description && (
                    <p className="text-xs text-[#EAE0D5]/50 mt-2 line-clamp-2">{c.description}</p>
                  )}

                  {/* Order control */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-[#EAE0D5]/40">Order:</span>
                    <input
                      type="number"
                      min="0"
                      defaultValue={c.display_order || 0}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val !== c.display_order) handleReorder(c.id, val);
                      }}
                      className="w-16 px-2 py-1 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] text-xs focus:outline-none focus:border-[#B76E79]/40"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setEditCollection(c)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#7A2F57]/20 border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors text-xs"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 transition-colors text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

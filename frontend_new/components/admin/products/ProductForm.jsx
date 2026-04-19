'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Plus, RefreshCw, Save, Star, X, PackageX, Package } from 'lucide-react';
import { categoriesApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import DropZone from './DropZone';
import VariantRow from './VariantRow';

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const blankVariant = () => ({
  size: '',
  color: '',
  color_hex: '',
  sku: '',
  quantity: '',
  low_stock_threshold: '10',
  is_active: true,
  image: null,
  image_url: '',
});

/**
 * ProductForm — single source of truth for both Create and Edit pages.
 *
 * The component is intentionally dumb about networking: parents wire `onSubmit`
 * with whatever create/update strategy they need (POST vs PATCH, image upload
 * order, etc.), receiving the validated payload + helpers.
 *
 * Props
 *   mode               'create' | 'edit'
 *   initial            Optional initial form values (edit mode loads these).
 *   initialImages      Existing images: [{ id?, image_url, is_primary? }]
 *   initialVariants    Existing variants in the same shape VariantRow uses.
 *   submitting         Parent-controlled busy flag.
 *   submitError        Parent-controlled error message string.
 *   onSubmit           ({ form, images, variants, primaryIndex,
 *                        deletedImageIds, deletedVariantIds }) => Promise<void>
 *   onMarkOutOfStock   Optional callback (edit-only). Receives no args.
 */
export default function ProductForm({
  mode = 'create',
  initial = {},
  initialImages = [],
  initialVariants = [],
  submitting = false,
  submitError = '',
  onSubmit,
  onMarkOutOfStock,
}) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    name: initial.name || '',
    slug: initial.slug || '',
    description: initial.description || '',
    price: initial.price ?? '',
    mrp: initial.mrp ?? '',
    collection_id: initial.collection_id ?? initial.category_id ?? '',
    is_active: initial.is_active !== false,
    is_featured: !!initial.is_featured,
    is_new_arrival: !!initial.is_new_arrival,
  });

  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionsError, setCollectionsError] = useState(null);

  const [images, setImages] = useState(
    initialImages.map((img) => ({
      id: img.id,
      preview: img.image_url,
      file: null,
      existing: true,
      is_primary: !!img.is_primary,
    }))
  );
  const [primaryIndex, setPrimaryIndex] = useState(() => {
    const idx = initialImages.findIndex((i) => i.is_primary);
    return idx >= 0 ? idx : 0;
  });
  const [deletedImageIds, setDeletedImageIds] = useState([]);

  const [variants, setVariants] = useState(
    initialVariants.length
      ? initialVariants.map((v) => ({
          id: v.id,
          sku: v.sku || '',
          size: v.size || '',
          color: v.color || '',
          color_hex: v.color_hex || '',
          quantity: v.quantity ?? '',
          low_stock_threshold: v.low_stock_threshold ?? '10',
          is_active: v.is_active !== false,
          image: null,
          image_url: v.image_url || '',
        }))
      : []
  );
  const [deletedVariantIds, setDeletedVariantIds] = useState([]);

  const [errors, setErrors] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCollectionsLoading(true);
        const data = await categoriesApi.list();
        if (!mounted) return;
        setCollections(data?.categories || data?.collections || data || []);
      } catch (err) {
        logger.error('[ProductForm] Failed to load collections', err);
        if (mounted) setCollectionsError('Failed to load collections.');
      } finally {
        if (mounted) setCollectionsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (!img.existing && img.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(img.preview);
        }
      });
      variants.forEach((v) => {
        if (v.image?.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(v.image.preview);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    const next = type === 'checkbox' ? checked : value;
    setForm((prev) => {
      if (name === 'name' && !isEdit) {
        return { ...prev, name: value, slug: prev.slug || slugify(value) };
      }
      return { ...prev, [name]: next };
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const addImages = (files) => {
    setImages((prev) => [
      ...prev,
      ...files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        existing: false,
        is_primary: false,
      })),
    ]);
  };

  const removeImage = (idx) => {
    setImages((prev) => {
      const target = prev[idx];
      if (target?.existing && target.id) {
        setDeletedImageIds((d) => [...d, target.id]);
      }
      if (!target?.existing && target?.preview?.startsWith('blob:')) {
        URL.revokeObjectURL(target.preview);
      }
      const next = prev.filter((_, i) => i !== idx);
      if (primaryIndex >= next.length) setPrimaryIndex(Math.max(0, next.length - 1));
      else if (idx < primaryIndex) setPrimaryIndex(primaryIndex - 1);
      return next;
    });
  };

  const addVariant = () => setVariants((prev) => [...prev, blankVariant()]);

  const updateVariant = (idx, next) =>
    setVariants((prev) => prev.map((v, i) => (i === idx ? next : v)));

  const removeVariant = (idx) => {
    setVariants((prev) => {
      const target = prev[idx];
      if (target?.id) setDeletedVariantIds((d) => [...d, target.id]);
      if (target?.image?.preview?.startsWith('blob:')) {
        URL.revokeObjectURL(target.image.preview);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const copyImageToColor = (sourceIdx) => {
    const source = variants[sourceIdx];
    if (!source?.color || (!source.image && !source.image_url)) return;
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i === sourceIdx) return v;
        if ((v.color || '').toLowerCase() !== (source.color || '').toLowerCase()) return v;
        return { ...v, image: source.image, image_url: source.image_url };
      })
    );
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Product name is required';
    const price = parseFloat(form.price);
    if (!form.price || price <= 0) next.price = 'Selling price must be greater than 0';
    if (form.mrp && parseFloat(form.mrp) < price) next.mrp = 'MRP must be ≥ selling price';
    if (!form.collection_id) next.collection_id = 'Collection is required';
    if (variants.length === 0) next.variants = 'Add at least one size/color variant';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      form: {
        ...form,
        slug: form.slug || slugify(form.name),
        price: parseFloat(form.price),
        mrp: form.mrp ? parseFloat(form.mrp) : parseFloat(form.price),
        collection_id: parseInt(form.collection_id, 10),
      },
      images,
      variants,
      primaryIndex,
      deletedImageIds,
      deletedVariantIds,
    });
  };

  const inputCls = (field) =>
    `w-full px-4 py-2.5 bg-[#0B0608]/60 border rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none transition-colors ${
      errors[field] ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'
    }`;

  const cardCls = 'bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6';
  const heading = 'text-lg font-semibold text-[#F2C29A]';

  const totalStock = useMemo(
    () => variants.reduce((sum, v) => sum + (parseInt(v.quantity, 10) || 0), 0),
    [variants]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/admin/products"
          className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className={`${heading} text-2xl md:text-3xl`} style={{ fontFamily: 'Cinzel, serif' }}>
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1 text-sm">
            {isEdit
              ? 'Update product details, images, and variants in place.'
              : 'Create a new product in your catalog.'}
          </p>
        </div>
        {isEdit && onMarkOutOfStock && (
          <button
            type="button"
            onClick={onMarkOutOfStock}
            disabled={submitting || totalStock === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
            title={totalStock === 0 ? 'Already out of stock' : 'Set every variant to 0 quantity'}
          >
            {totalStock === 0 ? <Package className="w-4 h-4" /> : <PackageX className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {totalStock === 0 ? 'Out of stock' : 'Mark out of stock'}
            </span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic info */}
            <div className={cardCls}>
              <h2 className={`${heading} mb-4`} style={{ fontFamily: 'Cinzel, serif' }}>
                Basic Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">
                    Product Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleField}
                    placeholder="e.g. Aarya Silk Saree"
                    className={inputCls('name')}
                  />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                    URL Slug
                    <span className="text-[#EAE0D5]/40 text-xs ml-2">
                      Auto-filled from name; appears in /products/{form.slug || 'slug'}
                    </span>
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={form.slug}
                    onChange={handleField}
                    placeholder="aarya-silk-saree"
                    className={inputCls('slug')}
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleField}
                    placeholder="Single description shown on the product page (materials, fit, care)…"
                    rows={6}
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors resize-y"
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className={cardCls}>
              <h2 className={`${heading} mb-4`} style={{ fontFamily: 'Cinzel, serif' }}>
                Pricing
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">
                    Selling Price <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE0D5]/50">₹</span>
                    <input
                      type="number"
                      name="price"
                      value={form.price}
                      onChange={handleField}
                      min="0.01"
                      step="0.01"
                      placeholder="0"
                      className={`${inputCls('price')} pl-8`}
                    />
                  </div>
                  {errors.price && <p className="text-red-400 text-xs mt-1">{errors.price}</p>}
                </div>
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                    MRP
                    <span className="text-[#EAE0D5]/40 text-xs ml-2">≥ selling price</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE0D5]/50">₹</span>
                    <input
                      type="number"
                      name="mrp"
                      value={form.mrp}
                      onChange={handleField}
                      min="0"
                      step="0.01"
                      placeholder="0"
                      className={`${inputCls('mrp')} pl-8`}
                    />
                  </div>
                  {errors.mrp && <p className="text-red-400 text-xs mt-1">{errors.mrp}</p>}
                </div>
                <div className="p-3 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-xl text-xs text-[#EAE0D5]/70">
                  Total stock across variants:{' '}
                  <span className="text-[#F2C29A] font-semibold">{totalStock}</span>
                </div>
              </div>
            </div>

            {/* Images */}
            <div className={cardCls}>
              <div className="flex items-center justify-between mb-2">
                <h2 className={heading} style={{ fontFamily: 'Cinzel, serif' }}>
                  Product Images
                </h2>
                {images.length > 0 && (
                  <span className="text-xs text-[#EAE0D5]/50">
                    Click the star to choose the primary image
                  </span>
                )}
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {images.map((img, idx) => (
                    <div
                      key={img.id || `new-${idx}`}
                      className="relative aspect-square rounded-xl overflow-hidden bg-[#7A2F57]/10 border border-[#B76E79]/30 group"
                    >
                      <Image
                        src={img.preview}
                        alt={`Image ${idx + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                        unoptimized={img.preview?.startsWith('blob:')}
                      />
                      {idx === primaryIndex && (
                        <span className="absolute top-2 left-2 bg-[#7A2F57] text-[#F2C29A] text-[10px] px-2 py-0.5 rounded shadow font-semibold">
                          Primary
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPrimaryIndex(idx)}
                        title="Set as primary image"
                        className={`absolute bottom-2 left-2 p-1 rounded-lg transition-all ${
                          idx === primaryIndex
                            ? 'text-[#F2C29A] opacity-100'
                            : 'text-white/60 opacity-0 group-hover:opacity-100 hover:text-[#F2C29A]'
                        }`}
                      >
                        <Star className="w-4 h-4" fill={idx === primaryIndex ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/80 rounded-lg text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <DropZone onFiles={addImages} id="product-images" />
            </div>

            {/* Variants */}
            <div
              className={`${cardCls} ${
                errors.variants ? 'border-red-500/50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className={heading} style={{ fontFamily: 'Cinzel, serif' }}>
                    Variants <span className="text-red-400">*</span>
                  </h2>
                  <p className="text-xs text-[#EAE0D5]/50 mt-0.5">
                    Each row is one size+color combination with its own image and stock.
                  </p>
                  {errors.variants && (
                    <p className="text-red-400 text-xs mt-1 font-medium">{errors.variants}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addVariant}
                  className="flex items-center gap-1 text-sm bg-[#B76E79]/20 px-3 py-1.5 rounded-lg text-[#F2C29A] hover:bg-[#B76E79]/40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Variant
                </button>
              </div>

              {variants.length > 0 ? (
                <div className="space-y-3">
                  {variants.map((variant, idx) => (
                    <VariantRow
                      key={variant.id || `new-${idx}`}
                      index={idx}
                      variant={variant}
                      onChange={updateVariant}
                      onRemove={removeVariant}
                      onCopyImageToColor={copyImageToColor}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 border border-dashed border-[#B76E79]/20 rounded-xl text-center">
                  <p className="text-sm text-[#EAE0D5]/50">
                    No variants yet. Click <span className="text-[#F2C29A]">Add Variant</span> to
                    create the first size/color combination.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className={cardCls}>
              <h2 className={`${heading} mb-4`} style={{ fontFamily: 'Cinzel, serif' }}>
                Collection <span className="text-red-400">*</span>
              </h2>
              {collectionsError && (
                <p className="text-red-400 text-xs mb-2">{collectionsError}</p>
              )}
              <select
                name="collection_id"
                value={form.collection_id}
                onChange={handleField}
                disabled={collectionsLoading}
                className={`${inputCls('collection_id')} appearance-none cursor-pointer`}
              >
                <option value="" className="bg-[#0B0608]">
                  {collectionsLoading ? 'Loading…' : 'Select collection'}
                </option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0B0608]">
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.collection_id && (
                <p className="text-red-400 text-xs mt-1">{errors.collection_id}</p>
              )}
            </div>

            <div className={cardCls}>
              <h2 className={`${heading} mb-4`} style={{ fontFamily: 'Cinzel, serif' }}>
                Visibility & Flags
              </h2>
              <div className="space-y-3">
                {[
                  ['is_active', 'Active', 'Visible on storefront'],
                  ['is_featured', 'Featured', 'Shown in homepage Featured row'],
                  ['is_new_arrival', 'New Arrival', 'Shown in New Arrivals section'],
                ].map(([name, label, hint]) => (
                  <label key={name} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name={name}
                      checked={!!form[name]}
                      onChange={handleField}
                      className="w-5 h-5 mt-0.5 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
                    />
                    <div>
                      <span className="text-[#EAE0D5] text-sm">{label}</span>
                      <p className="text-[#EAE0D5]/40 text-xs">{hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {submitError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#7A2F57]/50 border border-[#B76E79]/50 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/70 transition-all disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span className="font-semibold">
                  {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Product'}
                </span>
              </button>
              <Link
                href="/admin/products"
                className="w-full px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-center"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

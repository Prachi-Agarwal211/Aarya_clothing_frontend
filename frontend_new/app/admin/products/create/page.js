'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  Star,
} from 'lucide-react';
import { productsApi, categoriesApi } from '@/lib/adminApi';
import ColorPicker from '@/components/ui/ColorPicker';
import { getHexFromName } from '@/lib/colorMap';
import logger from '@/lib/logger';

const INITIAL_FORM = {
  name: '',
  slug: '',
  short_description: '',
  description: '',
  price: '',
  mrp: '',
  category_id: '',
  brand: '',
  is_active: true,
  is_featured: false,
  is_new_arrival: false,
  meta_title: '',
  meta_description: '',
};

export default function CreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [variants, setVariants] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      setCategoriesError(null);
      const data = await categoriesApi.list();
      setCategories(data.categories || data || []);
    } catch (err) {
      logger.error('Error fetching categories:', err);
      setCategoriesError('Failed to load categories. Please try again.');
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const generateSlug = (name) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    if (name === 'name') {
      setForm(prev => ({ ...prev, name: value, slug: generateSlug(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: newValue }));
    }

    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const addVariant = () => {
    setVariants(prev => [...prev, { size: '', color: '', color_hex: '', quantity: '', sku: '', low_stock_threshold: '10' }]);
  };

  const removeVariant = (index) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index, field, value) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  };

  const handleImageUpload = (e) => {
    processFiles(Array.from(e.target.files).filter(f => f.type.startsWith('image/')));
  };

  const processFiles = (files) => {
    setImages(prev => [...prev, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const removeImage = (index) => {
    setImages(prev => {
      const img = prev[index];
      if (img?.preview?.startsWith('blob:')) URL.revokeObjectURL(img.preview);
      const next = prev.filter((_, i) => i !== index);
      if (primaryIndex >= next.length) setPrimaryIndex(Math.max(0, next.length - 1));
      return next;
    });
  };

  const setPrimary = (index) => setPrimaryIndex(index);

  useEffect(() => {
    return () => images.forEach(img => {
      if (img.preview?.startsWith('blob:')) URL.revokeObjectURL(img.preview);
    });
  }, [images]);

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Product name is required';
    const price = parseFloat(form.price);
    if (!form.price || price <= 0) newErrors.price = 'Selling price must be greater than 0';
    if (form.mrp && parseFloat(form.mrp) < price) newErrors.mrp = 'MRP must be ≥ selling price';
    if (!form.category_id) newErrors.category_id = 'Collection is required';
    if (variants.length === 0) newErrors.variants = 'Please add at least one variant (size/color) before creating the product';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);

      const productData = {
        name: form.name.trim(),
        slug: form.slug || undefined,
        short_description: form.short_description || undefined,
        description: form.description || undefined,
        base_price: parseFloat(form.price),
        mrp: form.mrp ? parseFloat(form.mrp) : undefined,
        category_id: parseInt(form.category_id),
        brand: form.brand || undefined,
        is_active: form.is_active,
        is_featured: form.is_featured,
        is_new_arrival: form.is_new_arrival,
        meta_title: form.meta_title || undefined,
        meta_description: form.meta_description || undefined,
      };

      const result = await productsApi.create(productData);

      if (images.length > 0) {
        const uploadPromises = images.map((img, index) =>
          productsApi.uploadImage(result.id, img.file, index === primaryIndex, form.name)
        );
        await Promise.allSettled(uploadPromises);
      }

      if (variants.length > 0) {
        const variantPromises = variants.map((v, index) => {
          const autoSku = `PRD-${result.id}-${(v.color || 'STD').substring(0, 3).toUpperCase()}-${(v.size || 'STD').toUpperCase()}-${index}`;
          return productsApi.createVariant(result.id, {
            product_id: result.id,
            sku: v.sku || autoSku,
            size: v.size || 'Standard',
            color: v.color || 'Standard',
            color_hex: v.color_hex || null,
            quantity: parseInt(v.quantity) || 0,
            low_stock_threshold: parseInt(v.low_stock_threshold) || 10,
          });
        });
        await Promise.allSettled(variantPromises);
      }

      router.push('/admin/products');
    } catch (err) {
      logger.error('Error creating product:', err);
      setSubmitError(err.message || 'Failed to create product. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (field) =>
    `w-full px-4 py-2.5 bg-[#0B0608]/60 border rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none transition-colors ${
      errors[field] ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/products"
          className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            Add New Product
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">Create a new product in your catalog</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Basic Info */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Basic Information
              </h2>
              <div className="space-y-4">

                {/* Name */}
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">
                    Product Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Aarya Silk Saree"
                    className={inputCls('name')}
                  />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                </div>

                {/* URL Slug */}
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                    URL Slug
                    <span className="text-[#EAE0D5]/40 text-xs ml-2">Auto-generated · visible in product page URL</span>
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={form.slug}
                    onChange={handleChange}
                    placeholder="aarya-silk-saree"
                    className={inputCls('slug')}
                  />
                  {form.slug && (
                    <p className="text-[#EAE0D5]/40 text-xs mt-1">/products/{form.slug}</p>
                  )}
                </div>

                {/* Short Description */}
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                    Short Description
                    <span className="text-[#EAE0D5]/40 text-xs ml-2">Shown on product cards · max 500 chars</span>
                  </label>
                  <textarea
                    name="short_description"
                    value={form.short_description}
                    onChange={handleChange}
                    placeholder="Brief summary shown in listing cards..."
                    rows={2}
                    maxLength={500}
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors resize-none text-sm"
                  />
                  <p className="text-[#EAE0D5]/30 text-xs mt-1 text-right">{form.short_description.length}/500</p>
                </div>

                {/* Full Description */}
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">Full Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Detailed product description, materials, care instructions..."
                    rows={5}
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors resize-none"
                  />
                </div>

                {/* Brand */}
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">Brand / Manufacturer</label>
                  <input
                    type="text"
                    name="brand"
                    value={form.brand}
                    onChange={handleChange}
                    placeholder="e.g. Aarya, FabIndia"
                    className={inputCls('brand')}
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Pricing & Stock
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {/* Selling Price */}
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
                      onChange={handleChange}
                      placeholder="0"
                      min="0.01"
                      step="0.01"
                      className={`w-full pl-8 pr-4 py-2.5 bg-[#0B0608]/60 border rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none transition-colors ${
                        errors.price ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'
                      }`}
                    />
                  </div>
                  {errors.price && <p className="text-red-400 text-xs mt-1">{errors.price}</p>}
                </div>

                {/* MRP */}
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
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className={`w-full pl-8 pr-4 py-2.5 bg-[#0B0608]/60 border rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none transition-colors ${
                        errors.mrp ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'
                      }`}
                    />
                  </div>
                  {errors.mrp && <p className="text-red-400 text-xs mt-1">{errors.mrp}</p>}
                  {form.price && form.mrp && parseFloat(form.mrp) > parseFloat(form.price) && (
                    <p className="text-green-400/70 text-xs mt-1">
                      Discount: {Math.round((1 - parseFloat(form.price) / parseFloat(form.mrp)) * 100)}% off
                    </p>
                  )}
                </div>

                <div className="p-3 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-xl">
                  <p className="text-xs text-[#EAE0D5]/60">
                    📦 Stock is managed per variant below. Add variants with their individual quantities.
                  </p>
                </div>
              </div>
            </div>

            {/* Product Images */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                  Product Images
                </h2>
                {images.length > 0 && (
                  <span className="text-xs text-[#EAE0D5]/50">Click star to set primary image</span>
                )}
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {images.map((img, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-[#7A2F57]/10 border border-[#B76E79]/30 group">
                      <Image
                        src={img.preview}
                        alt={`Product image ${index + 1}`}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                      {index === primaryIndex && (
                        <span className="absolute top-2 left-2 bg-[#7A2F57] text-[#F2C29A] text-[10px] px-2 py-0.5 rounded shadow font-semibold">
                          Primary
                        </span>
                      )}
                      {/* Set primary button */}
                      <button
                        type="button"
                        onClick={() => setPrimary(index)}
                        title="Set as primary image"
                        className={`absolute bottom-2 left-2 p-1 rounded-lg transition-all ${
                          index === primaryIndex
                            ? 'text-[#F2C29A] opacity-100'
                            : 'text-white/60 opacity-0 group-hover:opacity-100 hover:text-[#F2C29A]'
                        }`}
                      >
                        <Star className="w-4 h-4" fill={index === primaryIndex ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/80 rounded-lg text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label
                htmlFor="image-upload"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                  isDragging ? 'border-[#F2C29A] bg-[#B76E79]/20' : 'border-[#B76E79]/30 hover:border-[#B76E79]/60 hover:bg-[#B76E79]/5'
                }`}
              >
                <Upload className={`w-8 h-8 mb-3 ${isDragging ? 'text-[#F2C29A]' : 'text-[#B76E79]/60'}`} />
                <span className="text-sm text-[#EAE0D5] font-medium mb-1">Click to upload or drag & drop</span>
                <span className="text-xs text-[#EAE0D5]/50">JPG, PNG, WebP — multiple images allowed</span>
                <input id="image-upload" type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            {/* Product Variants */}
            <div className={`bg-[#0B0608]/40 backdrop-blur-md border rounded-2xl p-6 ${
              errors.variants ? 'border-red-500/50' : 'border-[#B76E79]/15'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                    Variants <span className="text-red-400">*</span>
                  </h2>
                  <p className="text-xs text-[#EAE0D5]/50 mt-0.5">
                    Add size &amp; color combinations (e.g. Red / S, Blue / M). SKUs are auto-generated.
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
                <div className="space-y-3 mt-4">
                  {variants.map((variant, index) => (
                    <div key={index} className="p-3 bg-[#0B0608]/60 border border-[#B76E79]/10 rounded-xl space-y-3">
                      {/* Row 1: Size + Color */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[#EAE0D5]/50 block mb-1">Size</label>
                          <input
                            type="text"
                            placeholder="S, M, L, XL"
                            value={variant.size}
                            onChange={(e) => updateVariant(index, 'size', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
                          />
                        </div>
                        <div>
                          <ColorPicker
                            value={variant.color_hex || (variant.color ? getHexFromName(variant.color) : null)}
                            onChange={(hex, name) => {
                              updateVariant(index, 'color', name);
                              updateVariant(index, 'color_hex', hex);
                            }}
                            label="Color"
                          />
                          {variant.color && (
                            <p className="text-[11px] text-[#EAE0D5]/50 mt-1">
                              Name: {variant.color}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Row 2: Qty + Low Stock + Delete */}
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4">
                          <label className="text-xs text-[#EAE0D5]/50 block mb-1">Qty</label>
                          <input
                            type="number"
                            placeholder="0"
                            min="0"
                            value={variant.quantity}
                            onChange={(e) => updateVariant(index, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
                          />
                        </div>
                        <div className="col-span-7">
                          <label className="text-xs text-[#EAE0D5]/50 block mb-1">Low Stock Alert</label>
                          <input
                            type="number"
                            placeholder="10"
                            min="0"
                            value={variant.low_stock_threshold}
                            onChange={(e) => updateVariant(index, 'low_stock_threshold', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
                          />
                        </div>
                        <div className="col-span-1 flex items-end pb-0.5">
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="w-full p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-8 border rounded-xl text-center mt-4 ${
                  errors.variants 
                    ? 'border-red-500/30 bg-red-500/5' 
                    : 'border-dashed border-[#B76E79]/20'
                }`}>
                  <p className={`text-sm ${
                    errors.variants ? 'text-red-400 font-medium' : 'text-[#EAE0D5]/50'
                  }`}>
                    {errors.variants 
                      ? errors.variants
                      : 'No variants yet. Click "Add Variant" to create size/color combinations.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Collection */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Collection <span className="text-red-400">*</span>
              </h2>
              {categoriesError && (
                <p className="text-red-400 text-xs mb-2">{categoriesError}</p>
              )}
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                disabled={categoriesLoading}
                className={`w-full px-4 py-2.5 bg-[#0B0608]/60 border rounded-xl text-[#EAE0D5] focus:outline-none transition-colors appearance-none cursor-pointer ${
                  errors.category_id ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'
                }`}
              >
                <option value="" className="bg-[#0B0608]">
                  {categoriesLoading ? 'Loading...' : 'Select Collection'}
                </option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-[#0B0608]">{cat.name}</option>
                ))}
              </select>
              {errors.category_id && <p className="text-red-400 text-xs mt-1">{errors.category_id}</p>}
            </div>

            {/* Status & Flags */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Status & Flags
              </h2>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
                  />
                  <div>
                    <span className="text-[#EAE0D5] text-sm">Active</span>
                    <p className="text-[#EAE0D5]/40 text-xs">Visible to customers on the storefront</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_featured"
                    checked={form.is_featured}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
                  />
                  <div>
                    <span className="text-[#EAE0D5] text-sm">Featured</span>
                    <p className="text-[#EAE0D5]/40 text-xs">Shown on homepage Featured section</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_new_arrival"
                    checked={form.is_new_arrival}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
                  />
                  <div>
                    <span className="text-[#EAE0D5] text-sm">New Arrival</span>
                    <p className="text-[#EAE0D5]/40 text-xs">Shown in New Arrivals section</p>
                  </div>
                </label>
              </div>
            </div>

            {/* SEO */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                SEO Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                    Meta Title
                    <span className="text-[#EAE0D5]/40 text-xs ml-2">50–60 chars ideal</span>
                  </label>
                  <input
                    type="text"
                    name="meta_title"
                    value={form.meta_title}
                    onChange={handleChange}
                    placeholder="Title shown in search engines"
                    maxLength={80}
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors text-sm"
                  />
                  <p className={`text-xs mt-1 text-right ${form.meta_title.length > 60 ? 'text-amber-400' : 'text-[#EAE0D5]/30'}`}>
                    {form.meta_title.length}/80
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                    Meta Description
                    <span className="text-[#EAE0D5]/40 text-xs ml-2">150–160 chars ideal</span>
                  </label>
                  <textarea
                    name="meta_description"
                    value={form.meta_description}
                    onChange={handleChange}
                    placeholder="Description shown in search results"
                    rows={3}
                    maxLength={200}
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors resize-none text-sm"
                  />
                  <p className={`text-xs mt-1 text-right ${form.meta_description.length > 160 ? 'text-amber-400' : 'text-[#EAE0D5]/30'}`}>
                    {form.meta_description.length}/200
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                onClick={() => setSubmitError('')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#7A2F57]/50 border border-[#B76E79]/50 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/70 hover:shadow-[0_0_15px_rgba(183,110,121,0.2)] transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span className="font-semibold">{loading ? 'Saving...' : 'Save Product'}</span>
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

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  Eye,
  Star,
  Sparkles,
  StarIcon,
} from 'lucide-react';
import { productsApi, categoriesApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id;

  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [productName, setProductName] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    short_description: '',
    price: '',
    mrp: '',
    category_id: '',
    brand: '',
    is_active: true,
    is_featured: false,
    is_new_arrival: false,
    meta_title: '',
    meta_description: '',
  });
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (productSlugOrId) {
      fetchProduct();
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSlugOrId]);

  const fetchProduct = async () => {
    try {
      setLoadingProduct(true);
      setError(null);
      setAuthError(false);

      // Validate product identifier
      if (!productSlugOrId || productSlugOrId === 'undefined' || productSlugOrId === 'null') {
        throw new Error(`Invalid product identifier: ${productSlugOrId}. The URL might be malformed.`);
      }

      logger.info(`[EditProduct] Fetching product with identifier: ${productSlugOrId}`);
      
      // Fetch product - try slug endpoint first via customer API
      let product;
      try {
        // Use fetch directly with slug endpoint
        const response = await fetch(`/api/v1/products/slug/${productSlugOrId}`, {
          credentials: 'include',
        });
        if (response.ok) {
          product = await response.json();
        } else {
          // Fallback to numeric ID
          product = await productsApi.get(productSlugOrId);
        }
      } catch (err) {
        // Final fallback to admin API with numeric ID
        product = await productsApi.get(productSlugOrId);
      }
      
      logger.info(`[EditProduct] Product fetched successfully:`, {
        id: product.id,
        name: product.name,
        slug: product.slug,
        hasImages: !!product.images?.length,
        hasVariants: !!product.inventory?.length
      });

      setForm({
        name: product.name || '',
        slug: product.slug || '',
        description: product.description || '',
        short_description: product.short_description || '',
        price: product.price || '',
        mrp: product.mrp || '',
        category_id: product.collection_id || product.category_id || '',
        brand: product.brand || '',
        is_active: product.is_active ?? true,
        is_featured: product.is_featured ?? false,
        is_new_arrival: product.is_new_arrival ?? false,
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || '',
      });
      setProductName(product.name || '');
      setExistingImages(product.images || []);
    } catch (err) {
      logger.error('Error fetching product:', err);
      
      // Check if this is an authentication error
      if (err.status === 401) {
        setAuthError(true);
        logger.warn('[EditProduct] Authentication failed - user needs to re-authenticate');
      }
      
      // Build detailed error message based on error type
      let errorMessage = 'Failed to load product. ';

      if (err.status === 404) {
        errorMessage = `Product "${productSlugOrId}" was not found in the database. It may have been deleted or the URL is incorrect.`;
      } else if (err.status === 401) {
        errorMessage = 'Your session has expired or you are not authenticated. Please log in again in the main admin panel.';
      } else if (err.status === 403) {
        errorMessage = 'You do not have permission to edit this product. Please contact an administrator.';
      } else if (err.status === 0 || err.isNetworkError) {
        errorMessage = 'Cannot connect to the server. Please check if the admin service is running.';
      } else {
        errorMessage = err?.message || 'Failed to load product. The product may not exist or you may need to re-authenticate.';
      }
      
      // Show error with retry instead of redirecting — the user may have
      // just opened a new tab and auth hasn't propagated yet.
      setError(errorMessage);
    } finally {
      setLoadingProduct(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const data = await categoriesApi.list();
      setCategories(data.categories || data || []);
    } catch (err) {
      logger.error('Error fetching categories:', err);
    } finally {
      setCategoriesLoading(false);
    }
  };

  // Generate slug from name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Handle form change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    processFiles(files);
  };

  // Handle image file selection
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    processFiles(files);
  };

  const processFiles = (files) => {
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      setNewImages(prev => [...prev, { file, preview, uploading: false }]);
    }
  };

  // Remove existing image
  const removeExistingImage = async (imageId) => {
    try {
      await productsApi.deleteImage(productId, imageId);
      setExistingImages(prev => prev.filter(img => img.id !== imageId));
    } catch (err) {
      setErrors(prev => ({ ...prev, _general: 'Failed to delete image' }));
    }
  };

  // Set image as primary
  const setAsPrimaryImage = async (imageId) => {
    try {
      await productsApi.setPrimaryImage(productId, imageId);
      // Update local state to reflect the change
      setExistingImages(prev => prev.map(img => ({
        ...img,
        is_primary: img.id === imageId
      })));
    } catch (err) {
      setErrors(prev => ({ ...prev, _general: 'Failed to set primary image' }));
    }
  };

  // Reorder images (drag and drop)
  const reorderImages = (dragIndex, hoverIndex) => {
    setExistingImages(prev => {
      const newImages = [...prev];
      const [draggedItem] = newImages.splice(dragIndex, 1);
      newImages.splice(hoverIndex, 0, draggedItem);
      return newImages;
    });
  };

  // Save image order to backend
  const saveImageOrder = async () => {
    try {
      const imageIds = existingImages.map(img => img.id);
      await productsApi.reorderImages(productId, imageIds);
    } catch (err) {
      logger.error('Failed to save image order:', err);
    }
  };

  // Remove new image
  const removeNewImage = (index) => {
    setNewImages(prev => {
      const imageToRemove = prev[index];
      if (imageToRemove?.preview && imageToRemove.preview.startsWith('blob:')) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      newImages.forEach(img => {
        if (img.preview && img.preview.startsWith('blob:')) {
          URL.revokeObjectURL(img.preview);
        }
      });
    };
  }, [newImages]);

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!form.name.trim()) newErrors.name = 'Product name is required';
    if (!form.price || parseFloat(form.price) <= 0) newErrors.price = 'Valid price is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setLoading(true);

      // Build update payload with correct field names
      const productData = {
        name: form.name,
        slug: form.slug,
        description: form.description,
        short_description: form.short_description,
        base_price: parseFloat(form.price),
        mrp: form.mrp ? parseFloat(form.mrp) : null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        brand: form.brand || null,
        is_active: form.is_active,
        is_featured: form.is_featured,
        is_new_arrival: form.is_new_arrival,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
      };

      logger.info('Updating product with data:', { productId, productData });

      // Update Product
      const productId = product.id; // Use numeric ID for update
      await productsApi.update(productId, productData);

      // Upload New Images
      if (newImages.length > 0) {
        const isFirstPrimary = existingImages.length === 0;
        for (let i = 0; i < newImages.length; i++) {
          await productsApi.uploadImage(productId, newImages[i].file, isFirstPrimary && i === 0);
        }
      }

      router.push(`/admin/products`);
    } catch (err) {
      logger.error('Error updating product:', err);
      setErrors(prev => ({ ...prev, _general: err?.message || 'Failed to update product' }));
    } finally {
      setLoading(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[#B76E79] mx-auto mb-3" />
          <p className="text-[#EAE0D5]/60 text-sm">Loading product details...</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-[#EAE0D5]/40 text-xs mt-2 font-mono">
              Product ID: {productId}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error && !form.name) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-md text-center">
          <p className="text-red-400 font-medium mb-2">Failed to Load Product</p>
          <p className="text-red-400/80 text-sm mb-4">{error}</p>
          
          {/* Special handling for authentication errors */}
          {authError && (
            <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-yellow-400 text-sm mb-3">
                Authentication required. Please log in again.
              </p>
              <Link
                href="/auth/login?redirect_url=/admin/products"
                className="px-4 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity text-sm inline-flex items-center gap-2"
              >
                Go to Login
              </Link>
            </div>
          )}
          
          {/* Debug info for development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-black/20 rounded-lg text-left">
              <p className="text-xs text-[#EAE0D5]/50 font-mono mb-1">Debug Info:</p>
              <p className="text-xs text-[#EAE0D5]/70 font-mono">Product Slug/ID: <span className="text-white">{productSlugOrId || 'undefined'}</span></p>
              <p className="text-xs text-[#EAE0D5]/70 font-mono">URL Path: <span className="text-white">/admin/products/{productSlugOrId}/edit</span></p>
              <p className="text-xs text-[#EAE0D5]/70 font-mono">Error Status: <span className="text-white">{error?.status || 'N/A'}</span></p>
            </div>
          )}
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fetchProduct()}
              className="px-4 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
            <Link
              href="/admin/products"
              className="px-4 py-2 border border-[#B76E79]/30 text-[#EAE0D5]/70 rounded-xl hover:bg-[#B76E79]/10 transition-colors text-sm"
            >
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/40 mb-1">
            <span>Products</span>
            <span>/</span>
            <span className="text-[#EAE0D5]/60 truncate max-w-[200px]">{productName || 'Edit Product'}</span>
          </div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#F2C29A]"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Edit Product
          </h1>
          {productName && (
            <p className="text-[#EAE0D5]/60 mt-0.5 text-sm truncate max-w-[400px]">
              {productName}
            </p>
          )}
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
                    placeholder="Enter product name"
                    className={`
                      w-full px-4 py-2.5
                      bg-[#0B0608]/60 border rounded-xl
                      text-[#EAE0D5] placeholder-[#EAE0D5]/40
                      focus:outline-none transition-colors
                      ${errors.name ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'}
                    `}
                  />
                  {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">
                    Product Link (URL)
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={form.slug}
                    onChange={handleChange}
                    placeholder="product-url-link"
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors"
                  />
                </div>

                {/* Short Description */}
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">
                    Short Description
                  </label>
                  <input
                    type="text"
                    name="short_description"
                    value={form.short_description}
                    onChange={handleChange}
                    placeholder="Brief product summary"
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Enter product description..."
                    rows={4}
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Pricing
              </h2>

              <div className="grid grid-cols-2 gap-4">
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
                      className={`
                        w-full pl-8 pr-4 py-2.5
                        bg-[#0B0608]/60 border rounded-xl
                        text-[#EAE0D5] placeholder-[#EAE0D5]/40
                        focus:outline-none transition-colors
                        ${errors.price ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'}
                      `}
                    />
                  </div>
                  {errors.price && <p className="text-red-400 text-sm mt-1">{errors.price}</p>}
                </div>

                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">
                    MRP
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EAE0D5]/50">₹</span>
                    <input
                      type="number"
                      name="mrp"
                      value={form.mrp}
                      onChange={handleChange}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Images with Drag & Drop */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Product Images
              </h2>

              {/* Existing Images */}
              {existingImages.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[#EAE0D5]">Product Images</h3>
                    <button
                      type="button"
                      onClick={saveImageOrder}
                      className="text-xs text-[#B76E79] hover:text-[#F2C29A] transition-colors"
                    >
                      Save Order
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    {existingImages.map((img, index) => (
                      <div
                        key={img.id || index}
                        className="relative aspect-square rounded-xl overflow-hidden bg-[#7A2F57]/10 border border-[#B76E79]/30 group cursor-move"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                          if (dragIndex !== index) {
                            reorderImages(dragIndex, index);
                          }
                        }}
                      >
                        <Image
                          src={img.image_url}
                          alt={`Product image ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 25vw"
                        />
                        {img.is_primary ? (
                          <span className="absolute top-2 left-2 bg-[#7A2F57] text-[#F2C29A] text-[10px] px-2 py-0.5 rounded shadow">Primary</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAsPrimaryImage(img.id)}
                            className="absolute top-2 left-2 bg-[#0B0608]/70 text-[#EAE0D5] text-[10px] px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 hover:bg-[#7A2F57] transition-all"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeExistingImage(img.id)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500/80 rounded-lg text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {/* Drag handle indicator */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-0.5">
                            <div className="w-1 h-1 bg-white/70 rounded-full"></div>
                            <div className="w-1 h-1 bg-white/70 rounded-full"></div>
                            <div className="w-1 h-1 bg-white/70 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* New Images */}
              {newImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {newImages.map((img, index) => (
                    <div key={`new-${index}`} className="relative aspect-square rounded-xl overflow-hidden bg-[#7A2F57]/10 border border-[#B76E79]/30 group">
                      <Image
                        src={img.preview}
                        alt={`New product image ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                      {existingImages.length === 0 && index === 0 && (
                        <span className="absolute top-2 left-2 bg-[#7A2F57] text-[#F2C29A] text-[10px] px-2 py-0.5 rounded shadow">Primary</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeNewImage(index)}
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
                className={`w-full flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${isDragging ? 'border-[#F2C29A] bg-[#B76E79]/20' : 'border-[#B76E79]/30 hover:border-[#B76E79]/60 hover:bg-[#B76E79]/5'
                  }`}
              >
                <Upload className={`w-8 h-8 mb-3 ${isDragging ? 'text-[#F2C29A]' : 'text-[#B76E79]/60'}`} />
                <span className="text-sm text-[#EAE0D5] font-medium mb-1">Click to upload or drag & drop</span>
                <span className="text-xs text-[#EAE0D5]/50">JPG, PNG, WebP — multiple images allowed</span>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Collection */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Collection
              </h2>

              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 transition-colors"
              >
                <option value="">— None —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status Flags */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Status
              </h2>

              <div className="space-y-3">
                {[
                  ['is_active', 'Active', Eye],
                  ['is_featured', 'Featured', Star],
                  ['is_new_arrival', 'New Arrival', Sparkles],
                ].map(([key, label, Icon]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name={key}
                      checked={form[key]}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form[key] ? 'bg-[#B76E79] border-[#B76E79]' : 'border-[#B76E79]/30 bg-transparent'}`}>
                      {form[key] && <Icon className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-[#EAE0D5]/80">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Brand */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                Brand
              </h2>

              <input
                type="text"
                name="brand"
                value={form.brand}
                onChange={handleChange}
                placeholder="Brand name"
                className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors"
              />
            </div>

            {/* SEO */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                SEO
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">Meta Title</label>
                  <input
                    type="text"
                    name="meta_title"
                    value={form.meta_title}
                    onChange={handleChange}
                    placeholder="SEO title"
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-2">Meta Description</label>
                  <textarea
                    name="meta_description"
                    value={form.meta_description}
                    onChange={handleChange}
                    placeholder="SEO description"
                    rows={2}
                    className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Link
                href="/admin/products"
                className="flex-1 py-2.5 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

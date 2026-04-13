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
import ColorPicker from '@/components/ui/ColorPicker';
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
  const [error, setError] = useState(null);
  const [numericProductId, setNumericProductId] = useState(null);

  // Variants state
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [stockAdjustingVariant, setStockAdjustingVariant] = useState(null);
  const [variantForm, setVariantForm] = useState({
    sku: '',
    size: '',
    color: '',
    color_hex: '#000000',
    quantity: 0,
    price: '',
    low_stock_threshold: 5,
  });
  const [stockForm, setStockForm] = useState({
    adjustment: 0,
    reason: '',
  });
  const [variantErrors, setVariantErrors] = useState({});

  // Use productId from useParams - this can be either a slug or numeric ID
  const productSlugOrId = productId;

  useEffect(() => {
    if (productSlugOrId) {
      fetchProduct();
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSlugOrId]);

  // Fetch variants when numericProductId is available
  useEffect(() => {
    if (numericProductId) {
      fetchVariants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericProductId]);

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

      // Store the numeric product ID for use in handleSubmit and variant operations
      setNumericProductId(product.id);

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
    if (!numericProductId) {
      setErrors(prev => ({ ...prev, _general: 'Product ID is not ready yet. Please refresh and try again.' }));
      return;
    }
    try {
      await productsApi.deleteImage(numericProductId, imageId);
      setExistingImages(prev => prev.filter(img => img.id !== imageId));
    } catch (err) {
      setErrors(prev => ({ ...prev, _general: 'Failed to delete image' }));
    }
  };

  // Set image as primary
  const setAsPrimaryImage = async (imageId) => {
    if (!numericProductId) {
      setErrors(prev => ({ ...prev, _general: 'Product ID is not ready yet. Please refresh and try again.' }));
      return;
    }
    try {
      await productsApi.setPrimaryImage(numericProductId, imageId);
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
    if (!numericProductId) return;
    try {
      const imageIds = existingImages.map(img => img.id);
      await productsApi.reorderImages(numericProductId, imageIds);
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

  // ===== VARIANTS & INVENTORY FUNCTIONS =====

  const fetchVariants = async () => {
    if (!numericProductId) return;
    try {
      setLoadingVariants(true);
      const data = await productsApi.getVariants(numericProductId);
      setVariants(data.variants || data || []);
    } catch (err) {
      logger.error('Error fetching variants:', err);
      // Non-critical error - variants may simply not exist yet
      setVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  };

  const validateVariantForm = () => {
    const newErrors = {};
    if (!variantForm.sku.trim()) newErrors.sku = 'SKU is required';
    if (!variantForm.size.trim()) newErrors.size = 'Size is required';
    if (!variantForm.color.trim()) newErrors.color = 'Color is required';
    if (!variantForm.price || parseFloat(variantForm.price) <= 0) newErrors.price = 'Valid price is required';
    if (variantForm.quantity < 0) newErrors.quantity = 'Quantity cannot be negative';

    setVariantErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVariantFormChange = (e) => {
    const { name, value } = e.target;
    setVariantForm(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'low_stock_threshold' ? parseInt(value) || 0 : value,
    }));
    if (variantErrors[name]) {
      setVariantErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAddVariant = () => {
    setVariantForm({
      sku: '',
      size: '',
      color: '',
      color_hex: '#000000',
      quantity: 0,
      price: '',
      low_stock_threshold: 5,
    });
    setVariantErrors({});
    setShowAddVariant(true);
  };

  const handleCancelAddVariant = () => {
    setShowAddVariant(false);
    setVariantErrors({});
  };

  const handleCreateVariant = async (e) => {
    e.preventDefault();
    if (!validateVariantForm()) return;

    try {
      const payload = {
        sku: variantForm.sku.trim(),
        size: variantForm.size.trim(),
        color: variantForm.color.trim(),
        color_hex: variantForm.color_hex,
        quantity: parseInt(variantForm.quantity),
        price: parseFloat(variantForm.price),
        low_stock_threshold: parseInt(variantForm.low_stock_threshold) || 5,
      };

      await productsApi.createVariant(numericProductId, payload);
      setShowAddVariant(false);
      await fetchVariants();
    } catch (err) {
      logger.error('Error creating variant:', err);
      setVariantErrors(prev => ({ ...prev, _general: err?.message || 'Failed to create variant' }));
    }
  };

  const handleEditVariant = (variant) => {
    setEditingVariantId(variant.id);
    setVariantForm({
      sku: variant.sku || '',
      size: variant.size || '',
      color: variant.color || '',
      color_hex: variant.color_hex || '#000000',
      quantity: variant.quantity ?? 0,
      price: variant.price || '',
      low_stock_threshold: variant.low_stock_threshold ?? 5,
    });
    setVariantErrors({});
  };

  const handleCancelEditVariant = () => {
    setEditingVariantId(null);
    setVariantErrors({});
  };

  const handleUpdateVariant = async (e) => {
    e.preventDefault();
    if (!validateVariantForm()) return;

    try {
      const payload = {
        sku: variantForm.sku.trim(),
        size: variantForm.size.trim(),
        color: variantForm.color.trim(),
        color_hex: variantForm.color_hex,
        quantity: parseInt(variantForm.quantity),
        price: parseFloat(variantForm.price),
        low_stock_threshold: parseInt(variantForm.low_stock_threshold) || 5,
      };

      await productsApi.updateVariant(numericProductId, editingVariantId, payload);
      setEditingVariantId(null);
      await fetchVariants();
    } catch (err) {
      logger.error('Error updating variant:', err);
      setVariantErrors(prev => ({ ...prev, _general: err?.message || 'Failed to update variant' }));
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (!confirm('Are you sure you want to delete this variant? This cannot be undone.')) return;

    try {
      await productsApi.deleteVariant(numericProductId, variantId);
      await fetchVariants();
    } catch (err) {
      logger.error('Error deleting variant:', err);
      setErrors(prev => ({ ...prev, _general: err?.message || 'Failed to delete variant' }));
    }
  };

  const handleStockAdjust = (variant) => {
    setStockAdjustingVariant(variant.id);
    setStockForm({
      adjustment: 0,
      reason: '',
    });
  };

  const handleStockChange = (e) => {
    const { name, value } = e.target;
    setStockForm(prev => ({
      ...prev,
      [name]: name === 'adjustment' ? parseInt(value) || 0 : value,
    }));
  };

  const handleCancelStockAdjust = () => {
    setStockAdjustingVariant(null);
  };

  const handleSubmitStockAdjust = async (e) => {
    e.preventDefault();
    if (!stockAdjustingVariant || stockForm.adjustment === 0) return;
    if (!stockForm.reason.trim()) {
      setErrors(prev => ({ ...prev, _stockReason: 'Reason is required for stock adjustment' }));
      return;
    }

    try {
      await productsApi.adjustVariantStock(numericProductId, stockAdjustingVariant, stockForm.adjustment, stockForm.reason.trim());
      setStockAdjustingVariant(null);
      await fetchVariants();
    } catch (err) {
      logger.error('Error adjusting stock:', err);
      setErrors(prev => ({ ...prev, _general: err?.message || 'Failed to adjust stock' }));
    }
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

      logger.info('Updating product with data:', { productId: numericProductId, productData });

      // Update Product - use numericProductId state variable
      if (!numericProductId) {
        throw new Error('Product ID not available. Please reload the page.');
      }
      await productsApi.update(numericProductId, productData);

      // Upload New Images
      if (newImages.length > 0) {
        const isFirstPrimary = existingImages.length === 0;
        for (let i = 0; i < newImages.length; i++) {
          await productsApi.uploadImage(numericProductId, newImages[i].file, isFirstPrimary && i === 0);
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

            {/* Variants & Inventory */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                  Variants & Inventory
                </h2>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] rounded-lg hover:bg-[#7A2F57]/60 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Variant
                </button>
              </div>

              {/* Loading State */}
              {loadingVariants && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#B76E79]" />
                  <p className="text-[#EAE0D5]/60 text-sm ml-3">Loading variants...</p>
                </div>
              )}

              {/* Add Variant Form */}
              {showAddVariant && (
                <form onSubmit={handleCreateVariant} className="mb-4 p-4 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-xl space-y-3">
                  <h3 className="text-sm font-medium text-[#F2C29A]">New Variant</h3>
                  {variantErrors._general && (
                    <p className="text-red-400 text-xs">{variantErrors._general}</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-[#EAE0D5]/70 mb-1">SKU <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        name="sku"
                        value={variantForm.sku}
                        onChange={handleVariantFormChange}
                        placeholder="SKU-001"
                        className={`w-full px-3 py-2 text-sm bg-[#0B0608]/60 border rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none transition-colors ${variantErrors.sku ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'}`}
                      />
                      {variantErrors.sku && <p className="text-red-400 text-xs mt-1">{variantErrors.sku}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-[#EAE0D5]/70 mb-1">Size <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        name="size"
                        value={variantForm.size}
                        onChange={handleVariantFormChange}
                        placeholder="S, M, L, XL"
                        className={`w-full px-3 py-2 text-sm bg-[#0B0608]/60 border rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none transition-colors ${variantErrors.size ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'}`}
                      />
                      {variantErrors.size && <p className="text-red-400 text-xs mt-1">{variantErrors.size}</p>}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <ColorPicker
                        value={variantForm.color_hex || '#000000'}
                        onChange={(hex, name) => {
                          setVariantForm(prev => ({ ...prev, color: name, color_hex: hex }));
                          if (variantErrors.color) setVariantErrors(prev => ({ ...prev, color: null }));
                        }}
                        label={<>Color <span className="text-red-400">*</span></>}
                      />
                      {variantForm.color && (
                        <p className="text-[11px] text-[#EAE0D5]/50 mt-1">Name: {variantForm.color}</p>
                      )}
                      {variantErrors.color && <p className="text-red-400 text-xs mt-1">{variantErrors.color}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-[#EAE0D5]/70 mb-1">Quantity</label>
                      <input
                        type="number"
                        name="quantity"
                        value={variantForm.quantity}
                        onChange={handleVariantFormChange}
                        min="0"
                        className={`w-full px-3 py-2 text-sm bg-[#0B0608]/60 border rounded-lg text-[#EAE0D5] focus:outline-none transition-colors ${variantErrors.quantity ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'}`}
                      />
                      {variantErrors.quantity && <p className="text-red-400 text-xs mt-1">{variantErrors.quantity}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-[#EAE0D5]/70 mb-1">Price <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#EAE0D5]/50 text-xs">₹</span>
                        <input
                          type="number"
                          name="price"
                          value={variantForm.price}
                          onChange={handleVariantFormChange}
                          placeholder="0"
                          className={`w-full pl-6 pr-3 py-2 text-sm bg-[#0B0608]/60 border rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none transition-colors ${variantErrors.price ? 'border-red-500/50' : 'border-[#B76E79]/20 focus:border-[#B76E79]/40'}`}
                        />
                      </div>
                      {variantErrors.price && <p className="text-red-400 text-xs mt-1">{variantErrors.price}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleCancelAddVariant}
                      className="px-4 py-2 text-xs border border-[#B76E79]/30 text-[#EAE0D5]/70 rounded-lg hover:bg-[#B76E79]/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] rounded-lg hover:bg-[#7A2F57]/60 transition-colors flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" /> Save Variant
                    </button>
                  </div>
                </form>
              )}

              {/* Variants Table */}
              {!loadingVariants && variants.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#B76E79]/20">
                        <th className="text-left py-2 px-2 text-xs text-[#EAE0D5]/50 font-medium">SKU</th>
                        <th className="text-left py-2 px-2 text-xs text-[#EAE0D5]/50 font-medium">Size</th>
                        <th className="text-left py-2 px-2 text-xs text-[#EAE0D5]/50 font-medium">Color</th>
                        <th className="text-right py-2 px-2 text-xs text-[#EAE0D5]/50 font-medium">Stock</th>
                        <th className="text-right py-2 px-2 text-xs text-[#EAE0D5]/50 font-medium">Price</th>
                        <th className="text-center py-2 px-2 text-xs text-[#EAE0D5]/50 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((variant) => (
                        <tr key={variant.id} className="border-b border-[#B76E79]/10 hover:bg-[#B76E79]/5 transition-colors">
                          {editingVariantId === variant.id ? (
                            <>
                              {/* Edit Mode Row */}
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  name="sku"
                                  value={variantForm.sku}
                                  onChange={handleVariantFormChange}
                                  className="w-full px-2 py-1 text-xs bg-[#0B0608]/60 border border-[#B76E79]/20 rounded text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  name="size"
                                  value={variantForm.size}
                                  onChange={handleVariantFormChange}
                                  className="w-full px-2 py-1 text-xs bg-[#0B0608]/60 border border-[#B76E79]/20 rounded text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="color"
                                    name="color_hex"
                                    value={variantForm.color_hex}
                                    onChange={handleVariantFormChange}
                                    className="w-5 h-5 rounded cursor-pointer border-0"
                                  />
                                  <input
                                    type="text"
                                    name="color"
                                    value={variantForm.color}
                                    onChange={handleVariantFormChange}
                                    className="flex-1 px-2 py-1 text-xs bg-[#0B0608]/60 border border-[#B76E79]/20 rounded text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  name="quantity"
                                  value={variantForm.quantity}
                                  onChange={handleVariantFormChange}
                                  min="0"
                                  className="w-full px-2 py-1 text-xs bg-[#0B0608]/60 border border-[#B76E79]/20 rounded text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-right"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <div className="relative">
                                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[#EAE0D5]/50 text-xs">₹</span>
                                  <input
                                    type="number"
                                    name="price"
                                    value={variantForm.price}
                                    onChange={handleVariantFormChange}
                                    className="w-full pl-5 pr-2 py-1 text-xs bg-[#0B0608]/60 border border-[#B76E79]/20 rounded text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-right"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={handleUpdateVariant}
                                    className="p-1 text-green-400 hover:bg-green-400/10 rounded transition-colors"
                                    title="Save"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditVariant}
                                    className="p-1 text-[#EAE0D5]/50 hover:bg-[#EAE0D5]/10 rounded transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {/* View Mode Row */}
                              <td className="py-2 px-2 font-mono text-xs text-[#EAE0D5]/80">{variant.sku}</td>
                              <td className="py-2 px-2 text-[#EAE0D5]/80">{variant.size}</td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-3 h-3 rounded-full border border-[#EAE0D5]/20"
                                    style={{ backgroundColor: variant.color_hex || '#000' }}
                                  />
                                  <span className="text-[#EAE0D5]/80">{variant.color}</span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right">
                                <span className={variant.quantity <= (variant.low_stock_threshold || 5) ? 'text-red-400' : 'text-[#EAE0D5]/80'}>
                                  {variant.quantity ?? 0}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right text-[#EAE0D5]/80">₹{variant.price?.toFixed(2) || '0.00'}</td>
                              <td className="py-2 px-2">
                                <div className="flex gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handleEditVariant(variant)}
                                    className="p-1 text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStockAdjust(variant)}
                                    className="p-1 text-yellow-400 hover:bg-yellow-400/10 rounded transition-colors"
                                    title="Adjust Stock"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteVariant(variant.id)}
                                    className="p-1 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Stock Adjustment Form */}
              {stockAdjustingVariant && (
                <form onSubmit={handleSubmitStockAdjust} className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-3">
                  <h3 className="text-sm font-medium text-yellow-400">Adjust Stock</h3>
                  {errors._stockReason && <p className="text-red-400 text-xs">{errors._stockReason}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#EAE0D5]/70 mb-1">Adjustment (+/-)</label>
                      <input
                        type="number"
                        name="adjustment"
                        value={stockForm.adjustment}
                        onChange={handleStockChange}
                        className="w-full px-3 py-2 text-sm bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#EAE0D5]/70 mb-1">Reason <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        name="reason"
                        value={stockForm.reason}
                        onChange={handleStockChange}
                        placeholder="e.g., restock, damaged, found"
                        className="w-full px-3 py-2 text-sm bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelStockAdjust}
                      className="px-4 py-2 text-xs border border-[#B76E79]/30 text-[#EAE0D5]/70 rounded-lg hover:bg-[#B76E79]/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-lg hover:bg-yellow-500/30 transition-colors flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" /> Apply Adjustment
                    </button>
                  </div>
                </form>
              )}

              {/* No Variants Message */}
              {!loadingVariants && variants.length === 0 && !showAddVariant && (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-[#B76E79]/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-[#EAE0D5]/50 text-sm">No variants yet. Click "Add Variant" to create one.</p>
                </div>
              )}
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

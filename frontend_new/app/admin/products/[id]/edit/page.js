'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { productsApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import ProductForm from '@/components/admin/products/ProductForm';

/**
 * Edit Product page — thin wrapper around <ProductForm/>.
 *
 * The form runs entirely in-memory and only reconciles with the backend on
 * Save. The reconciliation order is intentional and matters:
 *   1. PATCH product fields.
 *   2. Delete removed images, then upload new ones (last new upload becomes
 *      primary if the user moved the star to a new image).
 *   3. Set the correct primary image after uploads finish.
 *   4. Delete removed variants → PATCH existing variants → POST new variants.
 *      Each variant uploads its own image (when changed) before persisting.
 */
export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const slugOrId = params?.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [productId, setProductId] = useState(null);
  const [initial, setInitial] = useState(null);
  const [initialImages, setInitialImages] = useState([]);
  const [initialVariants, setInitialVariants] = useState([]);

  const fetchProduct = useCallback(async () => {
    if (!slugOrId || slugOrId === 'undefined') {
      setLoadError('Invalid product identifier.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      let product;
      // The admin GET works with both slug and numeric id, but the public
      // slug endpoint is faster and avoids an admin-permission round-trip
      // when an admin hits the storefront URL directly.
      try {
        const res = await fetch(`/api/v1/products/slug/${slugOrId}`, { credentials: 'include' });
        product = res.ok ? await res.json() : await productsApi.get(slugOrId);
      } catch {
        product = await productsApi.get(slugOrId);
      }

      const pid = product.id;
      setProductId(pid);

      setInitial({
        name: product.name || '',
        slug: product.slug || '',
        description: product.description || '',
        price: product.price ?? product.base_price ?? '',
        mrp: product.mrp ?? '',
        collection_id: product.collection_id ?? product.category_id ?? '',
        is_active: product.is_active !== false,
        is_featured: !!product.is_featured,
        is_new_arrival: !!product.is_new_arrival,
      });

      setInitialImages(
        (product.images || []).map((img) => ({
          id: img.id,
          image_url: img.image_url,
          is_primary: !!img.is_primary,
        })),
      );

      // Variants may live under either `variants` or `inventory` depending on
      // which API path served the product. The shape is the same.
      const variantSrc = product.variants || product.inventory || [];
      setInitialVariants(
        variantSrc.map((v) => ({
          id: v.id,
          sku: v.sku || '',
          size: v.size || '',
          color: v.color || '',
          color_hex: v.color_hex || '',
          quantity: v.quantity ?? 0,
          low_stock_threshold: v.low_stock_threshold ?? 10,
          is_active: v.is_active !== false,
          image_url: v.image_url || '',
        })),
      );
    } catch (err) {
      logger.error('[EditProduct] load failed', err);
      const msg =
        err?.status === 404
          ? `Product "${slugOrId}" was not found.`
          : err?.status === 401
          ? 'Your session has expired — please sign in again.'
          : err?.message || 'Failed to load product.';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [slugOrId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const persistVariants = async ({ variants, deletedVariantIds }) => {
    await Promise.allSettled(
      deletedVariantIds.map((id) => productsApi.deleteVariant(productId, id)),
    );

    for (let idx = 0; idx < variants.length; idx += 1) {
      const v = variants[idx];
      let imageUrl = v.image_url || '';

      if (v.image?.file) {
        try {
          const uploaded = await productsApi.uploadImage(
            productId,
            v.image.file,
            false,
            v.color ? `variant-${v.color}` : `variant-${idx + 1}`,
          );
          imageUrl = uploaded?.image_url || imageUrl;
        } catch (err) {
          logger.warn('[EditProduct] variant image upload failed', { idx, err });
        }
      }

      const payload = {
        sku: v.sku?.trim() || undefined,
        size: v.size || 'Free',
        color: v.color?.trim() || v.color_hex || 'Default',
        color_hex: v.color_hex || null,
        quantity: parseInt(v.quantity, 10) || 0,
        low_stock_threshold: parseInt(v.low_stock_threshold, 10) || 10,
        is_active: v.is_active !== false,
        image_url: imageUrl || null,
      };

      try {
        if (v.id) {
          await productsApi.updateVariant(productId, v.id, payload);
        } else {
          await productsApi.createVariant(productId, {
            ...payload,
            sku: payload.sku || `PRD-${productId}-${(v.color || 'STD').slice(0, 3).toUpperCase()}-${(v.size || 'STD').toUpperCase()}-${idx + 1}`,
          });
        }
      } catch (err) {
        logger.warn('[EditProduct] variant save failed', { idx, err });
      }
    }
  };

  const handleSubmit = async ({
    form,
    images,
    variants,
    primaryIndex,
    deletedImageIds,
    deletedVariantIds,
  }) => {
    if (!productId) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      await productsApi.update(productId, {
        name: form.name.trim(),
        slug: form.slug || undefined,
        description: form.description || null,
        base_price: form.price,
        mrp: form.mrp,
        collection_id: form.collection_id,
        is_active: form.is_active,
        is_featured: form.is_featured,
        is_new_arrival: form.is_new_arrival,
      });

      await Promise.allSettled(
        deletedImageIds.map((id) => productsApi.deleteImage(productId, id)),
      );

      let primaryImageId = null;
      if (images[primaryIndex]?.existing && images[primaryIndex]?.id) {
        primaryImageId = images[primaryIndex].id;
      }

      const newPendingImages = images.filter((img) => !img.existing && img.file);
      const uploadResults = await Promise.allSettled(
        newPendingImages.map((img, i) => {
          // Find the original index of this new image so we know whether it
          // was the user-selected primary.
          const originalIdx = images.indexOf(img);
          const isPrimary = originalIdx === primaryIndex;
          return productsApi
            .uploadImage(productId, img.file, isPrimary, form.name)
            .then((res) => ({ res, isPrimary }));
        }),
      );

      uploadResults.forEach((r) => {
        if (r.status === 'fulfilled' && r.value?.isPrimary && r.value?.res?.id) {
          primaryImageId = r.value.res.id;
        }
      });

      if (primaryImageId) {
        try {
          await productsApi.setPrimaryImage(productId, primaryImageId);
        } catch (err) {
          logger.warn('[EditProduct] setPrimaryImage failed', err);
        }
      }

      await persistVariants({ variants, deletedVariantIds });

      router.push('/admin/products');
    } catch (err) {
      logger.error('[EditProduct] save failed', err);
      setSubmitError(err?.message || 'Failed to save product changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkOutOfStock = async () => {
    if (!productId || !initialVariants.length) return;
    if (!confirm('Set every variant of this product to 0 stock?')) return;
    try {
      setSubmitting(true);
      await Promise.allSettled(
        initialVariants.map((v) =>
          productsApi.updateVariant(productId, v.id, { quantity: 0 }),
        ),
      );
      await fetchProduct();
    } catch (err) {
      logger.error('[EditProduct] mark out of stock failed', err);
      setSubmitError(err?.message || 'Failed to mark product out of stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const formKey = useMemo(
    () => (productId ? `product-${productId}` : 'product-loading'),
    [productId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#EAE0D5]/60">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading product…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto p-6 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 space-y-3">
        <h2 className="text-lg font-semibold">Couldn’t load product</h2>
        <p className="text-sm">{loadError}</p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={fetchProduct}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-sm"
          >
            Retry
          </button>
          <Link
            href="/admin/products"
            className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-sm"
          >
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProductForm
      key={formKey}
      mode="edit"
      initial={initial || {}}
      initialImages={initialImages}
      initialVariants={initialVariants}
      submitting={submitting}
      submitError={submitError}
      onSubmit={handleSubmit}
      onMarkOutOfStock={handleMarkOutOfStock}
    />
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import ProductForm from '@/components/admin/products/ProductForm';

/**
 * Create Product page — thin wrapper around <ProductForm/>.
 *
 * Submission strategy:
 *   1. POST /admin/products with the cleaned product fields.
 *   2. Upload all images sequentially so the chosen primary lands first.
 *   3. For each variant: upload its image (if any) → create variant with that
 *      image_url. We use Promise.allSettled so a single bad image doesn't
 *      orphan the product, and surface a warning instead.
 */
export default function CreateProductPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const buildAutoSku = (productId, variant, idx) => {
    const colorPart = (variant.color || 'STD').replace(/\s+/g, '').slice(0, 3).toUpperCase();
    const sizePart = (variant.size || 'STD').replace(/\s+/g, '').toUpperCase();
    return `PRD-${productId}-${colorPart}-${sizePart}-${idx + 1}`;
  };

  const handleSubmit = async ({ form, images, variants, primaryIndex }) => {
    setSubmitting(true);
    setSubmitError('');

    try {
      const product = await productsApi.create({
        name: form.name.trim(),
        slug: form.slug || undefined,
        description: form.description || undefined,
        base_price: form.price,
        mrp: form.mrp,
        collection_id: form.collection_id,
        is_active: form.is_active,
        is_featured: form.is_featured,
        is_new_arrival: form.is_new_arrival,
      });

      const productId = product.id;

      // Upload product images. We do this sequentially because the backend
      // promotes only one image to primary based on the `is_primary` flag,
      // and we want the user-chosen primary to win deterministically.
      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        if (!img.file) continue;
        try {
          await productsApi.uploadImage(productId, img.file, i === primaryIndex, form.name);
        } catch (err) {
          logger.warn('[CreateProduct] image upload failed', { index: i, err });
        }
      }

      // Upload + create variants. Each variant image is uploaded first so we
      // can persist the resulting URL on the variant row.
      const variantOps = variants.map(async (v, idx) => {
        let imageUrl = v.image_url || '';
        if (v.image?.file) {
          try {
            const uploaded = await productsApi.uploadImage(
              productId,
              v.image.file,
              false,
              `${form.name} - ${v.color || 'variant'}`,
            );
            imageUrl = uploaded?.image_url || imageUrl;
          } catch (err) {
            logger.warn('[CreateProduct] variant image upload failed', { idx, err });
          }
        }

        return productsApi.createVariant(productId, {
          sku: v.sku?.trim() || buildAutoSku(productId, v, idx),
          size: v.size || 'Free',
          color: v.color?.trim() || v.color_hex || 'Default',
          color_hex: v.color_hex || null,
          quantity: parseInt(v.quantity, 10) || 0,
          low_stock_threshold: parseInt(v.low_stock_threshold, 10) || 10,
          image_url: imageUrl || null,
          is_active: v.is_active !== false,
        });
      });

      await Promise.allSettled(variantOps);
      router.push('/admin/products');
    } catch (err) {
      logger.error('[CreateProduct] failed', err);
      setSubmitError(err?.message || 'Failed to create product. Please review the form and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProductForm
      mode="create"
      submitting={submitting}
      submitError={submitError}
      onSubmit={handleSubmit}
    />
  );
}

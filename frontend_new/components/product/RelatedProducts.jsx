'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { productsApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

/**
 * Validate product ID before making API calls.
 * Prevents 404 errors from undefined, null, or empty string IDs.
 */
const isValidId = (id) => {
  return id && id !== 'undefined' && id !== 'null' && id !== '';
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function RelatedProducts({ productId, collectionId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isValidId(productId)) {
      logger.warn('[RelatedProducts] Invalid productId:', productId);
      setLoading(false);
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    (async () => {
      try {
        const data = await productsApi.getRelated(productId);
        if (!mounted) return;
        const items = Array.isArray(data) ? data : data?.items || data?.products || [];
        setProducts(items.filter((p) => p.id !== productId).slice(0, 4));
      } catch (err) {
        if (mounted && err.name !== 'AbortError') {
          logger.warn('Related products failed:', err?.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [productId]);

  if (!loading && products.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 border-t border-white/[0.06]">
      <div className="container mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#3D5A80] mb-1.5">
              Continue exploring
            </p>
            <h2
              className="text-xl md:text-2xl text-white"
              style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif', fontWeight: 400 }}
            >
              You May Also Like
            </h2>
          </div>
          <div className="hairline-gold hidden sm:block flex-1 max-w-[8rem] mb-2" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-[#161616] rounded-2xl mb-3 border border-white/[0.04]" />
                  <div className="h-4 bg-white/[0.06] rounded w-3/4 mb-2" />
                  <div className="h-4 bg-white/[0.04] rounded w-1/2" />
                </div>
              ))
            : products.map((product) => {
                const productHref = product.id
                  ? `/products/${product.slug || product.id}`
                  : '/products';
                return (
                  <Link key={product.id} href={productHref} className="group block">
                    {/* Borderless matte card — no white/pink glow */}
                    <div className="overflow-hidden transition-transform duration-500 ease-out group-hover:-translate-y-1">
                      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#161616] border border-white/[0.04]">
                        {product.primary_image || product.image_url ? (
                          <Image
                            src={product.primary_image || product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                            sizes="(max-width: 640px) 50vw, 25vw"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[#161616] flex items-center justify-center">
                            <span className="text-[#8A919C]/40 text-xs">No Image</span>
                          </div>
                        )}
                        <div
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0D0D0D]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="pt-3 px-0.5">
                        <h3 className="font-medium text-[#F5F0E8] group-hover:text-white transition-colors line-clamp-2 text-sm">
                          {product.name}
                        </h3>
                        <p
                          className="text-[#D4AF37] font-semibold text-sm mt-1"
                          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                        >
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}

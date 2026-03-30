'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { productsApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
}

export default function RelatedProducts({ productId, collectionId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    let mounted = true;
    const controller = new AbortController();
    (async () => {
      try {
        const data = await productsApi.getRelated(productId);
        if (!mounted) return;
        const items = Array.isArray(data) ? data : (data?.items || data?.products || []);
        setProducts(items.filter(p => p.id !== productId).slice(0, 4));
      } catch (err) {
        if (mounted && err.name !== 'AbortError') logger.warn('Related products failed:', err?.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; controller.abort(); };
  }, [productId]);

  if (!loading && products.length === 0) return null;

  return (
    <section className="py-12 border-t border-[#B76E79]/15">
      <div className="container mx-auto px-4 sm:px-6 md:px-8">
        <h2
          className="text-xl md:text-2xl font-bold text-[#F2C29A] mb-6"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          You May Also Like
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-[#B76E79]/10 rounded-2xl mb-3" />
                  <div className="h-4 bg-[#B76E79]/10 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-[#B76E79]/10 rounded w-1/2" />
                </div>
              ))
            : products.map(product => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug || product.id}`}
                  className="group"
                >
                  <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden hover:border-[#B76E79]/30 hover:shadow-[0_0_30px_rgba(183,110,121,0.1)] transition-all duration-300">
                    <div className="relative aspect-[3/4] overflow-hidden">
                      {(product.primary_image || product.image_url) ? (
                        <Image
                          src={product.primary_image || product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[#1A1114] flex items-center justify-center">
                          <span className="text-[#B76E79]/30 text-xs">No Image</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-[#EAE0D5] group-hover:text-[#F2C29A] transition-colors line-clamp-2 text-sm">
                        {product.name}
                      </h3>
                      <p className="text-[#F2C29A] font-semibold text-sm mt-1">{formatCurrency(product.price)}</p>
                    </div>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}

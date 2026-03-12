'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import { customerApi } from '@/lib/customerApi';

export default function NewArrivalsPage() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await customerApi.products.getNewArrivals({ limit: 24 });
        setProducts(data?.products || data || []);
      } catch (e) {
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, []);

  return (
    <main className="min-h-screen text-[#EAE0D5]">
      <div className="relative z-10">
        <EnhancedHeader />
        <div className="pt-32 pb-20 px-4 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-heading text-[#F2C29A] mb-4">New Arrivals</h1>
            <p className="text-[#EAE0D5]/70 text-lg">Discover our latest collection of timeless pieces</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#EAE0D5]/50 text-xl mb-6">New arrivals coming soon</p>
              <Link href="/products" className="text-[#F2C29A] hover:underline">Browse all products →</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <Link key={product.id} href={`/products/${product.slug || product.id}`}>
                  <div className="group cursor-pointer">
                    <div className="aspect-[3/4] bg-[#1a0f0a] rounded-xl overflow-hidden mb-3">
                      {product.primary_image ? (
                        <img
                          src={product.primary_image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#EAE0D5]/20">
                          No Image
                        </div>
                      )}
                    </div>
                    <h3 className="text-[#EAE0D5] font-medium truncate">{product.name}</h3>
                    <p className="text-[#F2C29A] text-sm">₹{product.price}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import { categoriesApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

export default function CollectionsPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const data = await categoriesApi.list();
        setCategories(data?.categories || data || []);
      } catch (error) {
        logger.error('Failed to load collections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />
        
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-[#EAE0D5]/50 mb-8">
              <Link href="/" className="hover:text-[#F2C29A] transition-colors">Home</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-[#EAE0D5]">Collections</span>
            </nav>

            <div className="max-w-4xl mx-auto mb-16 text-center">
              <h1 
                className="text-4xl md:text-5xl lg:text-6xl text-[#F2C29A] mb-6"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Curated Collections
              </h1>
              <p 
                className="text-[#EAE0D5]/70 text-lg md:text-xl max-w-2xl mx-auto"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Explore our carefully curated categories of premium ethnic wear, designed to bring timeless elegance to your wardrobe.
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-[4/5] bg-[#B76E79]/10 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-20 bg-[#0B0608]/40 rounded-3xl border border-[#B76E79]/20">
                <p className="text-xl text-[#EAE0D5]/70">No collections available at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                {categories.map((category) => (
                  <Link 
                    key={category.id} 
                    href={`/collections/${category.slug}`}
                    className="group relative aspect-[4/5] rounded-3xl overflow-hidden block"
                  >
                    <div className="absolute inset-0 bg-[#0B0608]/20 group-hover:bg-[#0B0608]/40 transition-colors z-10 duration-500" />
                    
                    {category.image_url ? (
                      <Image
                        src={category.image_url}
                        alt={category.name}
                        fill
                        className="object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1A1114] flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out">
                        <span className="text-[#B76E79]/30 text-lg tracking-widest uppercase">{category.name}</span>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
                      <span className="text-[#F2C29A]/80 text-sm tracking-[0.2em] mb-3 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-100 uppercase">
                        Discover
                      </span>
                      <h3 
                        className="text-3xl md:text-4xl text-white font-medium drop-shadow-lg"
                        style={{ fontFamily: 'Cinzel, serif' }}
                      >
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="mt-4 text-[#EAE0D5]/90 text-sm max-w-[80%] opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-200">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}

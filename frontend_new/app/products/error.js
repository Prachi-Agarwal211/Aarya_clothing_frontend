'use client';

import { useEffect } from 'react';
import { ShoppingBag, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';

export default function ProductsError({ error, reset }) {
  useEffect(() => {
    console.error('Products page error:', error);
  }, [error]);

  return (
    <main className="min-h-screen text-[#F5F5F5] selection:bg-[#FFD700] selection:text-[#000000]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />
        
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#E07B8B]/10 flex items-center justify-center">
                <ShoppingBag className="w-10 h-10 text-[#E07B8B]/60" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#FFD700] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                Something Went Wrong
              </h1>
              <p className="text-[#F5F5F5]/60 mb-8 max-w-md mx-auto">
                We couldn&apos;t load the products. This might be a temporary issue.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#9333EA]/30 text-[#FFD700] rounded-xl hover:bg-[#9333EA]/50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#9333EA] to-[#E07B8B] text-white rounded-xl hover:opacity-90 transition-opacity"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-16">
          <Footer />
        </div>
      </div>
    </main>
  );
}

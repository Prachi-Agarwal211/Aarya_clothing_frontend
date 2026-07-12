'use client';

import { useEffect } from 'react';
import { Tag, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';

export default function CollectionsError({ error, reset }) {
  useEffect(() => {
    console.error('Collections page error:', error);
  }, [error]);

  return (
    <main className="min-h-screen text-[#F5F0E8] selection:bg-[#D4AF37] selection:text-[#000000]">
      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />
        
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#A8B4C8]/10 flex items-center justify-center">
                <Tag className="w-10 h-10 text-[#A8B4C8]/60" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#D4AF37] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                Something Went Wrong
              </h1>
              <p className="text-[#F5F0E8]/60 mb-8 max-w-md mx-auto">
                We couldn&apos;t load the collections. This might be a temporary issue.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#1E3A5F]/30 text-[#D4AF37] rounded-xl hover:bg-[#1E3A5F]/50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1E3A5F] to-[#A8B4C8] text-white rounded-xl hover:opacity-90 transition-opacity"
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

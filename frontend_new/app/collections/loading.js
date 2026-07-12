import { Tag } from 'lucide-react';

export default function CollectionsLoading() {
  return (
    <main className="min-h-screen text-[#F5F0E8] selection:bg-[#D4AF37] selection:text-[#000000]">
      <div className="relative z-10 page-wrapper">
        {/* Header skeleton */}
        <div className="h-16 bg-[#111111]/60 border-b border-[#A8B4C8]/10" />
        
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            {/* Page header skeleton */}
            <div className="mb-8">
              <div className="h-4 bg-[#A8B4C8]/10 rounded w-32 mb-4" />
              <div className="h-10 bg-[#A8B4C8]/10 rounded w-64 mb-2" />
              <div className="h-4 bg-[#A8B4C8]/10 rounded w-96" />
            </div>

            {/* Collections grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/3] bg-[#A8B4C8]/10 rounded-2xl mb-4" />
                  <div className="h-6 bg-[#A8B4C8]/10 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-[#A8B4C8]/10 rounded w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

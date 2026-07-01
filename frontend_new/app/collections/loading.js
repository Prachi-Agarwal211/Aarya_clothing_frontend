import { Tag } from 'lucide-react';

export default function CollectionsLoading() {
  return (
    <main className="min-h-screen text-[#F5F5F5] selection:bg-[#FFD700] selection:text-[#000000]">
      <div className="relative z-10 page-wrapper">
        {/* Header skeleton */}
        <div className="h-16 bg-[#0A0A0A]/60 border-b border-[#E07B8B]/10" />
        
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            {/* Page header skeleton */}
            <div className="mb-8">
              <div className="h-4 bg-[#E07B8B]/10 rounded w-32 mb-4" />
              <div className="h-10 bg-[#E07B8B]/10 rounded w-64 mb-2" />
              <div className="h-4 bg-[#E07B8B]/10 rounded w-96" />
            </div>

            {/* Collections grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/3] bg-[#E07B8B]/10 rounded-2xl mb-4" />
                  <div className="h-6 bg-[#E07B8B]/10 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-[#E07B8B]/10 rounded w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

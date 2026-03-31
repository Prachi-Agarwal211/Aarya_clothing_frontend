import { ArrowLeft } from 'lucide-react';

export default function CollectionDetailLoading() {
  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        {/* Header skeleton */}
        <div className="h-16 bg-[#0B0608]/60 border-b border-[#B76E79]/10" />
        
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 pt-20 pb-6">
            {/* Back button skeleton */}
            <div className="h-4 bg-[#B76E79]/10 rounded w-40 mb-4" />
            
            {/* Collection header skeleton */}
            <div className="flex items-end gap-6">
              <div className="w-16 h-16 bg-[#B76E79]/10 rounded-xl flex-shrink-0 hidden sm:block" />
              <div className="flex-1">
                <div className="h-10 bg-[#B76E79]/10 rounded w-64 mb-2" />
                <div className="h-4 bg-[#B76E79]/10 rounded w-96" />
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 md:px-8 pb-16">
            {/* Toolbar skeleton */}
            <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-[#B76E79]/10">
              <div className="h-10 bg-[#B76E79]/10 rounded-xl flex-1 min-w-[180px]" />
              <div className="h-10 bg-[#B76E79]/10 rounded-xl w-36" />
              <div className="h-10 bg-[#B76E79]/10 rounded-xl w-24" />
              <div className="h-10 bg-[#B76E79]/10 rounded-xl w-36" />
            </div>

            {/* Products grid skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-[#B76E79]/10 rounded-2xl mb-3" />
                  <div className="h-4 bg-[#B76E79]/10 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-[#B76E79]/10 rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

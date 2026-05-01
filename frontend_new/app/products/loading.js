import { ShoppingBag } from 'lucide-react';

export default function ProductsLoading() {
  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      <div className="relative z-10 page-wrapper">
        {/* Header skeleton */}
        <div className="h-16 md:h-20 bg-[#0B0608]/60 border-b border-[#B76E79]/10" />
        
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            {/* Page header skeleton */}
            <div className="mb-8">
              <div className="h-4 bg-[#B76E79]/10 rounded w-32 mb-4" />
              <div className="h-10 bg-[#B76E79]/10 rounded w-64 mb-2" />
              <div className="h-4 bg-[#B76E79]/10 rounded w-96" />
            </div>

            {/* Toolbar skeleton */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="h-11 bg-[#B76E79]/10 rounded-xl flex-1" />
              <div className="h-11 bg-[#B76E79]/10 rounded-xl w-48" />
              <div className="h-11 bg-[#B76E79]/10 rounded-xl w-32 hidden md:block" />
            </div>

            {/* Filters and products skeleton */}
            <div className="flex gap-6">
              {/* Sidebar skeleton */}
              <div className="hidden md:block w-64 flex-shrink-0 space-y-4">
                <div className="h-32 bg-[#B76E79]/10 rounded-2xl" />
                <div className="h-28 bg-[#B76E79]/10 rounded-2xl" />
              </div>

              {/* Products grid skeleton */}
              <div className="flex-1">
                <div className="h-4 bg-[#B76E79]/10 rounded w-48 mb-4" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
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
        </div>
      </div>
    </main>
  );
}

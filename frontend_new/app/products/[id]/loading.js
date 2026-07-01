import React from 'react';

export default function Loading() {
  return (
    <main className="min-h-screen text-[#F5F5F5] bg-[#000000]">
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 animate-pulse">
          {/* Image Skeleton */}
          <div className="aspect-[3/4] bg-[#E07B8B]/5 rounded-2xl border border-[#E07B8B]/10" />
          
          {/* Info Skeleton */}
          <div className="space-y-6">
            <div className="h-4 bg-[#E07B8B]/10 rounded w-1/4" />
            <div className="h-10 bg-[#E07B8B]/10 rounded w-3/4" />
            <div className="h-6 bg-[#E07B8B]/10 rounded w-1/2" />
            
            <div className="space-y-3 pt-6 border-t border-[#E07B8B]/10">
              <div className="h-20 bg-[#E07B8B]/5 rounded-xl" />
              <div className="h-20 bg-[#E07B8B]/5 rounded-xl" />
            </div>
            
            <div className="h-14 bg-[#E07B8B]/10 rounded-xl w-full mt-8" />
          </div>
        </div>
      </div>
    </main>
  );
}

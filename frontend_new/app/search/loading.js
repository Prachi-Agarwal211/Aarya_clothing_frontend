import React from 'react';

export default function Loading() {
  return (
    <main className="min-h-screen text-[#EAE0D5] bg-[#050203]">
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-2xl h-14 bg-[#B76E79]/10 rounded-2xl animate-pulse mb-12" />
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[3/4] bg-[#B76E79]/5 rounded-2xl border border-[#B76E79]/10" />
              <div className="h-4 bg-[#B76E79]/10 rounded w-3/4" />
              <div className="h-4 bg-[#B76E79]/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

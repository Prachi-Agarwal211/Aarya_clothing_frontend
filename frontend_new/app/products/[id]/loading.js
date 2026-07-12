import React from 'react';

/**
 * Streaming skeleton for product PDP — matches matte royal layout (no layout shift).
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-transparent text-[#F5F0E8]">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 mt-16 sm:mt-20">
        <div className="h-3 w-48 bg-white/[0.06] rounded mb-8 animate-pulse" />
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-7 space-y-3">
            <div className="aspect-[3/4] bg-[#161616] rounded-2xl border border-white/[0.04] animate-pulse" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-[72px] h-[72px] rounded-xl bg-[#161616] border border-white/[0.04] animate-pulse"
                />
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 space-y-5">
            <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-9 w-4/5 bg-white/[0.08] rounded animate-pulse" />
            <div className="h-5 w-32 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-10 w-40 bg-[#D4AF37]/15 rounded animate-pulse" />
            <div className="h-24 bg-white/[0.04] rounded-xl animate-pulse" />
            <div className="h-14 bg-[#D4AF37]/20 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}

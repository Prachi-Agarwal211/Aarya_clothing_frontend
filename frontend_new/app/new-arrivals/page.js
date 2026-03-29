'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * New Arrivals Page - Redirects to landing page
 *
 * SIMPLIFICATION: This page now redirects to the landing page (#new-arrivals section)
 * to eliminate duplicate logic and simplify the user experience.
 * New arrival products are displayed directly on the landing page.
 */
export default function NewArrivalsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to landing page new arrivals section
    router.replace('/#new-arrivals');
  }, [router]);

  return (
    <main className="min-h-screen bg-[#050203] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#EAE0D5]/60 text-sm uppercase tracking-[0.3em]">Redirecting...</p>
      </div>
    </main>
  );
}

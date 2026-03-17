'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import dynamic from 'next/dynamic';

const Footer = dynamic(() => import('@/components/landing/Footer'), { ssr: false });

export default function AboutPage() {
  const [imgErrors, setImgErrors] = useState({});

  const handleImageError = (idx) => () => {
    setImgErrors(prev => ({ ...prev, [idx]: true }));
  };

  return (
    <main className="min-h-screen text-[#EAE0D5]">
      <div className="relative z-10">
        <EnhancedHeader />
        <div className="pt-32 pb-20 px-4 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-heading text-[#F2C29A] mb-6">The Art of Elegance</h1>
            <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A] to-transparent mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="space-y-6">
              <p className="text-[#EAE0D5]/80 text-lg leading-relaxed">
                Aarya Clothing is a Jaipur-based fashion brand founded in 2020, created with a simple vision — 
                to offer stylish, high-quality clothing at reasonable prices, just a click away.
              </p>
              <p className="text-[#EAE0D5]/80 text-lg leading-relaxed">
                What began with a few live sessions on Facebook soon grew into a trusted independent brand,
                powered by customer love and support. Rooted in Jaipur&apos;s rich textile heritage and inspired
                by modern fashion trends, our collections blend style, comfort, and affordability.
              </p>
              <p className="text-[#EAE0D5]/80 text-lg leading-relaxed">
                At Aarya Clothing, we make it easy for every woman to discover fashion she truly loves — 
                updated, accessible, and confidently chosen.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#0B0608]/40 border border-[#B76E79]/15 flex items-center justify-center">
                {!imgErrors[0] ? (
                  <Image
                    src="/about/kurti1.jpg"
                    alt="Aarya Collection - Traditional Kurti"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    priority
                    quality={85}
                    onError={handleImageError(0)}
                  />
                ) : (
                  <div className="text-[#B76E79]/30 text-sm">Image coming soon</div>
                )}
              </div>
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#0B0608]/40 border border-[#B76E79]/15 flex items-center justify-center mt-8">
                {!imgErrors[1] ? (
                  <Image
                    src="/about/kurti2.jpg"
                    alt="Aarya Collection - Designer Kurti"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    quality={85}
                    onError={handleImageError(1)}
                  />
                ) : (
                  <div className="text-[#B76E79]/30 text-sm">Image coming soon</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center border-t border-[#F2C29A]/10 pt-16">
            {[
              { value: '2020', label: 'Founded' },
              { value: '10K+', label: 'Happy Customers' },
              { value: '500+', label: 'Styles' },
              { value: 'Jaipur', label: 'Based In' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl md:text-4xl font-heading text-[#F2C29A] mb-2">{stat.value}</div>
                <div className="text-[#EAE0D5]/60 text-sm uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <Footer />
      </div>
    </main>
  );
}

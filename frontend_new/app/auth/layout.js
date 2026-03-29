'use client';

import React from 'react';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen w-full relative text-[#EAE0D5] selection:bg-[#C27A4E] selection:text-white">
      {/* Background is now handled by root layout - no duplicate SilkBackground here */}

      {/* SCROLLABLE CONTENT LAYER */}
      <div 
        className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6 md:px-8"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        {children}
      </div>
    </div>
  );
}

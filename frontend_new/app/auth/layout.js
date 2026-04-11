'use client';

import React from 'react';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen w-full relative text-[#EAE0D5] selection:bg-[#C27A4E] selection:text-white">
      {/* Background is now handled by root layout - no duplicate SilkBackground here */}

      {/* SCROLLABLE CONTENT LAYER */}
      <div 
        className="relative z-10 w-full min-h-[100dvh] flex flex-col items-center justify-start md:justify-center py-4 sm:py-6 md:py-8 px-4 sm:px-6 md:px-8"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >
        {children}
      </div>
    </div>
  );
}

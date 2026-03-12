'use client';

import React from 'react';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen w-full relative text-[#EAE0D5] selection:bg-[#C27A4E] selection:text-white">
      {/* Background is now handled by root layout - no duplicate SilkBackground here */}

      {/* SCROLLABLE CONTENT LAYER */}
      <div className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 md:px-8">
        {children}
      </div>
    </div>
  );
}

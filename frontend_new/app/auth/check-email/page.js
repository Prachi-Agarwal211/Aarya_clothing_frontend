'use client';

import React from 'react';
import Link from 'next/link';
import { useLogo } from '../../../lib/siteConfigContext';
import { Mail } from 'lucide-react';

export default function CheckEmailPage() {
  const logoUrl = useLogo();

  return (
    <div className="w-full max-w-[480px] flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-8 sm:mb-10 animate-fade-in-up">
        <img
          src={logoUrl || ''}
          alt="Aarya Clothing Logo"
          className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
          loading="eager"
          fetchPriority="high"
        />
      </div>

      {/* EMAIL ICON */}
      <div className="w-20 h-20 rounded-full bg-[#7A2F57]/30 flex items-center justify-center mb-8 animate-fade-in-up-delay" aria-hidden="true">
        <Mail className="w-10 h-10 text-[#F2C29A]" />
      </div>

      {/* HEADER */}
      <div className="text-center mb-8 animate-fade-in-up-delay">
        <h2 className="text-2xl sm:text-3xl md:text-4xl text-white/90 font-body mb-4">
          Check Your Email
        </h2>
        <p className="text-white/70 text-sm sm:text-base max-w-sm">
          We&apos;ve sent a verification link to your email address.
          Click the link to verify your account and get started.
        </p>
      </div>

      {/* INFO BOX */}
      <div className="w-full p-4 bg-[#7A2F57]/20 border border-[#B76E79]/30 rounded-xl mb-8 animate-fade-in-up-delay" role="status">
        <p className="text-[#EAE0D5]/80 text-sm text-center">
          <span className="text-[#F2C29A] font-medium">Didn&apos;t receive the email?</span>
          <br />
          Check your spam folder or
          <Link href="/auth/register" className="text-[#C27A4E] hover:text-[#F2C29A] ml-1">
            try again
          </Link>
        </p>
      </div>

      {/* ACTIONS */}
      <div className="space-y-4 text-center animate-fade-in-up-delay">
        <Link
          href="/auth/login"
          className="block w-full py-3 px-6 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80
                         text-white font-serif tracking-widest rounded-xl border border-[#B76E79]/40
                         hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]
                         transition-all duration-500"
        >
          Back to Login
        </Link>

        <p className="text-white/50 text-xs">
          The verification link will expire in 24 hours.
        </p>
      </div>
    </div>
  );
}

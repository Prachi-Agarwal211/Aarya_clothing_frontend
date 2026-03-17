'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { setAuthData } from '../../../lib/baseApi';
import { useLogo } from '../../../lib/siteConfigContext';
import { CheckCircle, XCircle } from 'lucide-react';

function VerifyEmailForm() {
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const logoUrl = useLogo();
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setStatus('no_token');
      setError('No verification token provided');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const verifyEmail = async () => {
    try {
      // Backend expects token as a query parameter
      const response = await apiFetch(`/api/v1/auth/verify-email?token=${token}`, {
        method: 'POST'
      });

      // Store auth data (auto-login after verification)
      if (response.tokens || response.access_token) {
        setAuthData({
          access_token: response.tokens?.access_token || response.access_token,
          refresh_token: response.tokens?.refresh_token || response.refresh_token,
          user: response.user
        });
        setStatus('success');
        
        // Redirect based on role after 2 seconds
        setTimeout(() => {
          if (response.user?.role === 'admin' || response.user?.role === 'staff') {
            router.push('/admin');
          } else {
            router.push('/products');  // Customers go to products section
          }
        }, 2000);
      }
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Email verification failed');
    }
  };

  return (
    <div className="w-full max-w-[480px] flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-8 sm:mb-10 animate-fade-in-up">
        <img
          src={logoUrl || "/logo.png"}
          alt="Aarya Clothing Logo"
          className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
          loading="eager"
          fetchPriority="high"
        />
      </div>

      {/* Content based on status */}
      {status === 'verifying' && (
        <div className="text-center animate-fade-in-up-delay" role="status" aria-live="polite">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-2xl sm:text-3xl text-white/90 font-body mb-2">
            Verifying Email
          </h2>
          <p className="text-white/70 text-sm sm:text-base">
            Please wait while we verify your email address...
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center animate-fade-in-up-delay" role="status" aria-live="polite">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl text-white/90 font-body mb-2">
            Email Verified!
          </h2>
          <p className="text-[#C27A4E] mb-4 text-sm sm:text-base">
            Your email has been verified successfully.
          </p>
          <p className="text-white/60 text-sm">
            Redirecting to products section...
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center animate-fade-in-up-delay" role="alert" aria-live="assertive">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl text-white/90 font-body mb-2">
            Verification Failed
          </h2>
          <p className="text-red-300 mb-4 text-sm sm:text-base">
            {error || 'The verification link is invalid or has expired.'}
          </p>
          <div className="space-y-3">
            <Link
              href="/auth/register"
              className="block text-[#C27A4E] hover:text-[#F2C29A] transition-colors text-sm sm:text-base"
            >
              Create a new account
            </Link>
            <Link
              href="/auth/login"
              className="block text-white/60 hover:text-white/80 transition-colors text-sm sm:text-base"
            >
              Back to Login
            </Link>
          </div>
        </div>
      )}

      {status === 'no_token' && (
        <div className="text-center animate-fade-in-up-delay" role="alert" aria-live="assertive">
          <h2 className="text-2xl sm:text-3xl text-white/90 font-body mb-2">
            Invalid Request
          </h2>
          <p className="text-white/70 mb-4 text-sm sm:text-base">
            No verification token was provided. Please click the link in your email.
          </p>
          <Link
            href="/auth/login"
            className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors text-sm sm:text-base"
          >
            Back to Login
          </Link>
        </div>
      )}
    </div>
  );
}

function VerifyEmailLoading() {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#EAE0D5]/70">Loading...</p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailForm />
    </Suspense>
  );
}

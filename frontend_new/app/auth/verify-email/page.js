'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { setAuthData, getCoreBaseUrl } from '../../../lib/baseApi';
import { useLogo } from '../../../lib/siteConfigContext';
import { CheckCircle, XCircle } from 'lucide-react';
import logger from '@/lib/logger';

function VerifyEmailForm() {
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const logoUrl = useLogo();
  
  // CRITICAL FIX: Use ref to track if verification has already been attempted
  const hasVerifiedRef = useRef(false);

  const token = searchParams.get('token');

  // Clear error state when component mounts or token changes
  useEffect(() => {
    if (!token) {
      setStatus('no_token');
      return;
    }
    setError('');
    setStatus('verifying');
    setIsVerifying(false);
    hasVerifiedRef.current = false; // Reset verification flag on token change
  }, [token]);

  // Verify email effect - runs when token is available
  useEffect(() => {
    // CRITICAL FIX: Prevent multiple verification attempts
    // Don't run if: no token, already verifying, already processed, or already verified
    if (!token || isVerifying || status !== 'verifying' || hasVerifiedRef.current) {
      return;
    }

    const performVerification = async () => {
      // Set flag immediately to prevent race condition
      hasVerifiedRef.current = true;
      setIsVerifying(true);
      setError('');

      try {
        logger.info('[VerifyEmail] Starting verification with token:', token.substring(0, 10) + '...');

        // IMPORTANT: Encode the token to handle special characters properly
        // The token is already URL-safe from secrets.token_urlsafe(), but we encode
        // to ensure it survives any URL parsing/encoding that might happen in the email client
        const encodedToken = encodeURIComponent(token);

        logger.info('[VerifyEmail] Calling API with encoded token');

        // Use native fetch with proper credentials to ensure cookies are sent
        const response = await fetch(`${getCoreBaseUrl()}/api/v1/auth/verify-email?token=${encodedToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Important for cookies
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
        }

        const responseData = await response.json();
        logger.info('[VerifyEmail] Verification successful:', responseData.message);

        // Store auth data (auto-login after verification)
        if (responseData.tokens || responseData.access_token) {
          setAuthData({
            access_token: responseData.tokens?.access_token || responseData.access_token,
            refresh_token: responseData.tokens?.refresh_token || responseData.refresh_token,
            user: responseData.user
          });
          setStatus('success');

          // Redirect based on role after 2 seconds
          setTimeout(() => {
            if (responseData.user?.role === 'admin' || responseData.user?.role === 'staff') {
              router.push('/admin');
            } else {
              router.push('/products');  // Customers go to products section
            }
          }, 2000);
        }
      } catch (err) {
        logger.error('[VerifyEmail] Verification failed:', err);

        // Determine error type for better user messaging
        let errorMessage = err.message || 'The verification link is invalid or has expired.';
        let isErrorExpired = false;

        // Check for specific error types
        if (err.message?.includes('expired') || err.message?.includes('Expired')) {
          errorMessage = 'This verification link has expired. Please request a new one.';
          isErrorExpired = true;
        } else if (err.message?.includes('already verified') || err.message?.includes('Already verified')) {
          setStatus('already_verified');
          setError('');
          isErrorExpired = false;
        } else if (err.message?.includes('Invalid')) {
          errorMessage = 'This verification link is invalid. It may have been corrupted or already used.';
        }

        // Only set error status if not already_verified
        if (status !== 'already_verified') {
          setStatus('error');
          setError(errorMessage);
        }
      } finally {
        setIsVerifying(false);
      }
    };

    performVerification();
  }, [token, router, isVerifying, status]); // Removed 'status' from dependencies that could cause re-runs

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

      {status === 'already_verified' && (
        <div className="text-center animate-fade-in-up-delay" role="status" aria-live="polite">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <CheckCircle className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl text-white/90 font-body mb-2">
            Already Verified
          </h2>
          <p className="text-white/70 mb-4 text-sm sm:text-base">
            Your email has already been verified. You can now log in.
          </p>
          <Link
            href="/auth/login"
            className="inline-block text-[#C27A4E] hover:text-[#F2C29A] transition-colors text-sm sm:text-base"
          >
            Go to Login
          </Link>
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

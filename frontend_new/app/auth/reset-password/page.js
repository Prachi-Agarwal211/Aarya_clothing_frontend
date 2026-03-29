'use client';

import React, { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { authApi } from '../../../lib/customerApi';
import { useLogo } from '../../../lib/siteConfigContext';
import logger from '../../../lib/logger';
import { validatePassword } from '../../../lib/authHelpers';

// Total steps in the flow
const TOTAL_STEPS = 3;

function ResetPasswordForm() {
  const logoUrl = useLogo();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // Fix #7: Success state
  const searchParams = useSearchParams();
  const router = useRouter();

  // Determine flow type
  // SECURITY FIX: Check sessionStorage first (more secure than URL params)
  // This prevents OTP from being exposed in browser history, server logs, and Referer headers
  const storedVerification = typeof window !== 'undefined' 
    ? JSON.parse(sessionStorage.getItem('otp_verification') || 'null')
    : null;

  // Support both URL params (legacy) and sessionStorage (new secure method)
  const isOtpFlow = searchParams.get('verified') !== null || storedVerification?.verified;
  const verifiedIdentifier = searchParams.get('verified') || storedVerification?.identifier;
  const otpType = searchParams.get('otp_type') || storedVerification?.otpType || 'WHATSAPP';
  
  // For OTP code, prefer sessionStorage (secure) over URL param (legacy)
  const otpCode = storedVerification?.otpCode || 
                  (typeof window !== 'undefined' ? sessionStorage.getItem('otp_code_temp') : null) ||
                  searchParams.get('otp_code');
  const emailToken = searchParams.get('token');

  // Password validation
  const passwordRequirements = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
    { label: 'One number', test: (p) => /\d/.test(p) },
  ];

  const passwordValidation = password ? validatePassword(password) : null;
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    // Validate password
    if (!passwordValidation?.valid) {
      setError('Password does not meet requirements.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isOtpFlow) {
        // OTP-based reset flow
        if (!verifiedIdentifier || !otpCode) {
          setError('Verification expired. Please request a new code.');
          setIsSubmitting(false);
          return;
        }

        // Fix #5: Use authApi.resetPasswordWithOtp() instead of raw apiFetch
        await authApi.resetPasswordWithOtp(verifiedIdentifier, otpCode, password, otpType);

        // SECURITY FIX: Clear sessionStorage after successful password reset
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('otp_verification');
          sessionStorage.removeItem('otp_code_temp');
        }

        // Fix #7: Show success confirmation instead of auto-redirect
        setIsSuccess(true);
        setStatus('Password reset successfully!');
      } else {
        // Token-based reset flow (from email link)
        const token = emailToken || tokenInput.trim();
        if (!token) {
          setError('Reset token is required.');
          setIsSubmitting(false);
          return;
        }

        // Fix #5: Use authApi.resetPassword() instead of raw apiFetch
        await authApi.resetPassword(token, password);

        // Fix #7: Show success confirmation instead of auto-redirect
        setIsSuccess(true);
        setStatus('Password reset successfully!');
      }
    } catch (err) {
      logger.error('Reset password failed:', err);
      // Fix #9: Handle rate limit errors (429)
      if (err.status === 429) {
        setError('Too many requests. Please try again later.');
      } else {
        setError(err.message || 'Failed to reset password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fix #7: Success confirmation view
  if (isSuccess) {
    return (
      <div className="w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] flex flex-col items-center">
        {/* LOGO - Fix #8: Replace img with Next.js Image */}
        <div className="flex flex-col items-center mb-8 sm:mb-10 md:mb-12 lg:mb-14 animate-fade-in-up">
          <Image
            src={logoUrl || '/logo.png'}
            alt="Aarya Clothing Logo"
            width={144}
            height={144}
            className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
            priority
          />
        </div>

        {/* Fix #6: Progress Indicator - All steps complete */}
        <div className="w-full mb-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-[#F2C29A] text-[#2A1208] transition-all duration-300"
                >
                  <CheckCircle className="w-5 h-5" />
                </div>
                {stepNum < TOTAL_STEPS && (
                  <div className="w-16 sm:w-24 h-1 mx-2 rounded bg-[#F2C29A]" />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-[#EAE0D5]/50 uppercase tracking-widest">
            <span>Request</span>
            <span>Verify</span>
            <span>Reset</span>
          </div>
        </div>

        {/* Success Message */}
        <div className="text-center mb-10 lg:mb-12 space-y-4 animate-fade-in-up-delay">
          <div className="w-20 h-20 rounded-full bg-[#7A2F57]/30 border border-[#F2C29A]/60 flex items-center justify-center mx-auto">
            <CheckCircle className="w-12 h-12 text-[#F2C29A]" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl text-white/90 font-body">
            Password Reset Successful!
          </h2>
          <p className="text-[#8A6A5C] text-sm sm:text-base uppercase tracking-[0.2em] font-light">
            Your password has been updated
          </p>
          <p className="text-[#EAE0D5]/60 text-sm">
            You can now sign in with your new password
          </p>
        </div>

        {/* Go to Login Button */}
        <Link href="/auth/login" className="w-full animate-fade-in-up-delay">
          <Button
            className="w-full h-14 sm:h-16 md:h-18 relative overflow-hidden rounded-2xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
            <div className="animate-sheen"></div>
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/70 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B76E79]/50 to-transparent"></div>

            <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.1em] sm:tracking-[0.15em] text-lg sm:text-xl md:text-2xl group-hover:text-white transition-colors font-heading">
              GO TO SIGN IN
            </span>
          </Button>
        </Link>

        <div className="w-full mt-8 text-center">
          <p className="text-[#8A6A5C] text-sm">
            Remember your password now?{' '}
            <Link href="/auth/login" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-sm font-bold tracking-widest">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] flex flex-col items-center">
      {/* LOGO - Fix #8: Replace img with Next.js Image */}
      <div className="flex flex-col items-center mb-8 sm:mb-10 md:mb-12 lg:mb-14 animate-fade-in-up">
        <Image
          src={logoUrl || '/logo.png'}
          alt="Aarya Clothing Logo"
          width={144}
          height={144}
          className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
          priority
        />
      </div>

      {/* Fix #6: Progress Indicator */}
      <div className="w-full mb-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  stepNum <= 3
                    ? 'bg-[#F2C29A] text-[#2A1208]'
                    : 'bg-[#B76E79]/30 text-[#EAE0D5]/40'
                }`}
              >
                {stepNum < 3 ? <CheckCircle className="w-5 h-5" /> : stepNum}
              </div>
              {stepNum < TOTAL_STEPS && (
                <div
                  className={`w-16 sm:w-24 h-1 mx-2 rounded transition-all duration-300 ${
                    stepNum < 3 ? 'bg-[#F2C29A]' : 'bg-[#B76E79]/30'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-[#EAE0D5]/50 uppercase tracking-widest">
          <span>Request</span>
          <span>Verify</span>
          <span>Reset</span>
        </div>
      </div>

      {/* HEADER */}
      <div className="text-center mb-10 lg:mb-12 space-y-2 animate-fade-in-up-delay">
        <h2 className="text-2xl sm:text-3xl md:text-4xl text-white/90 font-body">
          Reset Password
        </h2>
        <p className="text-[#8A6A5C] text-sm sm:text-base uppercase tracking-[0.2em] font-light">
          {isOtpFlow ? 'Create your new password' : 'Create your new password'}
        </p>
      </div>

      {/* FORM */}
      <form className="w-full space-y-5 sm:space-y-6 md:space-y-7 animate-fade-in-up-delay" onSubmit={handleSubmit} noValidate>
        {/* Token input for email link flow without token in URL */}
        {!emailToken && !isOtpFlow && (
          <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Reset Token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              variant="minimal"
              className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
              autoComplete="one-time-code"
              aria-label="Reset token"
            />
          </div>
        )}

        {/* Verified identifier display for OTP flow */}
        {isOtpFlow && verifiedIdentifier && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#7A2F57]/15 border border-[#B76E79]/20">
            <CheckCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0" />
            <div>
              <p className="text-[#EAE0D5]/90 text-sm font-bold tracking-widest uppercase">Verified</p>
              <p className="text-[#EAE0D5]/70 text-sm">{verifiedIdentifier}</p>
            </div>
          </div>
        )}

        {/* New Password */}
        <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
            autoComplete="new-password"
            aria-label="New password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="touch-target-icon absolute right-3 sm:right-4 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
          <Input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
            autoComplete="new-password"
            aria-label="Confirm new password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="touch-target-icon absolute right-3 sm:right-4 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>

        {/* Password Requirements */}
        <div className="text-sm sm:text-base text-white/60 space-y-1" aria-live="polite">
          <p>Password must contain:</p>
          <ul className="space-y-0.5 ml-2">
            {passwordRequirements.map((req, index) => (
              <li key={index} className="flex items-center gap-2">
                {passwordValidation?.strength?.checks[
                  index === 0 ? 'length' : index === 1 ? 'upper' : index === 2 ? 'lower' : 'number'
                ] ? (
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#C27A4E]" aria-hidden="true" />
                ) : (
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#6E5E58]" aria-hidden="true" />
                )}
                <span className={passwordValidation?.strength?.checks[
                  index === 0 ? 'length' : index === 1 ? 'upper' : index === 2 ? 'lower' : 'number'
                ] ? 'text-[#C27A4E]' : ''}>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Password Match Indicator */}
        {confirmPassword && (
          <div className="flex items-center gap-2 text-sm sm:text-base" role="status" aria-live="polite">
            {passwordsMatch ? (
              <>
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#C27A4E]" aria-hidden="true" />
                <span className="text-[#C27A4E]">Passwords match</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#6E5E58]" aria-hidden="true" />
                <span className="text-[#6E5E58]">Passwords do not match</span>
              </>
            )}
          </div>
        )}

        {/* LUXURY BUTTON */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 sm:h-16 md:h-18 mt-6 sm:mt-8 relative overflow-hidden rounded-2xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          aria-busy={isSubmitting}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
          <div className="animate-sheen"></div>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/70 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B76E79]/50 to-transparent"></div>

          <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.1em] sm:tracking-[0.15em] text-lg sm:text-xl md:text-2xl group-hover:text-white transition-colors font-heading">
            {isSubmitting ? 'RESETTING...' : 'RESET PASSWORD'}
          </span>
        </Button>

        {/* Error/Status Messages */}
        {(error || status) && (
          <div
            className={`text-center text-sm sm:text-base ${error ? 'text-red-300' : 'text-[#C27A4E]'}`}
            role={error ? "alert" : "status"}
            aria-live="polite"
          >
            {error && <p>{error}</p>}
            {!error && status && <p>{status}</p>}
          </div>
        )}
      </form>

      {/* BACK TO LOGIN */}
      <div className="w-full mt-10 sm:mt-12 md:mt-14">
        <Link href="/auth/login" className="text-[#8A6A5C] hover:text-[#F2C29A] transition-colors text-sm sm:text-base tracking-wide uppercase text-sm font-bold tracking-widest">
          ← Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-[#8A6A5C]">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

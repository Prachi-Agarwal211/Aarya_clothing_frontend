'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { authApi } from '../../../lib/customerApi';
import { useLogo } from '../../../lib/siteConfigContext';
import { validatePassword } from '../../../lib/authHelpers';

// Total steps in the flow
const TOTAL_STEPS = 3;

function ResetPasswordForm() {
  const logoUrl = useLogo();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // Fix #7: Success state
  const searchParams = useSearchParams();
  const router = useRouter();

  // Session data read in useEffect to avoid SSR/client hydration mismatch
  const [otpClient, setOtpClient] = useState({
    loaded: false,
    storedVerification: null,
    otpCodeTemp: null,
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('otp_verification');
      const storedVerification = raw ? JSON.parse(raw) : null;
      const otpCodeTemp = sessionStorage.getItem('otp_code_temp');
      setOtpClient({ loaded: true, storedVerification, otpCodeTemp });
    } catch {
      setOtpClient({ loaded: true, storedVerification: null, otpCodeTemp: null });
    }
  }, []);

  const { storedVerification, otpCodeTemp } = otpClient;

  const verifiedIdentifier =
    searchParams.get('verified') || storedVerification?.identifier;
  const otpType =
    searchParams.get('otp_type') || storedVerification?.otpType || 'EMAIL';

  const otpCode =
    storedVerification?.otpCode ||
    otpCodeTemp ||
    searchParams.get('otp_code');

  // Password validation
  const passwordRequirements = [
    { label: 'At least 5 characters', key: 'length' },
  ];

  const passwordValidation = password ? validatePassword(password) : null;
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    // Validate password
    if (!passwordValidation?.valid) {
      setError('Password must be at least 5 characters.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!verifiedIdentifier || !otpCode) {
        setError('Verification expired. Please request a new code.');
        setIsSubmitting(false);
        return;
      }

      await authApi.resetPasswordWithOtp(verifiedIdentifier, otpCode, password, otpType);

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('otp_verification');
        sessionStorage.removeItem('otp_code_temp');
      }

      setIsSuccess(true);
      setStatus('Password reset successfully!');
    } catch (err) {
      console.error('Reset password failed:', err);
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
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="flex flex-col items-center mb-4 animate-fade-in-up">
          <Image
            src={logoUrl || '/logo.png'}
            alt="Aarya Clothing Logo"
            width={96}
            height={96}
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
            priority
          />
        </div>

        <div className="w-full mb-4 max-w-xs mx-auto animate-fade-in-up">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#F2C29A] text-[#2A1208]">
                  <CheckCircle className="w-4 h-4" />
                </div>
                {stepNum < TOTAL_STEPS && (
                  <div className="w-10 sm:w-16 h-0.5 mx-1.5 rounded bg-[#F2C29A]" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mb-6 space-y-2 animate-fade-in-up-delay">
          <div className="w-14 h-14 rounded-full bg-[#7A2F57]/30 border border-[#F2C29A]/60 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-[#F2C29A]" />
          </div>
          <h2 className="text-xl sm:text-2xl text-white/90 font-body">
            Password updated
          </h2>
          <p className="text-[#8A6A5C] text-xs uppercase tracking-wider">
            You can sign in now
          </p>
        </div>

        <Link href="/auth/login" className="w-full animate-fade-in-up-delay">
          <Button
            className="w-full h-11 sm:h-12 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
            <div className="animate-sheen"></div>
            <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-base group-hover:text-white transition-colors font-heading">
              GO TO SIGN IN
            </span>
          </Button>
        </Link>

        <div className="w-full mt-5 text-center">
          <p className="text-[#8A6A5C] text-xs">
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
    <div className="w-full max-w-md md:max-w-lg flex flex-col items-center">
      <div className="flex flex-col items-center mb-4 sm:mb-5 animate-fade-in-up">
        <Image
          src={logoUrl || '/logo.png'}
          alt="Aarya Clothing Logo"
          width={96}
          height={96}
          className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
          priority
        />
      </div>

      <div className="w-full mb-4 max-w-xs mx-auto animate-fade-in-up">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  stepNum <= 3
                    ? 'bg-[#F2C29A] text-[#2A1208]'
                    : 'bg-[#B76E79]/30 text-[#EAE0D5]/40'
                }`}
              >
                {stepNum < 3 ? <CheckCircle className="w-4 h-4" /> : stepNum}
              </div>
              {stepNum < TOTAL_STEPS && (
                <div
                  className={`w-10 sm:w-16 h-0.5 mx-1.5 rounded transition-all duration-300 ${
                    stepNum < 3 ? 'bg-[#F2C29A]' : 'bg-[#B76E79]/30'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-[#EAE0D5]/50 uppercase tracking-wider">
          <span>Request</span>
          <span>Verify</span>
          <span>Reset</span>
        </div>
      </div>

      <div className="text-center mb-4 sm:mb-5 space-y-1 animate-fade-in-up-delay">
        <h2 className="text-xl sm:text-2xl text-white/90 font-body">
          New password
        </h2>
        <p className="text-[#8A6A5C] text-xs uppercase tracking-wider">
          Choose your password
        </p>
      </div>

      <form className="w-full space-y-3 sm:space-y-3.5 animate-fade-in-up-delay" onSubmit={handleSubmit} noValidate>
        {verifiedIdentifier && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#7A2F57]/15 border border-[#B76E79]/20 text-left">
            <CheckCircle className="w-4 h-4 text-[#F2C29A] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[#EAE0D5]/90 text-[10px] font-bold tracking-widest uppercase">Verified</p>
              <p className="text-[#EAE0D5]/70 text-xs truncate">{verifiedIdentifier}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-3 sm:pl-4 pr-11 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            autoComplete="new-password"
            aria-label="New password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="touch-target-icon absolute right-2.5 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>

        <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
          <Input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-3 sm:pl-4 pr-11 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            autoComplete="new-password"
            aria-label="Confirm new password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="touch-target-icon absolute right-2.5 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
        </div>

        <div className="text-[10px] sm:text-xs text-white/55 grid grid-cols-2 gap-x-2 gap-y-0.5" aria-live="polite">
            {passwordRequirements.map((req, index) => (
              <div key={index} className="flex items-center gap-1.5">
                {passwordValidation?.strength?.checks[req.key] ? (
                  <CheckCircle className="w-3 h-3 text-[#C27A4E] shrink-0" aria-hidden="true" />
                ) : (
                  <XCircle className="w-3 h-3 text-[#6E5E58] shrink-0" aria-hidden="true" />
                )}
                <span className={passwordValidation?.strength?.checks[req.key] ? 'text-[#C27A4E]/90' : ''}>{req.label}</span>
              </div>
            ))}
        </div>

        {confirmPassword && (
          <div className="flex items-center gap-2 text-xs" role="status" aria-live="polite">
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

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 sm:h-12 mt-1 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          aria-busy={isSubmitting}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
          <div className="animate-sheen"></div>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/70 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B76E79]/50 to-transparent"></div>

          <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-base sm:text-lg group-hover:text-white transition-colors font-heading">
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

      <div className="w-full mt-6 sm:mt-8">
        <Link href="/auth/login" className="text-[#8A6A5C] hover:text-[#F2C29A] transition-colors text-xs sm:text-sm uppercase font-bold tracking-widest">
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

'use client';

import React, { useState, Suspense } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useLogo } from '../../../lib/siteConfigContext';
import logger from '../../../lib/logger';

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
  const searchParams = useSearchParams();
  const router = useRouter();

  // Password validation
  const passwordRequirements = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
    { label: 'One number', test: (p) => /\d/.test(p) },
  ];

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    const token = searchParams.get('token') || tokenInput.trim();
    if (!token) {
      setError('Reset token is required.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
      });
      setStatus('Password reset successfully.');
      router.push('/auth/login');
    } catch (err) {
      logger.error('Reset password failed:', err);
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-8 sm:mb-10 md:mb-12 lg:mb-14 animate-fade-in-up">
        <img
          src={logoUrl || ''}
          alt="Aarya"
          className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
        />
      </div>

      {/* HEADER */}
      <div className="text-center mb-10 lg:mb-12 space-y-2 animate-fade-in-up-delay">
        <h2 className="text-2xl sm:text-3xl md:text-4xl text-white/90 font-body">
          Reset Password
        </h2>
        <p className="text-[#8A6A5C] text-xs sm:text-sm md:text-base uppercase tracking-[0.2em] font-light">
          Create your new password
        </p>
      </div>

      {/* FORM */}
      <form className="w-full space-y-5 sm:space-y-6 md:space-y-7 animate-fade-in-up-delay" onSubmit={handleSubmit}>
        {!searchParams.get('token') && (
          <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
            <Input
              type="text"
              placeholder="Reset Token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              variant="minimal"
              className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
            />
          </div>
        )}
        {/* New Password */}
        <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-5 sm:right-6 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
          <Input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-5 sm:right-6 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>

        {/* Password Requirements */}
        <div className="text-xs sm:text-sm md:text-base text-white/60 space-y-1">
          <p>Password must contain:</p>
          <ul className="space-y-0.5 ml-2">
            {passwordRequirements.map((req, index) => (
              <li key={index} className="flex items-center gap-2">
                {req.test(password) ? (
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#C27A4E]" />
                ) : (
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#6E5E58]" />
                )}
                <span className={req.test(password) ? 'text-[#C27A4E]' : ''}>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Password Match Indicator */}
        {confirmPassword && (
          <div className="flex items-center gap-2 text-xs sm:text-sm md:text-base">
            {passwordsMatch ? (
              <>
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#C27A4E]" />
                <span className="text-[#C27A4E]">Passwords match</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#6E5E58]" />
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
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
          <div className="animate-sheen"></div>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/70 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B76E79]/50 to-transparent"></div>

          <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.1em] sm:tracking-[0.15em] text-lg sm:text-xl md:text-2xl group-hover:text-white transition-colors font-heading">
            {isSubmitting ? 'RESETTING...' : 'RESET PASSWORD'}
          </span>
        </Button>

        {(error || status) && (
          <div className="text-center text-xs sm:text-sm md:text-base">
            {error && <p className="text-red-300">{error}</p>}
            {!error && status && <p className="text-[#C27A4E]">{status}</p>}
          </div>
        )}
      </form>

      {/* BACK TO LOGIN */}
      <div className="w-full mt-10 sm:mt-12 md:mt-14">
        <Link href="/auth/login" className="text-[#8A6A5C] hover:text-[#F2C29A] transition-colors text-sm sm:text-base md:text-lg tracking-wide uppercase text-xs sm:text-sm md:text-base font-bold tracking-widest">
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

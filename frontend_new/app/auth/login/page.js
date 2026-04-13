'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../lib/authContext';
import { getRedirectForRole, USER_ROLES } from '../../../lib/roles';
import logger from '../../../lib/logger';
import { useLogo } from '../../../lib/siteConfigContext';

// Centralized login error message mapping
function getLoginErrorMessage(err) {
  // Backend raises ValueError for bad credentials → FastAPI converts to HTTP 400
  if (err.status === 400 || err.status === 401) {
    const msg = err.message || '';
    if (msg.toLowerCase().includes('verification') || msg.toLowerCase().includes('verify')) {
      return 'Please verify your email before logging in. Check your inbox for the verification code.';
    }
    if (msg.toLowerCase().includes('locked')) return msg;
    if (msg.toLowerCase().includes('deactivated')) return 'Your account has been disabled. Please contact support.';
    return 'Invalid credentials. Please check your username/email and password.';
  }
  // HTTP 403: Could be EMAIL_NOT_VERIFIED (handled separately with redirect) or truly disabled
  if (err.status === 403) {
    // If we reach here, the EMAIL_NOT_VERIFIED redirect logic didn't trigger
    // This means it's a genuine account disabled error or parsing failed
    const msg = err.message || '';
    if (msg.includes('EMAIL_NOT_VERIFIED')) {
      return 'Please verify your email before logging in. Request a new verification code if needed.';
    }
    return 'Your account has been disabled. Please contact support.';
  }
  if (err.status === 429) return 'Too many login attempts. Please try again later.';
  if (err.message?.includes('network') || err.message?.includes('fetch')) return 'Network error. Please check your connection and try again.';
  return err.message || 'Login failed. Please try again.';
}

// Loading component for Suspense
function LoginLoading() {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#EAE0D5]/70">Loading...</p>
      </div>
    </div>
  );
}

// Main login form component that uses useSearchParams
function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, loading, user, isStaff } = useAuth();

  // Get logo URL from backend via context
  const logoUrl = useLogo();

  // Get redirect URL from query params (set by middleware or referring page)
  // Note: Only redirect_url is supported (redirect param removed for consistency)
  const redirectUrl = searchParams.get('redirect_url') || null;

  // NOTE: Redirect after login is handled in handleSubmit, not in useEffect
  // This prevents race conditions between form handler and effect

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    // Validation
    if (!identifier || !password) {
      setError('Please enter your email/username and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login({
        username: identifier.trim(),
        password,
        remember_me: rememberMe,
      });

      setStatus('Signed in successfully.');

      // CRITICAL: Validate role exists before redirect
      if (!response.user?.role) {
        logger.error('Login response missing role:', response);
        throw new Error('Invalid login response: missing role');
      }

      // Use centralized redirect logic with response.user (not context user which might be stale)
      const targetUrl = redirectUrl && redirectUrl.startsWith('/')
        ? redirectUrl
        : getRedirectForRole(response.user.role);

      logger.info(`Login successful for user ${response.user.username} with role ${response.user.role}, redirecting to ${targetUrl}`);

      router.push(targetUrl);
      return;
    } catch (err) {
      logger.error('Login failed:', err);

      // EMAIL_NOT_VERIFIED: redirect to OTP / verification step (method matches how they signed up)
      // Try multiple ways to extract the error detail from the response
      let detail = null;
      
      // Method 1: err.data.detail (from baseApi.js error.data)
      if (err?.data) {
        detail = err.data.detail ?? err.data;
      }
      // Method 2: err.response.data.detail (alternative structure)
      if (!detail && err?.response?.data) {
        detail = err.response.data.detail ?? err.response.data;
      }
      
      // Parse stringified JSON if needed
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail);
        } catch {
          detail = {};
        }
      }
      if (!detail || typeof detail !== 'object') detail = {};
      
      // Check for EMAIL_NOT_VERIFIED error code
      if (err.status === 403 && detail.error_code === 'EMAIL_NOT_VERIFIED') {
        const email = detail.email || identifier.trim();
        const method = detail.signup_verification_method || 'otp_email';
        logger.info(`Email not verified for ${email}, redirecting to verification page with method ${method}`);
        router.push(
          `/auth/register?step=verify&email=${encodeURIComponent(email)}&method=${encodeURIComponent(method)}`
        );
        return;
      }
      
      // Also check error message string for EMAIL_NOT_VERIFIED (fallback)
      if (err.message && err.message.includes('EMAIL_NOT_VERIFIED')) {
        const parts = err.message.replace('EMAIL_NOT_VERIFIED:', '').split(':');
        const email = parts[0] || identifier.trim();
        const method = parts[1] || 'otp_email';
        logger.info(`Email not verified (from message) for ${email}, redirecting to verification`);
        router.push(
          `/auth/register?step=verify&email=${encodeURIComponent(email)}&method=${encodeURIComponent(method)}`
        );
        return;
      }

      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth status
  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-4 sm:mb-5 animate-fade-in-up">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Aarya Clothing Logo"
            width={96}
            height={96}
            priority
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-3xl font-bold text-[#F2C29A] drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]" aria-label="Aarya Clothing">
            A
          </div>
        )}
      </div>

      {/* HEADER */}
      <div className="text-center mb-5 sm:mb-6 space-y-1 animate-fade-in-up-delay">
        <h2 className="text-xl sm:text-2xl text-white/90 font-body">
          Welcome Back
        </h2>
        <p className="text-white/75 text-xs sm:text-sm uppercase tracking-[0.18em] font-light">
          Sign in to continue your journey
        </p>
      </div>

      {/* Redirect notice */}
      {redirectUrl && (
        <div className="w-full mb-4 p-3 bg-[#7A2F57]/20 border border-[#B76E79]/30 rounded-xl text-center" role="status">
          <p className="text-[#F2C29A] text-sm">
            Please sign in to access that page
          </p>
        </div>
      )}

      {/* FORM */}
      <form className="w-full space-y-3 sm:space-y-3.5 animate-fade-in-up-delay" onSubmit={handleSubmit} noValidate>
        {/* Username/Email */}
        <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
          <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Email, Username, or Phone"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            variant="minimal"
            className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            disabled={isSubmitting}
            autoComplete="username"
            aria-label="Email, username, or phone number"
            required
          />
        </div>

        {/* Password */}
        <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-3 sm:pl-4 pr-11 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            disabled={isSubmitting}
            autoComplete="current-password"
            aria-label="Password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="touch-target-icon absolute right-2.5 sm:right-3 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <label className="checkbox-wrapper flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isSubmitting}
              aria-label="Remember me on this device"
            />
            <span className="text-xs sm:text-sm text-white/80 select-none">Remember me</span>
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs sm:text-sm uppercase tracking-wider text-white/80 hover:text-[#F2C29A] transition-colors whitespace-nowrap"
          >
            Forgot Password?
          </Link>
        </div>

        {/* LUXURY BUTTON */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 sm:h-12 mt-2 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          aria-busy={isSubmitting}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
          <div className="animate-sheen"></div>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/70 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B76E79]/50 to-transparent"></div>

          <span className="relative z-10 text-white font-serif tracking-[0.12em] text-base sm:text-lg group-hover:text-white transition-colors font-heading">
            {isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}
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

      {/* TOGGLE LINK */}
      <div className="w-full mt-6 sm:mt-8">
        <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
          New here?{" "}
          <Link
            href="/auth/register"
            className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-sm font-bold tracking-widest"
          >
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}

// Default export wrapped in Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}

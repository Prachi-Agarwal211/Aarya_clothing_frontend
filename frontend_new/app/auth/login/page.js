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
      return 'Please verify your email before logging in. Check your inbox or WhatsApp for the verification code.';
    }
    if (msg.toLowerCase().includes('locked')) return msg;
    if (msg.toLowerCase().includes('deactivated')) return 'Your account has been disabled. Please contact support.';
    return 'Invalid credentials. Please check your username/email and password.';
  }
  if (err.status === 403) return 'Your account has been disabled. Please contact support.';
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
  const [rememberMe, setRememberMe] = useState(false);
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

      // Use soft navigation - backend sets HttpOnly cookies automatically
      // Browser will send cookies on next request
      router.push(targetUrl);
      return; // Exit early, don't set isSubmitting to false yet
    } catch (err) {
      logger.error('Login failed:', err);
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
    <div className="w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-8 sm:mb-10 md:mb-12 lg:mb-14 animate-fade-in-up">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Aarya Clothing Logo"
            width={144}
            height={144}
            priority
            className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
          />
        ) : (
          <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 flex items-center justify-center text-4xl font-bold text-[#F2C29A] drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]" aria-label="Aarya Clothing">
            A
          </div>
        )}
      </div>

      {/* HEADER */}
      <div className="text-center mb-10 lg:mb-12 space-y-2 animate-fade-in-up-delay">
        <h2 className="text-2xl sm:text-3xl md:text-4xl text-white/90 font-body">
          Welcome Back
        </h2>
        <p className="text-white/80 text-sm sm:text-base uppercase tracking-[0.2em] font-light">
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
      <form className="w-full space-y-5 sm:space-y-6 md:space-y-7 animate-fade-in-up-delay" onSubmit={handleSubmit} noValidate>
        {/* Username/Email */}
        <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Email, Username, or Phone"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
            disabled={isSubmitting}
            autoComplete="username"
            aria-label="Email, username, or phone number"
            required
          />
        </div>

        {/* Password */}
        <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
            disabled={isSubmitting}
            autoComplete="current-password"
            aria-label="Password"
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

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between gap-4">
          <label className="checkbox-wrapper flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isSubmitting}
              aria-label="Remember me on this device"
            />
            <span className="text-sm sm:text-base text-white/80 select-none">Remember me</span>
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-sm sm:text-base uppercase tracking-widest text-white/80 hover:text-[#F2C29A] transition-colors whitespace-nowrap"
          >
            Forgot Password?
          </Link>
        </div>

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

          <span className="relative z-10 text-white font-serif tracking-[0.1em] sm:tracking-[0.15em] text-lg sm:text-xl md:text-2xl group-hover:text-white transition-colors font-heading">
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
      <div className="w-full mt-10 sm:mt-12 md:mt-14">
        <p className="text-center text-[#8A6A5C] text-sm sm:text-base tracking-wide">
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

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../../../lib/authContext';
import logger from '../../../lib/logger';
import { getDeviceFingerprint, getDeviceName } from '../../../lib/deviceFingerprint';
import { useLogo } from '../../../lib/siteConfigContext';
import { getRedirectForRole, USER_ROLES } from '../../../lib/roles';

/**
 * Password login only. OTP flow: /auth/login-otp (separate page).
 */
function LoginPageContent({ redirectUrl = '/products' }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { login, user, isAuthenticated, loading } = useAuth();
  const logoUrl = useLogo();
  const loginOtpHref = `/auth/login-otp?redirect_url=${encodeURIComponent(redirectUrl)}`;

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!identifier || !password) {
      setError('Please enter your email, username, or phone number and password.');
      setIsSubmitting(false);
      return;
    }

    try {
      const [device_fingerprint, device_name] = await Promise.all([
        getDeviceFingerprint(),
        Promise.resolve(getDeviceName()),
      ]);

      const result = await login({
        identifier: identifier.trim(),
        password,
        remember_me: rememberMe,
        device_fingerprint,
        device_name,
      });

      logger.info('Login successful');
      const role = result?.user?.role || user?.role || USER_ROLES.CUSTOMER;
      const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
      setTimeout(() => router.push(target), 500);
    } catch (err) {
      logger.error('Login failed:', err);
      setError(err.message || 'Invalid credentials. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated && !loading) {
    const role = user?.role || USER_ROLES.CUSTOMER;
    const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
    router.push(target);
    return null;
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

      <div className="text-center mb-4 sm:mb-5 space-y-1 animate-fade-in-up-delay">
        <h2 className="text-xl sm:text-2xl text-white/90 font-body">Sign in to your account</h2>
        <p className="text-[#8A6A5C] text-xs sm:text-sm uppercase tracking-[0.15em] font-light">
          Welcome back
        </p>
      </div>

      <form className="w-full space-y-3 sm:space-y-3.5 animate-fade-in-up-delay" onSubmit={handlePasswordLogin} noValidate>
        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
          <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email, username, or phone"
            variant="minimal"
            className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
          />
        </div>

        <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-3 sm:pl-4 pr-10 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 touch-target-icon text-[#B76E79] hover:text-[#F2C29A] transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="remember-me" className="flex items-center gap-2 text-sm text-[#EAE0D5]/85 cursor-pointer">
            <span className="checkbox-wrapper">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                aria-label="Remember me"
              />
            </span>
            <span>Remember me</span>
          </label>

          <Link href="/auth/forgot-password" className="text-sm text-[#C27A4E] hover:text-[#F2C29A] transition-colors">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 sm:h-12 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
          <div className="animate-sheen"></div>
          <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-base group-hover:text-white transition-colors font-heading">
            {isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}
          </span>
        </Button>
      </form>

      <div className="w-full mt-3 animate-fade-in-up-delay">
        <Link
          href={loginOtpHref}
          className="w-full inline-flex items-center justify-center h-11 sm:h-12 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/90 hover:text-[#F2C29A] hover:border-[#F2C29A]/50 transition-all duration-300"
        >
          Login with OTP instead
        </Link>
      </div>

      <div className="w-full mt-6 sm:mt-8">
        <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
          New here?{' '}
          <Link href="/auth/register" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-sm font-bold tracking-widest">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPageContent;

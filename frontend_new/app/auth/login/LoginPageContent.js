'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Mail, Lock, MessageCircle, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../../../lib/authContext';
import { authApi } from '../../../lib/customerApi';
import logger from '../../../lib/logger';
import { getDeviceFingerprint, getDeviceName } from '../../../lib/deviceFingerprint';
import { useLogo, useSiteConfig } from '../../../lib/siteConfigContext';
import { getRedirectForRole, USER_ROLES } from '../../../lib/roles';
import { AUTH_COPY } from '../../../lib/authCopy';

/**
 * Unified login page — password and OTP in one page.
 * Toggle between modes with a clean switcher.
 */
export default function LoginPageContent({ redirectUrl = '/products' }) {
  const [mode, setMode] = useState('password'); // 'password' | 'otp'

  // Shared
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password mode
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // OTP mode
  const [verificationMethod, setVerificationMethod] = useState('otp_email');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimeLeft, setOtpTimeLeft] = useState(600);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef([]);
  const router = useRouter();
  const { login, user, isAuthenticated, setAuthStatus, loading } = useAuth();
  const logoUrl = useLogo();
  const { smsOtpEnabled, whatsappEnabled } = useSiteConfig();

  // Auto-fix OTP method if channel is disabled
  useEffect(() => {
    if (!smsOtpEnabled && verificationMethod === 'otp_sms') setVerificationMethod('otp_email');
    if (!whatsappEnabled && verificationMethod === 'otp_whatsapp') setVerificationMethod('otp_email');
  }, [smsOtpEnabled, whatsappEnabled, verificationMethod]);

  // OTP timers
  useEffect(() => {
    let otpTimer = null;
    let cooldownTimer = null;
    if (otpSent && otpTimeLeft > 0 && !otpExpired) {
      otpTimer = setInterval(() => {
        setOtpTimeLeft((prev) => {
          if (prev <= 1) { setOtpExpired(true); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    if (resendCooldown > 0) {
      cooldownTimer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => { if (otpTimer) clearInterval(otpTimer); if (cooldownTimer) clearInterval(cooldownTimer); };
  }, [otpSent, otpTimeLeft, otpExpired, resendCooldown]);

  const formatTime = useCallback((seconds) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  }, []);

  // Reset OTP state when switching modes
  // FIXED: Also reset isSubmitting to prevent stuck button state
  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setIsSubmitting(false);
    setOtpSent(false);
    setOtpDigits(['', '', '', '', '', '']);
    setOtpTimeLeft(600);
    setOtpExpired(false);
    setResendCooldown(0);
  };

  // === PASSWORD LOGIN ===
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier || !password) {
      setError('Please enter your credentials.');
      return;
    }
    setIsSubmitting(true);
    try {
      const [device_fingerprint, device_name] = await Promise.all([
        getDeviceFingerprint(), Promise.resolve(getDeviceName()),
      ]);
      const result = await login({
        identifier: identifier.trim(), password, remember_me: rememberMe,
        device_fingerprint, device_name,
      });
      logger.info('Login successful');
      const role = result?.user?.role || user?.role || USER_ROLES.CUSTOMER;
      const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
      setTimeout(() => router.push(target), 500);
    } catch (err) {
      logger.error('Login failed:', err);
      setError(err.message || AUTH_COPY.errors.invalidCredentials);
      setIsSubmitting(false);
    }
  };

  // === OTP: REQUEST ===
  const handleRequestOtp = async () => {
    if (!identifier) { setError(AUTH_COPY.errors.missingIdentifier); return; }
    setError('');
    setIsSubmitting(true);
    try {
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') otpType = 'WHATSAPP';
      else if (verificationMethod === 'otp_sms') otpType = 'SMS';
      await authApi.sendLoginOtpRequest(identifier.trim(), otpType);
      setOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpTimeLeft(600);
      setOtpExpired(false);
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || AUTH_COPY.errors.otpSendFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  // === OTP: VERIFY ===
  const handleOtpVerify = async (finalOtpValue) => {
    const otpValue = finalOtpValue || otpDigits.join('');
    if (otpValue.length !== 6) { setError('Please enter all 6 digits.'); return; }
    setError('');
    setIsSubmitting(true);
    try {
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') otpType = 'WHATSAPP';
      else if (verificationMethod === 'otp_sms') otpType = 'SMS';
      const [device_fingerprint, device_name] = await Promise.all([
        getDeviceFingerprint(), Promise.resolve(getDeviceName()),
      ]);
      const result = await login({
        identifier: identifier.trim(), otp_code: otpValue, login_method: 'otp',
        otp_type: otpType, remember_me: rememberMe, device_fingerprint, device_name,
      });
      logger.info('OTP Login successful');
      if (result?.user) setAuthStatus(result.user);
      const role = result?.user?.role || user?.role || USER_ROLES.CUSTOMER;
      const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
      setTimeout(() => router.push(target), 400);
    } catch (err) {
      logger.error('OTP Login failed:', err);
      setError(err.message || AUTH_COPY.errors.otpFailed);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setError('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    // FIXED: Guard against double-submit when all 6 digits entered
    if (next.every((d) => d) && !isSubmitting) setTimeout(() => handleOtpVerify(next.join('')), 50);
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    await handleRequestOtp();
  };

  // Redirect if already authenticated
  if (isAuthenticated && !loading) {
    const role = user?.role || USER_ROLES.CUSTOMER;
    const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
    router.push(target);
    return null;
  }

  return (
    <div className="w-full max-w-md md:max-w-lg flex flex-col items-center">
      {/* Logo */}
      <div className="flex flex-col items-center mb-4 sm:mb-5 animate-fade-in-up">
        <Image
          src={logoUrl || '/logo.png'} alt="Aarya Clothing Logo"
          width={96} height={96}
          className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
          priority
        />
      </div>

      {/* Title */}
      <div className="text-center mb-4 sm:mb-5 space-y-1 animate-fade-in-up-delay">
        <h2 className="text-xl sm:text-2xl text-white/90 font-body">Sign in to your account</h2>
        <p className="text-[#8A6A5C] text-xs sm:text-sm uppercase tracking-[0.15em] font-light">
          {mode === 'password' ? 'Sign in using password' : AUTH_COPY.loginOtpSubtitle}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="w-full mb-4 animate-fade-in-up-delay">
        <div className="flex bg-[#0B0608]/60 rounded-xl border border-[#B76E79]/20 p-1">
          <button
            type="button"
            onClick={() => switchMode('password')}
            className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
              mode === 'password'
                ? 'bg-[#7A2F57]/30 text-[#F2C29A] border border-[#F2C29A]/30'
                : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]/80'
            }`}
          >
            <Lock className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
            Password
          </button>
          <button
            type="button"
            onClick={() => switchMode('otp')}
            className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
              mode === 'otp'
                ? 'bg-[#7A2F57]/30 text-[#F2C29A] border border-[#F2C29A]/30'
                : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]/80'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
            OTP
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="w-full p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* === PASSWORD MODE === */}
      {mode === 'password' && (
        <form className="w-full space-y-3 sm:space-y-3.5 animate-fade-in-up-delay" onSubmit={handlePasswordLogin} noValidate>
          <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
            <Input
              id="identifier" name="identifier" type="text" autoComplete="username"
              required value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              placeholder={AUTH_COPY.identifierPlaceholder} variant="minimal"
              className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            />
          </div>

          <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
            <Input
              id="password" name="password" type={showPassword ? 'text' : 'password'}
              autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} variant="minimal"
              className="h-full pl-3 sm:pl-4 pr-10 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 touch-target-icon text-[#B76E79] hover:text-[#F2C29A] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="remember-me" className="flex items-center gap-2 text-sm text-[#EAE0D5]/85 cursor-pointer">
              <span className="checkbox-wrapper">
                <input id="remember-me" name="remember-me" type="checkbox"
                  checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} aria-label="Remember me" />
              </span>
              <span>Remember me</span>
            </label>
            <Link href="/auth/forgot-password" className="text-sm text-[#C27A4E] hover:text-[#F2C29A] transition-colors">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" disabled={isSubmitting}
            className="w-full h-11 sm:h-12 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
            <div className="animate-sheen"></div>
            <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-base group-hover:text-white transition-colors font-heading">
              {isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}
            </span>
          </Button>
        </form>
      )}

      {/* === OTP MODE === */}
      {mode === 'otp' && (
        <div className="w-full space-y-4 animate-fade-in-up-delay">
          {!otpSent ? (
            <>
              {/* OTP Method Selector */}
              <div className="space-y-2">
                <p className="text-[#EAE0D5]/60 text-[10px] uppercase tracking-widest">Verification method</p>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setVerificationMethod('otp_email')}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-300 ${
                      verificationMethod === 'otp_email'
                        ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                        : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                    }`}
                  >
                    <Mail className={`w-5 h-5 transition-colors ${verificationMethod === 'otp_email' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                    <p className="text-[10px] sm:text-[11px] text-[#EAE0D5]/90 font-bold tracking-widest">EMAIL</p>
                  </button>
                  <button type="button" disabled={!whatsappEnabled}
                    title={!whatsappEnabled ? 'WhatsApp OTP is not configured.' : undefined}
                    onClick={() => whatsappEnabled && setVerificationMethod('otp_whatsapp')}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-300 ${
                      !whatsappEnabled ? 'opacity-50 cursor-not-allowed bg-[#7A2F57]/5 border-[#B76E79]/20'
                        : verificationMethod === 'otp_whatsapp'
                          ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                          : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                    }`}
                  >
                    <MessageCircle className={`w-5 h-5 transition-colors ${verificationMethod === 'otp_whatsapp' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                    <p className="text-[10px] sm:text-[11px] text-[#EAE0D5]/90 font-bold tracking-widest">WA</p>
                  </button>
                  <button type="button" disabled={!smsOtpEnabled}
                    title={!smsOtpEnabled ? 'SMS OTP is not configured.' : undefined}
                    onClick={() => smsOtpEnabled && setVerificationMethod('otp_sms')}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-300 ${
                      !smsOtpEnabled ? 'opacity-50 cursor-not-allowed bg-[#7A2F57]/5 border-[#B76E79]/20'
                        : verificationMethod === 'otp_sms'
                          ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                          : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                    }`}
                  >
                    <Smartphone className={`w-5 h-5 transition-colors ${verificationMethod === 'otp_sms' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                    <p className="text-[10px] sm:text-[11px] text-[#EAE0D5]/90 font-bold tracking-widest">SMS</p>
                  </button>
                </div>
              </div>

              {/* Identifier Input */}
              <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
                <Input
                  id="identifier-otp" name="identifier-otp" type="text" autoComplete="username"
                  required value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={AUTH_COPY.identifierPlaceholder} variant="minimal"
                  className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
                />
              </div>

              <p className="text-[#EAE0D5]/40 text-[11px] px-1">
                {AUTH_COPY.otpDeliveryExplanation}{' '}
                <Link href="/auth/register" className="text-[#C27A4E] hover:text-[#F2C29A]">Create one here</Link>.
              </p>

              <label htmlFor="remember-me-otp" className="flex items-center gap-2 text-sm text-[#EAE0D5]/85 cursor-pointer">
                <span className="checkbox-wrapper">
                  <input id="remember-me-otp" type="checkbox" checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)} aria-label="Remember me on this device" />
                </span>
                <span>Remember me on this device</span>
              </label>

              <Button type="button" onClick={handleRequestOtp} disabled={isSubmitting || !identifier}
                className="w-full h-11 sm:h-12 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
                <div className="animate-sheen"></div>
                <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-base group-hover:text-white transition-colors font-heading">
                  {isSubmitting ? 'SENDING...' : 'SEND OTP'}
                </span>
              </Button>
            </>
          ) : (
            <>
              {/* OTP Verification */}
              <div className="text-center mb-2">
                <p className="text-sm text-[#EAE0D5]/80">
                  Enter the 6-digit code sent to your{' '}
                  {verificationMethod === 'otp_email' ? 'email' : verificationMethod === 'otp_whatsapp' ? 'WhatsApp' : 'phone'}
                </p>
                <p className={`text-sm mt-1 ${otpExpired ? 'text-red-300' : otpTimeLeft <= 30 ? 'text-amber-300' : 'text-[#EAE0D5]/70'}`}>
                  {otpExpired ? 'Code expired' : `Expires in ${formatTime(otpTimeLeft)}`}
                </p>
              </div>

              <div className="flex justify-center gap-1.5 sm:gap-2 mb-2">
                {otpDigits.map((digit, index) => (
                  <input key={index} ref={(el) => { otpRefs.current[index] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => handleOtpDigit(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-9 sm:w-11 h-12 text-center text-lg font-bold border-2 border-[#B76E79]/30 bg-[#0B0608]/60 text-[#F2C29A] rounded-lg focus:border-[#F2C29A] focus:outline-none"
                  />
                ))}
              </div>

              <Button type="button" onClick={() => handleOtpVerify()} disabled={isSubmitting || otpDigits.some((d) => !d)}
                className="w-full h-11 sm:h-12 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
                <div className="animate-sheen"></div>
                <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-base group-hover:text-white transition-colors font-heading">
                  {isSubmitting ? 'VERIFYING...' : 'VERIFY & LOG IN'}
                </span>
              </Button>

              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-sm text-[#EAE0D5]/70">Resend in {resendCooldown}s</p>
                ) : (
                  <button type="button" onClick={handleResendOtp} className="text-sm text-[#C27A4E] hover:text-[#F2C29A]">
                    Resend OTP
                  </button>
                )}
              </div>

              <p className="text-center text-[#EAE0D5]/50 text-xs px-2">
                {AUTH_COPY.otpTroubleshooting}
              </p>

              <div className="text-center">
                <button type="button" onClick={() => { setOtpSent(false); setError(''); }}
                  className="text-sm text-[#8A6A5C] hover:text-[#EAE0D5]/80"
                >
                  ← Change method or identifier
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="w-full mt-4 sm:mt-5 space-y-2">
        <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
          New here?{' '}
          <Link href="/auth/register" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-sm font-bold tracking-widest">
            Create account
          </Link>
        </p>
        <p className="text-center text-[#EAE0D5]/40 text-[11px] uppercase tracking-wider">
          {AUTH_COPY.needBothToRegister}
        </p>
      </div>
    </div>
  );
}

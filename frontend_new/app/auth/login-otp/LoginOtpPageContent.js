'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, MessageCircle, Smartphone } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '../../../lib/authContext';
import logger from '../../../lib/logger';
import { getDeviceFingerprint, getDeviceName } from '../../../lib/deviceFingerprint';
import { useLogo, useSiteConfig } from '../../../lib/siteConfigContext';
import { getRedirectForRole, USER_ROLES } from '../../../lib/roles';

/**
 * OTP-only login — same API as password login but via /api/v1/auth/login-otp-request + login-otp-verify.
 */
export default function LoginOtpPageContent({ redirectUrl = '/products' }) {
  const [identifier, setIdentifier] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState('otp_email');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimeLeft, setOtpTimeLeft] = useState(600);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef([]);
  const router = useRouter();
  const { login, user, isAuthenticated, setAuthStatus } = useAuth();
  const logoUrl = useLogo();
  const { smsOtpEnabled, whatsappEnabled } = useSiteConfig();

  useEffect(() => {
    if (!smsOtpEnabled && verificationMethod === 'otp_sms') {
      setVerificationMethod('otp_email');
    }
    if (!whatsappEnabled && verificationMethod === 'otp_whatsapp') {
      setVerificationMethod('otp_email');
    }
  }, [smsOtpEnabled, whatsappEnabled, verificationMethod]);

  useEffect(() => {
    let otpTimer = null;
    let cooldownTimer = null;

    if (otpSent && otpTimeLeft > 0 && !otpExpired) {
      otpTimer = setInterval(() => {
        setOtpTimeLeft((prev) => {
          if (prev <= 1) {
            setOtpExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    if (resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (otpTimer) clearInterval(otpTimer);
      if (cooldownTimer) clearInterval(cooldownTimer);
    };
  }, [otpSent, otpTimeLeft, otpExpired, resendCooldown]);

  const handleRequestOtp = async () => {
    if (!identifier) {
      setError('Please enter your email, username, or phone number.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') otpType = 'WHATSAPP';
      else if (verificationMethod === 'otp_sms') otpType = 'SMS';

      // Fix #4: Use authApi.sendLoginOtpRequest instead of raw fetch
      // This automatically uses coreClient with its standardized error parsing.
      await authApi.sendLoginOtpRequest(identifier.trim(), otpType);

      setOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpTimeLeft(600);
      setOtpExpired(false);
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpLogin = async (finalOtpValue) => {
    const otpValue = finalOtpValue || otpDigits.join('');
    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') otpType = 'WHATSAPP';
      else if (verificationMethod === 'otp_sms') otpType = 'SMS';

      const [device_fingerprint, device_name] = await Promise.all([
        getDeviceFingerprint(),
        Promise.resolve(getDeviceName()),
      ]);

      const result = await login({
        identifier: identifier.trim(),
        otp_code: otpValue,
        login_method: 'otp',
        otp_type: otpType,
        remember_me: rememberMe,
        device_fingerprint,
        device_name,
      });

      logger.info('OTP Login successful');

      // Update centralized auth context immediately
      if (result?.user) {
        setAuthStatus(result.user);
      }

      const role = result?.user?.role || user?.role || USER_ROLES.CUSTOMER;
      const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
      setTimeout(() => router.push(target), 400);
    } catch (err) {
      logger.error('OTP Login failed:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
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

    if (next.every((d) => d)) {
      const fullOtp = next.join('');
      setTimeout(() => handleOtpLogin(fullOtp), 50);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    await handleRequestOtp();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isAuthenticated) {
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
        <h2 className="text-xl sm:text-2xl text-white/90 font-body">Login with OTP</h2>
        <p className="text-[#8A6A5C] text-xs sm:text-sm uppercase tracking-[0.15em] font-light">
          Passwordless sign in
        </p>
      </div>

      {error && (
        <div className="w-full p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="w-full space-y-4">
        {!otpSent ? (
          <>
            <div className="space-y-2">
              <p className="text-[#EAE0D5]/60 text-[10px] uppercase tracking-widest">Verification method</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setVerificationMethod('otp_email')}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-300 ${
                    verificationMethod === 'otp_email'
                      ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                      : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                  }`}
                >
                  <Mail className={`w-5 h-5 transition-colors ${verificationMethod === 'otp_email' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                  <p className="text-[10px] sm:text-[11px] text-[#EAE0D5]/90 font-bold tracking-widest">EMAIL</p>
                </button>
                <button
                  type="button"
                  disabled={!whatsappEnabled}
                  title={!whatsappEnabled ? 'WhatsApp OTP is not configured.' : undefined}
                  onClick={() => whatsappEnabled && setVerificationMethod('otp_whatsapp')}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-300 ${
                    !whatsappEnabled
                      ? 'opacity-50 cursor-not-allowed bg-[#7A2F57]/5 border-[#B76E79]/20'
                      : verificationMethod === 'otp_whatsapp'
                        ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                        : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                  }`}
                >
                  <MessageCircle className={`w-5 h-5 transition-colors ${verificationMethod === 'otp_whatsapp' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                  <p className="text-[10px] sm:text-[11px] text-[#EAE0D5]/90 font-bold tracking-widest">WA</p>
                </button>
                <button
                  type="button"
                  disabled={!smsOtpEnabled}
                  title={!smsOtpEnabled ? 'SMS OTP is not configured.' : undefined}
                  onClick={() => smsOtpEnabled && setVerificationMethod('otp_sms')}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-300 ${
                    !smsOtpEnabled
                      ? 'opacity-50 cursor-not-allowed bg-[#7A2F57]/5 border-[#B76E79]/20'
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

            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
              <Input
                id="identifier-otp"
                name="identifier-otp"
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

            <label htmlFor="remember-me-otp" className="flex items-center gap-2 text-sm text-[#EAE0D5]/85 cursor-pointer">
              <span className="checkbox-wrapper">
                <input
                  id="remember-me-otp"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  aria-label="Remember me on this device"
                />
              </span>
              <span>Remember me on this device</span>
            </label>

            <Button
              type="button"
              onClick={handleRequestOtp}
              disabled={isSubmitting || !identifier}
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
            <div className="text-center mb-2">
              <p className="text-sm text-[#EAE0D5]/80">
                Enter the 6-digit code sent to your{' '}
                {verificationMethod === 'otp_email' ? 'email' : verificationMethod === 'otp_whatsapp' ? 'WhatsApp' : 'phone'}
              </p>
              <p className={`text-sm mt-1 ${otpExpired ? 'text-red-300' : otpTimeLeft <= 30 ? 'text-amber-300' : 'text-[#EAE0D5]/70'}`}>
                {otpExpired ? 'Code expired' : `Expires in ${formatTime(otpTimeLeft)}`}
              </p>
            </div>

            <div className="flex justify-center gap-2 mb-2">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    otpRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigit(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-11 h-12 text-center text-lg font-bold border-2 border-[#B76E79]/30 bg-[#0B0608]/60 text-[#F2C29A] rounded-lg focus:border-[#F2C29A] focus:outline-none"
                />
              ))}
            </div>

            <Button
              type="button"
              onClick={handleOtpLogin}
              disabled={isSubmitting || otpDigits.some((d) => !d)}
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

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setError('');
                }}
                className="text-sm text-[#8A6A5C] hover:text-[#EAE0D5]/80"
              >
                ← Change method or identifier
              </button>
            </div>
          </>
        )}
      </div>

      <div className="w-full mt-6 sm:mt-8">
        <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
          <Link href={`/auth/login?redirect_url=${encodeURIComponent(redirectUrl)}`} className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors mr-2 uppercase text-xs font-bold tracking-widest">
            Password login
          </Link>
          ·
          <Link href="/auth/register" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-2 uppercase text-xs font-bold tracking-widest">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

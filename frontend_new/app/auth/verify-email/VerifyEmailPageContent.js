'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Smartphone, MessageCircle, RefreshCw, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../src/store/authStore';
import logger from '../../../lib/logger';

const OTP_EXPIRY_SECONDS = 120;
const RESEND_COOLDOWN_SECONDS = 30;

// Enhanced OTP Verification Page
function VerifyEmailPageContent() {
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimeLeft, setOtpTimeLeft] = useState(OTP_EXPIRY_SECONDS);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState('');
  const [status, setStatus] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState('otp_email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const otpRefs = useRef([]);
  const router = useRouter();
  const queryParams = useSearchParams();
  const { checkAuth, isAuthenticated } = useAuth();

  // Get email and method from query params
  useEffect(() => {
    const emailParam = queryParams.get('email');
    const methodParam = queryParams.get('method') || 'otp_email';
    const phoneParam = queryParams.get('phone');
    
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
    if (phoneParam) {
      setPhone(decodeURIComponent(phoneParam));
    }
    
    // Set verification method
    if (methodParam === 'otp_sms' || methodParam === 'otp_whatsapp') {
      setVerificationMethod(methodParam);
    } else {
      setVerificationMethod('otp_email');
    }
    
    // Start OTP timer
    startOtpTimers();
  }, [queryParams]);

  // Timer management
  useEffect(() => {
    let otpTimer = null;
    let cooldownTimer = null;

    if (otpTimeLeft > 0 && !otpExpired) {
      otpTimer = setInterval(() => {
        setOtpTimeLeft(prev => {
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
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }

    return () => {
      if (otpTimer) clearInterval(otpTimer);
      if (cooldownTimer) clearInterval(cooldownTimer);
    };
  }, [otpTimeLeft, otpExpired, resendCooldown]);

  const startOtpTimers = () => {
    setOtpTimeLeft(OTP_EXPIRY_SECONDS);
    setOtpExpired(false);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleOtpVerification = async (e) => {
    e?.preventDefault();
    setOtpError('');
    setIsVerifying(true);

    const otpValue = otpDigits.join('');
    
    if (otpValue.length !== 6) {
      setOtpError('Please enter all 6 digits.');
      setIsVerifying(false);
      return;
    }

    if (otpExpired) {
      setOtpError('This code has expired. Please request a new one.');
      setIsVerifying(false);
      return;
    }

    try {
      // Map verification method to API format
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_sms') {
        otpType = 'SMS';
      } else if (verificationMethod === 'otp_whatsapp') {
        otpType = 'WHATSAPP';
      }

      // Call backend to verify OTP
      const response = await fetch('/api/v1/auth/verify-otp-registration', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp_code: otpValue,
          ...(verificationMethod === 'otp_email' 
            ? { email } 
            : phone 
              ? { phone } 
              : { email }),
          otp_type: otpType,
          purpose: 'registration'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'OTP verification failed');
      }

      const data = await response.json();

      await checkAuth();
      setStatus(data?.message || 'Verification successful.');

      // Redirect to success page or products
      setTimeout(() => {
        router.push('/products');
      }, 1500);

    } catch (err) {
      logger.error('[OTP Verify] Verification failed:', err);
      setOtpError(err.message || 'Invalid OTP. Please try again.');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    
    setIsResending(true);
    setOtpError('');
    setStatus('');

    try {
      // Map verification method to API format
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') {
        otpType = 'WHATSAPP';
      } else if (verificationMethod === 'otp_sms') {
        otpType = 'SMS';
      }

      // Call backend to resend OTP
      const response = await fetch('/api/v1/auth/send-verification-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(verificationMethod === 'otp_email' ? { email } : { phone }),
          otp_type: otpType,
          purpose: 'registration'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Could not resend OTP');
      }

      setOtpDigits(['', '', '', '', '', '']);
      const methodLabel = verificationMethod === 'otp_email' ? 'Email' : verificationMethod === 'otp_whatsapp' ? 'WhatsApp' : 'SMS';
      setStatus(`New code sent to ${methodLabel}.`);
      startOtpTimers();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);

    } catch (err) {
      logger.error('Resend OTP failed:', err);
      setOtpError('Could not resend code. Please wait and try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setOtpError('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = '';
        setOtpDigits(next);
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      setOtpError('');
      otpRefs.current[5]?.focus();
    }
  };

  if (isAuthenticated) {
    router.push('/products');
    return null;
  }

  const otpValue = otpDigits.join('');
  const methodLabel = verificationMethod === 'otp_email' ? 'Email' : verificationMethod === 'otp_whatsapp' ? 'WhatsApp' : 'SMS';
  const contactInfo = verificationMethod === 'otp_email' ? email : phone;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center px-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-6 animate-fade-in-up">
        <div className="w-16 h-16 flex items-center justify-center text-3xl font-bold text-[#F2C29A] drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]" aria-label="Aarya Clothing">
          A
        </div>
      </div>

      {/* Verification Form */}
      <div className="w-full">
        <div className="text-center mb-6 space-y-2 animate-fade-in-up-delay">
          <h2 className="text-xl text-white/90 font-body">Verify Your {methodLabel}</h2>
          <p className="text-white/70 text-sm break-all px-1">
            We've sent a 6-digit code to:
          </p>
          <p className="text-[#F2C29A] font-medium break-all">
            {contactInfo}
          </p>
        </div>

        {/* Countdown Timer */}
        <div className={`flex items-center justify-center gap-2 mb-4 text-sm ${otpExpired ? 'text-red-400' : otpTimeLeft <= 30 ? 'text-amber-400' : 'text-[#F2C29A]'}`}>
          <span className="text-lg font-mono font-semibold tabular-nums">{Math.floor(otpTimeLeft / 60)}:{String(otpTimeLeft % 60).padStart(2, '0')}</span>
          <span className="text-xs">{otpExpired ? '— expired' : 'left'}</span>
        </div>

        {/* OTP Input Form */}
        <form onSubmit={handleOtpVerification} noValidate>
          <div className="flex gap-1.5 sm:gap-2 justify-center mb-4" onPaste={handleOtpPaste} role="group" aria-label="One-time password">
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={el => otpRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpDigit(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                disabled={isVerifying || otpExpired}
                aria-label={`Digit ${i + 1} of 6`}
                className={[
                  'w-9 h-11 sm:w-10 sm:h-12 text-center text-lg sm:text-xl font-bold font-mono rounded-lg border-2 transition-all duration-200 outline-none',
                  'bg-[#0B0608]/60 text-[#F2C29A] caret-[#F2C29A]',
                  digit ? 'border-[#F2C29A]/60 bg-[#7A2F57]/20' : 'border-[#B76E79]/30',
                  otpExpired ? 'opacity-50 cursor-not-allowed' : 'focus:border-[#F2C29A] focus:bg-[#7A2F57]/15 focus:shadow-[0_0_0_3px_rgba(242,194,154,0.1)]',
                ].join(' ')}
              />
            ))}
          </div>

          {otpError && (
            <div className="text-center text-sm text-red-300 mb-4 py-2 px-4 bg-red-500/10 rounded-xl border border-red-500/20" role="alert" aria-live="assertive">
              {otpError}
            </div>
          )}
          
          {status && !otpError && (
            <div className="text-center text-sm text-green-300 mb-4 py-2 px-4 bg-green-500/10 rounded-xl border border-green-500/20" role="status" aria-live="polite">
              {status}
            </div>
          )}

          <Button
            type="submit"
            disabled={isVerifying || otpValue.length !== 6 || otpExpired}
            className="w-full h-11 sm:h-12 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={isVerifying}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90" />
            <span className="relative z-10 text-white font-serif tracking-[0.12em] text-base">
              {isVerifying ? 'VERIFYING...' : 'VERIFY & CONTINUE'}
            </span>
          </Button>
        </form>

        {/* Resend OTP */}
        <div className="text-center mt-4 space-y-1">
          <p className="text-[#EAE0D5]/50 text-xs">Didn't receive the code?</p>
          {resendCooldown > 0 ? (
            <p className="text-[#EAE0D5]/40 text-sm">
              Resend available in <span className="text-[#F2C29A] font-mono tabular-nums">{resendCooldown}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isResending}
              className="flex items-center gap-2 mx-auto text-[#C27A4E] hover:text-[#F2C29A] transition-colors text-sm font-bold tracking-widest uppercase disabled:opacity-50"
            >
              {isResending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Resend via {methodLabel}
            </button>
          )}
        </div>

        {/* Method Info */}
        <div className="mt-6 p-3 rounded-lg border border-[#B76E79]/20 bg-[#0B0608]/25">
          <p className="text-[#EAE0D5]/70 text-xs mb-2">Verification Method:</p>
          <div className="flex items-center gap-2">
            {verificationMethod === 'otp_email' && <Mail className="w-4 h-4 text-[#F2C29A]" />}
            {verificationMethod === 'otp_sms' && <Smartphone className="w-4 h-4 text-[#F2C29A]" />}
            {verificationMethod === 'otp_whatsapp' && <MessageCircle className="w-4 h-4 text-[#F2C29A]" />}
            <span className="text-[#F2C29A] text-sm font-medium capitalize">
              {methodLabel} OTP
            </span>
          </div>
          <p className="text-[#EAE0D5]/60 text-xs mt-1">
            {verificationMethod === 'otp_email' ? 'Check your email inbox' : 'Check your messages'}
          </p>
        </div>

        {/* Help Link */}
        <div className="w-full mt-4">
          <p className="text-center text-[#8A6A5C] text-xs tracking-wide">
            Need help?{' '}
            <Link href="/support" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-xs font-bold tracking-widest">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPageContent;

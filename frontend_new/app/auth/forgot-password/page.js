'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Phone, MessageCircle, CheckCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { authApi } from '../../../lib/customerApi';
import { useLogo } from '../../../lib/siteConfigContext';
import logger from '../../../lib/logger';
import { validatePhone, formatTime, getErrorMessage } from '../../../lib/authHelpers';

const OTP_EXPIRY_SECONDS = 120;
const RESEND_COOLDOWN_SECONDS = 30;

// Total steps in the flow
const TOTAL_STEPS = 3;

export default function ForgotPasswordPage() {
  const logoUrl = useLogo();
  const router = useRouter();

  // Step management: 1 = form, 2 = OTP input, 3 = success (verified, redirecting)
  const [step, setStep] = useState(1);

  // Form state
  const [identifier, setIdentifier] = useState('');
  // FIX: Default to email OTP since WhatsApp is not configured in production
  const [verificationMethod, setVerificationMethod] = useState('otp_email');

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);
  const [otpTimeLeft, setOtpTimeLeft] = useState(OTP_EXPIRY_SECONDS);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const otpValue = otpDigits.join('');

  // Timer management
  useEffect(() => {
    let otpTimer = null;
    let cooldownTimer = null;

    if (step === 2 && otpTimeLeft > 0 && !otpExpired) {
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

    if (step === 2 && resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }

    return () => {
      if (otpTimer) clearInterval(otpTimer);
      if (cooldownTimer) clearInterval(cooldownTimer);
    };
  }, [step, otpTimeLeft, otpExpired, resendCooldown]);

  const startOtpTimers = () => {
    setOtpTimeLeft(OTP_EXPIRY_SECONDS);
    setOtpExpired(false);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setIsSubmitting(true);

    if (!identifier) {
      setError('Please enter your email or phone number.');
      setIsSubmitting(false);
      return;
    }

    // Validate based on method
    if (verificationMethod === 'otp_email') {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        setError('Please enter a valid email address.');
        setIsSubmitting(false);
        return;
      }
    } else {
      // WhatsApp - validate phone
      const phoneValidation = validatePhone(identifier);
      if (!phoneValidation.valid) {
        setError(phoneValidation.message);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const otpType = verificationMethod === 'otp_email' ? 'EMAIL' : 'WHATSAPP';

      // Fix #3: Use identifier field (not email) to match backend ForgotPasswordRequest schema
      // Fix #5: Use authApi.forgotPassword() instead of raw apiFetch
      await authApi.forgotPassword(identifier.trim(), otpType);

      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      startOtpTimers();
      setStep(2);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      logger.error('Forgot password OTP request failed:', err);
      // Fix #9: Handle rate limit errors (429)
      if (err.status === 429) {
        setError('Too many requests. Please try again later.');
      } else {
        setError(getErrorMessage(err.message, 'general'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpVerification = async (e) => {
    e?.preventDefault();
    setOtpError('');
    setIsVerifying(true);

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
      const otpType = verificationMethod === 'otp_email' ? 'EMAIL' : 'WHATSAPP';

      // Fix #4: Add OTP verification step - call new /api/v1/auth/verify-reset-otp endpoint
      // Fix #5: Use authApi.verifyResetOtp() instead of raw apiFetch
      const verifyResult = await authApi.verifyResetOtp(identifier, otpValue, otpType);

      // Only redirect to reset-password page AFTER successful OTP verification
      if (verifyResult.verified) {
        // SECURITY FIX: Store verification state in sessionStorage instead of URL
        // This prevents OTP from appearing in browser history, server logs, and Referer headers
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('otp_verification', JSON.stringify({
            identifier,
            otpType,
            verified: true,
            timestamp: Date.now()
          }));
          // Store OTP code separately (still client-side, but more secure than URL)
          sessionStorage.setItem('otp_code_temp', otpValue);
        }
        // Redirect WITHOUT otp_code in URL - only pass identifier and otp_type
        const redirectUrl = `/auth/reset-password?verified=${encodeURIComponent(identifier)}&otp_type=${otpType}`;
        router.push(redirectUrl);
      } else {
        // Show specific error based on error_code
        const errorCode = verifyResult.error_code;
        if (errorCode === 'EXPIRED') {
          setOtpError('This code has expired. Please request a new one.');
          setOtpExpired(true);
        } else if (errorCode === 'LOCKED') {
          setOtpError('Too many failed attempts. Please request a new code.');
          setOtpExpired(true);
        } else {
          setOtpError(verifyResult.message || 'Invalid OTP code.');
        }
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      }
    } catch (err) {
      logger.error('[OTP Verify] Verification failed:', err);
      // Fix #9: Handle rate limit errors (429)
      if (err.status === 429) {
        setOtpError('Too many requests. Please try again later.');
      } else {
        setOtpError(getErrorMessage(err.message, 'otp'));
      }
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
      const otpType = verificationMethod === 'otp_email' ? 'EMAIL' : 'WHATSAPP';

      // Fix #5: Use authApi.forgotPassword() instead of raw apiFetch
      await authApi.forgotPassword(identifier.trim(), otpType);

      setOtpDigits(['', '', '', '', '', '']);
      setStatus(`New code sent to ${verificationMethod === 'otp_email' ? 'email' : 'WhatsApp'}.`);
      startOtpTimers();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      logger.error('Resend OTP failed:', err);
      // Fix #9: Handle rate limit errors (429)
      if (err.status === 429) {
        setOtpError('Too many requests. Please wait and try again.');
      } else {
        setOtpError('Could not resend code. Please wait and try again.');
      }
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

  const handleBackToForm = () => {
    setStep(1);
    setError('');
    setOtpError('');
    setOtpDigits(['', '', '', '', '', '']);
  };

  return (
    <div className="w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] flex flex-col items-center">
      {/* LOGO - Fix #8: Replace img with Next.js Image component */}
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
                  stepNum <= step
                    ? 'bg-[#F2C29A] text-[#2A1208]'
                    : 'bg-[#B76E79]/30 text-[#EAE0D5]/40'
                }`}
              >
                {stepNum < step ? <CheckCircle className="w-5 h-5" /> : stepNum}
              </div>
              {stepNum < TOTAL_STEPS && (
                <div
                  className={`w-16 sm:w-24 h-1 mx-2 rounded transition-all duration-300 ${
                    stepNum < step ? 'bg-[#F2C29A]' : 'bg-[#B76E79]/30'
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

      {/* STEP 1: Request OTP Form */}
      {step === 1 && (
        <>
          <div className="text-center mb-10 lg:mb-12 space-y-2 animate-fade-in-up-delay">
            <h2 className="text-2xl sm:text-3xl md:text-4xl text-white/90 font-body">
              Forgot Password
            </h2>
            <p className="text-[#8A6A5C] text-sm sm:text-base uppercase tracking-[0.2em] font-light">
              Reset via OTP verification
            </p>
          </div>

          <form className="w-full space-y-5 sm:space-y-6 animate-fade-in-up-delay" onSubmit={handleRequestOtp} noValidate>
            {/* Verification Method Selector */}
            <div className="space-y-3">
              <p className="text-[#EAE0D5]/60 text-xs uppercase tracking-widest">Verification Method</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVerificationMethod('otp_email')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 ${
                    verificationMethod === 'otp_email'
                      ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                      : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                  }`}
                >
                  <Mail className={`w-6 h-6 transition-colors ${verificationMethod === 'otp_email' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                  <p className="text-xs text-[#EAE0D5]/90 font-bold tracking-widest">EMAIL OTP</p>
                  <p className="text-[10px] text-[#EAE0D5]/50 text-center">6-digit code via email</p>
                </button>

                <button
                  type="button"
                  onClick={() => setVerificationMethod('otp_whatsapp')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 ${
                    verificationMethod === 'otp_whatsapp'
                      ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                      : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                  }`}
                >
                  <MessageCircle className={`w-6 h-6 transition-colors ${verificationMethod === 'otp_whatsapp' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                  <p className="text-xs text-[#EAE0D5]/90 font-bold tracking-widest">WHATSAPP OTP</p>
                  <p className="text-[10px] text-[#EAE0D5]/50 text-center">6-digit code via WhatsApp</p>
                </button>
              </div>
            </div>

            {/* Identifier Input */}
            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              {verificationMethod === 'otp_email' ? (
                <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
              ) : (
                <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
              )}
              <Input
                type={verificationMethod === 'otp_email' ? 'email' : 'tel'}
                placeholder={verificationMethod === 'otp_email' ? 'Email Address' : 'Phone Number'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
                autoComplete={verificationMethod === 'otp_email' ? 'email' : 'tel'}
                aria-label={verificationMethod === 'otp_email' ? 'Email address' : 'Phone number'}
                required
              />
            </div>

            {/* Method-specific notice */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#7A2F57]/15 border border-[#B76E79]/20">
              {verificationMethod === 'otp_email' ? (
                <Mail className="w-5 h-5 text-[#F2C29A] flex-shrink-0" />
              ) : (
                <MessageCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0" />
              )}
              <p className="text-[#EAE0D5]/70 text-sm">
                We&apos;ll send a <strong className="text-[#F2C29A]">6-digit code</strong> to your{' '}
                {verificationMethod === 'otp_email' ? 'email address' : 'WhatsApp number'} to verify your identity.
              </p>
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

              <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.1em] sm:tracking-[0.15em] text-lg sm:text-xl md:text-2xl group-hover:text-white transition-colors font-heading">
                {isSubmitting ? 'SENDING...' : 'SEND CODE'}
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

          <div className="w-full mt-10 sm:mt-12 md:mt-14">
            <p className="text-center text-[#8A6A5C] text-sm sm:text-base tracking-wide">
              Remember your password?{" "}
              <Link href="/auth/login" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-sm font-bold tracking-widest">
                Sign In
              </Link>
            </p>
          </div>
        </>
      )}

      {/* STEP 2: OTP Verification */}
      {step === 2 && (
        <div className="w-full animate-fade-in-up-delay">
          <div className="text-center mb-6 space-y-2">
            <div className="w-16 h-16 rounded-full bg-[#7A2F57]/30 border border-[#B76E79]/30 flex items-center justify-center mx-auto mb-4">
              {verificationMethod === 'otp_email' ? (
                <Mail className="w-8 h-8 text-[#F2C29A]" />
              ) : (
                <MessageCircle className="w-8 h-8 text-[#F2C29A]" />
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl text-white/90 font-body">
              Verify Your {verificationMethod === 'otp_email' ? 'Email' : 'Phone Number'}
            </h2>
            <p className="text-white/70 text-sm sm:text-base">
              Code sent to {verificationMethod === 'otp_email' ? 'Email' : 'WhatsApp'}:{' '}
              <strong className="text-[#F2C29A]">{identifier}</strong>
            </p>
            <p className="text-white/50 text-xs">Enter the 6-digit code below</p>
          </div>

          {/* Countdown Timer */}
          <div className={`flex items-center justify-center gap-2 mb-6 ${otpExpired ? 'text-red-400' : otpTimeLeft <= 30 ? 'text-amber-400' : 'text-[#F2C29A]'}`}>
            <span className="text-2xl font-mono font-semibold tabular-nums">{formatTime(otpTimeLeft)}</span>
            <span className="text-sm">{otpExpired ? '— Code expired' : 'remaining'}</span>
          </div>

          {/* OTP Input Form */}
          <form onSubmit={handleOtpVerification} noValidate>
            <div className="flex gap-2 sm:gap-3 justify-center mb-6" onPaste={handleOtpPaste} role="group" aria-label="One-time password">
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
                    'w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl border-2 transition-all duration-200 outline-none',
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
              className="w-full h-14 relative overflow-hidden rounded-2xl bg-transparent border border-[#B76E79]/40 transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={isVerifying}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90" />
              <span className="relative z-10 text-white font-serif tracking-[0.15em] text-lg">
                {isVerifying ? 'VERIFYING...' : 'VERIFY & RESET'}
              </span>
            </Button>
          </form>

          {/* Resend OTP */}
          <div className="text-center mt-6 space-y-2">
            <p className="text-[#EAE0D5]/50 text-sm">Didn&apos;t receive the code?</p>
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
                Resend via {verificationMethod === 'otp_email' ? 'Email' : 'WhatsApp'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleBackToForm}
            className="w-full mt-4 py-3 text-center text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70 transition-colors text-sm uppercase tracking-widest"
          >
            ← Back to Form
          </button>
        </div>
      )}
    </div>
  );
}

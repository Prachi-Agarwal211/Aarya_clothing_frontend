'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, Eye, EyeOff, Phone, User, Smartphone, CheckCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '../../../lib/customerApi';
import { setAuthData } from '../../../lib/baseApi';
import { useAuth } from '../../../lib/authContext';
import { useLogo } from '../../../lib/siteConfigContext';
import logger from '../../../lib/logger';
import { validatePhone, validatePassword, formatTime, getErrorMessage } from '../../../lib/authHelpers';

const OTP_EXPIRY_SECONDS = 120;
const RESEND_COOLDOWN_SECONDS = 30;

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  // FIX: Default to email OTP since SMS is not configured in production
  const [verificationMethod, setVerificationMethod] = useState('otp_email');
  
  const otpRefs = useRef([]);
  const [otpTimeLeft, setOtpTimeLeft] = useState(OTP_EXPIRY_SECONDS);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { login, isAuthenticated, loading, user, isStaff, checkAuth } = useAuth();
  const logoUrl = useLogo();

  const passwordValidation = password ? validatePassword(password) : null;
  const passwordStrength = passwordValidation?.strength;
  const passwordsMatch = confirmPassword ? password === confirmPassword : null;
  const otpValue = otpDigits.join('');

  // Handle ?step=verify&email= params — unverified users redirected from login page
  useEffect(() => {
    const stepParam = searchParams?.get('step');
    const emailParam = searchParams?.get('email');
    if (stepParam === 'verify' && emailParam) {
      setEmail(decodeURIComponent(emailParam));
      setVerificationMethod('otp_email');
      // Send OTP to email and jump to verification step
      const sendOtp = async () => {
        try {
          await authApi.resendVerificationOtp({ email: decodeURIComponent(emailParam), otp_type: 'EMAIL' });
          startOtpTimers();
          setStep(2);
        } catch (err) {
          logger.warn('Failed to send OTP to unverified email:', err?.message);
          // Still jump to step 2 — user can use resend
          startOtpTimers();
          setStep(2);
        }
      };
      sendOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      router.push(isStaff() ? '/admin' : '/products');
    }
  }, [loading, isAuthenticated, user, isStaff, router]);

  // eslint-disable-next-line no-unused-vars
  const formatTime = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

  const startOtpTimers = () => {
    setOtpTimeLeft(OTP_EXPIRY_SECONDS);
    setOtpExpired(false);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setIsSubmitting(true);

    // Validate all fields
    if (!fullName || !username || !email || !password || !phone) {
      setError('Please fill in all required fields.');
      setIsSubmitting(false);
      return;
    }

    // Validate phone number
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      setError(phoneValidation.message);
      setIsSubmitting(false);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      setIsSubmitting(false);
      return;
    }

    try {
      await authApi.register({
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          role: 'customer',
          verification_method: verificationMethod,
      });

      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      startOtpTimers();
      setStep(2);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      logger.error('Registration failed:', err);
      setError(getErrorMessage(err.message, 'registration'));
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
      const otpType = verificationMethod === 'otp_email' ? 'EMAIL' : 'SMS';
      const identifier = verificationMethod === 'otp_email' ? email : phone;

      const response = await authApi.verifyOtpRegistration({
        otp_code: otpValue,
        ...(verificationMethod === 'otp_email' ? { email } : { phone }),
        otp_type: otpType,
      });

      if (response?.user) {
        setAuthData({
          access_token: response.tokens?.access_token || response.access_token,
          refresh_token: response.tokens?.refresh_token || response.refresh_token,
          user: response.user,
        });
        await checkAuth();
      }

      setStep(3);
      setTimeout(() => router.push('/products'), 1500);
    } catch (err) {
      logger.error('[OTP Verify] Verification failed:', err);
      setOtpError(getErrorMessage(err.message, 'otp'));
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
      const otpType = verificationMethod === 'otp_email' ? 'EMAIL' : 'SMS';
      const identifier = verificationMethod === 'otp_email' ? email : phone;

      await authApi.resendVerificationOtp({
        ...(verificationMethod === 'otp_email' ? { email } : { phone }),
        otp_type: otpType,
      });

      setOtpDigits(['', '', '', '', '', '']);
      setStatus(`New code sent to ${verificationMethod === 'otp_email' ? 'email' : 'SMS'}.`);
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

  const handleBackToRegistration = () => {
    setStep(1);
    setError('');
    setOtpError('');
    setOtpDigits(['', '', '', '', '', '']);
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-8 sm:mb-10 md:mb-12 lg:mb-14 animate-fade-in-up">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Aarya Clothing Logo"
            className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
            loading="eager"
            fetchPriority="high"
          />
        ) : (
          <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 flex items-center justify-center text-4xl font-bold text-[#F2C29A] drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]" aria-label="Aarya Clothing">
            A
          </div>
        )}
      </div>

      {/* STEP 1: Registration Form */}
      {step === 1 && (
        <>
          <div className="text-center mb-10 lg:mb-12 space-y-2 animate-fade-in-up-delay">
            <h2 className="text-2xl sm:text-3xl md:text-4xl text-white/90 font-body">Create Account</h2>
            <p className="text-white/80 text-sm sm:text-base uppercase tracking-[0.2em] font-light">Begin your luxury journey</p>
          </div>

          <form className="w-full space-y-5 sm:space-y-6 animate-fade-in-up-delay" onSubmit={handleFormSubmit} noValidate>
            {/* Full Name */}
            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
                autoComplete="name"
                aria-label="Full name"
                required
              />
            </div>

            {/* Username */}
            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
                autoComplete="username"
                aria-label="Username"
                required
              />
            </div>

            {/* Email */}
            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
                autoComplete="email"
                aria-label="Email address"
                required
              />
            </div>

            {/* Phone */}
            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
              <Input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
                autoComplete="tel"
                aria-label="Phone number"
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
                autoComplete="new-password"
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

            {/* Confirm Password */}
            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
                autoComplete="new-password"
                aria-label="Confirm password"
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

            {/* Password Strength */}
            {passwordStrength && (
              <div className="space-y-2" aria-live="polite">
                <div className="flex gap-1" role="progressbar" aria-valuenow={passwordStrength.passed} aria-valuemin="0" aria-valuemax="4">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                        passwordStrength.passed >= level
                          ? passwordStrength.passed === 4
                            ? 'bg-green-500'
                            : passwordStrength.passed >= 3
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  {[
                    ['length', '8+ characters'],
                    ['upper', 'Uppercase letter'],
                    ['lower', 'Lowercase letter'],
                    ['number', 'Number'],
                  ].map(([key, label]) => (
                    <div key={key} className={`flex items-center gap-1.5 ${passwordStrength.checks[key] ? 'text-green-400' : 'text-white/40'}`}>
                      <span className="text-base leading-none">{passwordStrength.checks[key] ? '✓' : '○'}</span>
                      <span className="text-sm">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {confirmPassword && (
              <p className={`text-sm ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`} role="status" aria-live="polite">
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}

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
                  onClick={() => setVerificationMethod('otp_sms')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 ${
                    verificationMethod === 'otp_sms'
                      ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                      : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                  }`}
                >
                  <Smartphone className={`w-6 h-6 transition-colors ${verificationMethod === 'otp_sms' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                  <p className="text-xs text-[#EAE0D5]/90 font-bold tracking-widest">SMS OTP</p>
                  <p className="text-[10px] text-[#EAE0D5]/50 text-center">6-digit code via SMS</p>
                </button>
              </div>
            </div>

            {/* Method-specific notice */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#7A2F57]/15 border border-[#B76E79]/20">
              {verificationMethod === 'otp_email' ? (
                <Mail className="w-5 h-5 text-[#F2C29A] flex-shrink-0" />
              ) : (
                <Smartphone className="w-5 h-5 text-[#F2C29A] flex-shrink-0" />
              )}
              <p className="text-[#EAE0D5]/70 text-sm">
                We'll send a <strong className="text-[#F2C29A]">6-digit code</strong> to your{' '}
                {verificationMethod === 'otp_email' ? 'email address' : 'phone number'} to verify your account.
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 sm:h-16 md:h-18 mt-6 sm:mt-8 relative overflow-hidden rounded-2xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
              aria-busy={isSubmitting}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
              <div className="animate-sheen"></div>
              <span className="relative z-10 text-white font-serif tracking-[0.1em] sm:tracking-[0.15em] text-lg sm:text-xl md:text-2xl">
                {isSubmitting ? 'CREATING...' : 'CONTINUE'}
              </span>
            </Button>

            {error && (
              <div className="text-center text-sm text-red-300 py-2 px-4 bg-red-500/10 rounded-xl border border-red-500/20" role="alert" aria-live="assertive">
                {error}
              </div>
            )}
          </form>

          <div className="w-full mt-8">
            <p className="text-center text-[#8A6A5C] text-sm tracking-wide">
              Already have an account?{' '}
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
                <Smartphone className="w-8 h-8 text-[#F2C29A]" />
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl text-white/90 font-body">
              Verify Your {verificationMethod === 'otp_email' ? 'Email' : 'Phone Number'}
            </h2>
            <p className="text-white/70 text-sm sm:text-base">
              Code sent to {verificationMethod === 'otp_email' ? 'Email' : 'SMS'}:{' '}
              <strong className="text-[#F2C29A]">
                {verificationMethod === 'otp_email' ? email : phone}
              </strong>
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
                {isVerifying ? 'VERIFYING...' : 'VERIFY & CONTINUE'}
              </span>
            </Button>
          </form>

          {/* Resend OTP */}
          <div className="text-center mt-6 space-y-2">
            <p className="text-[#EAE0D5]/50 text-sm">Didn't receive the code?</p>
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
                Resend via {verificationMethod === 'otp_email' ? 'Email' : 'SMS'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleBackToRegistration}
            className="w-full mt-4 py-3 text-center text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70 transition-colors text-sm uppercase tracking-widest"
          >
            ← Back to Registration
          </button>
        </div>
      )}

      {/* STEP 3: Success */}
      {step === 3 && (
        <div className="w-full text-center animate-fade-in-up-delay">
          <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl text-white/90 font-body mb-3">Welcome to Aarya!</h2>
          <p className="text-white/60 text-sm sm:text-base mb-2">Your account has been verified successfully.</p>
          <p className="text-white/40 text-xs mb-8">Redirecting you to products...</p>
          <div className="w-8 h-8 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-6" />
          <Link href="/products" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors text-sm">
            Continue to Products
          </Link>
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin" />
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}

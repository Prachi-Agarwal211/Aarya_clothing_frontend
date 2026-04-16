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
import { useLogo, useSiteConfig } from '../../../lib/siteConfigContext';
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
  const recoveryVerifySentRef = useRef(false);
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
  const { smsOtpEnabled, whatsappEnabled } = useSiteConfig();

  const passwordValidation = password ? validatePassword(password) : null;
  const passwordStrength = passwordValidation?.strength;
  const passwordsMatch = confirmPassword ? password === confirmPassword : null;
  const otpValue = otpDigits.join('');

  // Handle ?step=verify&email=&method= — unverified users redirected from login page
  useEffect(() => {
    const stepParam = searchParams?.get('step');
    const emailParam = searchParams?.get('email');
    const methodParam = searchParams?.get('method') || 'otp_email';
    
    // Only auto-send OTP once when coming from login redirect
    if (stepParam !== 'verify' || !emailParam || recoveryVerifySentRef.current) {
      return;
    }
    
    recoveryVerifySentRef.current = true;
    const decodedEmail = decodeURIComponent(emailParam);
    setEmail(decodedEmail);
    const useSms = methodParam === 'otp_sms' && smsOtpEnabled;
    setVerificationMethod(useSms ? 'otp_sms' : 'otp_email');
    
    logger.info(`Auto-sending OTP for verification redirect: email=${decodedEmail}, method=${methodParam}`);
    
    const sendOtp = async () => {
      try {
        if (useSms) {
          await authApi.resendVerificationOtp({
            email: decodedEmail,
            otp_type: 'SMS',
          });
        } else {
          await authApi.resendVerificationOtp({
            email: decodedEmail,
            otp_type: 'EMAIL',
          });
        }
        logger.info('OTP sent successfully for verification redirect');
        startOtpTimers();
        setStep(2);
      } catch (err) {
        logger.warn('Failed to send verification code (will still show verification form):', err?.message);
        // Still show verification form even if OTP sending failed - user can retry
        startOtpTimers();
        setStep(2);
      }
    };
    sendOtp();
  }, [searchParams, smsOtpEnabled]);

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

  useEffect(() => {
    if (!smsOtpEnabled && verificationMethod === 'otp_sms') {
      setVerificationMethod('otp_email');
    }
  }, [smsOtpEnabled, verificationMethod]);

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
      let otp_type = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') {
        otp_type = 'WHATSAPP';
      } else if (verificationMethod === 'otp_sms') {
        otp_type = 'SMS';
      }

      await authApi.register({
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          role: 'customer',
          otp_type,
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

      const response = await authApi.verifyOtpRegistration({
        otp_code: otpValue,
        ...(verificationMethod === 'otp_email'
          ? { email }
          : phone?.trim()
            ? { phone: phone.trim() }
            : { email }),
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
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') {
        otpType = 'WHATSAPP';
      } else if (verificationMethod === 'otp_sms') {
        otpType = 'SMS';
      }

      await authApi.resendVerificationOtp({
        ...(verificationMethod === 'otp_email' ? { email } : { phone }),
        otp_type: otpType,
      });

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
    <div className="w-full max-w-md md:max-w-3xl flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-4 sm:mb-5 animate-fade-in-up">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Aarya Clothing Logo"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
            loading="eager"
            fetchPriority="high"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-3xl font-bold text-[#F2C29A] drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]" aria-label="Aarya Clothing">
            A
          </div>
        )}
      </div>

      {/* STEP 1: Registration Form */}
      {step === 1 && (
        <>
          <div className="text-center mb-4 sm:mb-5 space-y-1 animate-fade-in-up-delay">
            <h2 className="text-xl sm:text-2xl text-white/90 font-body">Create Account</h2>
            <p className="text-white/75 text-xs sm:text-sm uppercase tracking-[0.18em] font-light">Begin your luxury journey</p>
          </div>

          <form className="w-full space-y-3 sm:space-y-3.5 animate-fade-in-up-delay" onSubmit={handleFormSubmit} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Full Name */}
            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                variant="minimal"
                className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
                autoComplete="name"
                aria-label="Full name"
                required
              />
            </div>

            {/* Username */}
            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                variant="minimal"
                className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
                autoComplete="username"
                aria-label="Username"
                required
              />
            </div>

            {/* Email */}
            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                variant="minimal"
                className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
                autoComplete="email"
                aria-label="Email address"
                required
              />
            </div>

            {/* Phone */}
            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
              <Input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                variant="minimal"
                className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
                autoComplete="tel"
                aria-label="Phone number"
                required
              />
            </div>

            {/* Password */}
            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4 md:col-span-1">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                variant="minimal"
                className="h-full pl-3 sm:pl-4 pr-11 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
                autoComplete="new-password"
                aria-label="Password"
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

            {/* Confirm Password */}
            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4 md:col-span-1">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                variant="minimal"
                className="h-full pl-3 sm:pl-4 pr-11 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
                autoComplete="new-password"
                aria-label="Confirm password"
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

            {/* Password Strength — compact */}
            {passwordStrength && (
              <div className="space-y-2" aria-live="polite">
                <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs">
                  <div className="flex gap-0.5 flex-1 min-w-[120px] max-w-[200px]" role="progressbar" aria-valuenow={passwordStrength.passed} aria-valuemin="0" aria-valuemax="1">
                    {[1].map((level) => (
                      <div
                        key={level}
                        className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                          passwordStrength.passed >= level
                            ? 'bg-green-500'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[#EAE0D5]/50 whitespace-nowrap">
                    {passwordStrength.checks.length ? '●' : '○'} <span className="text-[#F2C29A]/90">{passwordStrength.passed}/1</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-1 text-[10px] sm:text-xs text-[#EAE0D5]/70">
                  <span className={passwordStrength.checks.length ? 'text-green-400' : 'text-[#EAE0D5]/50'}>{passwordStrength.checks.length ? '✓' : '○'} At least 5 characters</span>
                </div>
              </div>
            )}

            {confirmPassword && (
              <p className={`text-xs ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`} role="status" aria-live="polite">
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}

            {/* Verification Method Selector */}
            <div className="space-y-2">
              <p className="text-[#EAE0D5]/60 text-[10px] uppercase tracking-widest">Verification</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVerificationMethod('otp_email')}
                  className={`flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-300 ${
                    verificationMethod === 'otp_email'
                      ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                      : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                  }`}
                >
                  <Mail className={`w-5 h-5 transition-colors ${verificationMethod === 'otp_email' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                  <p className="text-[10px] sm:text-xs text-[#EAE0D5]/90 font-bold tracking-widest">EMAIL OTP</p>
                  <p className="text-[9px] text-[#EAE0D5]/50 text-center leading-tight">Code to email</p>
                </button>

                <button
                  type="button"
                  disabled={!whatsappEnabled}
                  onClick={() => whatsappEnabled && setVerificationMethod('otp_whatsapp')}
                  className={`flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-300 ${
                    !whatsappEnabled
                      ? 'opacity-50 cursor-not-allowed bg-[#7A2F57]/5 border-[#B76E79]/20'
                      : verificationMethod === 'otp_whatsapp'
                        ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                        : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                  }`}
                >
                  <MessageCircle className={`w-5 h-5 transition-colors ${verificationMethod === 'otp_whatsapp' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                  <p className="text-[10px] sm:text-xs text-[#EAE0D5]/90 font-bold tracking-widest uppercase">WhatsApp</p>
                  <p className="text-[9px] text-[#EAE0D5]/50 text-center leading-tight">
                    {whatsappEnabled ? 'Code to WhatsApp' : 'Not available'}
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!smsOtpEnabled}
                  aria-describedby={!smsOtpEnabled ? 'sms-otp-status' : undefined}
                  onClick={() => smsOtpEnabled && setVerificationMethod('otp_sms')}
                  className={`flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-300 ${
                    !smsOtpEnabled
                      ? 'opacity-50 cursor-not-allowed bg-[#7A2F57]/5 border-[#B76E79]/20'
                      : verificationMethod === 'otp_sms'
                        ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                        : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                  }`}
                >
                  <Smartphone className={`w-5 h-5 transition-colors ${verificationMethod === 'otp_sms' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                  <p className="text-[10px] sm:text-xs text-[#EAE0D5]/90 font-bold tracking-widest">SMS OTP</p>
                  <p className="text-[9px] text-[#EAE0D5]/50 text-center leading-tight">
                    {smsOtpEnabled ? 'Code by SMS' : 'Not available'}
                  </p>
                </button>
              </div>
              <div className="rounded-lg border border-[#B76E79]/20 bg-[#0B0608]/25 px-3 py-2 text-[10px] sm:text-[11px] text-[#EAE0D5]/70">
                <p>• Email OTP: <span className="text-green-400">Available</span></p>
                <p>• WhatsApp OTP: {whatsappEnabled ? <span className="text-green-400">Available</span> : <span className="text-amber-300">Currently unavailable</span>}</p>
                <p id="sms-otp-status">• SMS OTP: {smsOtpEnabled ? <span className="text-green-400">Available</span> : <span className="text-amber-300">Currently unavailable</span>}</p>
              </div>
              <p className="text-center text-[10px] sm:text-[11px] text-[#EAE0D5]/55">
                6-digit code to your {verificationMethod === 'otp_email' ? 'email' : 'phone'}.
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 sm:h-12 mt-1 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
              aria-busy={isSubmitting}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
              <div className="animate-sheen"></div>
              <span className="relative z-10 text-white font-serif tracking-[0.12em] text-base sm:text-lg">
                {isSubmitting ? 'CREATING...' : 'CONTINUE'}
              </span>
            </Button>

            {error && (
              <div className="text-center text-xs sm:text-sm text-red-300 py-2 px-3 bg-red-500/10 rounded-lg border border-red-500/20" role="alert" aria-live="assertive">
                {error}
              </div>
            )}
          </form>

          <div className="w-full mt-5 sm:mt-6">
            <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
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
        <div className="w-full max-w-md mx-auto animate-fade-in-up-delay">
          <div className="text-center mb-4 space-y-1">
            <div className="w-12 h-12 rounded-full bg-[#7A2F57]/30 border border-[#B76E79]/30 flex items-center justify-center mx-auto mb-2">
              {verificationMethod === 'otp_email' ? (
                <Mail className="w-6 h-6 text-[#F2C29A]" />
              ) : (
                <Smartphone className="w-6 h-6 text-[#F2C29A]" />
              )}
            </div>
            <h2 className="text-lg sm:text-xl text-white/90 font-body">
              Verify your {verificationMethod === 'otp_email' ? 'email' : 'phone'}
            </h2>
            <p className="text-white/70 text-xs sm:text-sm break-all px-1">
              Sent to: <strong className="text-[#F2C29A]">
                {verificationMethod === 'otp_email' ? email : phone}
              </strong>
            </p>
            <p className="text-white/45 text-[10px]">Enter the 6-digit code</p>
          </div>

          {/* Countdown Timer */}
          <div className={`flex items-center justify-center gap-2 mb-4 text-sm ${otpExpired ? 'text-red-400' : otpTimeLeft <= 30 ? 'text-amber-400' : 'text-[#F2C29A]'}`}>
            <span className="text-lg font-mono font-semibold tabular-nums">{formatTime(otpTimeLeft)}</span>
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
                Resend via {verificationMethod === 'otp_email' ? 'Email' : 'SMS'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleBackToRegistration}
            className="w-full mt-3 py-2 text-center text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70 transition-colors text-xs uppercase tracking-widest"
          >
            ← Back
          </button>
        </div>
      )}

      {/* STEP 3: Success */}
      {step === 3 && (
        <div className="w-full max-w-md mx-auto text-center animate-fade-in-up-delay">
          <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-lg sm:text-xl text-white/90 font-body mb-2">Welcome to Aarya!</h2>
          <p className="text-white/60 text-xs sm:text-sm mb-1">Account verified.</p>
          <p className="text-white/40 text-[10px] mb-4">Redirecting…</p>
          <div className="w-7 h-7 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <Link href="/products" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors text-xs sm:text-sm">
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
t function RegisterPage() {
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

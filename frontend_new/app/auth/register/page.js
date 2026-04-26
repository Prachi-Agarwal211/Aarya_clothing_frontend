'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, Eye, EyeOff, Smartphone, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../../../lib/authContext';
import logger from '../../../lib/logger';
import { getRedirectForRole, USER_ROLES } from '../../../lib/roles';
import { useLogo, useSiteConfig } from '../../../lib/siteConfigContext';

const OTP_EXPIRY_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 30;

const VERIFICATION_LABELS = {
  otp_email: 'email',
  otp_sms: 'phone via SMS',
  otp_whatsapp: 'WhatsApp number',
};

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [verificationMethod, setVerificationMethod] = useState('otp_email');
  const [otpTimeLeft, setOtpTimeLeft] = useState(OTP_EXPIRY_SECONDS);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const router = useRouter();
  const { user, isAuthenticated, setAuthStatus } = useAuth();
  const logoUrl = useLogo();
  const { smsOtpEnabled, whatsappEnabled } = useSiteConfig();
  const otpRefs = useRef([]);
  const expiryTimerRef = useRef(null);
  const cooldownTimerRef = useRef(null);

  const startExpiryTimer = () => {
    if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
    setOtpTimeLeft(OTP_EXPIRY_SECONDS);
    setOtpExpired(false);
    expiryTimerRef.current = setInterval(() => {
      setOtpTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(expiryTimerRef.current);
          setOtpExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startResendCooldown = () => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  React.useEffect(() => {
    return () => {
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!smsOtpEnabled && verificationMethod === 'otp_sms') {
      setVerificationMethod('otp_email');
    }
    if (!whatsappEnabled && verificationMethod === 'otp_whatsapp') {
      setVerificationMethod('otp_email');
    }
  }, [smsOtpEnabled, whatsappEnabled, verificationMethod]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Single digit only
    
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    
    // Auto-focus next input
    if (value && index < 5 && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 5) {
      setError('Password must be at least 5 characters');
      return;
    }

    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          password: password,
          verification_method: verificationMethod,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      await response.json();
      setStep(2);
      setRegistrationSuccess(true);
      setIsSubmitting(false);
      startExpiryTimer();
      startResendCooldown();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setError('');
    setResending(true);
    const otpType =
      verificationMethod === 'otp_email'
        ? 'EMAIL'
        : verificationMethod === 'otp_whatsapp'
        ? 'WHATSAPP'
        : 'SMS';
    const body =
      otpType === 'EMAIL'
        ? { email: email.trim(), otp_type: otpType, purpose: 'registration' }
        : { phone: phone.trim(), otp_type: otpType, purpose: 'registration' };
    try {
      const response = await fetch('/api/v1/auth/send-verification-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to resend code');
      }
      setOtpDigits(['', '', '', '', '', '']);
      startExpiryTimer();
      startResendCooldown();
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleOtpVerification = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    const otpValue = otpDigits.join('');

    const otpType =
      verificationMethod === 'otp_email'
        ? 'EMAIL'
        : verificationMethod === 'otp_whatsapp'
        ? 'WHATSAPP'
        : 'SMS';

    const body =
      otpType === 'EMAIL'
        ? { email: email.trim(), otp_code: otpValue, otp_type: otpType }
        : { phone: phone.trim(), otp_code: otpValue, otp_type: otpType };

    try {
      const response = await fetch('/api/v1/auth/verify-otp-registration', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'OTP verification failed');
      }

      const data = await response.json();
      logger.info('Registration & OTP verification successful', {
        userId: data?.user?.id,
      });

      // Update centralized auth context immediately
      if (data?.user) {
        setAuthStatus(data.user);
      }

      // Cookies are already set by the verify-otp-registration endpoint —
      // no second login round-trip needed (the user is now authenticated).
      const role = data?.user?.role || USER_ROLES.CUSTOMER;
      router.push(getRedirectForRole(role));
    } catch (error) {
      setError(error.message);
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isAuthenticated) {
    router.push(getRedirectForRole(user?.role || USER_ROLES.CUSTOMER));
    return null;
  }

  const verificationLabel = VERIFICATION_LABELS[verificationMethod] || 'email';
  const verificationTarget =
    verificationMethod === 'otp_email' ? email : phone;

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
        <h2 className="text-xl sm:text-2xl text-white/90 font-body">
          {step === 1 ? 'Create your account' : `Verify your ${verificationLabel}`}
        </h2>
        <p className="text-[#8A6A5C] text-xs sm:text-sm uppercase tracking-[0.15em] font-light">
          {step === 1 ? 'Join Aarya Clothing' : 'Complete verification'}
        </p>
      </div>

      {step === 1 ? (
        <form className="w-full space-y-3 sm:space-y-3.5 animate-fade-in-up-delay" onSubmit={handleRegistration} noValidate>
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative flex items-center px-4">
              <Input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                variant="minimal"
                className="h-full text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm"
              />
            </div>
            <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative flex items-center px-4">
              <Input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                variant="minimal"
                className="h-full text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm"
              />
            </div>
          </div>

          <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={5}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 5 chars)"
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

          <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={5}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              variant="minimal"
              className="h-full pl-3 sm:pl-4 pr-10 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2 touch-target-icon text-[#B76E79] hover:text-[#F2C29A] transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              variant="minimal"
              className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            />
          </div>

          <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              variant="minimal"
              className="h-full pl-3 sm:pl-4 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
            />
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-sm text-red-300">Passwords do not match.</p>
          )}

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
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 sm:h-12 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
            <div className="animate-sheen"></div>
            <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-base group-hover:text-white transition-colors font-heading">
              {isSubmitting ? 'REGISTERING...' : 'REGISTER'}
            </span>
          </Button>
        </form>
      ) : (
        <form className="w-full space-y-4 animate-fade-in-up-delay" onSubmit={handleOtpVerification}>
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="text-center mb-2">
            <div className="w-12 h-12 rounded-full bg-[#7A2F57]/30 border border-[#B76E79]/30 flex items-center justify-center mx-auto mb-2">
              {verificationMethod === 'otp_email' ? (
                <Mail className="w-6 h-6 text-[#F2C29A]" />
              ) : verificationMethod === 'otp_whatsapp' ? (
                <MessageCircle className="w-6 h-6 text-[#F2C29A]" />
              ) : (
                <Smartphone className="w-6 h-6 text-[#F2C29A]" />
              )}
            </div>
            <p className="text-[#EAE0D5]/80 text-sm">
              Enter the 6-digit code sent to <span className="text-[#F2C29A]">{verificationTarget}</span>
            </p>
          </div>

          <div className="flex justify-center gap-2">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={el => otpRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                className="w-11 h-12 text-center text-lg font-bold border-2 border-[#B76E79]/30 bg-[#0B0608]/60 text-[#F2C29A] rounded-lg focus:border-[#F2C29A] focus:outline-none"
              />
            ))}
          </div>

          <div className="text-center space-y-2">
            {!otpExpired ? (
              <p className="text-sm text-[#EAE0D5]/70">Code expires in {formatTime(otpTimeLeft)}</p>
            ) : (
              <p className="text-sm text-red-300">Code expired. Request a new one.</p>
            )}
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || resending}
              className="text-sm font-medium text-[#C27A4E] hover:text-[#F2C29A] disabled:text-[#8A6A5C] disabled:cursor-not-allowed"
            >
              {resending
                ? 'Sending…'
                : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend code'}
            </button>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || otpExpired || otpDigits.some(d => !d)}
            className="w-full h-11 sm:h-12 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
            <div className="animate-sheen"></div>
            <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-base group-hover:text-white transition-colors font-heading">
              {isSubmitting ? 'VERIFYING...' : 'VERIFY & COMPLETE'}
            </span>
          </Button>
        </form>
      )}

      <div className="w-full mt-6 sm:mt-8">
        <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-sm font-bold tracking-widest">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

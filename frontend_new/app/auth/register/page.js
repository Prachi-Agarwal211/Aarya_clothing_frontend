'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Smartphone, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../../../lib/authContext';
import logger from '../../../lib/logger';
import { getRedirectForRole, USER_ROLES } from '../../../lib/roles';
import { useLogo, useSiteConfig } from '../../../lib/siteConfigContext';
import { AUTH_COPY } from '../../../lib/authCopy';
import { validatePhone, toE164 } from '../../../lib/authHelpers';
import { userApi } from '../../../lib/customerApi';

const OTP_EXPIRY_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 30;

const VERIFICATION_LABELS = {
  otp_email: 'email',
  otp_sms: 'phone via SMS',
  otp_whatsapp: 'WhatsApp number',
};

/**
 * Simplified Registration Page - Phone First for Indian Users
 * 
 * Flow:
 * 1. Enter phone number
 * 2. Get OTP via SMS/WhatsApp
 * 3. Verify OTP
 * 4. Auto-create account
 * 5. Optional: Add name and email later
 */
export default function RegisterPage() {
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Profile (name+email), 4: Success
  const [completeProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('completeProfile') === 'true';
    }
    return false;
  });
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [verificationMethod, setVerificationMethod] = useState('otp_sms'); // Default SMS
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
      setVerificationMethod(whatsappEnabled ? 'otp_whatsapp' : 'otp_email');
    }
    if (!whatsappEnabled && verificationMethod === 'otp_whatsapp') {
      setVerificationMethod(smsOtpEnabled ? 'otp_sms' : 'otp_email');
    }
  }, [smsOtpEnabled, whatsappEnabled, verificationMethod]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    
    if (value && index < 5 && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
    
    // Auto-submit when all digits entered
    if (newDigits.every(d => d) && !isSubmitting) {
      setTimeout(() => handleOtpVerification(null, newDigits.join('')), 50);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  // Step 1: Register user with phone number (creates account + sends OTP)
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) {
      setError(AUTH_COPY.errors.missingPhone);
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      setError(phoneValidation.message || AUTH_COPY.errors.invalidPhone);
      return;
    }

    setIsSubmitting(true);

    try {
      const otpType = verificationMethod === 'otp_whatsapp' ? 'WHATSAPP' : 
                      verificationMethod === 'otp_email' ? 'EMAIL' : 'SMS';
      
      // Call the register endpoint — it creates the user AND sends OTP in one step.
      // The backend auto-generates email/username/password for phone-only registrations.
      const verificationMethodValue = verificationMethod === 'otp_whatsapp' ? 'otp_whatsapp' : 
                                      verificationMethod === 'otp_email' ? 'otp_email' : 'otp_sms';
      
      const body = {
        phone: toE164(phone),
        verification_method: verificationMethodValue,
      };
      
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        let message = 'Registration failed';
        if (errorData.detail) {
          message = typeof errorData.detail === 'string' ? errorData.detail : errorData.detail.message || 'Registration failed';
        } else if (errorData.error?.message) {
          message = errorData.error.message;
        }
        throw new Error(message);
      }

      const data = await response.json();
      logger.info('Registration initiated', { userId: data?.user?.id });

      setStep(2);
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
    
    const otpType = verificationMethod === 'otp_whatsapp' ? 'WHATSAPP' : 
                    verificationMethod === 'otp_email' ? 'EMAIL' : 'SMS';
    
    const body = {
      phone: toE164(phone),
      otp_type: otpType,
    };
    
    try {
      const response = await fetch('/api/v1/auth/send-verification-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        let message = 'Failed to resend code';
        if (errorData.detail) {
          message = typeof errorData.detail === 'string' ? errorData.detail : errorData.detail.message || message;
        }
        throw new Error(message);
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

  // Step 2: Verify OTP and create account
  const handleOtpVerification = async (e, finalOtpValue) => {
    e?.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    const otpValue = finalOtpValue || otpDigits.join('');

    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits.');
      setIsSubmitting(false);
      return;
    }

    if (otpExpired) {
      setError('This code has expired. Please request a new one.');
      setIsSubmitting(false);
      return;
    }

    const otpType = verificationMethod === 'otp_whatsapp' ? 'WHATSAPP' : 
                    verificationMethod === 'otp_email' ? 'EMAIL' : 'SMS';

    const body = { phone: toE164(phone), otp_code: otpValue, otp_type: otpType };

    try {
      const response = await fetch('/api/v1/auth/verify-otp-registration', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        let message = 'OTP verification failed';
        if (errorData.detail) {
          message = errorData.detail;
        } else if (errorData.error?.message) {
          message = errorData.error.message;
        }
        throw new Error(message);
      }

      const data = await response.json();
      logger.info('Registration & OTP verification successful', { userId: data?.user?.id });

      // Set auth status with the verified user data so the profile PATCH
      // endpoint can authenticate, and so the auth context knows about the user.
      if (data?.user) setAuthStatus(data.user);
      setStep(3);
      setRegistrationSuccess(true);
    } catch (error) {
      setError(error.message);
      setIsSubmitting(false);
    }
  };

  // Step 3: Save profile details (name + email) after OTP verification
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const body = {};
      if (firstName.trim()) {
        body.full_name = lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim();
      }
      if (email.trim()) {
        body.email = email.trim();
      }

      // Only call PATCH if there's something to save
      if (Object.keys(body).length > 0) {
        const updatedUser = await userApi.updateProfile(body);
        logger.info('Profile updated after registration', { userId: updatedUser?.id });
        setAuthStatus(updatedUser);
      } else {
        // No profile data to save — set auth status with empty object
        // so the isAuthenticated redirect in step 4 works
        setAuthStatus({});
      }

      // Move to success step
      setStep(4);
      setRegistrationSuccess(true);

      const role = USER_ROLES.CUSTOMER;
      setTimeout(() => {
        router.push(getRedirectForRole(role));
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If redirected from login with ?completeProfile=true, skip to step 3
  useEffect(() => {
    if (completeProfile && isAuthenticated) {
      setStep(3);
    }
  }, [completeProfile, isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated && !completeProfile) {
      router.push(getRedirectForRole(user?.role || USER_ROLES.CUSTOMER));
    }
  }, [isAuthenticated, user, router, completeProfile]);

  if (isAuthenticated) {
    return null;
  }

  const verificationLabel = VERIFICATION_LABELS[verificationMethod] || 'phone';

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
          {step === 1 ? 'Create your account' : 
           step === 2 ? `Verify your ${verificationLabel}` :
           step === 3 ? 'Complete your profile' :
           'Welcome to Aarya!'}
        </h2>
        <p className="text-[#8A6A5C] text-xs sm:text-sm uppercase tracking-[0.15em] font-light">
          {step === 1 ? 'Enter your phone number to get started' : 
           step === 2 ? 'Enter the code we sent you' :
           step === 3 ? 'Tell us about yourself' :
           'Your account is ready'}
        </p>
      </div>

      {/* Step 1: Phone Number Input */}
      {step === 1 && (
        <form className="w-full space-y-4 animate-fade-in-up-delay" onSubmit={handleSendOtp} noValidate>
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Phone Number - Large and prominent */}
          <div className="space-y-2">
            <label className="text-[#F5F0E8]/80 text-sm font-medium">Phone Number</label>              <div className="luxury-input-wrapper h-14 sm:h-16 rounded-xl relative group flex items-center px-4 bg-[#111111]/80 border border-[#A8B4C8]/30">
              <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-[#A8B4C8] group-focus-within:text-[#D4AF37] transition-colors duration-300 shrink-0" aria-hidden="true" />
              <span className="text-[#D4AF37] font-medium text-lg sm:text-xl ml-2 shrink-0 select-none">+91</span>
              <Input
                id="phone-register"
                name="phone-register"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhone(val);
                }}
                placeholder="XXXXXXXXXX"
                variant="minimal"
                className="h-full pl-2 text-[#F5F0E8] placeholder:text-[#8A6A5C] text-lg sm:text-xl font-medium tracking-wider"
              />
            </div>
            <p className="text-[#F5F0E8]/50 text-xs px-1">
              {AUTH_COPY.phoneFormatHint}
            </p>
          </div>

          {/* OTP Method Selector */}
          <div className="space-y-2">
            <p className="text-[#F5F0E8]/60 text-xs uppercase tracking-widest">Send OTP via</p>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setVerificationMethod('otp_sms')}
                disabled={!smsOtpEnabled}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 ${
                  !smsOtpEnabled 
                    ? 'opacity-50 cursor-not-allowed bg-[#1E3A5F]/5 border-[#A8B4C8]/20'
                    : verificationMethod === 'otp_sms'
                      ? 'bg-[#1E3A5F]/20 border-[#D4AF37]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                      : 'bg-[#1E3A5F]/10 border-[#A8B4C8]/30 hover:border-[#D4AF37]/40'
                }`}
              >
                <Smartphone className={`w-5 h-5 ${verificationMethod === 'otp_sms' ? 'text-[#D4AF37]' : 'text-[#A8B4C8]'}`} />
                <span className="text-sm font-medium text-[#F5F0E8]/90">SMS</span>
              </button>
              
              <button 
                type="button" 
                onClick={() => setVerificationMethod('otp_whatsapp')}
                disabled={!whatsappEnabled}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 ${
                  !whatsappEnabled 
                    ? 'opacity-50 cursor-not-allowed bg-[#1E3A5F]/5 border-[#A8B4C8]/20'
                    : verificationMethod === 'otp_whatsapp'
                      ? 'bg-[#1E3A5F]/20 border-[#D4AF37]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                      : 'bg-[#1E3A5F]/10 border-[#A8B4C8]/30 hover:border-[#D4AF37]/40'
                }`}
              >
                <MessageCircle className={`w-5 h-5 ${verificationMethod === 'otp_whatsapp' ? 'text-[#D4AF37]' : 'text-[#A8B4C8]'}`} />
                <span className="text-sm font-medium text-[#F5F0E8]/90">WhatsApp</span>
              </button>
              
              <button 
                type="button" 
                onClick={() => setVerificationMethod('otp_email')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 ${
                  verificationMethod === 'otp_email'
                    ? 'bg-[#1E3A5F]/20 border-[#D4AF37]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                    : 'bg-[#1E3A5F]/10 border-[#A8B4C8]/30 hover:border-[#D4AF37]/40'
                }`}
              >
                <Mail className={`w-5 h-5 ${verificationMethod === 'otp_email' ? 'text-[#D4AF37]' : 'text-[#A8B4C8]'}`} />
                <span className="text-sm font-medium text-[#F5F0E8]/90">Email</span>
              </button>
            </div>
          </div>

          {/* Send OTP Button - Large */}
          <Button
            type="submit"
            disabled={isSubmitting || !phone || phone.length < 10}
            className="w-full h-14 sm:h-16 relative overflow-hidden rounded-xl bg-transparent border border-[#A8B4C8]/40 group transition-all duration-500 hover:border-[#D4AF37]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#1E3A5F]/80 via-[#A8B4C8]/70 to-[#152238]/80 opacity-90"></div>
            <div className="animate-sheen"></div>
            <span className="relative z-10 text-[#D4AF37] font-serif tracking-[0.12em] text-lg group-hover:text-white transition-colors font-heading">
              {isSubmitting ? AUTH_COPY.sendingOtp : AUTH_COPY.sendOtpButton}
            </span>
          </Button>

          <p className="text-center text-[#F5F0E8]/50 text-sm px-2">
            {AUTH_COPY.newUserMessage}
          </p>
        </form>
      )}

      {/* Step 2: OTP Verification */}
      {step === 2 && (
        <form className="w-full space-y-4 animate-fade-in-up-delay" onSubmit={(e) => handleOtpVerification(e)}>
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[#1E3A5F]/30 border border-[#A8B4C8]/30 flex items-center justify-center mx-auto mb-3">
              {verificationMethod === 'otp_email' ? (
                <Mail className="w-7 h-7 text-[#D4AF37]" />
              ) : verificationMethod === 'otp_whatsapp' ? (
                <MessageCircle className="w-7 h-7 text-[#D4AF37]" />
              ) : (
                <Smartphone className="w-7 h-7 text-[#D4AF37]" />
              )}
            </div>
            <p className="text-[#F5F0E8]/80 text-base mb-1">
              {AUTH_COPY.otpEnterCode}
            </p>
            <p className="text-[#D4AF37] font-medium text-lg">
              +91 {phone}
            </p>
          </div>

          {/* OTP Input - Large digits */}
          <div className="flex justify-center gap-2 sm:gap-3">
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
                disabled={isSubmitting || otpExpired}
                className="w-12 sm:w-14 h-14 text-center text-xl font-bold border-2 border-[#A8B4C8]/30 bg-[#111111]/60 text-[#D4AF37] rounded-xl focus:border-[#D4AF37] focus:outline-none focus:shadow-[0_0_0_3px_rgba(242,194,154,0.1)]"
              />
            ))}
          </div>

          {/* Timer and Resend */}
          <div className="text-center space-y-2">
            {!otpExpired ? (
              <p className="text-sm text-[#F5F0E8]/70">{AUTH_COPY.otpExpiresIn} {formatTime(otpTimeLeft)}</p>
            ) : (
              <p className="text-sm text-red-300">Code expired. Request a new one.</p>
            )}
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || resending}
              className="text-sm font-medium text-[#F59E0B] hover:text-[#D4AF37] disabled:text-[#8A6A5C] disabled:cursor-not-allowed"
            >
              {resending
                ? 'Sending…'
                : resendCooldown > 0
                ? `${AUTH_COPY.otpResendIn} ${resendCooldown}s`
                : AUTH_COPY.otpResend}
            </button>
          </div>

          {/* Verify Button - Large */}
          <Button
            type="submit"
            disabled={isSubmitting || otpExpired || otpDigits.some(d => !d)}
            className="w-full h-14 sm:h-16 relative overflow-hidden rounded-xl bg-transparent border border-[#A8B4C8]/40 group transition-all duration-500 hover:border-[#D4AF37]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#1E3A5F]/80 via-[#A8B4C8]/70 to-[#152238]/80 opacity-90"></div>
            <div className="animate-sheen"></div>
            <span className="relative z-10 text-[#D4AF37] font-serif tracking-[0.12em] text-lg group-hover:text-white transition-colors font-heading">
              {isSubmitting ? AUTH_COPY.verifying : AUTH_COPY.verifyButton}
            </span>
          </Button>

          <div className="text-center">
            <button type="button" onClick={() => { setStep(1); setError(''); }}
              className="text-sm text-[#8A6A5C] hover:text-[#F5F0E8]/80"
            >
              ← Change phone number
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Optional Details + Success */}
      {/* Step 3: Profile details (name + email) */}
      {step === 3 && (
        <div className="w-full space-y-4 animate-fade-in-up-delay">
          <div className="text-center mb-2">
            <p className="text-[#F5F0E8]/70 text-sm">
              Tell us a bit about yourself so we can personalize your experience.
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleProfileSubmit}>
            <div className="space-y-2">
              <label className="text-[#F5F0E8]/80 text-sm font-medium">First Name *</label>
              <div className="luxury-input-wrapper h-12 rounded-xl">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  className="w-full h-full px-4 bg-transparent text-[#F5F0E8] placeholder:text-[#8A6A5C]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[#F5F0E8]/80 text-sm font-medium">Last Name</label>
              <div className="luxury-input-wrapper h-12 rounded-xl">
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  className="w-full h-full px-4 bg-transparent text-[#F5F0E8] placeholder:text-[#8A6A5C]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[#F5F0E8]/80 text-sm font-medium">Email Address</label>
              <div className="luxury-input-wrapper h-12 rounded-xl relative group flex items-center">
                <Mail className="w-5 h-5 text-[#A8B4C8] group-focus-within:text-[#D4AF37] transition-colors duration-300 ml-4 shrink-0" aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full h-full px-3 bg-transparent text-[#F5F0E8] placeholder:text-[#8A6A5C]"
                />
              </div>
              <p className="text-[#F5F0E8]/40 text-xs px-1">
                We'll use this for order updates and account recovery. No spam, ever.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !firstName.trim()}
              className="w-full h-14 relative overflow-hidden rounded-xl bg-transparent border border-[#A8B4C8]/40 group transition-all duration-500 hover:border-[#D4AF37]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#1E3A5F]/80 via-[#A8B4C8]/70 to-[#152238]/80 opacity-90"></div>
              <div className="animate-sheen"></div>
              <span className="relative z-10 text-[#D4AF37] font-serif tracking-[0.12em] text-lg group-hover:text-white transition-colors font-heading">
                {isSubmitting ? 'Saving...' : 'Continue'}
              </span>
            </Button>

            <p className="text-center text-[#F5F0E8]/40 text-xs px-1">
              You can update these later from your profile settings.
            </p>
          </form>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && registrationSuccess && (
        <div className="w-full space-y-4 animate-fade-in-up-delay">
          <div className="text-center p-6 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl text-white font-medium mb-2">{AUTH_COPY.accountCreated}</h3>
            <p className="text-[#F5F0E8]/50 text-xs">
              Redirecting you to our products...
            </p>
          </div>
        </div>
      )}

      <div className="w-full mt-6 sm:mt-8">
        <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#F59E0B] hover:text-[#D4AF37] transition-colors ml-1 uppercase text-sm font-bold tracking-widest">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

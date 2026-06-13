'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Mail, Lock, MessageCircle, Smartphone, Phone, User } from 'lucide-react';
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
import { validatePhone, toE164 } from '../../../lib/authHelpers';
import { userApi } from '../../../lib/customerApi';

/** Validate email format */
function validateEmail(email) {
  if (!email || !email.trim()) return { valid: false, message: 'Email is required' };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) ? { valid: true, message: '' } : { valid: false, message: 'Please enter a valid email address' };
}

/**
 * Simplified login page — Phone-first OTP for Indian users.
 * Password mode is hidden by default, accessible via "Use password instead" link.
 */
export default function LoginPageContent({ redirectUrl = '/products' }) {
  const [mode, setMode] = useState('otp'); // Default to OTP mode for Indian users

  // Shared
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password mode (hidden by default)
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // OTP mode
  const [verificationMethod, setVerificationMethod] = useState('otp_sms'); // Default to SMS for Indian users
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimeLeft, setOtpTimeLeft] = useState(600);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [accountNotFound, setAccountNotFound] = useState(false);

  // Profile completion — backward-compat for users auto-registered before auto-registration was removed.
  // These users have pending_@aaryaclothing.in emails and need to complete their profile on first login.
  // New users must register via /auth/register instead. This code can be removed once no such users remain.
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [newUserResult, setNewUserResult] = useState(null);

  const otpRefs = useRef([]);
  const router = useRouter();
  const { login, user, isAuthenticated, setAuthStatus, loading } = useAuth();
  const logoUrl = useLogo();
  const { smsOtpEnabled, whatsappEnabled } = useSiteConfig();

  // Derived: is the current verification method email-based?
  const isEmailMode = verificationMethod === 'otp_email';

  // Auto-fix OTP method if channel is disabled
  useEffect(() => {
    if (!smsOtpEnabled && verificationMethod === 'otp_sms') {
      setVerificationMethod(whatsappEnabled ? 'otp_whatsapp' : 'otp_email');
    }
    if (!whatsappEnabled && verificationMethod === 'otp_whatsapp') {
      setVerificationMethod(smsOtpEnabled ? 'otp_sms' : 'otp_email');
    }
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
  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setAccountNotFound(false);
    setIsSubmitting(false);
    setOtpSent(false);
    setOtpDigits(['', '', '', '', '', '']);
    setOtpTimeLeft(600);
    setOtpExpired(false);
    setResendCooldown(0);
  };

  // Reset identifier when switching between email/phone OTP methods
  const switchVerificationMethod = (method) => {
    setVerificationMethod(method);
    setIdentifier('');
    setError('');
    setAccountNotFound(false);
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
      setError(AUTH_COPY.errors.missingPhone);
      return;
    }
    setIsSubmitting(true);
    try {
      const [device_fingerprint, device_name] = await Promise.all([
        getDeviceFingerprint(), Promise.resolve(getDeviceName()),
      ]);
      const result = await login({
        identifier, password, remember_me: rememberMe,
        device_fingerprint, device_name,
      });
      logger.info('Login successful');

      // Check if user needs profile completion.
      // New users who registered via phone have no real name or email yet.
      const userName = result?.user?.full_name || '';
      const userEmail = result?.user?.email || '';
      const isNewUser = !userName.trim()
        || userName.startsWith('Customer')
        || userName.startsWith('User')
        || !userEmail.trim()
        || userEmail.startsWith('pending_')
        || userEmail.endsWith('@example.com');
      if (isNewUser) {
        setNewUserResult(result);
        setShowProfileForm(true);
      } else {
        const role = result?.user?.role || user?.role || USER_ROLES.CUSTOMER;
        const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
        setTimeout(() => router.push(target), 500);
      }
    } catch (err) {
      logger.error('Login failed:', err);
      setError(err.message || AUTH_COPY.errors.invalidCredentials);
      setIsSubmitting(false);
    }
  };

  // === OTP: REQUEST ===
  const handleRequestOtp = async () => {
    if (!identifier) {
      setError(isEmailMode ? 'Email is required' : AUTH_COPY.errors.missingPhone);
      return;
    }

    // Validate based on mode
    if (isEmailMode) {
      const emailValidation = validateEmail(identifier);
      if (!emailValidation.valid) {
        setError(emailValidation.message);
        return;
      }
    } else {
      const phoneValidation = validatePhone(identifier);
      if (!phoneValidation.valid) {
        setError(phoneValidation.message || AUTH_COPY.errors.invalidPhone);
        return;
      }
    }

    setError('');
    setAccountNotFound(false);
    setIsSubmitting(true);
    try {
      let otpType = 'SMS';
      if (verificationMethod === 'otp_whatsapp') otpType = 'WHATSAPP';
      else if (isEmailMode) otpType = 'EMAIL';

      const apiIdentifier = isEmailMode ? identifier.trim() : toE164(identifier);
      await authApi.sendLoginOtpRequest(apiIdentifier, otpType);
      setOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpTimeLeft(600);
      setOtpExpired(false);
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      const msg = err.message || AUTH_COPY.errors.otpSendFailed;
      if (msg.includes('No account found') || msg.includes('Please create an account')) {
        // Store the flag so we can render a richer error with register link
        setAccountNotFound(true);
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // === OTP: VERIFY ===
  const handleOtpVerify = async (finalOtpValue) => {
    const otpValue = finalOtpValue || otpDigits.join('');
    if (otpValue.length !== 6) { 
      setError('Please enter all 6 digits.'); 
      return; 
    }
    setError('');
    setIsSubmitting(true);
    setCheckingProfile(true); // Block redirect guard while we determine if user is new
    try {
      let otpType = 'SMS';
      if (verificationMethod === 'otp_whatsapp') otpType = 'WHATSAPP';
      else if (isEmailMode) otpType = 'EMAIL';
      
      const [device_fingerprint, device_name] = await Promise.all([
        getDeviceFingerprint(), Promise.resolve(getDeviceName()),
      ]);

      const apiIdentifier = isEmailMode ? identifier.trim() : toE164(identifier);
      
      const result = await login({
        identifier: apiIdentifier,
        otp_code: otpValue, 
        login_method: 'otp',
        otp_type: otpType, 
        remember_me: rememberMe, 
        device_fingerprint, 
        device_name,
      });
      
      logger.info('OTP Login successful');
      if (result?.user) setAuthStatus(result.user);

      // NEW USER: If name is empty/placeholder or email is missing, show inline profile form.
      // This catches: fresh phone-only registrations, users with auto-generated names,
      // and users with pending/example emails.
      const userName = result?.user?.full_name || '';
      const userEmail = result?.user?.email || '';
      const isNewUser = !userName.trim()
        || userName.startsWith('Customer')
        || userName.startsWith('User')
        || !userEmail.trim()
        || userEmail.startsWith('pending_')
        || userEmail.endsWith('@example.com');
      if (isNewUser) {
        setNewUserResult(result);
        setShowProfileForm(true);
        // Don't clear checkingProfile — keep blocking redirect until profile form is shown or skipped
      } else {
        // Existing user — clear the guard so the redirect can proceed
        setCheckingProfile(false);
        const role = result?.user?.role || user?.role || USER_ROLES.CUSTOMER;
        const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
        setTimeout(() => router.push(target), 400);
      }
    } catch (err) {
      logger.error('OTP Login failed:', err);
      setError(err.message || AUTH_COPY.errors.otpFailed);
      setOtpDigits(['', '', '', '', '', '']);
      setCheckingProfile(false); // Clear guard on error so user can retry
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setIsSubmitting(false);
      // NOTE: Do NOT clear checkingProfile here!
      // React batches state updates, so showProfileForm is stale (still false)
      // in this synchronous finally block even after setShowProfileForm(true).
      // The guard is cleared by: handleProfileSubmit, skip handler, or the else branch above.
    }
  };

  // === PROFILE: SAVE (for new users after OTP verification) ===
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!profileFirstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    if (!profileEmail.trim()) {
      setError('Email is required for order confirmations and account recovery.');
      return;
    }

    const emailCheck = validateEmail(profileEmail);
    if (!emailCheck.valid) {
      setError(emailCheck.message);
      return;
    }

    setProfileSaving(true);
    try {
      const body = {
        full_name: profileLastName.trim()
          ? `${profileFirstName.trim()} ${profileLastName.trim()}`
          : profileFirstName.trim(),
        email: profileEmail.trim(),
      };

      const updatedUser = await userApi.updateProfile(body);
      logger.info('Profile updated after registration', { userId: updatedUser?.id });
      
      // Update auth state with the real user data
      if (updatedUser) setAuthStatus(updatedUser);

      // Clear checkingProfile so redirect guard can fire normally
      setCheckingProfile(false);

      // Redirect to target
      const role = updatedUser?.role || newUserResult?.user?.role || USER_ROLES.CUSTOMER;
      const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
      setTimeout(() => router.push(target), 300);
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please try again.');
      // Clear checkingProfile so the user can still proceed even if save fails
      setCheckingProfile(false);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setError('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.every((d) => d) && !isSubmitting) setTimeout(() => handleOtpVerify(next.join('')), 50);
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    await handleRequestOtp();
  };

  // Redirect if already authenticated (but NOT if checking profile or showing profile form)
  if (isAuthenticated && !loading && !showProfileForm && !checkingProfile) {
    const role = user?.role || USER_ROLES.CUSTOMER;
    const target = redirectUrl && redirectUrl !== '/products' ? redirectUrl : getRedirectForRole(role);
    router.push(target);
    return null;
  }

  const displayIdentifier = isEmailMode
    ? identifier.trim()
    : `+91 ${identifier}`;

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
        <h2 className="text-xl sm:text-2xl text-white/90 font-body">
          {showProfileForm ? 'Complete your profile' : AUTH_COPY.loginTitle}
        </h2>
        <p className="text-[#8A6A5C] text-xs sm:text-sm uppercase tracking-[0.15em] font-light">
          {showProfileForm ? 'We need your name and email for order confirmations' : AUTH_COPY.loginSubtitle}
        </p>
      </div>

      {/* Error */}
      {(error || accountNotFound) && (
        <div className="w-full p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
          {accountNotFound ? (
            <div className="text-sm">
              <p className="text-red-300">No account found with this {isEmailMode ? 'email' : 'phone number'}.</p>
              <Link
                href="/auth/register"
                className="text-[#F2C29A] hover:text-white font-medium underline mt-1 inline-block"
                onClick={() => setAccountNotFound(false)}
              >
                Create an account →
              </Link>
            </div>
          ) : (
            <p className="text-red-300 text-sm">{error}</p>
          )}
        </div>
      )}

      {/* === PROFILE COMPLETION (New users after OTP verification) === */}
      {showProfileForm && (
        <div className="w-full space-y-4 animate-fade-in-up-delay">
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* First Name */}
            <div className="space-y-2">
              <label className="text-[#EAE0D5]/80 text-sm font-medium">First Name *</label>
              <div className="luxury-input-wrapper h-12 sm:h-14 rounded-xl relative group flex items-center px-4 bg-[#0B0608]/80 border border-[#B76E79]/30">
                <User className="w-5 h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  value={profileFirstName}
                  onChange={(e) => setProfileFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  required
                  className="w-full h-full px-3 bg-transparent text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base outline-none"
                />
              </div>
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <label className="text-[#EAE0D5]/80 text-sm font-medium">Last Name</label>
              <div className="luxury-input-wrapper h-12 sm:h-14 rounded-xl relative group flex items-center px-4 bg-[#0B0608]/80 border border-[#B76E79]/30">
                <User className="w-5 h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  value={profileLastName}
                  onChange={(e) => setProfileLastName(e.target.value)}
                  placeholder="Enter your last name (optional)"
                  className="w-full h-full px-3 bg-transparent text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[#EAE0D5]/80 text-sm font-medium">Email Address *</label>
              <div className="luxury-input-wrapper h-12 sm:h-14 rounded-xl relative group flex items-center px-4 bg-[#0B0608]/80 border border-[#B76E79]/30">
                <Mail className="w-5 h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full h-full px-3 bg-transparent text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base outline-none"
                />
              </div>
              <p className="text-[#EAE0D5]/40 text-xs px-1">
                Required for order confirmations and account recovery. No spam, ever.
              </p>
            </div>

            {/* Save & Continue Button */}
            <Button 
              type="submit" 
              disabled={profileSaving || !profileFirstName.trim() || !profileEmail.trim()}
              className="w-full h-14 sm:h-16 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
              <div className="animate-sheen"></div>
              <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-lg group-hover:text-white transition-colors font-heading">
                {profileSaving ? 'Saving...' : 'Save & Continue'}
              </span>
            </Button>

            <p className="text-center text-[#EAE0D5]/40 text-xs px-1">
              You can update these later from your profile settings.
            </p>
          </form>
        </div>
      )}

      {/* === OTP MODE (Default for Indian users) === */}
      {!showProfileForm && mode === 'otp' && (
        <div className="w-full space-y-4 animate-fade-in-up-delay">
          {!otpSent ? (
            <>
              {/* Identifier Input — phone or email based on selected method */}
              <div className="space-y-2">
                <label className="text-[#EAE0D5]/80 text-sm font-medium">
                  {isEmailMode ? 'Email Address' : 'Phone Number'}
                </label>
                <div className="luxury-input-wrapper h-14 sm:h-16 rounded-xl relative group flex items-center px-4 bg-[#0B0608]/80 border border-[#B76E79]/30">
                  {isEmailMode ? (
                    <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
                  ) : (
                    <>
                      <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
                      <span className="text-[#F2C29A] font-medium text-lg sm:text-xl ml-2 shrink-0 select-none">+91</span>
                    </>
                  )}
                  {isEmailMode ? (
                    <Input
                      id="email-login"
                      name="email-login"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="your@email.com"
                      variant="minimal"
                      className="h-full pl-3 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg font-medium"
                    />
                  ) : (
                    <Input
                      id="phone-login"
                      name="phone-login"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      required
                      value={identifier}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setIdentifier(val);
                      }}
                      placeholder="XXXXXXXXXX"
                      variant="minimal"
                      className="h-full pl-2 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-lg sm:text-xl font-medium tracking-wider"
                    />
                  )}
                </div>
                <p className="text-[#EAE0D5]/50 text-xs px-1">
                  {isEmailMode
                    ? 'We\'ll send a verification code to this email address.'
                    : AUTH_COPY.phoneFormatHint}
                </p>
              </div>

              {/* OTP Method Selector */}
              <div className="space-y-2">
                <p className="text-[#EAE0D5]/60 text-xs uppercase tracking-widest">Send OTP via</p>
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => switchVerificationMethod('otp_sms')}
                    disabled={!smsOtpEnabled}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 ${
                      !smsOtpEnabled 
                        ? 'opacity-50 cursor-not-allowed bg-[#7A2F57]/5 border-[#B76E79]/20'
                        : verificationMethod === 'otp_sms'
                          ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                          : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                    }`}
                  >
                    <Smartphone className={`w-5 h-5 ${verificationMethod === 'otp_sms' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                    <span className="text-sm font-medium text-[#EAE0D5]/90">SMS</span>
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={() => switchVerificationMethod('otp_whatsapp')}
                    disabled={!whatsappEnabled}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 ${
                      !whatsappEnabled 
                        ? 'opacity-50 cursor-not-allowed bg-[#7A2F57]/5 border-[#B76E79]/20'
                        : verificationMethod === 'otp_whatsapp'
                          ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                          : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                    }`}
                  >
                    <MessageCircle className={`w-5 h-5 ${verificationMethod === 'otp_whatsapp' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                    <span className="text-sm font-medium text-[#EAE0D5]/90">WhatsApp</span>
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={() => switchVerificationMethod('otp_email')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 ${
                      verificationMethod === 'otp_email'
                        ? 'bg-[#7A2F57]/20 border-[#F2C29A]/60 shadow-[0_0_20px_rgba(242,194,154,0.15)]'
                        : 'bg-[#7A2F57]/10 border-[#B76E79]/30 hover:border-[#F2C29A]/40'
                    }`}
                  >
                    <Mail className={`w-5 h-5 ${verificationMethod === 'otp_email' ? 'text-[#F2C29A]' : 'text-[#B76E79]'}`} />
                    <span className="text-sm font-medium text-[#EAE0D5]/90">Email</span>
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label htmlFor="remember-me-otp" className="flex items-center gap-2 text-sm text-[#EAE0D5]/85 cursor-pointer">
                <span className="checkbox-wrapper">
                  <input id="remember-me-otp" type="checkbox" checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)} aria-label="Remember me on this device" />
                </span>
                <span>Remember me on this device</span>
              </label>

              {/* Send OTP Button */}
              <Button 
                type="button" 
                onClick={handleRequestOtp} 
                disabled={isSubmitting || !identifier || (isEmailMode ? !identifier.includes('@') : identifier.length < 10)}
                className="w-full h-14 sm:h-16 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
                <div className="animate-sheen"></div>
                <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-lg group-hover:text-white transition-colors font-heading">
                  {isSubmitting ? AUTH_COPY.sendingOtp : AUTH_COPY.sendOtpButton}
                </span>
              </Button>

              <p className="text-center text-[#EAE0D5]/50 text-sm px-2">
                {AUTH_COPY.newUserMessage}
              </p>
            </>
          ) : (
            <>
              {/* OTP Verification */}
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-[#7A2F57]/30 border border-[#B76E79]/30 flex items-center justify-center mx-auto mb-3">
                  {verificationMethod === 'otp_sms' ? (
                    <Smartphone className="w-7 h-7 text-[#F2C29A]" />
                  ) : verificationMethod === 'otp_whatsapp' ? (
                    <MessageCircle className="w-7 h-7 text-[#F2C29A]" />
                  ) : (
                    <Mail className="w-7 h-7 text-[#F2C29A]" />
                  )}
                </div>
                <p className="text-[#EAE0D5]/80 text-base mb-1">
                  {AUTH_COPY.otpEnterCode}
                </p>
                <p className="text-[#F2C29A] font-medium text-lg">
                  {displayIdentifier}
                </p>
                <p className={`text-sm mt-2 ${otpExpired ? 'text-red-300' : otpTimeLeft <= 30 ? 'text-amber-300' : 'text-[#EAE0D5]/70'}`}>
                  {otpExpired ? 'Code expired' : `${AUTH_COPY.otpExpiresIn} ${formatTime(otpTimeLeft)}`}
                </p>
              </div>

              {/* OTP Input - Large digits */}
              <div className="flex justify-center gap-2 sm:gap-3 mb-4">
                {otpDigits.map((digit, index) => (
                  <input 
                    key={index} 
                    ref={(el) => { otpRefs.current[index] = el; }}
                    type="text" 
                    inputMode="numeric" 
                    maxLength={1} 
                    value={digit}
                    onChange={(e) => handleOtpDigit(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 sm:w-14 h-14 text-center text-xl font-bold border-2 border-[#B76E79]/30 bg-[#0B0608]/60 text-[#F2C29A] rounded-xl focus:border-[#F2C29A] focus:outline-none focus:shadow-[0_0_0_3px_rgba(242,194,154,0.1)]"
                  />
                ))}
              </div>

              {/* Verify Button */}
              <Button 
                type="button" 
                onClick={() => handleOtpVerify()} 
                disabled={isSubmitting || otpDigits.some((d) => !d)}
                className="w-full h-14 sm:h-16 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
                <div className="animate-sheen"></div>
                <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.12em] text-lg group-hover:text-white transition-colors font-heading">
                  {isSubmitting ? AUTH_COPY.verifying : AUTH_COPY.verifyButton}
                </span>
              </Button>

              {/* Resend OTP */}
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-sm text-[#EAE0D5]/70">{AUTH_COPY.otpResendIn} {resendCooldown}s</p>
                ) : (
                  <button type="button" onClick={handleResendOtp} className="text-sm text-[#C27A4E] hover:text-[#F2C29A]">
                    {AUTH_COPY.otpResend}
                  </button>
                )}
              </div>

              <p className="text-center text-[#EAE0D5]/50 text-xs px-2">
                {AUTH_COPY.otpTroubleshooting}
              </p>

              <div className="text-center">
                <button type="button" onClick={() => { setOtpSent(false); setError(''); setAccountNotFound(false); }}
                  className="text-sm text-[#8A6A5C] hover:text-[#EAE0D5]/80"
                >
                  ← Change {isEmailMode ? 'email' : 'phone number'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* === PASSWORD MODE (Hidden by default) === */}
      {!showProfileForm && mode === 'password' && (
        <form className="w-full space-y-3 sm:space-y-3.5 animate-fade-in-up-delay" onSubmit={handlePasswordLogin} noValidate>
          <div className="luxury-input-wrapper h-11 sm:h-12 rounded-xl relative group flex items-center px-4">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300 shrink-0" aria-hidden="true" />
            <Input
              id="identifier" name="identifier" type="text" autoComplete="username"
              required value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email, username, or phone" variant="minimal"
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

      {/* Footer (hidden during profile form) */}
      {!showProfileForm && (
        <div className="w-full mt-4 sm:mt-5 space-y-3">
          <div className="text-center">
            <button 
              type="button" 
              onClick={() => switchMode(mode === 'otp' ? 'password' : 'otp')}
              className="text-xs text-[#8A6A5C] hover:text-[#EAE0D5]/80 transition-colors"
            >
              {mode === 'otp' ? 'Use password instead' : 'Use OTP instead (recommended)'}
            </button>
          </div>
          
          <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
            New here?{' '}
            <Link href="/auth/register" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-sm font-bold tracking-widest">
              Create account
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

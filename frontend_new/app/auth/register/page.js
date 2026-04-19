'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, Eye, EyeOff, User, Phone, Smartphone, MessageCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../src/store/authStore';
import logger from '../../../lib/logger';
import { getRedirectForRole, USER_ROLES } from '../../../lib/roles';

const OTP_EXPIRY_SECONDS = 120;
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
  const { isAuthenticated } = useAuth();
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

    const phoneRequired =
      verificationMethod === 'otp_sms' || verificationMethod === 'otp_whatsapp';
    if (phoneRequired && !phone.trim()) {
      setError(
        verificationMethod === 'otp_whatsapp'
          ? 'Phone number is required for WhatsApp verification'
          : 'Phone number is required for SMS verification',
      );
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
    router.push(getRedirectForRole(USER_ROLES.CUSTOMER));
    return null;
  }

  const verificationLabel = VERIFICATION_LABELS[verificationMethod] || 'email';
  const verificationTarget =
    verificationMethod === 'otp_email' ? email : phone;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {step === 1 ? 'Create your account' : `Verify your ${verificationLabel}`}
        </h2>

        {step === 1 ? (
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-center text-sm text-gray-600">
            We sent a 6-digit code to your {verificationLabel}
            {verificationTarget ? ` (${verificationTarget})` : ''}.
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {step === 1 ? (
            <form className="space-y-6" onSubmit={handleRegistration}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <div className="mt-1">
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <div className="mt-1">
                    <Input
                      id="lastName"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                  {(verificationMethod === 'otp_sms' || verificationMethod === 'otp_whatsapp') && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <div className="mt-1">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required={verificationMethod === 'otp_sms' || verificationMethod === 'otp_whatsapp'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={
                      verificationMethod === 'otp_email' ? 'Optional' : 'Required for SMS/WhatsApp OTP'
                    }
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password (min 5 characters)
                </label>
                <div className="mt-1 relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={5}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1 relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={5}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="mt-2 text-sm text-red-600">Passwords do not match</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Verification Method
                </label>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="verificationMethod"
                      value="otp_email"
                      checked={verificationMethod === 'otp_email'}
                      onChange={() => setVerificationMethod('otp_email')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <span className="ml-2 block text-sm text-gray-700">
                      Email OTP
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="verificationMethod"
                      value="otp_sms"
                      checked={verificationMethod === 'otp_sms'}
                      onChange={() => setVerificationMethod('otp_sms')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <span className="ml-2 block text-sm text-gray-700">
                      SMS OTP
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="verificationMethod"
                      value="otp_whatsapp"
                      checked={verificationMethod === 'otp_whatsapp'}
                      onChange={() => setVerificationMethod('otp_whatsapp')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <span className="ml-2 block text-sm text-gray-700">
                      WhatsApp OTP
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register'}
                </Button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleOtpVerification}>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {verificationMethod === 'otp_email' ? (
                    <Mail className="h-12 w-12 text-blue-500" />
                  ) : verificationMethod === 'otp_whatsapp' ? (
                    <MessageCircle className="h-12 w-12 text-green-500" />
                  ) : (
                    <Smartphone className="h-12 w-12 text-blue-500" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  Check your {verificationLabel}
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  We sent a verification code to{' '}
                  <span className="font-medium">{verificationTarget}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Enter the 6-digit code below to complete your registration
                </p>
              </div>

              <div className="flex justify-center space-x-2">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => otpRefs.current[index] = el}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-12 text-center border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  />
                ))}
              </div>

              <div className="text-center space-y-2">
                {!otpExpired ? (
                  <p className="text-sm text-gray-500">
                    Code expires in {formatTime(otpTimeLeft)}
                  </p>
                ) : (
                  <p className="text-sm text-red-500">
                    Code expired. Please request a new one.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || resending}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {resending
                    ? 'Sending…'
                    : resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend code'}
                </button>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isSubmitting || otpExpired || otpDigits.some(d => !d)}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify & Complete Registration'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

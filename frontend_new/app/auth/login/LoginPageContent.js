'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Eye, EyeOff, MessageCircle, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../src/store/authStore';
import logger from '../../../lib/logger';

function LoginPageContent({ searchParams }) {
  const [loginMode, setLoginMode] = useState('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState('otp_email');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimeLeft, setOtpTimeLeft] = useState(120);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const otpRefs = useRef([]);
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();

  const redirectUrl = searchParams.get('redirect_url') || '/products';

  useEffect(() => {
    let otpTimer = null;
    let cooldownTimer = null;

    if (loginMode === 'otp' && otpSent && otpTimeLeft > 0 && !otpExpired) {
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

    if (loginMode === 'otp' && resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }

    return () => {
      if (otpTimer) clearInterval(otpTimer);
      if (cooldownTimer) clearInterval(cooldownTimer);
    };
  }, [loginMode, otpSent, otpTimeLeft, otpExpired, resendCooldown]);

  const handleRequestOtp = async () => {
    if (!identifier) {
      setError('Please enter your email, username, or phone number.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') {
        otpType = 'WHATSAPP';
      } else if (verificationMethod === 'otp_sms') {
        otpType = 'SMS';
      }

      await fetch('/api/v1/auth/login-otp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp_type: otpType
        })
      });

      setOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpTimeLeft(120);
      setOtpExpired(false);
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpLogin = async () => {
    const otpValue = otpDigits.join('');
    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      let otpType = 'EMAIL';
      if (verificationMethod === 'otp_whatsapp') {
        otpType = 'WHATSAPP';
      } else if (verificationMethod === 'otp_sms') {
        otpType = 'SMS';
      }

      const response = await login({
        identifier: identifier.trim(),
        otp_code: otpValue,
        login_method: 'otp',
        otp_type: otpType,
        remember_me: rememberMe,
      });

      logger.info('OTP Login successful:', response);
      setTimeout(() => router.push(redirectUrl), 500);
    } catch (err) {
      logger.error('OTP Login failed:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!identifier || !password) {
      setError('Please enter your email, username, or phone number and password.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await login({
        identifier: identifier.trim(),
        password,
        remember_me: rememberMe,
      });

      logger.info('Login successful:', response);
      setTimeout(() => router.push(redirectUrl), 500);
    } catch (err) {
      logger.error('Login failed:', err);
      setError(err.message || 'Invalid credentials. Please try again.');
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
    
    if (next.every(d => d)) {
      setTimeout(() => handleOtpLogin(), 100);
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
    router.push(redirectUrl);
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {loginMode === 'otp' ? 'Login with OTP' : 'Sign in to your account'}
        </h2>
        
        {loginMode === 'password' && (
          <p className="mt-2 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
              Create account
            </Link>
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

          <div className="mb-6">
            <div className="flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => { setLoginMode('password'); setOtpSent(false); setError(''); }}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-md border ${
                  loginMode === 'password'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('otp'); setError(''); }}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-md border ${
                  loginMode === 'otp'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Login with OTP
              </button>
            </div>
          </div>

          {loginMode === 'password' ? (
            <form className="space-y-6" onSubmit={handlePasswordLogin}>
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
                  Email, Username, or Phone
                </label>
                <div className="mt-1">
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter email, username, or phone number"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
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

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link href="/auth/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {!otpSent ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Verification Method
                    </label>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setVerificationMethod('otp_email')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 ${
                          verificationMethod === 'otp_email'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Mail className="h-5 w-5" />
                        <span className="text-xs">Email</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerificationMethod('otp_whatsapp')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 ${
                          verificationMethod === 'otp_whatsapp'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-xs">WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerificationMethod('otp_sms')}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 ${
                          verificationMethod === 'otp_sms'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Smartphone className="h-5 w-5" />
                        <span className="text-xs">SMS</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="identifier-otp" className="block text-sm font-medium text-gray-700">
                      Email, Username, or Phone
                    </label>
                    <div className="mt-1">
                      <Input
                        id="identifier-otp"
                        name="identifier-otp"
                        type="text"
                        autoComplete="username"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="Enter your registered email or phone"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={isSubmitting || !identifier}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Sending...' : 'Send OTP'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600">
                      Enter the 6-digit code sent to your {verificationMethod === 'otp_email' ? 'email' : verificationMethod === 'otp_whatsapp' ? 'WhatsApp' : 'phone'}
                    </p>
                    <p className={`text-sm mt-1 ${otpExpired ? 'text-red-500' : otpTimeLeft <= 30 ? 'text-amber-500' : 'text-gray-500'}`}>
                      {otpExpired ? 'Code expired' : `Expires in ${formatTime(otpTimeLeft)}`}
                    </p>
                  </div>

                  <div className="flex justify-center gap-2 mb-4">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={el => otpRefs.current[index] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigit(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    ))}
                  </div>

                  <div>
                    <Button
                      type="button"
                      onClick={handleOtpLogin}
                      disabled={isSubmitting || otpDigits.some(d => !d)}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Verifying...' : 'Verify & Login'}
                    </Button>
                  </div>

                  <div className="text-center">
                    {resendCooldown > 0 ? (
                      <p className="text-sm text-gray-500">Resend in {resendCooldown}s</p>
                    ) : (
                      <button type="button" onClick={handleResendOtp} className="text-sm text-blue-600 hover:text-blue-500">
                        Resend OTP
                      </button>
                    )}
                  </div>

                  <div className="text-center">
                    <button type="button" onClick={() => { setOtpSent(false); setIdentifier(''); setError(''); }} className="text-sm text-gray-500 hover:text-gray-700">
                      ← Change verification method
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {loginMode === 'password' && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
                  Create account
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPageContent;
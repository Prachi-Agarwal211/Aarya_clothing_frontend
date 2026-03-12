'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Mail, Lock, Eye, EyeOff, Phone, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../lib/authContext';
import { useLogo } from '../../../lib/siteConfigContext';
import logger from '../../../lib/logger';

function getPasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, total: 4 };
}

export default function RegisterPage() {
  const [step, setStep] = useState(1); // 1: form, 2: verification method choice, 3: OTP input
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState('');
  const [otp, setOtp] = useState('');
  const [userData, setUserData] = useState(null);
  
  const router = useRouter();
  const { login, isAuthenticated, loading, user, isStaff } = useAuth();
  const logoUrl = useLogo();

  const passwordStrength = password ? getPasswordStrength(password) : null;
  const passwordsMatch = confirmPassword ? password === confirmPassword : null;

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (isStaff()) {
        router.push('/admin');
      } else {
        router.push('/products');
      }
    }
  }, [loading, isAuthenticated, user, isStaff, router]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    if (!fullName || !username || !email || !password || !phone) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (passwordStrength && passwordStrength.passed < 4) {
      setError('Password must meet all requirements.');
      return;
    }

    // Store form data and move to verification method selection
    setUserData({ fullName, username, email, phone, password });
    setStep(2);
  };

  const handleVerificationMethodSelect = async (method) => {
    setVerificationMethod(method);
    setIsSubmitting(true);
    setError('');

    try {
      const response = await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: userData.fullName.trim(),
          username: userData.username.trim(),
          email: userData.email.trim(),
          phone: userData.phone.trim(),
          password: userData.password,
          role: 'customer',
          verification_method: method,
        }),
      });

      if (method === 'link') {
        router.push('/auth/check-email');
      } else {
        // OTP methods - show OTP input
        setStatus(response.message || 'Verification code sent!');
        setStep(3);
      }
    } catch (err) {
      logger.error('Registration failed:', err);
      setError(err.message || 'Registration failed. Please try again.');
      setStep(1); // Go back to form
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload = {
        otp_code: otp,
        otp_type: verificationMethod === 'otp_whatsapp' ? 'WHATSAPP' : 'EMAIL',
      };

      // Add email or phone based on verification method
      if (verificationMethod === 'otp_whatsapp') {
        payload.phone = userData.phone;
      } else {
        payload.email = userData.email;
      }

      const response = await apiFetch('/api/v1/auth/verify-otp-registration', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setStatus('Account verified! Redirecting...');
      
      // Auto-login handled by backend cookies
      setTimeout(() => {
        router.push('/products');
      }, 1500);
    } catch (err) {
      logger.error('OTP verification failed:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setStatus('Resending...');
    
    try {
      const payload = {
        otp_type: verificationMethod === 'otp_whatsapp' ? 'WHATSAPP' : 'EMAIL',
      };

      if (verificationMethod === 'otp_whatsapp') {
        payload.phone = userData.phone;
      } else {
        payload.email = userData.email;
      }

      await apiFetch('/api/v1/auth/send-verification-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setStatus('New code sent!');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError('Failed to resend code.');
    }
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
        <img
          src={logoUrl || ''}
          alt="Aarya"
          className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
        />
      </div>

      {/* STEP 1: Registration Form */}
      {step === 1 && (
        <>
          <div className="text-center mb-10 lg:mb-12 space-y-2 animate-fade-in-up-delay">
            <h2 className="text-2xl sm:text-3xl md:text-4xl text-white/90 font-body">Create Account</h2>
            <p className="text-white/80 text-xs sm:text-sm md:text-base uppercase tracking-[0.2em] font-light">
              Begin your luxury journey
            </p>
          </div>

          <form className="w-full space-y-5 sm:space-y-6 animate-fade-in-up-delay" onSubmit={handleFormSubmit}>
            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
              <Input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
              />
            </div>

            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
              />
            </div>

            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
              />
            </div>

            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
              <Input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
              />
            </div>

            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 sm:right-6 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>

            <div className="luxury-input-wrapper h-14 sm:h-16 md:h-18 rounded-2xl relative group flex items-center px-5 sm:px-6">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                variant="minimal"
                className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg md:text-xl"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-5 sm:right-6 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>

            {passwordStrength && (
              <div className="space-y-2">
                <div className="flex gap-1">
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
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {[
                    ['length', '8+ characters'],
                    ['upper', 'Uppercase letter'],
                    ['lower', 'Lowercase letter'],
                    ['number', 'Number'],
                  ].map(([key, label]) => (
                    <div key={key} className={`flex items-center gap-1.5 ${passwordStrength.checks[key] ? 'text-green-400' : 'text-white/40'}`}>
                      <span className="text-base leading-none">{passwordStrength.checks[key] ? '✓' : '○'}</span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {confirmPassword && (
              <p className={`text-xs ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 sm:h-16 md:h-18 mt-6 sm:mt-8 relative overflow-hidden rounded-2xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
              <div className="animate-sheen"></div>
              <span className="relative z-10 text-white font-serif tracking-[0.1em] sm:tracking-[0.15em] text-lg sm:text-xl md:text-2xl">
                {isSubmitting ? 'CREATING...' : 'CONTINUE'}
              </span>
            </Button>

            {error && (
              <div className="text-center text-xs sm:text-sm text-red-300">{error}</div>
            )}
          </form>

          <div className="w-full mt-10 sm:mt-12 md:mt-14">
            <p className="text-center text-[#8A6A5C] text-sm sm:text-base md:text-lg tracking-wide">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-xs sm:text-sm md:text-base font-bold tracking-widest"
              >
                Sign In
              </Link>
            </p>
          </div>
        </>
      )}

      {/* STEP 2: Verification Method Choice */}
      {step === 2 && (
        <>
          <div className="text-center mb-8 animate-fade-in-up-delay">
            <h2 className="text-2xl sm:text-3xl text-white/90 font-body mb-2">Choose Verification Method</h2>
            <p className="text-white/70 text-sm">How would you like to verify your account?</p>
          </div>

          <div className="w-full space-y-4">
            <button
              onClick={() => handleVerificationMethodSelect('otp_email')}
              disabled={isSubmitting}
              className="w-full p-5 bg-[#7A2F57]/20 border-2 border-[#B76E79]/30 rounded-xl hover:border-[#F2C29A]/60 hover:bg-[#7A2F57]/30 transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <Mail className="w-6 h-6 text-[#F2C29A]" />
                <div className="text-left">
                  <p className="text-[#EAE0D5] font-medium">Email OTP</p>
                  <p className="text-[#EAE0D5]/60 text-sm">Receive a 6-digit code via email</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleVerificationMethodSelect('otp_whatsapp')}
              disabled={isSubmitting}
              className="w-full p-5 bg-[#7A2F57]/20 border-2 border-[#B76E79]/30 rounded-xl hover:border-[#F2C29A]/60 hover:bg-[#7A2F57]/30 transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <Phone className="w-6 h-6 text-[#F2C29A]" />
                <div className="text-left">
                  <p className="text-[#EAE0D5] font-medium">WhatsApp OTP</p>
                  <p className="text-[#EAE0D5]/60 text-sm">Receive a 6-digit code via WhatsApp</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleVerificationMethodSelect('link')}
              disabled={isSubmitting}
              className="w-full p-5 bg-[#7A2F57]/20 border-2 border-[#B76E79]/30 rounded-xl hover:border-[#F2C29A]/60 hover:bg-[#7A2F57]/30 transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <Mail className="w-6 h-6 text-[#F2C29A]" />
                <div className="text-left">
                  <p className="text-[#EAE0D5] font-medium">Email Link</p>
                  <p className="text-[#EAE0D5]/60 text-sm">Click a verification link in your email</p>
                </div>
              </div>
            </button>
          </div>

          {error && (
            <div className="text-center text-sm text-red-300 mt-4">{error}</div>
          )}
        </>
      )}

      {/* STEP 3: OTP Input */}
      {step === 3 && (
        <>
          <div className="text-center mb-8 animate-fade-in-up-delay">
            <h2 className="text-2xl sm:text-3xl text-white/90 font-body mb-2">Enter Verification Code</h2>
            <p className="text-white/70 text-sm">
              We sent a 6-digit code to {verificationMethod === 'otp_email' ? userData.email : userData.phone}
            </p>
          </div>

          <form className="w-full space-y-6" onSubmit={handleOtpSubmit}>
            <div className="luxury-input-wrapper h-16 rounded-2xl relative group flex items-center px-6 justify-center">
              <Input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                variant="minimal"
                maxLength={6}
                className="h-full text-center text-[#EAE0D5] placeholder:text-[#8A6A5C] text-3xl tracking-[0.5em] font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="w-full h-14 relative overflow-hidden rounded-2xl bg-transparent border border-[#B76E79]/40 transition-all hover:border-[#F2C29A]/60"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
              <span className="relative z-10 text-white font-serif tracking-[0.1em] text-lg">
                {isSubmitting ? 'VERIFYING...' : 'VERIFY'}
              </span>
            </Button>

            {(error || status) && (
              <div className="text-center text-sm">
                {error && <p className="text-red-300">{error}</p>}
                {!error && status && <p className="text-green-400">{status}</p>}
              </div>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isSubmitting}
                className="text-[#C27A4E] hover:text-[#F2C29A] text-sm transition-colors disabled:opacity-50"
              >
                Resend Code
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { authApi } from '../../../lib/customerApi';
import { useLogo } from '../../../lib/siteConfigContext';
import { validatePassword } from '../../../lib/authHelpers';

export default function ChangePasswordPage() {
  const logoUrl = useLogo();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password validation
  const passwordRequirements = [
    { label: 'At least 5 characters', key: 'length' },
  ];

  const passwordValidation = newPassword ? validatePassword(newPassword) : null;
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    if (!currentPassword || !newPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    if (!passwordValidation?.valid) {
      setError('Password must be at least 5 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setStatus('Password changed successfully.');
    } catch (err) {
      console.error('Change password failed:', err);
      setError(err.message || 'Failed to change password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-8 sm:mb-10 md:mb-12 animate-fade-in-up">
        <img
          src={logoUrl || ''}
          alt="Aarya Clothing Logo"
          className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
          loading="eager"
          fetchPriority="high"
        />
      </div>

      {/* HEADER */}
      <div className="text-center mb-10 space-y-2 animate-fade-in-up-delay">
        <h2 className="text-2xl sm:text-3xl text-white/90 font-body">
          Change Password
        </h2>
        <p className="text-[#8A6A5C] text-sm uppercase tracking-[0.2em] font-light">
          Create your password
        </p>
      </div>

      {/* FORM */}
      <form className="w-full space-y-4 sm:space-y-5 md:space-y-6 animate-fade-in-up-delay" onSubmit={handleSubmit} noValidate>
        {/* Current Password */}
        <div className="luxury-input-wrapper h-14 sm:h-16 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
          <Input
            type={showCurrentPassword ? "text" : "password"}
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg"
            autoComplete="current-password"
            aria-label="Current password"
            required
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="touch-target-icon absolute right-3 sm:right-4 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showCurrentPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>

        {/* New Password */}
        <div className="luxury-input-wrapper h-14 sm:h-16 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
          <Input
            type={showNewPassword ? "text" : "password"}
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg"
            autoComplete="new-password"
            aria-label="New password"
            required
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="touch-target-icon absolute right-3 sm:right-4 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
            aria-label={showNewPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showNewPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="luxury-input-wrapper h-14 sm:h-16 rounded-2xl relative group flex items-center px-5 sm:px-6">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" aria-hidden="true" />
          <Input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-4 sm:pl-5 pr-12 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-base sm:text-lg"
            autoComplete="new-password"
            aria-label="Confirm new password"
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

        {/* Password Requirements */}
        <div className="text-xs sm:text-sm text-[#6E5E58] space-y-1" aria-live="polite">
          <p>New password must be:</p>
          <ul className="space-y-0.5 ml-2">
            {passwordRequirements.map((req, index) => (
              <li key={index} className="flex items-center gap-2">
                {passwordValidation?.strength?.checks[req.key] ? (
                  <CheckCircle className="w-4 h-4 text-[#C27A4E]" aria-hidden="true" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#6E5E58]" aria-hidden="true" />
                )}
                <span className={passwordValidation?.strength?.checks[req.key] ? 'text-[#C27A4E]' : ''}>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Password Match Indicator */}
        {confirmPassword && (
          <div className="flex items-center gap-2 text-xs sm:text-sm" role="status" aria-live="polite">
            {passwordsMatch ? (
              <>
                <CheckCircle className="w-4 h-4 text-[#C27A4E]" aria-hidden="true" />
                <span className="text-[#C27A4E]">Passwords match</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-[#6E5E58]" aria-hidden="true" />
                <span className="text-[#6E5E58]">Passwords do not match</span>
              </>
            )}
          </div>
        )}

        {/* LUXURY BUTTON */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 sm:h-16 mt-4 sm:mt-6 relative overflow-hidden rounded-2xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
          aria-busy={isSubmitting}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
          <div className="animate-sheen"></div>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/70 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B76E79]/50 to-transparent"></div>

          <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.1em] sm:tracking-[0.15em] text-base sm:text-lg group-hover:text-white transition-colors font-heading">
            {isSubmitting ? 'UPDATING...' : 'CHANGE PASSWORD'}
          </span>
        </Button>

        {/* Error/Status Messages */}
        {(error || status) && (
          <div 
            className={`text-center text-xs sm:text-sm ${error ? 'text-red-300' : 'text-[#C27A4E]'}`} 
            role={error ? "alert" : "status"}
            aria-live="polite"
          >
            {error && <p>{error}</p>}
            {!error && status && <p>{status}</p>}
          </div>
        )}
      </form>

      {/* BACK TO PRODUCTS */}
      <div className="w-full mt-8 sm:mt-10 md:mt-12">
        <Link href="/products" className="text-[#8A6A5C] hover:text-[#F2C29A] transition-colors text-xs sm:text-sm tracking-wide uppercase text-xs font-bold tracking-widest">
          ← Back to Products
        </Link>
      </div>
    </div>
  );
}

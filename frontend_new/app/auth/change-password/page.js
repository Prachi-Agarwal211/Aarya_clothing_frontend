'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { useLogo } from '../../../lib/siteConfigContext';
import logger from '../../../lib/logger';

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
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
    { label: 'One number', test: (p) => /\d/.test(p) },
  ];

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

    setIsSubmitting(true);
    try {
      await apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setStatus('Password changed successfully.');
    } catch (err) {
      logger.error('Change password failed:', err);
      setError(err.message || 'Failed to change password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] flex flex-col items-center">
      {/* LOGO */}
      <div className="flex flex-col items-center mb-8 sm:mb-10 md:mb-12 animate-fade-in-up">
        <img
          src={logoUrl || ''}
          alt="Aarya"
          className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.2)]"
        />
      </div>

      {/* HEADER */}
      <div className="text-center mb-10 space-y-2 animate-fade-in-up-delay">
        <h2 className="text-2xl text-white/90 font-body">
          Change Password
        </h2>
        <p className="text-[#8A6A5C] text-xs uppercase tracking-[0.2em] font-light">
          Update your security
        </p>
      </div>

      {/* FORM */}
      <form className="w-full space-y-4 sm:space-y-5 md:space-y-6 animate-fade-in-up-delay" onSubmit={handleSubmit}>
        {/* Current Password */}
        <div className="luxury-input-wrapper h-12 sm:h-14 rounded-2xl relative group flex items-center px-4 sm:px-5">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
          <Input
            type={showCurrentPassword ? "text" : "password"}
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-3 sm:pl-4 pr-10 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-4 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
          >
            {showCurrentPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>

        {/* New Password */}
        <div className="luxury-input-wrapper h-12 sm:h-14 rounded-2xl relative group flex items-center px-4 sm:px-5">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
          <Input
            type={showNewPassword ? "text" : "password"}
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-3 sm:pl-4 pr-10 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-4 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
          >
            {showNewPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="luxury-input-wrapper h-12 sm:h-14 rounded-2xl relative group flex items-center px-4 sm:px-5">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#B76E79] group-focus-within:text-[#F2C29A] transition-colors duration-300" />
          <Input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant="minimal"
            className="h-full pl-3 sm:pl-4 pr-10 text-[#EAE0D5] placeholder:text-[#8A6A5C] text-sm sm:text-base"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 text-[#8A6A5C] hover:text-[#F2C29A] transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>

        {/* Password Requirements */}
        <div className="text-[10px] text-[#6E5E58] space-y-1">
          <p>New password must contain:</p>
          <ul className="space-y-0.5 ml-2">
            {passwordRequirements.map((req, index) => (
              <li key={index} className="flex items-center gap-2">
                {req.test(newPassword) ? (
                  <CheckCircle className="w-3 h-3 text-[#C27A4E]" />
                ) : (
                  <XCircle className="w-3 h-3 text-[#6E5E58]" />
                )}
                <span className={req.test(newPassword) ? 'text-[#C27A4E]' : ''}>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Password Match Indicator */}
        {confirmPassword && (
          <div className="flex items-center gap-2 text-[10px]">
            {passwordsMatch ? (
              <>
                <CheckCircle className="w-3 h-3 text-[#C27A4E]" />
                <span className="text-[#C27A4E]">Passwords match</span>
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-[#6E5E58]" />
                <span className="text-[#6E5E58]">Passwords do not match</span>
              </>
            )}
          </div>
        )}

        {/* LUXURY BUTTON */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 sm:h-14 mt-4 sm:mt-6 relative overflow-hidden rounded-2xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
          <div className="animate-sheen"></div>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/70 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B76E79]/50 to-transparent"></div>

          <span className="relative z-10 text-[#F2C29A] font-serif tracking-[0.1em] sm:tracking-[0.15em] text-base sm:text-lg group-hover:text-white transition-colors font-heading">
            {isSubmitting ? 'UPDATING...' : 'CHANGE PASSWORD'}
          </span>
        </Button>

        {(error || status) && (
          <div className="text-center text-[10px]">
            {error && <p className="text-red-300">{error}</p>}
            {!error && status && <p className="text-[#C27A4E]">{status}</p>}
          </div>
        )}
      </form>

      {/* BACK TO PRODUCTS */}
      <div className="w-full mt-8 sm:mt-10 md:mt-12">
        <Link href="/products" className="text-[#8A6A5C] hover:text-[#F2C29A] transition-colors text-xs sm:text-sm tracking-wide uppercase text-[10px] sm:text-xs font-bold tracking-widest">
          ← Back to Products
        </Link>
      </div>
    </div>
  );
}

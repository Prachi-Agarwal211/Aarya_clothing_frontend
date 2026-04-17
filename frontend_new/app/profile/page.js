'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Edit2,
  Camera,
  Save,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { userApi, authApi } from '@/lib/customerApi';
import { setAuthData } from '@/lib/baseApi';
import { useAuth } from '@/lib/authContext';

export default function ProfilePage() {
  const { user, loading: authLoading, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
  });

  /** Profile verification: resend link, email OTP, SMS OTP */
  const [verifyBusy, setVerifyBusy] = useState(null);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [verifyErr, setVerifyErr] = useState('');
  const [otpChannel, setOtpChannel] = useState(null);
  const [otpCode, setOtpCode] = useState('');

  // NOTE: Auth check is handled by middleware.js - removed duplicate redirect logic
  // The middleware will redirect to login with redirect_url if not authenticated

  // Sync form data from auth user
  useEffect(() => {
    if (user) {
      const fullName = user.profile?.full_name || user.full_name || '';
      setFormData({
        full_name: fullName,
        email: user.email || '',
        phone: user.profile?.phone || user.phone || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const data = await userApi.updateProfile({
        full_name: formData.full_name,
        phone: formData.phone,
      });
      updateUser(data);
      setEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const emailVerified = Boolean(user?.email_verified);
  const phoneVerified = Boolean(user?.phone_verified);
  const profilePhone = (user?.profile?.phone || user?.phone || '').trim();

  const applyVerifiedUser = (payload) => {
    if (payload?.user) {
      setAuthData({ user: payload.user });
      updateUser(payload.user);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!user?.email) return;
    setVerifyErr('');
    setVerifyMsg('');
    setVerifyBusy('email_otp_send');
    try {
      await authApi.resendVerificationOtp({ email: user.email, otp_type: 'EMAIL' });
      setOtpChannel('email');
      setOtpCode('');
      setVerifyMsg('Enter the 6-digit code we sent to your email.');
    } catch (e) {
      setVerifyErr(e.message || 'Could not send email code.');
    } finally {
      setVerifyBusy(null);
    }
  };

  const handleSendPhoneOtp = async () => {
    const phone = profilePhone || formData.phone?.trim();
    if (!phone) {
      setVerifyErr('Add a phone number in your profile, save, then verify.');
      return;
    }
    setVerifyErr('');
    setVerifyMsg('');
    setVerifyBusy('phone_otp_send');
    try {
      await authApi.resendVerificationOtp({ phone, otp_type: 'SMS' });
      setOtpChannel('phone');
      setOtpCode('');
      setVerifyMsg('Enter the 6-digit code we sent by SMS.');
    } catch (e) {
      setVerifyErr(e.message || 'Could not send SMS code.');
    } finally {
      setVerifyBusy(null);
    }
  };

  const handleSubmitOtp = async () => {
    const code = otpCode.replace(/\D/g, '').slice(0, 6);
    const channel = otpChannel;
    if (code.length !== 6 || !channel) return;
    setVerifyErr('');
    setVerifyMsg('');
    setVerifyBusy('otp_verify');
    try {
      const body =
        channel === 'email'
          ? { otp_code: code, email: user.email, otp_type: 'EMAIL' }
          : { otp_code: code, email: user.email, otp_type: 'SMS' };
      const res = await authApi.verifyOtpRegistration(body);
      applyVerifiedUser(res);
      setOtpChannel(null);
      setOtpCode('');
      setVerifyMsg(
        channel === 'email' ? 'Email verified successfully.' : 'Phone verified successfully.',
      );
    } catch (e) {
      setVerifyErr(e.message || 'Invalid or expired code.');
    } finally {
      setVerifyBusy(null);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (authLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-48 bg-[#B76E79]/10 rounded-2xl" />
        <div className="h-32 bg-[#B76E79]/10 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#F2C29A]">Profile Information</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-[#B76E79] hover:text-[#F2C29A] border border-[#B76E79]/20 rounded-lg hover:border-[#B76E79]/40 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[#7A2F57] to-[#B76E79] flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
              {editing && (
                <button className="absolute bottom-0 right-0 w-8 h-8 bg-[#B76E79] rounded-full flex items-center justify-center text-white hover:bg-[#7A2F57] transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5]/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-6 py-2.5 border border-[#B76E79]/20 text-[#EAE0D5]/70 rounded-xl hover:border-[#B76E79]/40 hover:text-[#EAE0D5] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-[#B76E79]" />
                  <span className="text-lg text-[#F2C29A]">{user?.profile?.full_name || user?.full_name || user?.username}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#B76E79]" />
                  <span className="text-[#EAE0D5]">{user?.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-[#B76E79]" />
                  <span className="text-[#EAE0D5]">{user?.profile?.phone || user?.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[#B76E79]" />
                  <span className="text-[#EAE0D5]/70">Member since {formatDate(user?.created_at || '2024-01-01')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verify email / phone — order notifications follow these flags (SMS preferred when both verified) */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-[#B76E79]" />
          <h3 className="text-lg font-semibold text-[#F2C29A]">Account verification</h3>
        </div>
        <p className="text-sm text-[#EAE0D5]/60 mb-4">
          Verify both email and phone to choose SMS for order updates (SMS is used first when both are verified).
        </p>

        {verifyErr ? (
          <div className="mb-3 flex items-start gap-2 text-sm text-red-300/90">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {verifyErr}
          </div>
        ) : null}
        {verifyMsg ? (
          <div className="mb-3 text-sm text-[#B76E79]/90">{verifyMsg}</div>
        ) : null}

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2 border-b border-[#B76E79]/10">
            <div>
              <p className="text-[#EAE0D5]">Email</p>
              <p className="text-xs text-[#EAE0D5]/50">
                {emailVerified ? 'Verified' : 'Not verified — confirm to receive email order updates'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {emailVerified ? (
                <span className="text-sm text-emerald-400/90">Verified</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={!!verifyBusy}
                  className="text-sm px-3 py-1.5 rounded-lg bg-[#B76E79]/20 text-[#F2C29A] hover:bg-[#B76E79]/30 disabled:opacity-50"
                >
                  {verifyBusy === 'email_otp_send' ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    'Send OTP'
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2 border-b border-[#B76E79]/10">
            <div>
              <p className="text-[#EAE0D5]">Phone</p>
              <p className="text-xs text-[#EAE0D5]/50">
                {phoneVerified
                  ? 'Verified'
                  : 'Not verified — add a valid number in Edit, save, then send SMS code'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {phoneVerified ? (
                <span className="text-sm text-emerald-400/90">Verified</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendPhoneOtp}
                  disabled={!!verifyBusy || !profilePhone}
                  className="text-sm px-3 py-1.5 rounded-lg bg-[#B76E79]/20 text-[#F2C29A] hover:bg-[#B76E79]/30 disabled:opacity-50"
                >
                  {verifyBusy === 'phone_otp_send' ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    'SMS code'
                  )}
                </button>
              )}
            </div>
          </div>

          {otpChannel ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end pt-2">
              <div className="flex-1">
                <label className="block text-xs text-[#EAE0D5]/60 mb-1">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full sm:max-w-xs px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] tracking-widest"
                  placeholder="••••••"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmitOtp}
                disabled={otpCode.replace(/\D/g, '').length !== 6 || verifyBusy === 'otp_verify'}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white text-sm disabled:opacity-50"
              >
                {verifyBusy === 'otp_verify' ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  'Verify'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpChannel(null);
                  setOtpCode('');
                  setVerifyErr('');
                }}
                className="text-sm text-[#EAE0D5]/60 hover:text-[#EAE0D5]"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Account Actions */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h3 className="text-lg font-semibold text-[#F2C29A] mb-4">Account Actions</h3>
        <div className="space-y-4">
          <div className="py-3 border-b border-[#B76E79]/10">
            <p className="text-[#EAE0D5]">Order updates</p>
            <p className="text-sm text-[#EAE0D5]/50 mt-1">
              Channel (email vs SMS) follows your verification status in Account verification above — there is no separate toggle yet.
            </p>
          </div>
          <div className="pt-2">
            <button className="text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

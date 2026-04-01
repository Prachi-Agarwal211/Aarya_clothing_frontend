'use client';

import React, { useState } from 'react';
import { Bell, Lock, Eye, EyeOff, Shield, Save, Check } from 'lucide-react';
import { userApi } from '@/lib/customerApi';
import { useAlertToast } from '@/lib/useAlertToast';

export default function SettingsPage() {
  const { showAlert } = useAlertToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [notifications, setNotifications] = useState({
    order_updates: true,
    newsletter: false,
    stock_alerts: true,
  });

  const handlePasswordChange = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showAlert('Passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      showAlert('Password must be at least 8 characters');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await userApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = async (key) => {
    const newValue = !notifications[key];
    setNotifications(prev => ({ ...prev, [key]: newValue }));
    setError('Notification preference sync is not available yet. Changes are local to this session.');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#F2C29A]">Account Settings</h2>

      {/* Success Message */}
      {saved && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2">
          <Check className="w-5 h-5 text-green-400" />
          <span className="text-green-400">Settings saved successfully</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Change Password */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-5 h-5 text-[#B76E79]" />
          <h3 className="text-lg font-medium text-[#F2C29A]">Change Password</h3>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                className="w-full px-3 py-2.5 pr-10 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#EAE0D5]/50 hover:text-[#EAE0D5]"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                className="w-full px-3 py-2.5 pr-10 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#EAE0D5]/50 hover:text-[#EAE0D5]"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
              className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
            />
          </div>

          <button
            onClick={handlePasswordChange}
            disabled={saving || !passwordForm.current_password || !passwordForm.new_password}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-[#B76E79]" />
          <h3 className="text-lg font-medium text-[#F2C29A]">Notification Preferences</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 bg-[#0B0608]/40 rounded-lg cursor-pointer hover:bg-[#0B0608]/60 transition-colors">
            <div>
              <p className="text-[#EAE0D5]">Order Updates</p>
              <p className="text-sm text-[#EAE0D5]/50">Get notified about your order status</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.order_updates}
              onChange={() => handleNotificationChange('order_updates')}
              className="w-5 h-5 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-[#0B0608]/40 rounded-lg cursor-pointer hover:bg-[#0B0608]/60 transition-colors">
            <div>
              <p className="text-[#EAE0D5]">Newsletter</p>
              <p className="text-sm text-[#EAE0D5]/50">Weekly updates about new arrivals</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.newsletter}
              onChange={() => handleNotificationChange('newsletter')}
              className="w-5 h-5 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-[#0B0608]/40 rounded-lg cursor-pointer hover:bg-[#0B0608]/60 transition-colors">
            <div>
              <p className="text-[#EAE0D5]">Stock Alerts</p>
              <p className="text-sm text-[#EAE0D5]/50">Get notified when wishlist items are back in stock</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.stock_alerts}
              onChange={() => handleNotificationChange('stock_alerts')}
              className="w-5 h-5 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
            />
          </label>
        </div>
      </div>

      {/* Security */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-[#B76E79]" />
          <h3 className="text-lg font-medium text-[#F2C29A]">Security</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[#0B0608]/40 rounded-lg">
            <div>
              <p className="text-[#EAE0D5]">Two-Factor Authentication</p>
              <p className="text-sm text-[#EAE0D5]/50">Add an extra layer of security</p>
            </div>
            <button className="px-4 py-2 text-sm text-[#B76E79] border border-[#B76E79]/20 rounded-lg hover:border-[#B76E79]/40 hover:text-[#F2C29A] transition-colors">
              Enable
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#0B0608]/40 rounded-lg">
            <div>
              <p className="text-[#EAE0D5]">Active Sessions</p>
              <p className="text-sm text-[#EAE0D5]/50">Manage your logged in devices</p>
            </div>
            <button className="px-4 py-2 text-sm text-[#B76E79] border border-[#B76E79]/20 rounded-lg hover:border-[#B76E79]/40 hover:text-[#F2C29A] transition-colors">
              View
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
        <h3 className="text-lg font-medium text-red-400 mb-4">Danger Zone</h3>
        <p className="text-sm text-[#EAE0D5]/50 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  );
}

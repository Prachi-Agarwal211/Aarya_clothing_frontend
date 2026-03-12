'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Calendar, Edit2, Camera, Save, AlertCircle } from 'lucide-react';
import { userApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/profile');
    }
  }, [authLoading, isAuthenticated, router]);

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
      logger.error('Error saving profile:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
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

      {/* Personal Information Form - Combined with Profile Information above */}
      {/* Note: Duplicate removed - using the form in Profile Information section above */}
      
      {/* Account Actions */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h3 className="text-lg font-semibold text-[#F2C29A] mb-4">Account Actions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-[#B76E79]/10">
            <div>
              <p className="text-[#EAE0D5]">Email Notifications</p>
              <p className="text-sm text-[#EAE0D5]/50">Receive updates about your orders</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-[#0B0608]/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7A2F57]"></div>
            </label>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-[#B76E79]/10">
            <div>
              <p className="text-[#EAE0D5]">Marketing Emails</p>
              <p className="text-sm text-[#EAE0D5]/50">Receive promotional offers and updates</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-[#0B0608]/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7A2F57]"></div>
            </label>
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

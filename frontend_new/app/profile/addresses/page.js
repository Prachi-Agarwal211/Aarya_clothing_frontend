'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MapPin, Phone, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { addressesApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

export default function AddressesPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    is_default: false,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/profile/addresses');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses();
    }
  }, [isAuthenticated]);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await addressesApi.list();
      setAddresses(data.addresses || data || []);
    } catch (err) {
      logger.error('Error fetching addresses:', err);
      setError('Failed to load addresses. Please try again.');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
      is_default: false,
    });
    setShowAddForm(false);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (address) => {
    setFormData({
      full_name: address.full_name || '',
      phone: address.phone || '',
      address_line1: address.address_line1 || '',
      address_line2: address.address_line2 || '',
      city: address.city || '',
      state: address.state || '',
      postal_code: address.postal_code || '',
      country: address.country || 'India',
      is_default: Boolean(address.is_default),
    });
    setEditingId(address.id);
    setShowAddForm(true);
  };

  const handleSave = async () => {
    // Validate required fields
    const validationErrors = [];
    
    if (!formData.full_name?.trim()) {
      validationErrors.push('Full name is required');
    }
    if (!formData.phone?.trim()) {
      validationErrors.push('Phone number is required');
    }
    if (!formData.address_line1?.trim()) {
      validationErrors.push('Address is required');
    }
    if (!formData.city?.trim()) {
      validationErrors.push('City is required');
    }
    if (!formData.state?.trim()) {
      validationErrors.push('State is required');
    }
    if (!formData.postal_code?.trim()) {
      validationErrors.push('Pincode is required');
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '));
      return;
    }

    // Phone validation - basic format check
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone?.replace(/\s/g, ''))) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    // Pincode validation - should be 6 digits
    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(formData.postal_code?.replace(/\s/g, ''))) {
      setError('Please enter a valid 6-digit pincode');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      if (editingId) {
        // Update existing
        const data = await addressesApi.update(editingId, formData);
        setAddresses(prev => prev.map(a => a.id === editingId ? (data.address || data) : a));
      } else {
        // Create new
        const data = await addressesApi.create(formData);
        setAddresses(prev => [...prev, data.address || data]);
      }
      
      resetForm();
    } catch (err) {
      logger.error('Error saving address:', err);
      setError(err?.message || 'Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    
    try {
      await addressesApi.delete(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      logger.error('Error deleting address:', err);
      setError(err?.message || 'Failed to delete address. Please try again.');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await addressesApi.setDefault(id);
      setAddresses(prev => prev.map(a => ({
        ...a,
        is_default: a.id === id,
      })));
    } catch (err) {
      logger.error('Error setting default address:', err);
      setError(err?.message || 'Failed to update default address. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#F2C29A]">My Addresses</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Address
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-[#F2C29A]">
              {editingId ? 'Edit Address' : 'Add New Address'}
            </h3>
            <button onClick={resetForm} className="text-[#EAE0D5]/50 hover:text-[#EAE0D5]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                required
                className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
              />
            </div>
            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                Phone <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                required
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
              />
            </div>
            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                Pincode <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                required
                maxLength={6}
                className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                Address Line 1 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.address_line1}
                onChange={(e) => setFormData(prev => ({ ...prev, address_line1: e.target.value }))}
                required
                className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">Address Line 2 (Optional)</label>
              <input
                type="text"
                value={formData.address_line2}
                onChange={(e) => setFormData(prev => ({ ...prev, address_line2: e.target.value }))}
                className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
              />
            </div>
            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                City <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                required
                className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
              />
            </div>
            <div>
              <label className="block text-sm text-[#EAE0D5]/70 mb-1">
                State <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                required
                className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="is_default"
              checked={formData.is_default}
              onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
              className="w-4 h-4 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
            />
            <label htmlFor="is_default" className="text-sm text-[#EAE0D5]/70">
              Set as default address
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Address'}
            </button>
            <button
              onClick={resetForm}
              className="px-6 py-2.5 border border-[#B76E79]/20 text-[#EAE0D5]/70 rounded-xl hover:border-[#B76E79]/40 hover:text-[#EAE0D5] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="animate-pulse h-32 bg-[#B76E79]/10 rounded-2xl" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl text-center">
          <MapPin className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
          <p className="text-[#EAE0D5]/50">No addresses saved yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 px-6 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            Add Your First Address
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`p-4 bg-[#0B0608]/40 backdrop-blur-md border rounded-2xl ${
                address.is_default ? 'border-[#B76E79]' : 'border-[#B76E79]/15'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#F2C29A]">{address.full_name}</span>
                  {address.is_default && (
                    <span className="px-2 py-0.5 bg-[#7A2F57]/30 text-[#F2C29A] text-xs rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(address)}
                    className="p-1.5 text-[#EAE0D5]/50 hover:text-[#B76E79] transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="p-1.5 text-[#EAE0D5]/50 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-[#EAE0D5]">{address.full_name}</p>
                <p className="text-[#EAE0D5]/70">
                  {address.address_line1}
                  {address.address_line2 && `, ${address.address_line2}`}
                </p>
                <p className="text-[#EAE0D5]/70">
                  {address.city}, {address.state} - {address.postal_code}
                </p>
                <p className="text-[#EAE0D5]/70 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {address.phone}
                </p>
              </div>

              {!address.is_default && (
                <button
                  onClick={() => handleSetDefault(address.id)}
                  className="mt-3 text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors"
                >
                  Set as default
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

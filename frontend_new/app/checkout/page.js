'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, MapPin, Phone, ChevronRight, Check, Building2 } from 'lucide-react';
import { addressesApi, cartApi } from '@/lib/customerApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

function CheckoutAddressPage() {
  const router = useRouter();
  const { cart, isAuthenticated, refreshCart } = useCart();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState(null);
  const [isBusinessCustomer, setIsBusinessCustomer] = useState(false);
  const [gstin, setGstin] = useState('');
  const [newAddress, setNewAddress] = useState({
    name: '',
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    is_default: false,
  });


  // Redirect if cart is empty
  useEffect(() => {
    if (!loading && cart?.items?.length === 0) {
      router.push('/cart');
    }
  }, [loading, cart, router]);

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

      // Select default address
      const defaultAddr = (data.addresses || data || []).find(a => a.is_default);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr.id);
      } else if ((data.addresses || data || []).length > 0) {
        setSelectedAddress((data.addresses || data)[0].id);
      }
    } catch (err) {
      logger.error('Error fetching addresses:', err);
      setError('Failed to load addresses. Please try again.');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async () => {
    try {
      setSaving(true);
      setError(null);

      // Client-side validation
      const validationErrors = [];
      if (!newAddress.full_name?.trim()) {
        validationErrors.push('Full name is required');
      }
      if (!newAddress.phone?.trim()) {
        validationErrors.push('Phone number is required');
      } else if (!/^\d{10}$/.test(newAddress.phone.replace(/\s/g, ''))) {
        validationErrors.push('Phone number must be 10 digits');
      }
      if (!newAddress.address_line1?.trim()) {
        validationErrors.push('Address is required');
      }
      if (!newAddress.city?.trim()) {
        validationErrors.push('City is required');
      }
      if (!newAddress.state?.trim()) {
        validationErrors.push('State is required');
      }
      if (!newAddress.postal_code?.trim()) {
        validationErrors.push('Pincode is required');
      } else if (!/^\d{6}$/.test(newAddress.postal_code)) {
        validationErrors.push('Pincode must be 6 digits');
      }

      if (validationErrors.length > 0) {
        setError(validationErrors.join('. '));
        setSaving(false);
        return;
      }

      const data = await addressesApi.create(newAddress);
      const newAddr = data.address || data;
      setAddresses(prev => [...prev, newAddr]);
      setSelectedAddress(newAddr.id);

      setShowAddForm(false);
      setNewAddress({
        name: '',
        full_name: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        is_default: false,
      });
    } catch (err) {
      logger.error('Error adding address:', err);
      setError('Failed to add address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedAddress) {
      setError('Please select a delivery address');
      return;
    }

    // GSTIN validation: 15-char alphanumeric
    if (isBusinessCustomer && gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim().toUpperCase())) {
      setError('Invalid GSTIN format. Please check and try again.');
      return;
    }

    try {
      setContinuing(true);
      setError(null);

      // Determine delivery state from selected address
      const addr = addresses.find(a => a.id === selectedAddress);
      const deliveryState = addr?.state || '';

      // Update cart with delivery state for correct GST calculation
      if (deliveryState) {
        await cartApi.setDeliveryState(
          deliveryState,
          isBusinessCustomer && gstin ? gstin.trim().toUpperCase() : null
        );
        await refreshCart();
      }

      // Store in session for payment + confirm pages
      sessionStorage.setItem('checkout_address_id', selectedAddress);
      if (isBusinessCustomer && gstin) {
        sessionStorage.setItem('checkout_gstin', gstin.trim().toUpperCase());
      } else {
        sessionStorage.removeItem('checkout_gstin');
      }

      router.push('/checkout/payment');
    } catch (err) {
      logger.error('Error during checkout continue:', err);
      setError('Failed to proceed. Please try again.');
    } finally {
      setContinuing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <h2 className="text-xl font-semibold text-[#F2C29A] mb-6">Delivery Address</h2>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse h-32 bg-[#B76E79]/10 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Saved Addresses */}
            {addresses.map((address) => (
              <div
                key={address.id}
                onClick={() => setSelectedAddress(address.id)}
                className={`relative p-4 border rounded-xl cursor-pointer transition-all ${selectedAddress === address.id
                  ? 'bg-[#7A2F57]/20 border-[#B76E79]'
                  : 'bg-[#0B0608]/40 border-[#B76E79]/15 hover:border-[#B76E79]/30'
                  }`}
              >
                {selectedAddress === address.id && (
                  <div className="absolute top-3 right-3">
                    <Check className="w-5 h-5 text-[#B76E79]" />
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#B76E79] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[#F2C29A]">{address.name}</span>
                      {address.is_default && (
                        <span className="px-2 py-0.5 bg-[#7A2F57]/30 text-[#F2C29A] text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[#EAE0D5]">{address.full_name}</p>
                    <p className="text-sm text-[#EAE0D5]/70">
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                    </p>
                    <p className="text-sm text-[#EAE0D5]/70">
                      {address.city}, {address.state} - {address.postal_code}
                    </p>
                    <p className="text-sm text-[#EAE0D5]/70 mt-1">
                      <Phone className="w-3 h-3 inline mr-1" />
                      {address.phone}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Address Button/Form */}
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full p-4 border border-dashed border-[#B76E79]/30 rounded-xl text-[#B76E79] hover:border-[#B76E79] hover:text-[#F2C29A] transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New Address
              </button>
            ) : (
              <div className="p-4 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl space-y-4">
                <h3 className="text-[#F2C29A] font-medium">Add New Address</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[#EAE0D5]/70 mb-1">Address Name</label>
                    <input
                      type="text"
                      placeholder="Home, Office, etc."
                      value={newAddress.name}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#EAE0D5]/70 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={newAddress.full_name}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newAddress.phone}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={newAddress.address_line1}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, address_line1: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#EAE0D5]/70 mb-1">Address Line 2 (Optional)</label>
                  <input
                    type="text"
                    value={newAddress.address_line2}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, address_line2: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#EAE0D5]/70 mb-1">City</label>
                    <input
                      type="text"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#EAE0D5]/70 mb-1">State</label>
                    <select
                      value={newAddress.state}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#EAE0D5]/70 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={newAddress.postal_code}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, postal_code: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={newAddress.is_default}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#B76E79]/30 bg-[#0B0608]/60 text-[#B76E79] focus:ring-[#B76E79]/30"
                  />
                  <label htmlFor="is_default" className="text-sm text-[#EAE0D5]/70">
                    Set as default address
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddAddress}
                    disabled={saving}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Address'}
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-2.5 border border-[#B76E79]/20 text-[#EAE0D5]/70 rounded-xl hover:border-[#B76E79]/40 hover:text-[#EAE0D5] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* B2B GSTIN Section */}
      <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            isBusinessCustomer ? 'bg-[#B76E79] border-[#B76E79]' : 'border-[#B76E79]/30 bg-transparent'
          }`} onClick={() => setIsBusinessCustomer(p => !p)}>
            {isBusinessCustomer && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]/80 group-hover:text-[#EAE0D5] transition-colors">
              I am purchasing for my business (GST Registered)
            </span>
          </div>
        </label>

        {isBusinessCustomer && (
          <div className="mt-4 space-y-1">
            <label className="block text-sm text-[#EAE0D5]/70">GSTIN (Optional)</label>
            <input
              type="text"
              placeholder="e.g. 27AAAPL1234C1ZV"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              maxLength={15}
              className="w-full px-3 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 font-mono text-sm uppercase"
            />
            <p className="text-xs text-[#EAE0D5]/40">Enter your 15-digit GSTIN for a tax invoice</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!selectedAddress || continuing}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {continuing ? 'Calculating taxes...' : 'Continue to Payment'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
export default CheckoutAddressPage;

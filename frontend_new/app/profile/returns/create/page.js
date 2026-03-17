'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  RotateCcw, Package, ChevronLeft, AlertCircle, Camera, Upload,
  CheckCircle, X, Trash2, ChevronRight, Loader2
} from 'lucide-react';
import { returnsApi, ordersApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

const RETURN_REASONS = [
  { value: 'defective', label: 'Defective Product', description: 'Product has manufacturing defects or quality issues' },
  { value: 'damaged', label: 'Damaged During Shipping', description: 'Product arrived damaged due to shipping' },
  { value: 'wrong_item', label: 'Wrong Item Received', description: 'Received a different product than ordered' },
  { value: 'size_issue', label: 'Size Issue', description: 'Product size doesn\'t fit as expected' },
  { value: 'quality_issue', label: 'Quality Issue', description: 'Product quality not as described' },
  { value: 'changed_mind', label: 'Changed Mind', description: 'No longer want the product' },
  { value: 'other', label: 'Other Reason', description: 'Please specify in description' },
];

const RETURN_TYPES = [
  { value: 'return', label: 'Return for Refund', description: 'Get your money back to original payment method' },
  { value: 'exchange', label: 'Exchange for Different Item', description: 'Exchange for a different size, color, or product' },
];

const BACKEND_REASON_MAP = {
  defective: 'defective',
  damaged: 'not_as_described',
  wrong_item: 'wrong_item',
  size_issue: 'size_issue',
  quality_issue: 'not_as_described',
  changed_mind: 'changed_mind',
  other: 'other',
};

function CreateReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  
  // Form state
  const [selectedItems, setSelectedItems] = useState([]);
  const [returnType, setReturnType] = useState('return');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [exchangePreference, setExchangePreference] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/profile/returns/create');
      return;
    }
    if (isAuthenticated) {
      fetchOrderDetails();
    }
  }, [orderId, isAuthenticated, authLoading]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (orderId) {
        const data = await ordersApi.get(orderId);
        setOrder(data.order || data);
      } else {
        // Fetch all eligible orders for return
        const data = await ordersApi.list({ status: 'delivered' });
        setOrders(data.orders || data || []);
      }
    } catch (err) {
      logger.error('Error fetching order:', err);
      setError('Failed to load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemToggle = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages(prev => [...prev, ...newImages].slice(0, 5)); // Max 5 images
  };

  const handleRemoveImage = (index) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (selectedItems.length === 0) {
      setError('Please select at least one item to return');
      return;
    }
    if (!reason) {
      setError('Please select a reason for return');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a description of the issue');
      return;
    }
    if (reason === 'defective' || reason === 'damaged') {
      if (images.length === 0) {
        setError('Please upload at least one photo showing the defect/damage');
        return;
      }
    }

    try {
      setSubmitting(true);
      
      const returnData = {
        order_id: order.id,
        type: returnType,
        reason: BACKEND_REASON_MAP[reason] || reason,
        description,
        items: order.items.filter(item => selectedItems.includes(item.id)).map(item => ({
          product_id: item.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.price,
        })),
        images: images.map(img => img.preview), // In real app, upload first
        exchange_preference: returnType === 'exchange' ? exchangePreference : null,
      };

      try {
        const result = await returnsApi.create(order.id, returnData);
        router.push(`/profile/returns/${result.id || result.return?.id}`);
      } catch (apiError) {
        logger.error('API error creating return:', apiError);
        setError(apiError.message || 'Failed to submit return request. Please try again.');
      }
    } catch (err) {
      logger.error('Error creating return:', err);
      setError('Failed to submit return request. Please try again.');
    } finally {
      setSubmitting(false);
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

  // Calculate return total
  const returnTotal = order?.items
    ?.filter(item => selectedItems.includes(item.id))
    ?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-8 w-48 bg-[#B76E79]/10 rounded" />
        <div className="animate-pulse h-96 bg-[#B76E79]/10 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={orderId ? `/profile/orders/${orderId}` : '/profile/orders'}
        className="inline-flex items-center gap-2 text-[#B76E79] hover:text-[#F2C29A] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-[#F2C29A]">Create Return/Exchange Request</h2>
        <p className="text-sm text-[#EAE0D5]/50 mt-1">
          Submit a return or exchange request for defective, damaged, or unwanted items
        </p>
      </div>

      {/* Return Policy Notice */}
      <div className="p-4 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-xl">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-[#B76E79] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#EAE0D5]/70">
            <p className="font-medium text-[#EAE0D5] mb-1">Return Policy</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Returns accepted within 7 days of delivery</li>
              <li>Items must be unused with original tags attached</li>
              <li>Defective/damaged items require photo evidence</li>
              <li>Refunds processed within 5-7 business days after approval</li>
            </ul>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Order Info */}
            {order && (
              <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
                <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Order Information</h3>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#7A2F57]/20 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-[#B76E79]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#EAE0D5]">Order #{order.order_number}</p>
                    <p className="text-sm text-[#EAE0D5]/50">Delivered on {order.delivered_at}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Select Items */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Select Items to Return</h3>
              <div className="space-y-3">
                {order?.items?.map((item) => (
                  <label
                    key={item.id}
                    className={`flex gap-4 p-4 rounded-xl cursor-pointer transition-colors ${
                      selectedItems.includes(item.id) 
                        ? 'bg-[#B76E79]/20 border border-[#B76E79]/40' 
                        : 'bg-[#7A2F57]/10 border border-transparent hover:bg-[#7A2F57]/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleItemToggle(item.id)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                      selectedItems.includes(item.id) 
                        ? 'bg-[#B76E79] border-[#B76E79]' 
                        : 'border-[#B76E79]/30'
                    }`}>
                      {selectedItems.includes(item.id) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="w-16 h-20 bg-[#7A2F57]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-[#B76E79]/30" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#EAE0D5]">{item.name}</p>
                      <p className="text-sm text-[#EAE0D5]/50">
                        Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                      </p>
                      <p className="text-[#F2C29A] mt-1">{formatCurrency(item.price)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Return Type */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Return Type</h3>
              <div className="grid grid-cols-2 gap-4">
                {RETURN_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`p-4 rounded-xl cursor-pointer transition-colors ${
                      returnType === type.value 
                        ? 'bg-[#B76E79]/20 border border-[#B76E79]/40' 
                        : 'bg-[#7A2F57]/10 border border-transparent hover:bg-[#7A2F57]/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="returnType"
                      value={type.value}
                      checked={returnType === type.value}
                      onChange={(e) => setReturnType(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        returnType === type.value 
                          ? 'bg-[#B76E79] border-[#B76E79]' 
                          : 'border-[#B76E79]/30'
                      }`}>
                        {returnType === type.value && (
                          <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[#EAE0D5]">{type.label}</p>
                        <p className="text-xs text-[#EAE0D5]/50">{type.description}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {returnType === 'exchange' && (
                <div className="mt-4 p-4 bg-[#7A2F57]/10 rounded-xl">
                  <label className="block text-sm font-medium text-[#EAE0D5] mb-2">
                    Exchange Preference
                  </label>
                  <textarea
                    value={exchangePreference}
                    onChange={(e) => setExchangePreference(e.target.value)}
                    placeholder="e.g., Exchange for size L, or different color..."
                    className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40 resize-none"
                    rows={2}
                  />
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Reason for Return</h3>
              <div className="space-y-3">
                {RETURN_REASONS.map((r) => (
                  <label
                    key={r.value}
                    className={`flex gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                      reason === r.value 
                        ? 'bg-[#B76E79]/20 border border-[#B76E79]/40' 
                        : 'bg-[#7A2F57]/10 border border-transparent hover:bg-[#7A2F57]/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 ${
                      reason === r.value 
                        ? 'bg-[#B76E79] border-[#B76E79]' 
                        : 'border-[#B76E79]/30'
                    }`}>
                      {reason === r.value && (
                        <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-[#EAE0D5]">{r.label}</p>
                      <p className="text-xs text-[#EAE0D5]/50">{r.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Description</h3>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue in detail. For defective items, mention specific defects..."
                className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40 resize-none"
                rows={4}
              />
            </div>

            {/* Image Upload */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-2">Upload Photos</h3>
              <p className="text-sm text-[#EAE0D5]/50 mb-4">
                {(reason === 'defective' || reason === 'damaged') && (
                  <span className="text-yellow-400">* Required for defective/damaged items. </span>
                )}
                Upload up to 5 photos showing the issue
              </p>
              
              <div className="flex flex-wrap gap-4">
                {images.map((img, index) => (
                  <div key={index} className="relative w-24 h-24 rounded-xl overflow-hidden bg-[#7A2F57]/20">
                    <Image
                      src={img.preview}
                      alt={`Upload preview ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
                
                {images.length < 5 && (
                  <label className="w-24 h-24 rounded-xl border-2 border-dashed border-[#B76E79]/30 flex flex-col items-center justify-center cursor-pointer hover:border-[#B76E79]/50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="sr-only"
                    />
                    <Camera className="w-6 h-6 text-[#B76E79]/50" />
                    <span className="text-xs text-[#EAE0D5]/50 mt-1">Add Photo</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Return Summary */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl sticky top-28">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Return Summary</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[#EAE0D5]/50">Items Selected</span>
                  <span className="text-[#EAE0D5]">{selectedItems.length} item(s)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#EAE0D5]/50">Return Type</span>
                  <span className="text-[#EAE0D5]">{returnType === 'return' ? 'Refund' : 'Exchange'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#EAE0D5]/50">Reason</span>
                  <span className="text-[#EAE0D5]">
                    {reason ? RETURN_REASONS.find(r => r.value === reason)?.label : '-'}
                  </span>
                </div>
                <div className="h-px bg-[#B76E79]/20 my-4" />
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/50">Estimated Refund</span>
                  <span className="text-xl font-semibold text-[#F2C29A]">{formatCurrency(returnTotal)}</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || selectedItems.length === 0}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-5 h-5" />
                    Submit Return Request
                  </>
                )}
              </button>

              <p className="text-xs text-[#EAE0D5]/40 text-center mt-4">
                By submitting, you agree to our return policy terms
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function CreateReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-pulse text-[#8A6A5C]">Loading...</div>
      </div>
    }>
      <CreateReturnContent />
    </Suspense>
  );
}

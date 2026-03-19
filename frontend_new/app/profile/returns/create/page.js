'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  RotateCcw, Package, ChevronLeft, AlertCircle, Upload, Video,
  CheckCircle, X, ChevronRight, Loader2, PlayCircle
} from 'lucide-react';
import { returnsApi, ordersApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

const RETURN_REASONS = [
  { value: 'defective', label: 'Defective Product', description: 'Product has manufacturing defects or quality issues', requiresVideo: true },
  { value: 'damaged', label: 'Damaged During Shipping', description: 'Product arrived damaged due to shipping', requiresVideo: true },
  { value: 'wrong_item', label: 'Wrong Item Received', description: 'Received a different product than ordered', requiresVideo: true },
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
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [exchangePreference, setExchangePreference] = useState('');
  const [videoError, setVideoError] = useState('');

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

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleRemoveVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideo(null);
    setVideoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setVideoError('');

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
    // Video is optional - but adding a video helps process return faster
    if (!video && !videoPreview) {
      setVideoError('Note: Adding a video helps us process your return faster.');
      // Don't return - allow submission without video
    }

    try {
      setSubmitting(true);
      
      let videoUrl = null;
      
      // Upload video if present
      if (video) {
        try {
          const uploadResult = await returnsApi.uploadVideo(video, (progress) => {
            setVideoUploadProgress(progress);
          });
          videoUrl = uploadResult.video_url || uploadResult.url;
        } catch (uploadErr) {
          logger.error('Video upload error:', uploadErr);
          // If video upload fails, still allow submission with note
          setVideoError('Note: Video upload encountered an issue. Your return will be reviewed.');
        }
      }

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
        video_url: videoUrl || videoPreview, // Use uploaded URL or preview blob
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
      setVideoUploadProgress(0);
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
          Submit a return or exchange request for defective or damaged items
        </p>
      </div>

      {/* Return Policy Notice - Video Recommended */}
      <div className="p-4 bg-[#7A2F57]/10 border border-[#B76E79]/30 rounded-xl">
        <div className="flex gap-3">
          <Video className="w-5 h-5 text-[#B76E79] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#EAE0D5]/70">
            <p className="font-medium text-[#F2C29A] mb-1">📹 Video Proof Recommended for Faster Processing</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Adding a video of the unboxing helps us process your return faster</li>
              <li>The video should show the <strong className="text-[#EAE0D5]">product defect or damage</strong> clearly</li>
              <li>Returns with clear video proof are typically approved faster</li>
              <li>Video must be under 3 minutes and clearly show the issue</li>
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

            {/* Video Upload - Optional but recommended */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-1">
                Upload Unboxing Video (Recommended)
              </h3>
              <p className="text-sm text-[#EAE0D5]/50 mb-4">
                Adding a video showing the product defect or damage helps us process your return faster.
              </p>

              {/* Video Recording Instructions */}
              <div className="mb-4 p-4 bg-[#7A2F57]/20 border border-[#B76E79]/30 rounded-xl">
                <p className="text-sm font-medium text-[#F2C29A] mb-2">📹 How to Record Your Video:</p>
                <ol className="text-xs text-[#EAE0D5]/70 space-y-1 list-decimal list-inside">
                  <li>Start recording before opening the package</li>
                  <li>Show the sealed package clearly on camera</li>
                  <li>Open the package while recording - show the packaging</li>
                  <li>Take out the product and show it clearly</li>
                  <li>Zoom in on any defects, damage, or issues</li>
                  <li>For wrong items, show both the received item and what you ordered</li>
                  <li>Keep the video under 3 minutes</li>
                </ol>
              </div>

              {/* Non-defective notice */}
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400">
                  <strong>Note:</strong> Returns are only approved if the video shows a genuine defect, damage, or wrong item. 
                  Returns for size issues, color preferences, or changed mind without valid issues will be declined.
                </p>
              </div>

              {videoPreview ? (
                <div className="relative rounded-xl overflow-hidden bg-[#0B0608]/60 border border-[#B76E79]/20">
                  <video
                    src={videoPreview}
                    controls
                    className="w-full max-h-64 object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveVideo}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="p-2 flex items-center justify-between">
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <PlayCircle className="w-3 h-3" /> Video attached - ready to upload
                    </p>
                    <button
                      type="button"
                      onClick={() => document.getElementById('video-replace').click()}
                      className="text-xs text-[#B76E79] hover:underline"
                    >
                      Replace Video
                    </button>
                    <input
                      id="video-replace"
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="sr-only"
                    />
                  </div>
                  {videoUploadProgress > 0 && videoUploadProgress < 100 && (
                    <div className="p-2">
                      <div className="h-1 bg-[#7A2F57]/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-center text-[#EAE0D5]/50 mt-1">Uploading... {videoUploadProgress}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed border-[#B76E79]/30 cursor-pointer hover:border-[#B76E79]/50 transition-colors bg-[#0B0608]/40">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="sr-only"
                  />
                  <Video className="w-10 h-10 text-[#B76E79]/50 mb-2" />
                  <span className="text-sm text-[#EAE0D5]">Click to upload your unboxing video</span>
                  <span className="text-xs text-red-400 mt-1">⚠️ Video is required for return approval</span>
                  <span className="text-xs text-[#EAE0D5]/30 mt-1">MP4, MOV, AVI up to 200MB • Under 3 minutes</span>
                </label>
              )}

              {videoError && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-xs text-amber-400">{videoError}</p>
                </div>
              )}
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

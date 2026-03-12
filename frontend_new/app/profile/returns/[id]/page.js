'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  RotateCcw, Package, ChevronLeft, Clock, CheckCircle, XCircle, Truck, 
  AlertCircle, MapPin, Phone, Mail, Camera, Upload, MessageSquare,
  ArrowRight, CreditCard, ShoppingBag
} from 'lucide-react';
import { returnsApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

const STATUS_CONFIG = {
  requested: { label: 'Pending Review', color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock },
  approved: { label: 'Approved', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle },
  received: { label: 'Received', color: 'text-purple-400', bg: 'bg-purple-400/10', icon: Package },
  refunded: { label: 'Refunded', color: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle },
};

const REASON_LABELS = {
  defective: 'Defective Product',
  not_as_described: 'Damaged / Not as Described',
  wrong_item: 'Wrong Item Received',
  size_issue: 'Size Issue',
  color_issue: 'Color Issue',
  changed_mind: 'Changed Mind',
  other: 'Other Reason',
};

const TYPE_LABELS = {
  return: 'Return for Refund',
  exchange: 'Exchange for Different Item',
};

export default function ReturnDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [returnData, setReturnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchReturnDetails();
  }, [params.id]);

  const fetchReturnDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await returnsApi.get(params.id);
      setReturnData(data.return || data);
    } catch (err) {
      logger.error('Error fetching return details:', err);
      setError('Failed to load return details. Please try again.');
      setReturnData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReturn = async () => {
    if (!confirm('Are you sure you want to cancel this return request?')) return;
    
    try {
      setCancelling(true);
      await returnsApi.cancel(params.id);
      router.push('/profile/returns');
    } catch (err) {
      logger.error('Error cancelling return:', err);
      alert('Failed to cancel return request');
    } finally {
      setCancelling(false);
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
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-8 w-48 bg-[#B76E79]/10 rounded" />
        <div className="animate-pulse h-64 bg-[#B76E79]/10 rounded-2xl" />
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
        <p className="text-[#EAE0D5]/50">Return request not found</p>
        <Link
          href="/profile/returns"
          className="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl"
        >
          Back to Returns
        </Link>
      </div>
    );
  }

  const normalizedType = returnData.type || 'return';
  const timeline = returnData.timeline || [{
    status: returnData.status,
    note: 'Return request created',
    date: returnData.requested_at || returnData.created_at,
  }];
  const statusConfig = STATUS_CONFIG[returnData.status] || STATUS_CONFIG.requested;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/profile/returns"
        className="inline-flex items-center gap-2 text-[#B76E79] hover:text-[#F2C29A] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Returns
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#F2C29A]">Return Request #{returnData.return_number || `RET-${String(returnData.id).padStart(6, '0')}`}</h2>
          <p className="text-sm text-[#EAE0D5]/50 mt-1">
            Created on {formatDate(returnData.requested_at || returnData.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-sm ${statusConfig.bg} ${statusConfig.color} flex items-center gap-2`}>
            <StatusIcon className="w-4 h-4" />
            {statusConfig.label}
          </span>
          <span className="px-3 py-1.5 rounded-full text-sm bg-[#7A2F57]/20 text-[#EAE0D5]/70">
            {TYPE_LABELS[normalizedType] || TYPE_LABELS.return}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Status Timeline */}
          <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
            <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Return Status Timeline</h3>
            <div className="relative">
              {timeline.map((event, index) => (
                <div key={index} className="flex gap-4 pb-6 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index === timeline.length - 1 ? 'bg-[#B76E79]' : 'bg-[#7A2F57]/30'
                    }`}>
                      {index === timeline.length - 1 ? (
                        <StatusIcon className="w-4 h-4 text-white" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-[#EAE0D5]/50" />
                      )}
                    </div>
                    {index < timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-[#B76E79]/20 mt-2" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[#EAE0D5] capitalize">{event.status}</p>
                    <p className="text-sm text-[#EAE0D5]/50">{event.note}</p>
                    <p className="text-xs text-[#EAE0D5]/30 mt-1">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
            <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Items Being Returned</h3>
            <div className="space-y-4">
              {returnData.items?.length > 0 ? returnData.items.map((item, index) => (
                <div key={index} className="flex gap-4 p-4 bg-[#7A2F57]/10 rounded-xl">
                  <div className="w-20 h-24 bg-[#7A2F57]/20 rounded-lg flex items-center justify-center">
                    <Package className="w-8 h-8 text-[#B76E79]/30" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#EAE0D5]">{item.name}</p>
                    <p className="text-sm text-[#EAE0D5]/50">
                      Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                    </p>
                    <p className="text-[#F2C29A] mt-1">{formatCurrency(item.price)}</p>
                  </div>
                </div>
              )) : (
                <p className="text-[#EAE0D5]/50">Item-level return details are not available for this request.</p>
              )}
            </div>
          </div>

          {/* Reason & Description */}
          <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
            <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Return Reason</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-[#EAE0D5]/50">Reason</p>
                <p className="text-[#EAE0D5]">{REASON_LABELS[returnData.reason] || returnData.reason}</p>
              </div>
              <div>
                <p className="text-sm text-[#EAE0D5]/50">Description</p>
                <p className="text-[#EAE0D5]">{returnData.description}</p>
              </div>
              {returnData.images?.length > 0 && (
                <div>
                  <p className="text-sm text-[#EAE0D5]/50 mb-2">Attached Images</p>
                  <div className="flex gap-2">
                    {returnData.images.map((img, idx) => (
                      <div key={idx} className="w-20 h-20 bg-[#7A2F57]/20 rounded-lg overflow-hidden">
                        <img src={img} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Return Shipping Instructions */}
          {returnData.status === 'approved' && returnData.return_tracking_number && (
            <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
              <h3 className="text-lg font-medium text-blue-400 mb-4">
                <Truck className="w-5 h-5 inline mr-2" />
                Return Tracking
              </h3>
              <div className="space-y-3 text-[#EAE0D5]">
                <p className="text-sm">
                  <strong>Tracking Number:</strong> {returnData.return_tracking_number}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
            <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Order Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/50">Order Number</span>
                <Link href={`/profile/orders/${returnData.order_id}`} className="text-[#B76E79] hover:underline">
                  {returnData.order_number || `#${returnData.order_id}`}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/50">Return Type</span>
                <span className="text-[#EAE0D5]">{TYPE_LABELS[normalizedType] || TYPE_LABELS.return}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#EAE0D5]/50">Total Amount</span>
                <span className="text-[#F2C29A] font-medium">{formatCurrency(returnData.total_amount || returnData.refund_amount)}</span>
              </div>
            </div>
          </div>

          {/* Refund Info */}
          {returnData.status === 'refunded' && returnData.refund && (
            <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl">
              <h3 className="text-lg font-medium text-green-400 mb-4">
                <CreditCard className="w-5 h-5 inline mr-2" />
                Refund Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/50">Refund Amount</span>
                  <span className="text-green-400 font-medium">{formatCurrency(returnData.refund.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/50">Refund Method</span>
                  <span className="text-[#EAE0D5]">{returnData.refund.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/50">Status</span>
                  <span className="text-green-400">{returnData.refund.status}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
            <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Actions</h3>
            <div className="space-y-3">
              <Link
                href={`/profile/orders/${returnData.order_id}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#7A2F57]/20 text-[#EAE0D5] rounded-xl hover:bg-[#7A2F57]/30 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                View Original Order
              </Link>
              
              {returnData.status === 'requested' && (
                <button
                  onClick={handleCancelReturn}
                  disabled={cancelling}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  {cancelling ? 'Cancelling...' : 'Cancel Return Request'}
                </button>
              )}
            </div>
          </div>

          {/* Help */}
          <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
            <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Need Help?</h3>
            <p className="text-sm text-[#EAE0D5]/50 mb-4">
              If you have any questions about your return, please contact our support team.
            </p>
            <Link
              href="/contact"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity"
            >
              <MessageSquare className="w-4 h-4" />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

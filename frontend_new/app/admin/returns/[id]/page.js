'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  RotateCcw, Package, ChevronLeft, Clock, CheckCircle, XCircle, Truck,
  AlertCircle, Mail, Phone, MapPin, MessageSquare, CreditCard, ShoppingBag,
  ArrowRight, Upload, FileText, Send, Ban, RefreshCw, DollarSign
} from 'lucide-react';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import { returnsApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

// Status config matching backend ReturnStatus enum
const STATUS_CONFIG = {
  requested: { label: 'Requested', color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock, nextStatus: ['approved', 'rejected'] },
  approved: { label: 'Approved', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: CheckCircle, nextStatus: ['received'] },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle, nextStatus: [] },
  received: { label: 'Item Received', color: 'text-purple-400', bg: 'bg-purple-400/10', icon: Package, nextStatus: ['refunded'] },
  refunded: { label: 'Refunded', color: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle, nextStatus: [] },
};

const REASON_LABELS = {
  defective: 'Defective Product',
  damaged: 'Damaged During Shipping',
  wrong_item: 'Wrong Item Received',
  size_issue: 'Size Issue',
  quality_issue: 'Quality Issue',
  changed_mind: 'Changed Mind',
  other: 'Other Reason',
};

const TYPE_LABELS = {
  return: 'Return for Refund',
  exchange: 'Exchange for Different Item',
};

export default function AdminReturnDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [returnData, setReturnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionModal, setShowActionModal] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('original');

  useEffect(() => {
    fetchReturnDetails();
  }, [params.id]);

  const fetchReturnDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await returnsApi.get(params.id);
      setReturnData(data.return || data);
      setRefundAmount(data?.total_amount || data?.return?.total_amount || 0);
    } catch (err) {
      logger.error('Error fetching return details:', err);
      setError('Failed to load return details. Please try again.');
      setReturnData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!actionNote.trim() && newStatus === 'rejected') {
      setError('Please provide a reason for rejection');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await returnsApi.updateStatus(params.id, {
        status: newStatus,
        note: actionNote,
      });
      await fetchReturnDetails();
      setShowActionModal(null);
      setActionNote('');
    } catch (err) {
      logger.error('Error updating status:', err);
      setError(err?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      setError('Please enter a valid refund amount');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await returnsApi.processRefund(params.id, {
        amount: parseFloat(refundAmount),
        method: refundMethod,
        note: actionNote,
      });
      await fetchReturnDetails();
      setShowActionModal(null);
      setActionNote('');
    } catch (err) {
      logger.error('Error processing refund:', err);
      setError(err?.message || 'Failed to process refund');
    } finally {
      setActionLoading(false);
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="animate-pulse h-8 w-48 bg-[#B76E79]/10 rounded" />
          <div className="animate-pulse h-96 bg-[#B76E79]/10 rounded-2xl" />
        </div>
      </AdminLayout>
    );
  }

  if (!returnData) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
          <p className="text-[#EAE0D5]/50">Return request not found</p>
          <Link
            href="/admin/returns"
            className="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl"
          >
            Back to Returns
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[returnData.status] || STATUS_CONFIG.pending;
  const returnTypeLabel = TYPE_LABELS[returnData.type] || TYPE_LABELS.return;
  const StatusIcon = statusConfig.icon;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link
          href="/admin/returns"
          className="inline-flex items-center gap-2 text-[#B76E79] hover:text-[#F2C29A] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Returns
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#F2C29A]">Return Request #{returnData.return_number}</h1>
            <p className="text-[#EAE0D5]/50 mt-1">
              Created on {formatDate(returnData.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm ${statusConfig.bg} ${statusConfig.color} flex items-center gap-2`}>
              <StatusIcon className="w-4 h-4" />
              {statusConfig.label}
            </span>
            <span className="px-3 py-1.5 rounded-full text-sm bg-[#7A2F57]/20 text-[#EAE0D5]/70">
              {returnTypeLabel}
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
                {returnData.timeline?.map((event, index) => (
                  <div key={index} className="flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index === returnData.timeline.length - 1 ? 'bg-[#B76E79]' : 'bg-[#7A2F57]/30'
                      }`}>
                        {index === returnData.timeline.length - 1 ? (
                          <StatusIcon className="w-4 h-4 text-white" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-[#EAE0D5]/50" />
                        )}
                      </div>
                      {index < returnData.timeline.length - 1 && (
                        <div className="w-0.5 h-full bg-[#B76E79]/20 mt-2" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-[#EAE0D5] capitalize">{event.status}</p>
                      <p className="text-sm text-[#EAE0D5]/50">{event.note}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-[#EAE0D5]/30">{formatDate(event.date)}</p>
                        <span className="text-xs text-[#B76E79]">• {event.actor}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Items Being Returned</h3>
              <div className="space-y-4">
                {returnData.items?.map((item, index) => (
                  <div key={index} className="flex gap-4 p-4 bg-[#7A2F57]/10 rounded-xl">
                    <div className="w-20 h-24 bg-[#7A2F57]/20 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-[#B76E79]/30" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-[#EAE0D5]">{item.name}</p>
                          <p className="text-sm text-[#EAE0D5]/50">
                            SKU: {item.sku}
                          </p>
                          <p className="text-sm text-[#EAE0D5]/50">
                            Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                          </p>
                        </div>
                        <Link
                          href={`/admin/products/${item.product_id}`}
                          className="text-[#B76E79] hover:underline text-sm"
                        >
                          View Product
                        </Link>
                      </div>
                      <p className="text-[#F2C29A] mt-2">{formatCurrency(item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reason & Description */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Return Reason</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-[#EAE0D5]/50">Reason</p>
                  <p className="text-[#EAE0D5] font-medium">{REASON_LABELS[returnData.reason] || returnData.reason}</p>
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
                        <div key={idx} className="relative w-24 h-24 bg-[#7A2F57]/20 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={img}
                            alt={`Evidence image ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Shipping Address */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Customer Shipping Address</h3>
              <div className="flex gap-3">
                <MapPin className="w-5 h-5 text-[#B76E79] flex-shrink-0 mt-0.5" />
                <div className="text-[#EAE0D5]">
                  <p className="font-medium">{returnData.shipping_address?.name}</p>
                  <p className="text-sm text-[#EAE0D5]/70">{returnData.shipping_address?.address}</p>
                  <p className="text-sm text-[#EAE0D5]/70">
                    {returnData.shipping_address?.city}, {returnData.shipping_address?.state} - {returnData.shipping_address?.pincode}
                  </p>
                  <p className="text-sm text-[#EAE0D5]/70 mt-1">
                    <Phone className="w-3 h-3 inline mr-1" />
                    {returnData.shipping_address?.phone}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Customer Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#7A2F57]/20 rounded-full flex items-center justify-center">
                    <span className="text-[#F2C29A] font-medium">
                      {returnData.customer?.name?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-[#EAE0D5]">{returnData.customer?.name}</p>
                    <p className="text-xs text-[#EAE0D5]/50">{returnData.customer?.email}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#B76E79]/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#EAE0D5]/50">Total Orders</span>
                    <span className="text-[#EAE0D5]">{returnData.customer?.total_orders}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-[#EAE0D5]/50">Total Spent</span>
                    <span className="text-[#EAE0D5]">{formatCurrency(returnData.customer?.total_spent)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Order Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/50">Order Number</span>
                  <Link href={`/admin/orders/${returnData.order_id}`} className="text-[#B76E79] hover:underline">
                    {returnData.order_number}
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/50">Return Type</span>
                  <span className="text-[#EAE0D5]">{returnTypeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#EAE0D5]/50">Total Amount</span>
                  <span className="text-[#F2C29A] font-medium">{formatCurrency(returnData.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Refund Info */}
            {returnData.refund && (
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
                    <span className="text-green-400">{returnData.refund.status || 'processed'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-6 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">Actions</h3>
              <div className="space-y-3">
                {/* Status-based actions */}
                {/* Status-based actions matching backend flow */}
                {returnData.status === 'requested' && (
                  <>
                    <button
                      onClick={() => setShowActionModal('approve')}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Return
                    </button>
                    <button
                      onClick={() => setShowActionModal('reject')}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Return
                    </button>
                  </>
                )}

                {returnData.status === 'approved' && (
                  <>
                    <button
                      onClick={() => setShowActionModal('received')}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      Mark as Received
                    </button>
                  </>
                )}

                {returnData.status === 'received' && (
                  <>
                    <button
                      onClick={() => setShowActionModal('refund')}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-colors"
                    >
                      <DollarSign className="w-4 h-4" />
                      Process Refund
                    </button>
                  </>
                )}

                <Link
                  href={`/admin/orders/${returnData.order_id}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#7A2F57]/20 text-[#EAE0D5] rounded-xl hover:bg-[#7A2F57]/30 transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  View Original Order
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Action Modals */}
        {showActionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a0a10] border border-[#B76E79]/20 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-[#F2C29A] mb-4">
                {showActionModal === 'approve' && 'Approve Return Request'}
                {showActionModal === 'reject' && 'Reject Return Request'}
                {showActionModal === 'receive' && 'Mark as Received'}
                {showActionModal === 'refund' && 'Process Refund'}
              </h3>

              {showActionModal === 'refund' && (
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm text-[#EAE0D5]/50 mb-1">Refund Amount</label>
                    <input
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-full px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#EAE0D5]/50 mb-1">Refund Method</label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-full px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
                    >
                      <option value="original">Original Payment Method</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="wallet">Store Wallet</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm text-[#EAE0D5]/50 mb-1">
                  {showActionModal === 'reject' ? 'Reason for Rejection *' : 'Note (Optional)'}
                </label>
                <textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={
                    showActionModal === 'reject' 
                      ? 'Please provide a reason for rejecting this return...'
                      : 'Add a note for this action...'
                  }
                  className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowActionModal(null);
                    setActionNote('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-[#7A2F57]/20 text-[#EAE0D5] rounded-xl hover:bg-[#7A2F57]/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (showActionModal === 'approve') handleStatusUpdate('approved');
                    else if (showActionModal === 'reject') handleStatusUpdate('rejected');
                    else if (showActionModal === 'receive') handleStatusUpdate('received');
                    else if (showActionModal === 'refund') handleProcessRefund();
                  }}
                  disabled={actionLoading}
                  className={`flex-1 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                    showActionModal === 'reject' 
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : showActionModal === 'refund'
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-[#B76E79] text-white hover:bg-[#B76E79]/80'
                  }`}
                >
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  X,
  User,
  Mail,
  Phone,
  ShoppingBag,
  IndianRupee,
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { usersApi, ordersApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

// R2 public URL for product images
const R2_BASE_URL = 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev';

// Helper to convert relative image URLs to full R2 URLs
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${R2_BASE_URL}/${url.replace(/^\//, '')}`;
};

export default function CustomerDetailModal({ customerId, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [copyError, setCopyError] = useState(null);

  const fetchCustomerDetails = useCallback(async () => {
    if (!customerId) return;
    
    try {
      setLoading(true);
      setError(null);

      const [customerData, ordersData] = await Promise.all([
        usersApi.get(customerId),
        ordersApi.list({ user_id: customerId, limit: 5 }).catch(() => ({ orders: [] })),
      ]);

      setCustomer(customerData);
      setOrders(ordersData.orders || []);
    } catch (err) {
      logger.error('Error fetching customer details:', err);
      setError('Failed to load customer details');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomerDetails();
  }, [fetchCustomerDetails]);

  const handleCopy = useCallback(async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setCopyError(null);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      setCopyError(`Failed to copy ${field}`);
      logger.error('Copy failed:', err);
    }
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'shipped':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'processing':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (!customerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0B0608] border border-[#B76E79]/30 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#B76E79]/20">
          <h2
            className="text-xl font-bold text-[#F2C29A]"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Customer Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/60 hover:text-[#EAE0D5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#B76E79] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-center">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              {error}
            </div>
          ) : customer ? (
            <div className="space-y-6">
              {/* Copy Error Message */}
              {copyError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {copyError}
                </div>
              )}

              {/* Profile Header */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center text-white text-xl font-bold">
                  {getInitials(customer.full_name)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#EAE0D5]">
                    {customer.full_name}
                  </h3>
                  <p className="text-sm text-[#EAE0D5]/50">@{customer.username}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        customer.is_active
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      {customer.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {customer.email_verified && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Email Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl p-4">
                  <label className="text-xs text-[#EAE0D5]/50 flex items-center gap-1 mb-2">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <div className="flex items-center gap-2">
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors text-sm flex-1 truncate"
                    >
                      {customer.email}
                    </a>
                    <button
                      onClick={() => handleCopy(customer.email, 'email')}
                      className="p-2 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors touch-target"
                      aria-label="Copy email to clipboard"
                      aria-pressed={copiedField === 'email'}
                      title="Copy email"
                    >
                      {copiedField === 'email' ? (
                        <Check className="w-5 h-5 text-green-400" aria-hidden="true" />
                      ) : (
                        <Copy className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl p-4">
                  <label className="text-xs text-[#EAE0D5]/50 flex items-center gap-1 mb-2">
                    <Phone className="w-3 h-3" /> Phone
                  </label>
                  <div className="flex items-center gap-2">
                    {customer.phone ? (
                      <>
                        <a
                          href={`tel:${customer.phone}`}
                          className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors text-sm flex-1"
                        >
                          {customer.phone}
                        </a>
                        <button
                          onClick={() => handleCopy(customer.phone, 'phone')}
                          className="p-2 rounded-lg hover:bg-[#B76E79]/10 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors touch-target"
                          aria-label="Copy phone to clipboard"
                          aria-pressed={copiedField === 'phone'}
                          title="Copy phone"
                        >
                          {copiedField === 'phone' ? (
                            <Check className="w-5 h-5 text-green-400" aria-hidden="true" />
                          ) : (
                            <Copy className="w-5 h-5" aria-hidden="true" />
                          )}
                        </button>
                      </>
                    ) : (
                      <span className="text-[#EAE0D5]/40 text-sm">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl p-4 text-center">
                  <ShoppingBag className="w-5 h-5 text-[#B76E79] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#F2C29A]">
                    {customer.order_count || 0}
                  </p>
                  <p className="text-xs text-[#EAE0D5]/50">Total Orders</p>
                </div>
                <div className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl p-4 text-center">
                  <IndianRupee className="w-5 h-5 text-[#B76E79] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#F2C29A]">
                    {formatCurrency(customer.total_spent || 0)}
                  </p>
                  <p className="text-xs text-[#EAE0D5]/50">Total Spent</p>
                </div>
                <div className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl p-4 text-center">
                  <Clock className="w-5 h-5 text-[#B76E79] mx-auto mb-2" />
                  <p className="text-lg font-bold text-[#F2C29A]">
                    {formatDate(customer.last_order_date) === 'N/A'
                      ? 'Never'
                      : formatDate(customer.last_order_date)}
                  </p>
                  <p className="text-xs text-[#EAE0D5]/50">Last Order</p>
                </div>
              </div>

              {/* Account Info */}
              <div className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl p-4">
                <h4 className="text-sm font-medium text-[#EAE0D5] mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#B76E79]" /> Account Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#EAE0D5]/50">Member Since:</span>
                    <p className="text-[#EAE0D5]">{formatDate(customer.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-[#EAE0D5]/50">Last Updated:</span>
                    <p className="text-[#EAE0D5]">{formatDate(customer.updated_at)}</p>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              {orders.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-[#EAE0D5] mb-3 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#B76E79]" /> Recent Orders
                  </h4>
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl overflow-hidden"
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between p-3 border-b border-[#B76E79]/10">
                          <div>
                            <p className="text-sm font-medium text-[#EAE0D5]">
                              #{order.order_number || order.id}
                            </p>
                            <p className="text-xs text-[#EAE0D5]/50">
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-[#F2C29A]">
                              {formatCurrency(order.total_amount)}
                            </span>
                            <span
                              className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>
                        {/* Order Items */}
                        {order.items && order.items.length > 0 && (
                          <div className="p-3 space-y-2">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 py-2"
                              >
                                {/* Product Image */}
                                <div className="w-12 h-12 rounded-lg bg-[#0B0608] border border-[#B76E79]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {item.image_url ? (
                                    <img
                                      src={getImageUrl(item.image_url)}
                                      alt={item.product_name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <ShoppingBag className="w-5 h-5 text-[#B76E79]/40" />
                                  )}
                                </div>
                                {/* Product Details */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#EAE0D5] truncate">
                                    {item.product_name}
                                  </p>
                                  <div className="flex items-center gap-3 text-xs text-[#EAE0D5]/50">
                                    {item.size && (
                                      <span>Size: {item.size}</span>
                                    )}
                                    {item.color && (
                                      <span>Color: {item.color}</span>
                                    )}
                                    <span>Qty: {item.quantity}</span>
                                  </div>
                                </div>
                                {/* Price */}
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-medium text-[#F2C29A]">
                                    {formatCurrency(item.total_price)}
                                  </p>
                                  {item.quantity > 1 && (
                                    <p className="text-xs text-[#EAE0D5]/40">
                                      {formatCurrency(item.unit_price)} each
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl p-6 text-center">
                  <ShoppingBag className="w-8 h-8 text-[#B76E79]/40 mx-auto mb-2" />
                  <p className="text-sm text-[#EAE0D5]/60">No orders found for this customer</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#B76E79]/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#B76E79]/30 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm"
          >
            Close
          </button>
          <Link
            href={`/admin/orders?user_id=${customerId}`}
            className="px-4 py-2 rounded-xl bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors text-sm flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> View All Orders
          </Link>
        </div>
      </div>
    </div>
  );
}

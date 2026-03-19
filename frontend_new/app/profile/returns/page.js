'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw, Package, ChevronRight, Eye, Clock, CheckCircle, XCircle, Truck, AlertCircle, Plus, Video } from 'lucide-react';
import { returnsApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';
import { 
  STATUS_CONFIG, 
  REASON_LABELS, 
  TYPE_LABELS, 
  STATUS_OPTIONS,
  RETURN_STATUS,
  getStatusConfig,
  getReasonLabel 
} from '@/lib/returnConstants';

// Icon mapping for status config
const ICON_MAP = {
  Clock,
  CheckCircle,
  XCircle,
  Package,
  AlertCircle,
  Truck,
};

function ReturnsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/profile/returns');
      return;
    }
    if (isAuthenticated) {
      fetchReturns();
    }
  }, [isAuthenticated, authLoading]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await returnsApi.list();
      setReturns(data.returns || data || []);
    } catch (err) {
      logger.error('Error fetching returns:', err);
      setError('Failed to load returns. Please try again.');
    } finally {
      setLoading(false);
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

  // Filter returns
  const filteredReturns = returns.filter(ret => {
    if (filter === 'all') return true;
    return ret.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header - using sidebar instead of page header to avoid double header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#F2C29A]">My Returns &amp; Exchanges</h2>
        
        <div className="flex items-center gap-3">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40 text-sm"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Return Policy Notice - Updated for Video Requirement */}
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
        <p className="text-sm text-[#EAE0D5]/70">
          <Video className="w-4 h-4 inline mr-2 text-red-400" />
          Returns require <strong className="text-red-400">video proof</strong> of the defect/damage. 
          Requests without video or for non-defective items will be <strong className="text-red-400">declined</strong>.
          Submit within <strong className="text-[#EAE0D5]">7 days of delivery</strong>.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-32 bg-[#B76E79]/10 rounded-2xl" />
          ))}
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl text-center">
          <RotateCcw className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
          <p className="text-[#EAE0D5]/50 mb-2">No return requests found</p>
          <p className="text-sm text-[#EAE0D5]/40 mb-4">
            {filter !== 'all' 
              ? 'Try changing the filter or create a new return request'
              : 'You haven\'t made any return or exchange requests yet'}
          </p>
          <Link
            href="/profile/orders"
            className="inline-block px-6 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            View Orders
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReturns.map((ret) => {
            const statusConfig = getStatusConfig(ret.status);
            const StatusIcon = ICON_MAP[statusConfig.icon] || Clock;
            
            return (
              <div
                key={ret.id}
                className="p-4 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl hover:border-[#B76E79]/30 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Return Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-[#F2C29A]">RET-{ret.id.toString().padStart(6, '0')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusConfig.bg} ${statusConfig.color} flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-sm text-[#EAE0D5]/70 mb-1">
                      Order: <Link href={`/profile/orders/${ret.order_id}`} className="text-[#B76E79] hover:underline">#{ret.order_id}</Link>
                    </p>
                    <p className="text-sm text-[#EAE0D5]/50">
                      Reason: {getReasonLabel(ret.reason)} • {formatDate(ret.requested_at)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className="text-lg font-semibold text-[#F2C29A]">{formatCurrency(ret.refund_amount)}</p>
                    {ret.status === RETURN_STATUS.REFUNDED && ret.refund_transaction_id && (
                      <p className="text-xs text-green-400">Refund ID: {ret.refund_transaction_id}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <Link
                    href={`/profile/returns/${ret.id}`}
                    className="flex items-center gap-1 px-4 py-2 text-[#B76E79] hover:text-[#F2C29A] transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Status Timeline Preview */}
                {ret.status === RETURN_STATUS.APPROVED && (
                  <div className="mt-3 pt-3 border-t border-[#B76E79]/10">
                    <p className="text-sm text-[#EAE0D5]/70">
                      <CheckCircle className="w-4 h-4 inline mr-1 text-blue-400" />
                      Your return request has been approved. Please ship the item back.
                    </p>
                  </div>
                )}
                {ret.status === RETURN_STATUS.REFUNDED && (
                  <div className="mt-3 pt-3 border-t border-[#B76E79]/10">
                    <p className="text-sm text-[#EAE0D5]/70">
                      <CheckCircle className="w-4 h-4 inline mr-1 text-green-400" />
                      Return completed. Refund has been processed to your original payment method.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-pulse text-[#8A6A5C]">Loading returns...</div>
      </div>
    }>
      <ReturnsContent />
    </Suspense>
  );
}

'use client';

import React, { useState, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, CheckCircle, Search, Download,
  IndianRupee, Clock, Phone, Mail, Zap, X, ExternalLink,
} from 'lucide-react';
import { ordersApi } from '@/lib/adminApi';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const formatTimestamp = (ts) => {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
};

export default function PaymentRecoveryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hours, setHours] = useState(48);
  const [tab, setTab] = useState('missing');

  // Force-create state: per-row
  const [creatingFor, setCreatingFor] = useState(null); // payment_id being processed
  const [confirmFor, setConfirmFor] = useState(null);   // payment to confirm
  const [createResults, setCreateResults] = useState({}); // payment_id -> { success, message, order_id }

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromTs = Math.floor((Date.now() / 1000) - hours * 3600);
      const result = await ordersApi.getPaymentRecovery(fromTs);
      setData(result);
      setCreateResults({}); // reset per-row results on refresh
    } catch (err) {
      setError(err?.message || err?.data?.detail || 'Failed to fetch payment recovery report');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  const handleForceCreate = async (paymentId) => {
    setConfirmFor(null);
    setCreatingFor(paymentId);
    try {
      const result = await ordersApi.forceCreateOrder(paymentId);
      setCreateResults(prev => ({
        ...prev,
        [paymentId]: { success: true, message: result.message, order_id: result.order_id, invoice: result.invoice_number, address: result.shipping_address },
      }));
      // Refresh the report after successful creation so it moves to Matched
      setTimeout(() => fetchReport(), 1200);
    } catch (err) {
      const detail = err?.data?.detail || err?.message || 'Failed to create order';
      setCreateResults(prev => ({
        ...prev,
        [paymentId]: { success: false, message: detail },
      }));
    } finally {
      setCreatingFor(null);
    }
  };

  const downloadCsv = () => {
    if (!data) return;
    const rows = [
      ['Payment ID', 'Razorpay Order ID', 'Amount (INR)', 'Email', 'Phone', 'Method', 'Created At', 'Status'],
      ...(data.missing_orders || []).map(p => [
        p.payment_id, p.razorpay_order_id, p.amount, p.email, p.contact, p.method, formatTimestamp(p.created_at), 'MISSING ORDER'
      ]),
      ...(data.matched || []).map(p => [
        p.payment_id, p.order_id, p.amount, p.email, p.contact, '—', formatTimestamp(p.created_at), 'MATCHED'
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment_recovery_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Confirm Dialog */}
      {confirmFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a0d12] border border-[#B76E79]/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-[#F2C29A] font-semibold">Force Create Order</h3>
                <p className="text-xs text-[#EAE0D5]/50">This will create a DB order immediately</p>
              </div>
            </div>
            <div className="p-3 bg-[#0B0608]/60 rounded-xl mb-4 space-y-1">
              <p className="text-xs text-[#EAE0D5]/50">Payment ID</p>
              <p className="font-mono text-sm text-[#F2C29A] break-all">{confirmFor.payment_id}</p>
              <p className="text-xs text-[#EAE0D5]/50 mt-2">Amount</p>
              <p className="text-green-400 font-semibold">{formatCurrency(confirmFor.amount)}</p>
              {confirmFor.email && <>
                <p className="text-xs text-[#EAE0D5]/50 mt-2">Customer</p>
                <p className="text-sm text-[#EAE0D5]/80">{confirmFor.email}</p>
              </>}
            </div>
            <p className="text-xs text-[#EAE0D5]/50 mb-4">
              The system will look up this payment in Razorpay, find the customer by email,
              pull their default address, and create a confirmed order. You can edit it afterward.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmFor(null)}
                className="flex-1 py-2 border border-[#B76E79]/20 text-[#EAE0D5]/60 rounded-xl hover:bg-[#B76E79]/10 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleForceCreate(confirmFor.payment_id)}
                className="flex-1 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-semibold"
              >
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            Payment Recovery
          </h1>
          <p className="text-sm text-[#EAE0D5]/60 mt-1">
            Cross-references Razorpay captured payments with DB orders. Use &quot;Force Create&quot; to recover missing orders.
          </p>
        </div>
        {data && (
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 px-4 py-2 bg-[#7A2F57]/30 border border-[#B76E79]/30 text-[#F2C29A] rounded-xl hover:bg-[#7A2F57]/50 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="p-5 bg-[#0B0608]/60 border border-[#B76E79]/15 rounded-2xl flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#B76E79]" />
          <span className="text-sm text-[#EAE0D5]/70">Look back:</span>
          {[12, 24, 48, 72, 168].map(h => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                hours === h
                  ? 'bg-[#B76E79] text-white'
                  : 'bg-[#7A2F57]/20 text-[#EAE0D5]/60 hover:bg-[#7A2F57]/40'
              }`}
            >
              {h === 168 ? '7d' : `${h}h`}
            </button>
          ))}
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm ml-auto"
        >
          <Search className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Fetching...' : 'Run Recovery Check'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Payments Fetched', value: data.total_payments_fetched, color: 'text-[#EAE0D5]' },
              { label: 'Matched Orders', value: data.matched_count, color: 'text-green-400' },
              { label: 'Missing Orders', value: data.missing_order_count, color: 'text-red-400' },
              { label: 'Unrecovered Amount', value: formatCurrency(data.total_missing_amount_inr), color: 'text-yellow-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 bg-[#0B0608]/60 border border-[#B76E79]/15 rounded-xl">
                <p className="text-xs text-[#EAE0D5]/50 mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-[#B76E79]/15">
            {[
              { key: 'missing', label: `Missing Orders (${data.missing_order_count})` },
              { key: 'matched', label: `Matched (${data.matched_count})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === key
                    ? 'border-[#B76E79] text-[#F2C29A]'
                    : 'border-transparent text-[#EAE0D5]/50 hover:text-[#EAE0D5]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Missing Orders Table */}
          {tab === 'missing' && (
            <div className="bg-[#0B0608]/60 border border-[#B76E79]/15 rounded-2xl overflow-hidden">
              {data.missing_orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <CheckCircle className="w-12 h-12 text-green-400 mb-3" />
                  <p className="text-[#F2C29A] font-semibold">All payments have orders — no recovery needed!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#B76E79]/15">
                        {['Payment ID', 'Rzp Order ID', 'Amount', 'Customer', 'Method', 'Date', 'Action'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs text-[#EAE0D5]/50 uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#B76E79]/10">
                      {data.missing_orders.map(p => {
                        const result = createResults[p.payment_id];
                        const isCreating = creatingFor === p.payment_id;
                        return (
                          <React.Fragment key={p.payment_id}>
                            <tr className={`hover:bg-[#B76E79]/5 transition-colors ${result?.success ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-3 font-mono text-xs text-[#F2C29A] whitespace-nowrap">{p.payment_id}</td>
                              <td className="px-4 py-3 font-mono text-xs text-[#EAE0D5]/50 whitespace-nowrap">{p.razorpay_order_id || '—'}</td>
                              <td className="px-4 py-3 text-green-400 font-semibold whitespace-nowrap">{formatCurrency(p.amount)}</td>
                              <td className="px-4 py-3">
                                <div className="space-y-0.5">
                                  {p.email && (
                                    <div className="flex items-center gap-1 text-[#EAE0D5]/70">
                                      <Mail className="w-3 h-3 shrink-0" />
                                      <span className="text-xs truncate max-w-[150px]">{p.email}</span>
                                    </div>
                                  )}
                                  {p.contact && (
                                    <div className="flex items-center gap-1 text-[#EAE0D5]/50">
                                      <Phone className="w-3 h-3 shrink-0" />
                                      <span className="text-xs">{p.contact}</span>
                                    </div>
                                  )}
                                  {!p.email && !p.contact && <span className="text-xs text-[#EAE0D5]/30">No contact info</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-[#EAE0D5]/60 capitalize whitespace-nowrap">{p.method || '—'}</td>
                              <td className="px-4 py-3 text-xs text-[#EAE0D5]/50 whitespace-nowrap">{formatTimestamp(p.created_at)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {result?.success ? (
                                  <span className="flex items-center gap-1 px-2 py-1 bg-green-500/15 text-green-400 text-xs rounded-lg w-fit">
                                    <CheckCircle className="w-3 h-3" />
                                    Order #{result.order_id}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setConfirmFor(p)}
                                    disabled={isCreating || !!result?.success}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/30 text-amber-400 text-xs rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {isCreating
                                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                                      : <Zap className="w-3 h-3" />
                                    }
                                    {isCreating ? 'Creating...' : 'Force Create'}
                                  </button>
                                )}
                              </td>
                            </tr>
                            {/* Inline result row */}
                            {result && !result.success && (
                              <tr>
                                <td colSpan={7} className="px-4 py-2 bg-red-500/5">
                                  <div className="flex items-center gap-2 text-xs text-red-400">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>{result.message}</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {result?.success && result.address && (
                              <tr>
                                <td colSpan={7} className="px-4 py-2 bg-green-500/5">
                                  <div className="flex items-center gap-2 text-xs text-green-400">
                                    <CheckCircle className="w-3 h-3 shrink-0" />
                                    <span>{result.invoice} — Ship to: {result.address}</span>
                                    <a href={`/admin/orders`} className="ml-auto flex items-center gap-1 text-[#B76E79] hover:text-[#F2C29A]">
                                      <ExternalLink className="w-3 h-3" /> View Orders
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Matched Orders Table */}
          {tab === 'matched' && (
            <div className="bg-[#0B0608]/60 border border-[#B76E79]/15 rounded-2xl overflow-hidden">
              {data.matched.length === 0 ? (
                <div className="py-12 text-center text-[#EAE0D5]/50">No matched payments in this period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#B76E79]/15">
                        {['Payment ID', 'Order ID', 'Amount', 'Customer Email', 'Phone', 'Date', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs text-[#EAE0D5]/50 uppercase tracking-wider font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#B76E79]/10">
                      {data.matched.map(p => (
                        <tr key={p.payment_id} className="hover:bg-[#B76E79]/5 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-[#F2C29A]">{p.payment_id}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#EAE0D5]/70">{p.order_id || '—'}</td>
                          <td className="px-4 py-3 text-green-400 font-semibold">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3 text-xs text-[#EAE0D5]/70 truncate max-w-[160px]">{p.email || '—'}</td>
                          <td className="px-4 py-3 text-xs text-[#EAE0D5]/60">{p.contact || '—'}</td>
                          <td className="px-4 py-3 text-xs text-[#EAE0D5]/50">{formatTimestamp(p.created_at)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-green-500/15 text-green-400 text-xs rounded-lg flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" />
                              Matched
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <IndianRupee className="w-14 h-14 text-[#B76E79]/30 mb-4" />
          <p className="text-[#EAE0D5]/50 mb-2">Click &quot;Run Recovery Check&quot; to fetch Razorpay payments</p>
          <p className="text-xs text-[#EAE0D5]/30">Compares captured payments against orders in the database</p>
        </div>
      )}
    </div>
  );
}

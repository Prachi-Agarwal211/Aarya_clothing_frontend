'use client';

import React, { useState } from 'react';
import {
  X, Calendar, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { ordersApi } from '@/lib/adminApi';

/**
 * Server-side Excel export modal — hands the date range to the backend
 * (`/api/v1/admin/excel/orders/export`) which streams an .xlsx response.
 * No client-side workbook generation, so the page stays small.
 */
export default function ExportOrdersModal({ open, statusFilter = '', onClose, onError }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setFrom('');
    setTo('');
    setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      await ordersApi.downloadExcel({
        from_date: from || undefined,
        to_date: to || undefined,
        status: statusFilter || undefined,
      });
      handleClose();
    } catch (err) {
      onError?.(err?.message || 'Export failed.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />
      <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-[#F2C29A] font-cinzel">
            Export orders to Excel
          </h3>
          <button
            onClick={handleClose}
            disabled={busy}
            className="p-1 rounded-lg hover:bg-[#B76E79]/10 disabled:opacity-50"
          >
            <X className="w-5 h-5 text-[#EAE0D5]/50" />
          </button>
        </div>
        <p className="text-sm text-[#EAE0D5]/50 mb-5">
          Pick a date range, or leave both empty to export every
          {statusFilter ? ` ${statusFilter}` : ''} order. The Excel includes one
          row per item (order id, customer, product, qty, price, status...).
        </p>

        <div className="grid grid-cols-2 gap-4">
          <DateField label="From date" value={from} onChange={setFrom} disabled={busy} />
          <DateField label="To date" value={to} onChange={setTo} disabled={busy} />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            disabled={busy}
            className="flex-1 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {busy ? 'Exporting...' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DateField({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative flex items-center border border-[#B76E79]/20 rounded-xl bg-[#0B0608]/60">
        <Calendar className="w-4 h-4 text-[#B76E79] ml-3 flex-shrink-0 pointer-events-none" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 px-3 py-2.5 bg-transparent text-[#EAE0D5] focus:outline-none text-sm disabled:opacity-50 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
      </div>
    </div>
  );
}

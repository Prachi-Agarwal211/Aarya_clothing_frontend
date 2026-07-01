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
      <div className="relative bg-[#0A0A0A]/95 backdrop-blur-xl border border-[#E07B8B]/20 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-[#FFD700] font-cinzel">
            Export orders to Excel
          </h3>
          <button
            onClick={handleClose}
            disabled={busy}
            className="p-1 rounded-lg hover:bg-[#E07B8B]/10 disabled:opacity-50"
          >
            <X className="w-5 h-5 text-[#F5F5F5]/50" />
          </button>
        </div>
        <p className="text-sm text-[#F5F5F5]/50 mb-5">
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
            className="flex-1 px-4 py-2.5 border border-[#E07B8B]/20 rounded-xl text-[#F5F5F5]/70 hover:bg-[#E07B8B]/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#9333EA] to-[#E07B8B] rounded-xl text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
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
      <label className="block text-xs text-[#F5F5F5]/60 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative flex items-center border border-[#E07B8B]/20 rounded-xl bg-[#0A0A0A]/60">
        <Calendar className="w-4 h-4 text-[#E07B8B] ml-3 flex-shrink-0 pointer-events-none" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 px-3 py-2.5 bg-transparent text-[#F5F5F5] focus:outline-none text-sm disabled:opacity-50 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
      </div>
    </div>
  );
}

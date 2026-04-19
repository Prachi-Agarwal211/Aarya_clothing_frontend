'use client';

import React, { useState } from 'react';
import { Hash, Truck, Loader2 } from 'lucide-react';
import { ordersApi } from '@/lib/adminApi';

const DELIVERY_PARTNERS = [
  'Delhivery', 'BlueDart', 'DTDC', 'Xpressbees', 'Shadowfax',
  'Ecom Express', 'India Post', 'FedEx', 'Gati', 'GoJavas',
  'Pickrr', 'Tirupati', 'Other',
];

/**
 * Modal for shipping a single order — kept as a modal because it has
 * three required fields (POD, courier, optional notes) and is a one-shot
 * action that doesn't belong inline in a row.
 *
 * Props
 *   orderId    Open when truthy.
 *   onClose    Always called on close (cancel or success).
 *   onShipped  Called after successful ship — parent should re-fetch.
 *   onError    Called with error message string.
 */
export default function ShipOrderModal({ orderId, onClose, onShipped, onError }) {
  const [pod, setPod] = useState('');
  const [courier, setCourier] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (!orderId) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pod.trim()) return onError?.('POD / tracking number is required.');
    if (!courier.trim()) return onError?.('Delivery partner is required.');
    setBusy(true);
    try {
      await ordersApi.updateStatus(orderId, {
        status: 'shipped',
        pod_number: pod.trim(),
        courier_name: courier.trim(),
        notes: notes.trim() || undefined,
      });
      onShipped?.();
      handleClose();
    } catch (err) {
      onError?.(err?.message || 'Failed to ship order.');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setPod('');
    setCourier('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={busy ? undefined : handleClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-md"
      >
        <h3 className="text-xl font-semibold text-[#F2C29A] mb-1 font-cinzel">
          Ship Order #{orderId}
        </h3>
        <p className="text-sm text-[#EAE0D5]/50 mb-5">
          Enter the courier tracking number — it will be shown to the customer.
        </p>
        <div className="space-y-4">
          <Field label="POD / Tracking number" required>
            <Hash className="w-4 h-4 text-[#B76E79] ml-3 flex-shrink-0" />
            <input
              type="text"
              value={pod}
              onChange={(e) => setPod(e.target.value)}
              placeholder="e.g. DTDC1234567890"
              autoFocus
              className="flex-1 px-3 py-2.5 bg-transparent text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none text-sm"
            />
          </Field>
          <Field label="Delivery partner" required>
            <Truck className="w-4 h-4 text-[#B76E79] ml-3 flex-shrink-0" />
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-transparent text-[#EAE0D5] focus:outline-none text-sm"
            >
              <option value="">Select delivery partner...</option>
              {DELIVERY_PARTNERS.map((dp) => (
                <option key={dp} value={dp} className="bg-[#0B0608]">
                  {dp}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pickup date, special instructions, etc."
              className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/40 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="flex-1 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !pod.trim() || !courier.trim()}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] rounded-xl text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            {busy ? 'Shipping...' : 'Confirm ship'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm text-[#EAE0D5]/70 mb-1">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      <div className="flex items-center border border-[#B76E79]/30 rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

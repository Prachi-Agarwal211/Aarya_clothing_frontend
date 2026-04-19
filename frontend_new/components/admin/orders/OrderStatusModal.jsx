'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ordersApi } from '@/lib/adminApi';

const STATUS_ADMIN_LABELS = {
  confirmed: 'Confirmed (awaiting shipment)',
  shipped:   'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const VALID_TRANSITIONS = {
  confirmed: ['shipped', 'cancelled'],
  shipped:   ['delivered'],
  delivered: [],
  cancelled: [],
};

const DELIVERY_PARTNERS = [
  'Delhivery', 'BlueDart', 'DTDC', 'Xpressbees', 'Shadowfax',
  'Ecom Express', 'India Post', 'FedEx', 'Gati', 'GoJavas',
  'Pickrr', 'Tirupati', 'Other',
];

/**
 * Combined status-update modal for the order detail page. Handles every
 * forward transition (confirmed→shipped/cancelled, shipped→delivered) so
 * the parent page only needs to open/close it.
 *
 * Props
 *   open          Whether the modal is visible.
 *   orderId       Required to call the update endpoint.
 *   currentStatus Drives the available transitions list.
 *   onClose       Called on cancel or after a successful update.
 *   onUpdated     Called after the API call resolves so the parent can re-fetch.
 *   onError       Called with an error message string on failure.
 */
export default function OrderStatusModal({
  open, orderId, currentStatus, onClose, onUpdated, onError,
}) {
  const [newStatus, setNewStatus] = useState('');
  const [pod, setPod] = useState('');
  const [courier, setCourier] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewStatus('');
    setPod('');
    setCourier('');
    setNotes('');
    setBusy(false);
  }, [open, orderId]);

  if (!open) return null;

  const transitions = VALID_TRANSITIONS[currentStatus] || [];

  const handleSubmit = async () => {
    if (!newStatus) return;
    if (newStatus === 'shipped') {
      if (!pod.trim()) return onError?.('POD / tracking number is required.');
      if (!courier.trim()) return onError?.('Delivery partner is required.');
    }
    setBusy(true);
    try {
      await ordersApi.updateStatus(orderId, {
        status: newStatus,
        pod_number: pod.trim() || undefined,
        courier_name: courier.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      onError?.(err?.message || 'Failed to update status.');
    } finally {
      setBusy(false);
    }
  };

  const submitDisabled =
    busy ||
    !newStatus ||
    (newStatus === 'shipped' && (!pod.trim() || !courier.trim()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={busy ? undefined : onClose} />
      <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold text-[#F2C29A] mb-4 font-cinzel">
          Update order status
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-2">New status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
            >
              <option value="">Select new status...</option>
              {transitions.map((s) => (
                <option key={s} value={s} className="bg-[#0B0608]">
                  {STATUS_ADMIN_LABELS[s] || s}
                </option>
              ))}
            </select>
            {transitions.length === 0 && (
              <p className="text-xs text-red-400 mt-1">
                No further status changes available for this order.
              </p>
            )}
          </div>

          {newStatus === 'shipped' && (
            <ShipFields
              pod={pod}
              setPod={setPod}
              courier={courier}
              setCourier={setCourier}
            />
          )}

          <div>
            <label className="block text-sm text-[#EAE0D5]/70 mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this status change..."
              rows={3}
              className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitDisabled}
            className="flex-1 px-4 py-2.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Updating...' : 'Update status'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShipFields({ pod, setPod, courier, setCourier }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-[#EAE0D5]/70 mb-2">
          Delivery partner <span className="text-red-400">*</span>
        </label>
        <select
          value={courier}
          onChange={(e) => setCourier(e.target.value)}
          autoFocus
          className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/40"
        >
          <option value="">Select delivery partner...</option>
          {DELIVERY_PARTNERS.map((dp) => (
            <option key={dp} value={dp} className="bg-[#0B0608]">{dp}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-[#EAE0D5]/70 mb-2">
          POD / Tracking number <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={pod}
          onChange={(e) => setPod(e.target.value)}
          placeholder="e.g. DTDC1234567890"
          className="w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40"
        />
        <p className="text-xs text-[#EAE0D5]/40 mt-1">
          Shown to the customer for tracking.
        </p>
      </div>
    </div>
  );
}

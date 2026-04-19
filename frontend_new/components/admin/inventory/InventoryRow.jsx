'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Loader2, Save, X, XCircle, CheckCircle2, Power,
} from 'lucide-react';
import { inventoryApi } from '@/lib/adminApi';

/**
 * Inline-editable inventory row.
 *
 * Stock changes use the audited POST /admin/inventory/{id}/adjust endpoint so
 * inventory_movements records the delta + reason. Threshold and active toggle
 * use PATCH /admin/inventory/{id} since they don't move stock.
 */
export default function InventoryRow({ item, onUpdated, onError }) {
  const [qtyDraft, setQtyDraft] = useState(String(item.quantity ?? 0));
  const [thresholdDraft, setThresholdDraft] = useState(
    String(item.low_stock_threshold ?? 5),
  );
  const [savingField, setSavingField] = useState(null); // 'qty' | 'threshold' | 'active' | 'oos'
  const qtyRef = useRef(null);
  const thresholdRef = useRef(null);

  useEffect(() => {
    setQtyDraft(String(item.quantity ?? 0));
    setThresholdDraft(String(item.low_stock_threshold ?? 5));
  }, [item.id, item.quantity, item.low_stock_threshold]);

  const qtyDirty = parseInt(qtyDraft, 10) !== (item.quantity ?? 0);
  const thresholdDirty =
    parseInt(thresholdDraft, 10) !== (item.low_stock_threshold ?? 5);

  const handleSaveQty = async () => {
    const next = parseInt(qtyDraft, 10);
    if (Number.isNaN(next) || next < 0) {
      onError?.('Quantity must be a non-negative number.');
      qtyRef.current?.focus();
      return;
    }
    if (next === (item.quantity ?? 0)) return;
    setSavingField('qty');
    try {
      await inventoryApi.adjustStock(item.id, {
        set_to: next,
        reason: 'manual',
        notes: 'Inline edit from inventory page',
      });
      onUpdated?.();
    } catch (err) {
      onError?.(err?.message || 'Failed to update stock.');
      setQtyDraft(String(item.quantity ?? 0));
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveThreshold = async () => {
    const next = parseInt(thresholdDraft, 10);
    if (Number.isNaN(next) || next < 0) {
      onError?.('Threshold must be a non-negative number.');
      thresholdRef.current?.focus();
      return;
    }
    if (next === (item.low_stock_threshold ?? 5)) return;
    setSavingField('threshold');
    try {
      await inventoryApi.update(item.id, { low_stock_threshold: next });
      onUpdated?.();
    } catch (err) {
      onError?.(err?.message || 'Failed to update threshold.');
      setThresholdDraft(String(item.low_stock_threshold ?? 5));
    } finally {
      setSavingField(null);
    }
  };

  const handleMarkOOS = async () => {
    if ((item.quantity ?? 0) === 0) return;
    if (
      !window.confirm(
        `Mark "${item.product_name}" (${item.size || '—'} / ${item.color || '—'}) as Out of Stock?`,
      )
    ) {
      return;
    }
    setSavingField('oos');
    try {
      await inventoryApi.adjustStock(item.id, {
        set_to: 0,
        reason: 'manual',
        notes: 'Marked out of stock from inventory page',
      });
      onUpdated?.();
    } catch (err) {
      onError?.(err?.message || 'Failed to mark out of stock.');
    } finally {
      setSavingField(null);
    }
  };

  const handleToggleActive = async () => {
    setSavingField('active');
    try {
      await inventoryApi.update(item.id, { is_active: !item.is_active });
      onUpdated?.();
    } catch (err) {
      onError?.(err?.message || 'Failed to toggle status.');
    } finally {
      setSavingField(null);
    }
  };

  const stockColor =
    (item.quantity ?? 0) === 0
      ? 'text-red-400'
      : (item.quantity ?? 0) <= (item.low_stock_threshold ?? 5)
        ? 'text-orange-400'
        : 'text-[#F2C29A]';

  return (
    <tr
      className={`hover:bg-[#B76E79]/5 transition-colors ${item.is_active === false ? 'opacity-50' : ''}`}
    >
      <td className="px-4 py-4">
        <p className="font-medium text-[#EAE0D5] text-sm">{item.product_name}</p>
        <p className="text-xs text-[#EAE0D5]/40 font-mono mt-0.5">
          {item.sku || `INV-${item.id}`}
        </p>
        <p className="text-xs text-[#EAE0D5]/50 mt-0.5 sm:hidden">
          {[item.size, item.color].filter(Boolean).join(' · ') || 'Standard'}
        </p>
      </td>

      <td className="px-4 py-4 text-sm text-[#EAE0D5]/70 hidden sm:table-cell">
        {item.size || <span className="text-[#EAE0D5]/30">—</span>}
      </td>

      <td className="px-4 py-4 text-sm hidden sm:table-cell">
        {item.color ? (
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0"
              style={{ backgroundColor: item.color_hex || '#888' }}
              title={item.color}
            />
            <span className="text-[#EAE0D5]/70">{item.color}</span>
          </div>
        ) : (
          <span className="text-[#EAE0D5]/30">—</span>
        )}
      </td>

      {/* Inline qty */}
      <td className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <input
            ref={qtyRef}
            type="number"
            min="0"
            value={qtyDraft}
            onChange={(e) => setQtyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveQty();
              if (e.key === 'Escape') setQtyDraft(String(item.quantity ?? 0));
            }}
            disabled={savingField !== null}
            className={`w-16 px-2 py-1 bg-[#0B0608]/60 border rounded-lg text-sm text-center font-bold focus:outline-none focus:border-[#B76E79]/60 ${qtyDirty ? 'border-[#F2C29A]/40' : 'border-[#B76E79]/15'} ${stockColor}`}
            aria-label="Stock quantity"
          />
          {qtyDirty && (
            <button
              type="button"
              onClick={handleSaveQty}
              disabled={savingField !== null}
              className="p-1.5 rounded-lg bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors disabled:opacity-50"
              title="Save quantity"
            >
              {savingField === 'qty' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </td>

      <td className="px-4 py-4 text-center text-sm text-[#EAE0D5]/50 hidden md:table-cell">
        {item.reserved_quantity || 0}
      </td>

      {/* Inline threshold */}
      <td className="px-4 py-4 text-center hidden lg:table-cell">
        <div className="flex items-center justify-center gap-1.5">
          <input
            ref={thresholdRef}
            type="number"
            min="0"
            value={thresholdDraft}
            onChange={(e) => setThresholdDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveThreshold();
              if (e.key === 'Escape')
                setThresholdDraft(String(item.low_stock_threshold ?? 5));
            }}
            disabled={savingField !== null}
            className={`w-14 px-2 py-1 bg-[#0B0608]/60 border rounded-lg text-sm text-center text-[#EAE0D5]/80 focus:outline-none focus:border-[#B76E79]/60 ${thresholdDirty ? 'border-[#F2C29A]/40' : 'border-[#B76E79]/15'}`}
            aria-label="Low stock threshold"
          />
          {thresholdDirty && (
            <button
              type="button"
              onClick={handleSaveThreshold}
              disabled={savingField !== null}
              className="p-1.5 rounded-lg bg-[#7A2F57]/40 border border-[#B76E79]/40 text-[#F2C29A] hover:bg-[#7A2F57]/60 transition-colors disabled:opacity-50"
              title="Save threshold"
            >
              {savingField === 'threshold' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </td>

      <td className="px-4 py-4 text-center">
        <StockBadge
          quantity={item.quantity ?? 0}
          threshold={item.low_stock_threshold ?? 5}
        />
      </td>

      <td className="px-4 py-4">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={savingField !== null}
            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-50 ${item.is_active === false ? 'bg-[#B76E79]/10 border-[#B76E79]/30 text-[#EAE0D5]/40' : 'bg-green-500/10 border-green-500/25 text-green-400'}`}
            title={item.is_active === false ? 'Inactive — click to activate' : 'Active — click to deactivate'}
          >
            {savingField === 'active' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : item.is_active === false ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleMarkOOS}
            disabled={savingField !== null || (item.quantity ?? 0) === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/15 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            title="Set quantity to 0"
          >
            {savingField === 'oos' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Power className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Out of stock</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

function StockBadge({ quantity, threshold }) {
  if (quantity === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25">
        <XCircle className="w-3 h-3" /> Out
      </span>
    );
  }
  if (quantity <= threshold) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/25">
        Low
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/25">
      In stock
    </span>
  );
}

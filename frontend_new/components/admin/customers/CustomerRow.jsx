'use client';

import Link from 'next/link';
import {
  CheckSquare, Square, Mail, Phone, ShoppingBag, Eye, Calendar, Copy, Check,
} from 'lucide-react';

const initialsOf = (name) =>
  name
    ? name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export default function CustomerRow({ row, selected, onToggleSelect, copied, onCopy }) {
  return (
    <tr
      className={`border-b border-[#B76E79]/5 hover:bg-[#B76E79]/5 transition-colors ${selected ? 'bg-[#B76E79]/10' : ''}`}
    >
      <td className="px-6 py-4">
        <button
          onClick={onToggleSelect}
          className="p-2 rounded hover:bg-[#B76E79]/10"
          aria-label={selected ? 'Deselect customer' : 'Select customer'}
        >
          {selected ? (
            <CheckSquare className="w-5 h-5 text-[#B76E79]" />
          ) : (
            <Square className="w-5 h-5 text-[#EAE0D5]/40" />
          )}
        </button>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center text-white text-sm font-bold">
            {initialsOf(row.full_name)}
          </div>
          <div>
            <p className="font-medium text-[#EAE0D5]">{row.full_name || '—'}</p>
            <p className="text-xs text-[#EAE0D5]/50">@{row.username}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2 group">
          <a
            href={`mailto:${row.email}`}
            className="text-[#EAE0D5]/70 hover:text-[#F2C29A] transition-colors flex items-center gap-1 min-w-0"
          >
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[180px]">{row.email}</span>
          </a>
          <button
            onClick={() => onCopy(row.email, `email-${row.id}`)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#B76E79]/10 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-all"
            title="Copy email"
          >
            {copied === `email-${row.id}` ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </td>
      <td className="px-4 py-4 text-sm">
        {row.phone ? (
          <a
            href={`tel:${row.phone}`}
            className="text-[#EAE0D5]/70 hover:text-[#F2C29A] transition-colors flex items-center gap-1"
          >
            <Phone className="w-3 h-3" /> {row.phone}
          </a>
        ) : (
          <span className="text-[#EAE0D5]/30">—</span>
        )}
      </td>
      <td className="px-4 py-4">
        <span className="flex items-center gap-1 text-[#EAE0D5]">
          <ShoppingBag className="w-4 h-4 text-[#B76E79]/50" />
          {row.order_count || 0}
        </span>
      </td>
      <td className="px-4 py-4 font-medium text-[#F2C29A]">
        {formatINR(row.total_spent)}
      </td>
      <td className="px-4 py-4">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${row.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-4">
        <span className="text-[#EAE0D5]/60 text-sm flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {formatDate(row.created_at)}
        </span>
      </td>
      <td className="px-4 py-4 text-right">
        <Link
          href={`/admin/customers/${row.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A2F57]/20 border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors text-xs"
        >
          <Eye className="w-3.5 h-3.5" /> View
        </Link>
      </td>
    </tr>
  );
}

'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Compact pagination control sized for admin tables.
 *
 * Props
 *   page          1-indexed current page.
 *   pageSize      Items per page (default 20 — matches the global spec).
 *   total         Total item count from the API. When unknown pass `null`
 *                 and the component will hide the "of N" suffix and disable
 *                 "Next" only when `hasMore` is explicitly false.
 *   hasMore       Optional escape hatch when the API doesn't return totals.
 *   onChange      (newPage: number) => void
 */
export default function Pagination({
  page,
  pageSize = 20,
  total = null,
  hasMore = null,
  onChange,
}) {
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const canGoBack = page > 1;
  const canGoForward =
    totalPages != null ? page < totalPages : hasMore !== false;

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem =
    total != null ? Math.min(total, page * pageSize) : page * pageSize;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#EAE0D5]/60">
      <div>
        {total != null ? (
          total === 0 ? (
            <>No results</>
          ) : (
            <>
              Showing <span className="text-[#EAE0D5]">{startItem}</span>–
              <span className="text-[#EAE0D5]">{endItem}</span> of{' '}
              <span className="text-[#EAE0D5]">{total}</span>
            </>
          )
        ) : (
          <>Page {page}</>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => canGoBack && onChange(page - 1)}
          disabled={!canGoBack}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        <span className="px-2">
          {page}
          {totalPages != null && <> / {totalPages}</>}
        </span>
        <button
          type="button"
          onClick={() => canGoForward && onChange(page + 1)}
          disabled={!canGoForward}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

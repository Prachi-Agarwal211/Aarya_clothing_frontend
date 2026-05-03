'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, MessageCircle } from 'lucide-react';

/**
 * DataTable - Reusable data table with sorting, pagination, and actions
 * Fully accessible with ARIA attributes and responsive design
 *
 * @param {Array} columns - Column definitions [{ key, label, sortable, render, width }]
 * @param {Array} data - Table data
 * @param {Function} onRowClick - Row click handler
 * @param {Array} actions - Row action buttons [{ label, onClick, icon, variant }]
 * @param {boolean} sortable - Enable sorting
 * @param {boolean} pagination - Enable pagination
 * @param {number} pageSize - Items per page
 * @param {boolean} loading - Loading state
 * @param {string} emptyMessage - Message when no data
 * @param {React.Component} emptyIcon - Icon for empty state
 * @param {boolean} serverSide - Server-side pagination/sorting
 * @param {number} totalCount - Total row count for server-side
 * @param {Function} onPageChange - Callback(page) for server-side
 * @param {Function} onSort - Callback(column, direction) for server-side
 */
export default function DataTable({
  columns,
  data = [],
  onRowClick,
  actions,
  getActions,
  sortable = true,
  pagination = true,
  pageSize = 20,
  loading = false,
  emptyMessage = 'No data available',
  emptyIcon,
  serverSide = false,
  totalCount,
  page,
  onPageChange,
  onSort,
}) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [internalPage, setInternalPage] = useState(1);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const tableContainerRef = useRef(null);

  // Sync internal page with prop
  useEffect(() => {
    if (page !== undefined && page !== internalPage) {
      setInternalPage(page);
    }
  }, [page]);

  // Use internal state if prop is missing
  const currentPage = page !== undefined ? page : internalPage;

  // Check for horizontal scroll need
  useEffect(() => {
    const checkScroll = () => {
      if (tableContainerRef.current) {
        const { scrollWidth, clientWidth } = tableContainerRef.current;
        setHasHorizontalScroll(scrollWidth > clientWidth);
      }
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Handle sort
  const handleSort = (column) => {
    if (!sortable) return;

    let newDirection = 'asc';
    if (sortColumn === column) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }

    setSortColumn(column);
    setSortDirection(newDirection);

    if (serverSide && onSort) {
      onSort(column, newDirection);
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setInternalPage(page);
    if (serverSide && onPageChange) {
      onPageChange(page);
    }
  };

  // Local sorting
  const sortedData = useMemo(() => {
    if (serverSide) return data;
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (aVal < bVal) {
        comparison = -1;
      } else if (aVal > bVal) {
        comparison = 1;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, serverSide]);

  // Local pagination
  const displayData = useMemo(() => {
    if (serverSide) return data;
    if (!pagination) return sortedData;

    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, pagination, serverSide, data]);

  // Total items & pages
  const effectiveTotal = serverSide ? (totalCount ?? data.length) : data.length;
  const totalPages = Math.ceil(effectiveTotal / pageSize);

  // Loading skeleton
  if (loading) {
    return (
      <div
        className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden"
        role="status"
        aria-label="Loading data"
      >
        <div className="animate-pulse">
          <div className="h-12 bg-[#B76E79]/10 border-b border-[#B76E79]/15" />
          {[...Array(pageSize)].map((_, i) => (
            <div key={i} className="h-14 border-b border-[#B76E79]/10 flex items-center px-4 gap-4">
              <div className="h-4 bg-[#B76E79]/10 rounded w-1/4" />
              <div className="h-4 bg-[#B76E79]/10 rounded w-1/3" />
              <div className="h-4 bg-[#B76E79]/10 rounded w-1/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!data.length) {
    const EmptyIcon = emptyIcon || MessageCircle;
    return (
      <div
        className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-12 text-center"
        role="status"
        aria-label="No data available"
      >
        {EmptyIcon && (
          <EmptyIcon className="w-12 h-12 text-[#B76E79]/30 mx-auto mb-4" aria-hidden="true" />
        )}
        <p className="text-[#EAE0D5]/50">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
      {/* Table container with horizontal scroll */}
      <div
        ref={tableContainerRef}
        className="overflow-x-auto relative"
        role="region"
        aria-label="Data table"
        tabIndex={0}
      >
        {/* Visual scroll indicator */}
        {hasHorizontalScroll && (
          <div
            className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0B0608]/80 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        )}

        <table className="w-full" role="table">
          <thead>
            <tr className="border-b border-[#B76E79]/20 bg-[#0B0608]/60">
              {columns.map((col, index) => (
                <th
                  key={col.key || index}
                  scope="col"
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={cn(
                    'px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-[#F2C29A]',
                    col.sortable !== false && sortable ? 'cursor-pointer hover:bg-[#B76E79]/5' : '',
                    'transition-colors whitespace-nowrap select-none',
                    'min-h-[44px]'
                  )}
                  style={{ minWidth: col.width }}
                  aria-sort={
                    sortColumn === col.key
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span style={{ fontFamily: 'Cinzel, serif' }}>{col.label}</span>
                    {sortable && col.sortable !== false && sortColumn === col.key && (
                      sortDirection === 'asc'
                        ? <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden="true" />
                        : <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden="true" />
                    )}
                  </div>
                </th>
              ))}
              {(actions || getActions) && (
                <th
                  scope="col"
                  className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium text-[#F2C29A] whitespace-nowrap min-h-[44px]"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, idx) => {
              const rowActions = getActions ? getActions(row) : actions;
              return (
                <tr
                  key={row.id || idx}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-[#B76E79]/10',
                    'hover:bg-[#B76E79]/5',
                    'transition-colors',
                    onRowClick ? 'cursor-pointer' : ''
                  )}
                  role="row"
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick?.(row);
                    }
                  }}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#EAE0D5] whitespace-nowrap min-h-[44px]"
                      role="cell"
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right min-h-[44px]" role="cell">
                      <ActionMenu actions={rowActions} row={row} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && effectiveTotal > pageSize && (
        <div
          className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 border-t border-[#B76E79]/20 gap-3"
          role="navigation"
          aria-label="Table pagination"
        >
          <span className="text-sm text-[#EAE0D5]/70" aria-live="polite">
            Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, effectiveTotal)} of {effectiveTotal}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={cn(
                'p-2 rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10',
                'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                'min-w-[44px] min-h-[44px] touch-target'
              )}
              aria-label="Previous page"
              aria-disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1" role="group" aria-label="Page numbers">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                      'min-w-[44px] min-h-[44px] touch-target',
                      currentPage === pageNum
                        ? 'bg-[#7A2F57]/30 text-[#F2C29A] border border-[#B76E79]/30'
                        : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10'
                    )}
                    aria-label={`Page ${pageNum}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                'p-2 rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10',
                'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                'min-w-[44px] min-h-[44px] touch-target'
              )}
              aria-label="Next page"
              aria-disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Action Menu Component with keyboard accessibility
function ActionMenu({ actions, row }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'ArrowDown' && isOpen) {
      e.preventDefault();
      const firstItem = menuRef.current?.querySelector('button');
      firstItem?.focus();
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Row actions"
        className={cn(
          'p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors',
          'min-w-[44px] min-h-[44px] touch-target'
        )}
      >
        <MoreHorizontal className="w-4 h-4 text-[#EAE0D5]/70" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 mt-1 w-40 py-1',
            'bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20',
            'rounded-xl shadow-xl z-20',
            'animate-in fade-in zoom-in-95 duration-200'
          )}
          role="menu"
          aria-orientation="vertical"
          ref={menuRef}
        >
          {actions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(row);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                  'min-h-[44px] touch-target',
                  action.variant === 'danger'
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]'
                )}
                role="menuitem"
              >
                {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}



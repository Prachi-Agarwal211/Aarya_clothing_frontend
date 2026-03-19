'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

/**
 * DataTable - Reusable data table with sorting, pagination, and actions
 * 
 * @param {Array} columns - Column definitions [{ key, label, sortable, render }]
 * @param {Array} data - Table data
 * @param {Function} onRowClick - Row click handler
 * @param {Array} actions - Row action buttons [{ label, onClick, icon, variant }]
 * @param {boolean} sortable - Enable sorting
 * @param {boolean} pagination - Enable pagination
 * @param {number} pageSize - Items per page
 * @param {boolean} loading - Loading state
 * @param {boolean} serverSide - When true, skip local sort/paginate; delegate to callbacks
 * @param {number} totalCount - Total row count for server-side pagination
 * @param {Function} onPageChange - Callback(page) when user changes page (server-side)
 * @param {Function} onSort - Callback(column, direction) when user sorts (server-side)
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
  // Server-side pagination props
  serverSide = false,
  totalCount,
  onPageChange,
  onSort,
}) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Handle sort — delegates to server callback when serverSide=true
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

  // Handle page change — delegates to server callback when serverSide=true
  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (serverSide && onPageChange) {
      onPageChange(page);
    }
  };

  // ---- Local-only sorting (skipped when serverSide=true) ----
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

  // ---- Local-only pagination (skipped when serverSide=true) ----
  const displayData = useMemo(() => {
    if (serverSide) return data;
    if (!pagination) return sortedData;

    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, pagination, serverSide, data]);

  // Total items & pages — uses totalCount for server-side
  const effectiveTotal = serverSide ? (totalCount ?? data.length) : data.length;
  const totalPages = Math.ceil(effectiveTotal / pageSize);

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-[#B76E79]/10 border-b border-[#B76E79]/15" />
          {[...Array(5)].map((_, i) => (
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
    return (
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-12 text-center">
        <p className="text-[#EAE0D5]/50">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#B76E79]/20 bg-[#0B0608]/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`
                    px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-[#F2C29A]
                    ${col.sortable !== false && sortable ? 'cursor-pointer hover:bg-[#B76E79]/5' : ''}
                    transition-colors
                    whitespace-nowrap
                  `}
                  style={{ minWidth: col.width }}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span style={{ fontFamily: 'Cinzel, serif' }}>{col.label}</span>
                    {sortable && col.sortable !== false && sortColumn === col.key && (
                      sortDirection === 'asc'
                        ? <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" />
                        : <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                  </div>
                </th>
              ))}
              {(actions || getActions) && (
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium text-[#F2C29A] whitespace-nowrap" style={{ fontFamily: 'Cinzel, serif' }}>
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
                  className={`
                    border-b border-[#B76E79]/10 
                    hover:bg-[#B76E79]/5 
                    transition-colors
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#EAE0D5] whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
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
        <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 border-t border-[#B76E79]/20 gap-3">
          <span className="text-sm text-[#EAE0D5]/70">
            Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, effectiveTotal)} of {effectiveTotal}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
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
                    className={`
                      w-8 h-8 rounded-lg text-sm font-medium
                      transition-colors
                      ${currentPage === pageNum
                        ? 'bg-[#7A2F57]/30 text-[#F2C29A] border border-[#B76E79]/30'
                        : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10'
                      }
                    `}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
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
  const menuRef = React.useRef(null);
  const buttonRef = React.useRef(null);

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
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4 text-[#EAE0D5]/70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 py-1 bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-xl shadow-xl z-20">
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
                className={`
                  w-full flex items-center gap-2 px-4 py-2 text-sm
                  transition-colors
                  ${action.variant === 'danger'
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]'
                  }
                `}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

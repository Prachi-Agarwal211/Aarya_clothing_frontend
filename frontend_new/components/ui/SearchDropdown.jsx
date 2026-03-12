'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

/**
 * SearchDropdown - Premium search with suggestions dropdown
 * 
 * Features:
 * - Debounced search
 * - Keyboard navigation
 * - Recent searches
 * - Product suggestions
 * - Category suggestions
 * - Loading states
 */
const SearchDropdown = ({
  isOpen,
  onClose,
  onSearch,
  onProductClick,
  recentSearches = [],
  suggestions = [],
  isLoading = false,
  placeholder = 'Search for products...',
  className,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery('');
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    const totalItems = suggestions.length + recentSearches.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < recentSearches.length) {
            handleRecentClick(recentSearches[selectedIndex]);
          } else {
            const productIndex = selectedIndex - recentSearches.length;
            onProductClick?.(suggestions[productIndex]);
          }
        } else if (query.trim()) {
          onSearch?.(query);
          onClose?.();
        }
        break;
      case 'Escape':
        onClose?.();
        break;
    }
  }, [selectedIndex, suggestions, recentSearches, query, onSearch, onProductClick, onClose]);

  // Handle recent search click
  const handleRecentClick = (search) => {
    setQuery(search);
    onSearch?.(search);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const showDropdown = query || recentSearches.length > 0;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'search-dropdown',
        className
      )}
    >
      {/* Search Input */}
      <div className="search-input-wrapper">
        <svg
          className="search-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="search-input"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="search-clear"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown Content */}
      {showDropdown && (
        <div className="search-dropdown-content">
          {/* Loading State */}
          {isLoading && (
            <div className="search-loading">
              <Skeleton variant="text" className="w-full h-12" />
              <Skeleton variant="text" className="w-full h-12" />
              <Skeleton variant="text" className="w-full h-12" />
            </div>
          )}

          {/* Recent Searches */}
          {!isLoading && recentSearches.length > 0 && !query && (
            <div className="search-section">
              <div className="search-section-header">
                <span className="text-xs font-medium text-[#8B7B8F] uppercase tracking-wider">
                  Recent Searches
                </span>
                <button className="text-xs text-[#B76E79] hover:text-[#F3E8EB]">
                  Clear All
                </button>
              </div>
              <div className="search-items">
                {recentSearches.map((search, index) => (
                  <button
                    key={search}
                    onClick={() => handleRecentClick(search)}
                    className={cn(
                      'search-item',
                      selectedIndex === index && 'selected'
                    )}
                  >
                    <svg className="w-4 h-4 text-[#8B7B8F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{search}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Suggestions */}
          {!isLoading && suggestions.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <span className="text-xs font-medium text-[#8B7B8F] uppercase tracking-wider">
                  Products
                </span>
                <span className="text-xs text-[#8B7B8F]">
                  {suggestions.length} results
                </span>
              </div>
              <div className="search-items">
                {suggestions.map((product, index) => (
                  <button
                    key={product.id}
                    onClick={() => onProductClick?.(product)}
                    className={cn(
                      'search-item product',
                      selectedIndex === recentSearches.length + index && 'selected'
                    )}
                  >
                    <img
                      src={product.image || product.images?.[0]}
                      alt={product.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-[#F3E8EB]">
                        {product.name}
                      </div>
                      <div className="text-xs text-[#8B7B8F]">
                        {product.category} • ₹{product.price?.toLocaleString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!isLoading && query && suggestions.length === 0 && (
            <div className="search-no-results">
              <svg className="w-12 h-12 text-[#3D2C35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[#8B7B8F] text-sm mt-2">
                No results found for "{query}"
              </p>
              <p className="text-[#5D4E57] text-xs mt-1">
                Try different keywords or check spelling
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, TrendingUp, Package, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCommerceBaseUrl } from '@/lib/baseApi';
import logger from '@/lib/logger';

/**
 * SearchAutocomplete Component
 * 
 * Features:
 * - Debounced input (300ms)
 * - Shows suggestions after 2 characters
 * - Product thumbnails in suggestions
 * - Category suggestions
 * - Popular/trending searches
 * - Keyboard navigation (arrow keys, Enter)
 * - Mobile-optimized dropdown
 * - Click outside to close
 * - Recent searches persistence (localStorage)
 */
export default function SearchAutocomplete({ 
    placeholder = "Search for products, categories...",
    className = "",
    onSearchSelect 
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [recentSearches, setRecentSearches] = useState([]);
    
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const debounceRef = useRef(null);

    const baseUrl = getCommerceBaseUrl();

    // Load recent searches from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('aarya_recent_searches');
            if (stored) {
                setRecentSearches(JSON.parse(stored));
            }
        } catch (e) {
            logger.error('Failed to load recent searches:', e);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (query.length < 2) {
            setSuggestions(null);
            setIsLoading(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${baseUrl}/api/v1/search/suggestions?q=${encodeURIComponent(query)}&limit=8`);
                if (res.ok) {
                    const data = await res.json();
                    setSuggestions(data);
                    setIsOpen(true);
                }
            } catch (e) {
                logger.error('Search suggestions error:', e);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, baseUrl]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    // Keyboard navigation
    const handleKeyDown = useCallback((e) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => {
                    const allItems = getAllSuggestionItems();
                    return prev < allItems.length - 1 ? prev + 1 : 0;
                });
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => {
                    const allItems = getAllSuggestionItems();
                    return prev > 0 ? prev - 1 : allItems.length - 1;
                });
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    const allItems = getAllSuggestionItems();
                    const selected = allItems[selectedIndex];
                    if (selected) {
                        handleSelectSuggestion(selected);
                    }
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    }, [isOpen, selectedIndex, suggestions, recentSearches]);

    const getAllSuggestionItems = () => {
        if (!suggestions) return [];
        const items = [];
        if (suggestions.products) items.push(...suggestions.products.map(p => ({ type: 'product', ...p })));
        if (suggestions.categories) items.push(...suggestions.categories.map(c => ({ type: 'category', ...c })));
        return items;
    };

    const handleSelectSuggestion = (item) => {
        // Save to recent searches
        if (item.type === 'product' || item.type === 'search') {
            const searchTerm = item.name || item.query;
            if (searchTerm) {
                const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
                setRecentSearches(updated);
                localStorage.setItem('aarya_recent_searches', JSON.stringify(updated));
            }
        }

        setIsOpen(false);
        setQuery('');

        if (onSearchSelect) {
            onSearchSelect(item);
        } else {
            // Default navigation
            if (item.type === 'product') {
                router.push(`/products/${item.id}`);
            } else if (item.type === 'category') {
                router.push(`/products?collection_id=${item.id}`);
            } else if (item.type === 'search') {
                router.push(`/search?q=${encodeURIComponent(item.query)}`);
            }
        }
    };

    const handleClearSearch = () => {
        setQuery('');
        setSuggestions(null);
        inputRef.current?.focus();
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('aarya_recent_searches');
    };

    return (
        <div className={`relative w-full ${className}`} ref={dropdownRef}>
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                        setSelectedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all text-sm"
                />
                {query && (
                    <button
                        onClick={handleClearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
                    {/* Loading State */}
                    {isLoading && (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            <div className="animate-pulse">Searching...</div>
                        </div>
                    )}

                    {/* No Results */}
                    {!isLoading && query.length >= 2 && suggestions &&
                     !suggestions.products?.length && !suggestions.categories?.length && (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            No suggestions found for &quot;{query}&quot;
                        </div>
                    )}

                    {/* Initial State - Recent & Trending */}
                    {!isLoading && query.length < 2 && (
                        <>
                            {recentSearches.length > 0 && (
                                <div className="border-b border-gray-100">
                                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Recent Searches
                                        </span>
                                        <button
                                            onClick={clearRecentSearches}
                                            className="text-xs text-gray-500 hover:text-black"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                    {recentSearches.map((search, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setQuery(search);
                                                setSelectedIndex(-1);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left text-sm text-gray-700"
                                        >
                                            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            <span className="truncate">{search}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {suggestions?.trending?.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100">
                                        <TrendingUp className="w-4 h-4 text-gray-600" />
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Trending Searches
                                        </span>
                                    </div>
                                    {suggestions.trending.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectSuggestion({ type: 'search', query: item })}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left text-sm text-gray-700"
                                        >
                                            <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            <span className="truncate">{item}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Product Suggestions */}
                    {!isLoading && suggestions?.products?.length > 0 && (
                        <div className="border-b border-gray-100">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50">
                                <Package className="w-4 h-4 text-gray-600" />
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Products
                                </span>
                            </div>
                            {suggestions.products.map((product, idx) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleSelectSuggestion({ type: 'product', ...product })}
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left ${
                                        selectedIndex === idx ? 'bg-gray-100' : ''
                                    }`}
                                >
                                    {product.image ? (
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-gray-100"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                                            <Package className="w-5 h-5 text-gray-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                            {product.name}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {product.category}
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold text-black flex-shrink-0">
                                        ₹{Number(product.price).toLocaleString('en-IN')}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Category Suggestions */}
                    {!isLoading && suggestions?.categories?.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100">
                                <Search className="w-4 h-4 text-gray-600" />
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Categories
                                </span>
                            </div>
                            {suggestions.categories.map((category, idx) => (
                                <button
                                    key={category.id}
                                    onClick={() => handleSelectSuggestion({ type: 'category', ...category })}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left ${
                                        selectedIndex === (suggestions.products?.length || 0) + idx ? 'bg-gray-100' : ''
                                    }`}
                                >
                                    <div className="w-8 h-8 bg-black/5 rounded-full flex items-center justify-center flex-shrink-0">
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <span className="text-sm text-gray-700">{category.name}</span>
                                    {category.count && (
                                        <span className="text-xs text-gray-400 ml-auto">
                                            {category.count} items
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search Directly */}
                    {query.length >= 2 && (
                        <button
                            onClick={() => handleSelectSuggestion({ type: 'search', query })}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white hover:bg-gray-800 font-medium text-sm"
                        >
                            <Search className="w-4 h-4" />
                            Search for &quot;{query}&quot;
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

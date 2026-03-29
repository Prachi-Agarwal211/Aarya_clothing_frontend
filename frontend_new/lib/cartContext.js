'use client';

/**
 * Cart Context for Aarya Clothing
 * 
 * Provides centralized cart state management:
 * - Cart items and totals
 * - Add/remove/update operations
 * - Synced with backend API
 * 
 * Usage:
 * ```jsx
 * import { useCart } from '@/lib/cartContext';
 * 
 * function MyComponent() {
 *   const { cart, addItem, removeItem, updateQuantity } = useCart();
 *   // ...
 * }
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cartApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

// Empty cart initial state
const EMPTY_CART = { 
  items: [], 
  subtotal: 0, 
  discount: 0, 
  shipping: 0, 
  total: 0, 
  item_count: 0,
};

const CartContext = createContext(null);

/**
 * Simple mutex lock for preventing race conditions
 */
class Mutex {
  constructor() {
    this._locked = false;
    this._queue = [];
  }

  async lock() {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    return new Promise(resolve => {
      this._queue.push(resolve);
    });
  }

  unlock() {
    const next = this._queue.shift();
    if (next) {
      next();
    } else {
      this._locked = false;
    }
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const fetchingRef = useRef(false);
  const mutexRef = useRef(new Mutex());
  const isUnmountingRef = useRef(false);

  const { isAuthenticated, loading: authLoading } = useAuth();

  // Cleanup on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  // Persist cart to localStorage for recovery
  const persistCartToLocalStorage = useCallback((cartData) => {
    try {
      localStorage.setItem('cart_backup', JSON.stringify({
        ...cartData,
        persistedAt: new Date().toISOString()
      }));
    } catch (err) {
      logger.error('Failed to persist cart to localStorage:', err);
    }
  }, []);

  // Load cart from localStorage backup
  const loadCartFromLocalStorage = useCallback(() => {
    try {
      const savedCart = localStorage.getItem('cart_backup');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        // Check if cart is older than 30 days
        const persistedAt = new Date(parsed.persistedAt);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (persistedAt < thirtyDaysAgo) {
          // Cart is too old, clear it
          localStorage.removeItem('cart_backup');
          return null;
        }
        return parsed;
      }
    } catch (err) {
      logger.error('Failed to load cart from localStorage:', err);
    }
    return null;
  }, []);

  // Clear persisted cart from localStorage
  const clearPersistedCart = useCallback(() => {
    try {
      localStorage.removeItem('cart_backup');
    } catch (err) {
      logger.error('Failed to clear persisted cart:', err);
    }
  }, []);

  // Reset cart when user logs out
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Prevent multiple state updates during logout
      if (isUnmountingRef.current) return;
      
      // Batch state updates to prevent render storm
      setCart(EMPTY_CART);
      setHasFetched(false);
      setError(null);
      setIsSyncing(false);
    }
  }, [isAuthenticated, authLoading]);

  // Fetch cart when user is authenticated
  const fetchCart = useCallback(async (force = false) => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      setCart(EMPTY_CART);
      return;
    }

    // Prevent duplicate fetches or if component is unmounting
    if (fetchingRef.current || isUnmountingRef.current) return;
    if (hasFetched && !force) return;

    // Prevent multiple sync operations
    if (isSyncing) return;

    // Acquire lock to prevent race conditions
    await mutexRef.current.lock();

    try {
      fetchingRef.current = true;
      setIsSyncing(true);
      setLoading(true);
      setError(null);

      const data = await cartApi.get();
      
      if (!isUnmountingRef.current) {
        setCart(data);
        setHasFetched(true);
      }
    } catch (err) {
      logger.error('Error fetching cart:', err);
      if (!isUnmountingRef.current) {
        setError(err.message);
        // Show empty cart on error
        setCart(EMPTY_CART);
        setHasFetched(true); // Set to true even on error to prevent infinite loops
      }
    } finally {
      if (!isUnmountingRef.current) {
        setLoading(false);
        setIsSyncing(false);
      }
      fetchingRef.current = false;
      mutexRef.current.unlock();
    }
  }, [hasFetched, isAuthenticated, isSyncing]);

  // Persist cart to localStorage whenever it changes (for authenticated users)
  useEffect(() => {
    if (isAuthenticated && cart && cart.items) {
      try {
        localStorage.setItem('cart', JSON.stringify(cart));
      } catch (err) {
        logger.error('Failed to persist cart to localStorage:', err);
      }
    }
  }, [cart, isAuthenticated]);

  // Fetch cart when auth state changes
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasFetched) {
      fetchCart();
    }
  }, [isAuthenticated, authLoading, hasFetched, fetchCart]);

  // Open cart drawer
  const openCart = useCallback(() => {
    setIsOpen(true);
    if (isAuthenticated && !hasFetched) {
      fetchCart();
    }
  }, [hasFetched, fetchCart, isAuthenticated]);

  const closeCart = useCallback(() => setIsOpen(false), []);
  
  const toggleCart = useCallback(() => {
    setIsOpen(prev => {
      const newState = !prev;
      if (newState && isAuthenticated && !hasFetched) {
        fetchCart();
      }
      return newState;
    });
  }, [hasFetched, fetchCart, isAuthenticated]);

  // Add item to cart
  const addItem = useCallback(async (productId, quantity = 1, variant = null) => {
    if (!isAuthenticated) {
      throw new Error('Please login to add items to cart');
    }

    try {
      setError(null);

      // If cart hasn't been fetched yet, fetch it first
      if (!hasFetched) {
        await fetchCart();
      }

      const data = await cartApi.addItem(productId, quantity, variant?.id);
      setCart(data);

      // Open cart drawer to show the added item
      setIsOpen(true);

      return data;
    } catch (err) {
      logger.error('Error adding to cart:', err);
      setError(err.message);
      throw err;
    }
  }, [hasFetched, fetchCart, isAuthenticated]);

  // Update item quantity
  const updateQuantity = useCallback(async (productId, quantity, variantId = null) => {
    if (!isAuthenticated) {
      throw new Error('Please login to update cart');
    }
    
    try {
      setError(null);
      const data = await cartApi.updateItem(productId, quantity, variantId);
      setCart(data);
      return data;
    } catch (err) {
      logger.error('Error updating quantity:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated]);

  // Remove item from cart
  const removeItem = useCallback(async (productId, variantId = null) => {
    if (!isAuthenticated) {
      throw new Error('Please login to modify cart');
    }
    
    try {
      setError(null);
      const data = await cartApi.removeItem(productId, variantId);
      setCart(data);
      return data;
    } catch (err) {
      logger.error('Error removing item:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated]);

  // Clear entire cart
  const clearCart = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('Please login to modify cart');
    }

    try {
      setError(null);
      await cartApi.clear();
      setCart(EMPTY_CART);
      // Also clear persisted guest cart
      clearPersistedCart();
    } catch (err) {
      logger.error('Error clearing cart:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated, clearPersistedCart]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    cart,
    loading,
    error,
    isOpen,
    itemCount: cart?.item_count ?? cart?.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) ?? 0,
    isAuthenticated,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
    refreshCart: () => fetchCart(true),
    clearError: () => setError(null),
    persistCartToLocalStorage,
    loadCartFromLocalStorage,
    clearPersistedCart,
  }), [
    cart,
    loading,
    error,
    isOpen,
    isAuthenticated,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
    fetchCart,
    persistCartToLocalStorage,
    loadCartFromLocalStorage,
    clearPersistedCart
  ]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartContext;

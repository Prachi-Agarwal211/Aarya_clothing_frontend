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

  // Reset cart when user logs out (authenticated → unauthenticated transition)
  // CRITICAL: Must NOT fire during the initial auth check window on mobile.
  const prevAuthRef = useRef(false);

  useEffect(() => {
    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = !authLoading && isAuthenticated;

    if (!authLoading && wasAuthenticated && !isAuthenticated) {
      // Genuine logout — clear everything
      if (isUnmountingRef.current) return;
      setCart(EMPTY_CART);
      setHasFetched(false);
      setError(null);
      try { localStorage.removeItem('cart'); } catch (_) {}
    }
  }, [isAuthenticated, authLoading]);

  // Fetch cart from backend
  const fetchCart = useCallback(async (force = false) => {
    if (!isAuthenticated) { setCart(EMPTY_CART); return; }
    if (fetchingRef.current || isUnmountingRef.current) return;
    if (hasFetched && !force) return;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await cartApi.get();
      if (!isUnmountingRef.current) {
        setCart(data);
        setHasFetched(true);
        try { localStorage.setItem('cart', JSON.stringify(data)); } catch (_) {}
      }
    } catch (err) {
      logger.error('Error fetching cart:', err);
      if (!isUnmountingRef.current) {
        setError(err.message);
        setCart(EMPTY_CART);
        setHasFetched(true);
      }
    } finally {
      if (!isUnmountingRef.current) setLoading(false);
      fetchingRef.current = false;
    }
  }, [hasFetched, isAuthenticated]);

  // Fetch cart when auth state becomes ready
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasFetched && !fetchingRef.current) {
      fetchCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  // Open cart drawer
  const openCart = useCallback(() => {
    setIsOpen(true);
    if (isAuthenticated && !hasFetched) fetchCart();
  }, [hasFetched, fetchCart, isAuthenticated]);

  const closeCart = useCallback(() => setIsOpen(false), []);
  
  const toggleCart = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      if (next && isAuthenticated && !hasFetched) fetchCart();
      return next;
    });
  }, [hasFetched, fetchCart, isAuthenticated]);

  // Add item to cart
  const addItem = useCallback(async (productId, quantity = 1, variant = null) => {
    if (!isAuthenticated) throw new Error('Please login to add items to cart');

    setError(null);
    if (!hasFetched) await fetchCart();

    const variantCandidate = typeof variant === 'object' && variant !== null ? variant.id : variant;
    const parsedVariantId = Number(variantCandidate);
    const normalizedVariantId = Number.isInteger(parsedVariantId) && parsedVariantId > 0 ? parsedVariantId : null;

    try {
      const data = await cartApi.addItem(productId, quantity, normalizedVariantId);
      setCart(data);
      setIsOpen(true);
      return data;
    } catch (err) {
      logger.error('Error adding to cart:', err);
      setError(err.message);
      throw err;
    }
  }, [hasFetched, fetchCart, isAuthenticated]);

  // Update item quantity with Optimistic UI
  const updateQuantity = useCallback(async (productId, quantity, variantId = null) => {
    if (!isAuthenticated) throw new Error('Please login to update cart');
    
    const previousCart = { ...cart };
    // Optimistic update
    setCart(prev => {
      const newItems = prev.items.map(item => {
        if (item.product_id === productId && (!variantId || item.variant_id === variantId)) {
          return { ...item, quantity };
        }
        return item;
      });
      const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
      return { ...prev, items: newItems, item_count: itemCount };
    });

    try {
      setError(null);
      const data = await cartApi.updateItem(productId, quantity, variantId);
      setCart(data);
      return data;
    } catch (err) {
      logger.error('Error updating quantity:', err);
      setCart(previousCart); // Rollback
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated, cart]);

  // Remove item from cart
  const removeItem = useCallback(async (productId, variantId = null) => {
    if (!isAuthenticated) throw new Error('Please login to modify cart');
    
    setError(null);
    try {
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
    if (!isAuthenticated) throw new Error('Please login to modify cart');

    setError(null);
    try {
      await cartApi.clear();
      setCart(EMPTY_CART);
      try { localStorage.removeItem('cart'); } catch (_) {}
    } catch (err) {
      logger.error('Error clearing cart:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated]);

  const refreshCart = useCallback(() => fetchCart(true), [fetchCart]);

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
    refreshCart,
    clearError: () => setError(null),
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
    refreshCart,
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

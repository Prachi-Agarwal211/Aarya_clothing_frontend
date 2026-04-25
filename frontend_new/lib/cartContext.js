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
  // We track the previous auth state to detect a genuine true→false transition
  // (logout) vs. the initial false state before checkAuth completes.
  const prevAuthRef = useRef(!authLoading && !isAuthenticated);

  useEffect(() => {
    // Only reset cart on a genuine logout (true → false transition)
    // Not during initial load when authLoading is true or just finished
    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = !authLoading && isAuthenticated;

    if (!authLoading && wasAuthenticated && !isAuthenticated) {
      // Genuine logout — clear everything
      if (isUnmountingRef.current) return;

      setCart(EMPTY_CART);
      setHasFetched(false);
      setError(null);
      setIsSyncing(false);
      clearPersistedCart();
    }
  }, [isAuthenticated, authLoading, clearPersistedCart]);

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

  // Fetch cart when auth state changes - ONLY ONCE per session
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasFetched && !fetchingRef.current) {
      fetchCart();
    }
    // Intentional: hasFetched and fetchCart excluded from deps — fetchingRef guards against re-fetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

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

      const variantCandidate =
        typeof variant === 'object' && variant !== null
          ? variant.id
          : variant;
      const parsedVariantId = Number(variantCandidate);
      const normalizedVariantId = Number.isInteger(parsedVariantId) && parsedVariantId > 0
        ? parsedVariantId
        : null;

      const data = await cartApi.addItem(productId, quantity, normalizedVariantId);
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

  // Update item quantity with Optimistic UI
  const updateQuantity = useCallback(async (productId, quantity, variantId = null) => {
    if (!isAuthenticated) {
      throw new Error('Please login to update cart');
    }
    
    // OPTIMISTIC UPDATE: Update local state immediately
    const previousCart = { ...cart };
    setCart(prev => {
      const newItems = prev.items.map(item => {
        if (item.product_id === productId && (!variantId || item.variant_id === variantId)) {
          return { ...item, quantity };
        }
        return item;
      });
      // Recalculate totals approximately (server will provide exact ones)
      const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
      return { ...prev, items: newItems, item_count: itemCount };
    });

    try {
      setError(null);
      const data = await cartApi.updateItem(productId, quantity, variantId);
      setCart(data); // Sync with real server data
      return data;
    } catch (err) {
      logger.error('Error updating quantity:', err);
      // ROLLBACK: Restore previous cart state on failure
      setCart(previousCart);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated, cart]);

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
  // Only include stable references and primitive values in deps
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
    persistCartToLocalStorage,
    loadCartFromLocalStorage,
    clearPersistedCart,
    // Intentional: fetchCart excluded — it's stable via useCallback and only used internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    cart,
    loading,
    error,
    isOpen,
    isAuthenticated,
    // Include stable callbacks only (they're memoized with useCallback)
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
    // fetchCart is NOT included - refreshCart wraps it via useCallback
    persistCartToLocalStorage,
    loadCartFromLocalStorage,
    clearPersistedCart,
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

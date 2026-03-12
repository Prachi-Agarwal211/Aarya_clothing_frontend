'use client';

/**
 * Cart Context for Aarya Clothing
 * 
 * Provides centralized cart state management:
 * - Cart items and totals
 * - Add/remove/update operations
 * - Coupon management
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

// Empty cart initial state
const EMPTY_CART = { 
  items: [], 
  subtotal: 0, 
  discount: 0, 
  shipping: 0, 
  total: 0, 
  item_count: 0,
  coupon_code: null 
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
  const fetchingRef = useRef(false);
  const mutexRef = useRef(new Mutex());
  
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Reset cart when user logs out
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setCart(EMPTY_CART);
      setHasFetched(false);
      setError(null);
    }
  }, [isAuthenticated, authLoading]);

  // Fetch cart when user is authenticated
  const fetchCart = useCallback(async (force = false) => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      setCart(EMPTY_CART);
      return;
    }
    
    // Prevent duplicate fetches
    if (fetchingRef.current) return;
    if (hasFetched && !force) return;
    
    // Acquire lock to prevent race conditions
    await mutexRef.current.lock();
    
    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      
      const data = await cartApi.get();
      setCart(data);
      setHasFetched(true);
    } catch (err) {
      console.error('Error fetching cart:', err);
      setError(err.message);
      // Don't use mock data - show empty cart on error
      setCart(EMPTY_CART);
      setHasFetched(true); // Set to true even on error to prevent infinite loops
    } finally {
      setLoading(false);
      fetchingRef.current = false;
      mutexRef.current.unlock();
    }
  }, [hasFetched, isAuthenticated]);

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
      console.error('Error adding to cart:', err);
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
      console.error('Error updating quantity:', err);
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
      console.error('Error removing item:', err);
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
    } catch (err) {
      console.error('Error clearing cart:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated]);

  // Apply coupon code
  const applyCoupon = useCallback(async (code) => {
    if (!isAuthenticated) {
      throw new Error('Please login to apply coupons');
    }
    
    try {
      setError(null);
      const data = await cartApi.applyCoupon(code);
      setCart(data);
      return data;
    } catch (err) {
      console.error('Error applying coupon:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated]);

  // Remove coupon code
  const removeCoupon = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('Please login to modify cart');
    }
    
    try {
      setError(null);
      const data = await cartApi.removeCoupon();
      setCart(data);
      return data;
    } catch (err) {
      console.error('Error removing coupon:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    cart,
    loading,
    error,
    isOpen,
    itemCount: cart?.item_count || 0,
    isAuthenticated,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    openCart,
    closeCart,
    toggleCart,
    refreshCart: () => fetchCart(true),
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
    applyCoupon, 
    removeCoupon, 
    openCart, 
    closeCart, 
    toggleCart, 
    fetchCart
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

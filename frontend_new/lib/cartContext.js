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
 * Merge guest cart with account cart
 * - For duplicate items (same product + size), keep higher quantity
 * - Combine totals appropriately
 */
function mergeCarts(accountCart, guestCart) {
  if (!accountCart || !accountCart.items) {
    return guestCart || EMPTY_CART;
  }
  
  if (!guestCart || !guestCart.items) {
    return accountCart;
  }

  const mergedItems = [...accountCart.items];
  
  // Add guest items, merging duplicates
  for (const guestItem of guestCart.items) {
    const existingIndex = mergedItems.findIndex(
      item => item.product_id === guestItem.product_id && 
              item.variant_id === guestItem.variant_id &&
              item.size === guestItem.size
    );
    
    if (existingIndex >= 0) {
      // Duplicate found - keep higher quantity
      const existingItem = mergedItems[existingIndex];
      if (guestItem.quantity > existingItem.quantity) {
        mergedItems[existingIndex] = {
          ...existingItem,
          quantity: guestItem.quantity
        };
      }
    } else {
      // New item - add to cart
      mergedItems.push(guestItem);
    }
  }
  
  // Recalculate totals
  const subtotal = mergedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const item_count = mergedItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // Keep account cart's discount and shipping, recalculate total
  const mergedCart = {
    ...accountCart,
    items: mergedItems,
    subtotal: subtotal,
    item_count: item_count,
    total: subtotal - (accountCart.discount || 0) + (accountCart.shipping || 0)
  };
  
  return mergedCart;
}

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

  // Persist cart to localStorage
  const persistCartToLocalStorage = useCallback((cartData, isGuest = true) => {
    try {
      localStorage.setItem('guest_cart', JSON.stringify({
        ...cartData,
        isGuestCart: isGuest,
        persistedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Failed to persist cart to localStorage:', err);
    }
  }, []);

  // Load cart from localStorage
  const loadCartFromLocalStorage = useCallback(() => {
    try {
      const savedCart = localStorage.getItem('guest_cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        // Check if cart is older than 30 days
        const persistedAt = new Date(parsed.persistedAt);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (persistedAt < thirtyDaysAgo) {
          // Cart is too old, clear it
          localStorage.removeItem('guest_cart');
          return null;
        }
        return parsed;
      }
    } catch (err) {
      console.error('Failed to load cart from localStorage:', err);
    }
    return null;
  }, []);

  // Clear persisted cart from localStorage
  const clearPersistedCart = useCallback(() => {
    try {
      localStorage.removeItem('guest_cart');
    } catch (err) {
      console.error('Failed to clear persisted cart:', err);
    }
  }, []);

  // Reset cart when user logs out - BUT keep it in localStorage for guest persistence
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Don't clear the cart state immediately - preserve guest cart
      const guestCart = loadCartFromLocalStorage();
      if (guestCart) {
        setCart(guestCart);
        setHasFetched(true);
      } else {
        setCart(EMPTY_CART);
        setHasFetched(false);
      }
      setError(null);
    }
  }, [isAuthenticated, authLoading, loadCartFromLocalStorage]);

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
      
      // Check if there's a guest cart to merge
      const guestCart = loadCartFromLocalStorage();
      if (guestCart && guestCart.items && guestCart.items.length > 0) {
        // Merge guest cart with account cart
        const mergedCart = mergeCarts(data, guestCart);
        setCart(mergedCart);
        // Clear the guest cart after successful merge
        clearPersistedCart();
      } else {
        setCart(data);
      }
      
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
  }, [hasFetched, isAuthenticated, loadCartFromLocalStorage, clearPersistedCart]);

  // Persist cart to localStorage whenever it changes (for authenticated users)
  useEffect(() => {
    if (isAuthenticated && cart && cart.items) {
      try {
        localStorage.setItem('cart', JSON.stringify(cart));
      } catch (err) {
        console.error('Failed to persist cart to localStorage:', err);
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
      // Also clear persisted guest cart
      clearPersistedCart();
    } catch (err) {
      console.error('Error clearing cart:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated, clearPersistedCart]);

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
    applyCoupon,
    removeCoupon,
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

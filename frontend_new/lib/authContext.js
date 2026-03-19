'use client';

/**
 * Authentication Context for Aarya Clothing
 *
 * Centralized authentication state management using React Context.
 * Uses baseApi for token storage (localStorage + cookies for middleware).
 *
 * Usage:
 * ```jsx
 * // In layout.js
 * import { AuthProvider } from '@/lib/authContext';
 *
 * export default function RootLayout({ children }) {
 *   return <AuthProvider>{children}</AuthProvider>;
 * }
 *
 * // In components
 * import { useAuth } from '@/lib/authContext';
 * const { user, isAuthenticated, login, logout, isStaff } = useAuth();
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi, clearStoredTokens, setStoredTokens } from './apiClient';
import { getStoredUser, clearAuthData } from './baseApi';
import { apiFetch } from './api';
import { USER_ROLES, hasRole, isAdmin, isStaff, isSuperAdmin } from './roles';

const AuthContext = createContext(null);

/**
 * AuthProvider Component
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);

  /**
   * Check authentication status on mount
   */
  const checkAuth = useCallback(async () => {
    try {
      setAuthError(null);
      const storedUser = getStoredUser();

      if (!storedUser) {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // Pre-set from local storage to avoid flicker
      setUser(storedUser);
      setIsAuthenticated(true);
      setLoading(false); // End loading state immediately to avoid UI flicker

      // Verify and get fresh data from backend
      try {
        const userData = await apiFetch('/api/v1/users/me');
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (err) {
        console.warn('Backend session verification failed:', err.message);
        
        // If unauthorized, clear everything
        if (err.status === 401 || err.status === 403) {
          clearAuthData();
          clearStoredTokens();
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    } catch (err) {
      console.error('Critical auth check error:', err);
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Login function with error handling
   */
  const login = useCallback(async (credentials) => {
    setAuthError(null);

    try {
      const response = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      // Validate response has required data
      if (!response.user) {
        throw new Error('Invalid login response: missing user data');
      }

      // Validate role exists before storing
      if (!response.user?.role) {
        logger.error('Login response missing user role:', response);
        throw new Error('Invalid login response: missing role');
      }

      // Store tokens (cookies + localStorage fallback) and user data
      // FIX: Pass response.tokens (nested object), not response (full object)
      setStoredTokens(response.tokens);
      localStorage.setItem('user', JSON.stringify(response.user));

      setUser(response.user);
      setIsAuthenticated(true);

      return response;
    } catch (err) {
      // Clear any stale auth data on failure
      clearStoredTokens();
      clearAuthData();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(err.message);
      throw err;
    }
  }, []);

  /**
   * Logout function
   */
  const logout = useCallback(async () => {
    setAuthError(null);

    try {
      await authApi.logout();
    } catch (err) {
      // Ignore logout API errors - we'll clear local state anyway
      console.warn('Logout API call failed:', err.message);
    } finally {
      // Persist current cart to localStorage before clearing auth
      // This allows cart to survive logout for guest persistence
      try {
        const currentCart = JSON.parse(localStorage.getItem('cart') || 'null');
        if (currentCart && currentCart.items && currentCart.items.length > 0) {
          localStorage.setItem('guest_cart', JSON.stringify({
            ...currentCart,
            isGuestCart: true,
            persistedAt: new Date().toISOString()
          }));
        }
      } catch (cartErr) {
        console.warn('Failed to persist cart on logout:', cartErr);
      }
      
      // Always clear local state
      setUser(null);
      setIsAuthenticated(false);
      clearStoredTokens();
      clearAuthData();
    }
  }, []);

  /**
   * Update user profile in context
   */
  const updateUser = useCallback((userData) => {
    setUser(prev => {
      if (!prev) return userData;
      const updated = { ...prev, ...userData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  /**
   * Check if user has specific role - uses centralized helper
   */
  const hasRoleCallback = useCallback((role) => {
    if (!user?.role) return false;
    return hasRole(user.role, role);
  }, [user]);

  /**
   * Check if user is super admin - uses centralized helper
   */
  const isSuperAdminCallback = useCallback(() => {
    return user?.role ? isSuperAdmin(user.role) : false;
  }, [user]);

  /**
   * Check if user is admin (includes super_admin) - uses centralized helper
   */
  const isAdminCallback = useCallback(() => {
    return user?.role ? isAdmin(user.role) : false;
  }, [user]);

  /**
   * Check if user is staff or admin (includes super_admin) - uses centralized helper
   */
  const isStaffCallback = useCallback(() => {
    return user?.role ? isStaff(user.role) : false;
  }, [user]);

  const value = {
    // State
    user,
    loading,
    isAuthenticated,
    authError,

    // Actions
    login,
    logout,
    checkAuth,
    updateUser,

    // Helpers - using centralized role utilities
    hasRole: hasRoleCallback,
    isSuperAdmin: isSuperAdminCallback,
    isAdmin: isAdminCallback,
    isStaff: isStaffCallback,
    
    // Also export role constants for direct access
    USER_ROLES,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export role utilities for direct import (preferred over withAuth HOC)
export { USER_ROLES };

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

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi, apiFetch } from './customerApi';
import { getStoredUser, clearAuthData, setAuthData } from './baseApi';
import { USER_ROLES, hasRole, isAdmin, isStaff, isSuperAdmin } from './roles';
import logger from './logger';

const clearStoredTokens = clearAuthData;
const setStoredTokens = (tokens) => setAuthData({ ...tokens });

const AuthContext = createContext(null);

/**
 * AuthProvider Component
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);
  const isLoggingOutRef = useRef(false);

  /**
   * Check authentication status on mount
   */
  const checkAuth = useCallback(async () => {
    // Skip auth check if logout is in progress to prevent infinite loop
    if (isLoggingOutRef.current) {
      return;
    }

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
        logger.warn('Backend session verification failed:', err.message);

        // If unauthorized, clear everything
        if (err.status === 401 || err.status === 403) {
          clearAuthData();
          clearStoredTokens();
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    } catch (err) {
      logger.error('Critical auth check error:', err);
      setAuthError(err.message);
    } finally {
      // Only set loading to false if not logging out
      if (!isLoggingOutRef.current) {
        setLoading(false);
      }
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
      const response = await authApi.login(credentials);

      // Validate response has required data
      if (!response.user) {
        throw new Error('Invalid login response: missing user data');
      }

      // Validate role exists before storing
      if (!response.user?.role) {
        logger.error('Login response missing user role:', response);
        throw new Error('Invalid login response: missing role');
      }

      // Tokens are set as HttpOnly cookies by the backend — nothing to store here.
      // Only persist non-sensitive user data to localStorage for UI.
      setAuthData({ user: response.user });

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
    
    // Set logout in progress flag to prevent auth check loop
    isLoggingOutRef.current = true;

    try {
      await authApi.logout();
    } catch (err) {
      // Ignore logout API errors - we'll clear local state anyway
      logger.warn('Logout API call failed:', err.message);
    } finally {
      // Clear cart on logout (no guest checkout anymore)
      try {
        localStorage.removeItem('cart');
        localStorage.removeItem('cart_backup');
      } catch (cartErr) {
        logger.warn('Failed to clear cart on logout:', cartErr);
      }

      // Always clear local state
      setUser(null);
      setIsAuthenticated(false);
      clearStoredTokens();
      clearAuthData();
      
      // Reset logout flag after state is cleared
      isLoggingOutRef.current = false;
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

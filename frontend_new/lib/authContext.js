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

      // Verify with backend FIRST - don't trust localStorage stale data
      // This prevents showing "Profile" briefly before it clears to "Sign In"
      try {
        const userData = await apiFetch('/api/v1/users/me');
        // Backend session valid - use backend user data (authoritative)
        setUser(userData);
        setIsAuthenticated(true);
        // Sync localStorage with fresh backend data
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (err) {
        // Backend session expired or invalid
        logger.warn('Backend session verification failed:', err.message);
        // Clear stale localStorage data - authoritative source says invalid
        clearAuthData();
        clearStoredTokens();
        setUser(null);
        setIsAuthenticated(false);
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
   * Proactive token refresh every 25 minutes (before 30-min access token expiry).
   * Extends the session window silently without user interaction.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    // 25 min base + 0–3 min jitter to avoid thundering herd on refresh
    const REFRESH_INTERVAL_MS = 25 * 60 * 1000 + Math.floor(Math.random() * 3 * 60 * 1000);

    const intervalId = setInterval(async () => {
      try {
        const response = await apiFetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        // Refresh succeeded — session window extended.
        // New access token is set as HttpOnly cookie by backend.
        logger.debug('Proactive token refresh succeeded');
      } catch (err) {
        if (err.status === 401) {
          // Refresh token expired or invalid — session is truly dead
          logger.warn('Proactive refresh returned 401 — clearing auth state');
          clearAuthData();
          clearStoredTokens();
          setUser(null);
          setIsAuthenticated(false);
          // Redirect to login
          if (typeof window !== 'undefined') {
            const currentPath = `${window.location.pathname}${window.location.search || ''}`;
            window.location.href = `/auth/login?reason=session_reset&redirect_url=${encodeURIComponent(currentPath)}`;
          }
        } else {
          // Network error or server error — don't clear auth, retry next interval
          logger.warn('Proactive refresh failed (network/server error), will retry:', err.message);
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

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

      // CRITICAL: Clear localStorage user data to prevent stale user display
      try {
        localStorage.removeItem('user');
      } catch (userErr) {
        logger.warn('Failed to clear user from localStorage:', userErr);
      }

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

  /**
   * Manually set authenticated user (used by Register/OTP pages)
   */
  const setAuthStatus = useCallback((userData) => {
    if (!userData) return;
    
    setAuthData({ user: userData });
    setUser(userData);
    setIsAuthenticated(true);
    setLoading(false);
    
    logger.info('Auth status manually set for user:', userData.id);
  }, []);

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
    setAuthStatus,

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

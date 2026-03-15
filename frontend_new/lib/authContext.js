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

/**
 * User role constants — single source of truth for role strings
 */
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STAFF: 'staff',
  CUSTOMER: 'customer',
};

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

      // Store tokens (cookies + localStorage fallback) and user data
      setStoredTokens(response);
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
   * Check if user has specific role
   */
  const hasRole = useCallback((role) => {
    if (!user?.role) return false;
    return Array.isArray(role) ? role.includes(user.role) : user.role === role;
  }, [user]);

  /**
   * Check if user is super admin
   */
  const isSuperAdmin = useCallback(() => hasRole(USER_ROLES.SUPER_ADMIN), [hasRole]);

  /**
   * Check if user is admin (includes super_admin)
   */
  const isAdmin = useCallback(() => hasRole([USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]), [hasRole]);

  /**
   * Check if user is staff or admin (includes super_admin)
   */
  const isStaff = useCallback(() => hasRole([USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF]), [hasRole]);

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

    // Helpers
    hasRole,
    isSuperAdmin,
    isAdmin,
    isStaff,
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

/**
 * withAuth HOC for protecting pages
 */
export function withAuth(Component, options = {}) {
  return function AuthenticatedComponent(props) {
    const { user, loading, isAuthenticated, isAdmin, isStaff, isSuperAdmin, authError } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
      if (!loading) {
        if (!isAuthenticated) {
          // Append current path as redirect param so login page can send user back
          const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search + window.location.hash : pathname;
          const redirectParam = currentPath ? `?redirect_url=${encodeURIComponent(currentPath)}` : '';
          router.push(`/auth/login${redirectParam}`);
        } else if (options.requiredRole) {
          // Robust role check
          let hasAccess = false;
          if (options.requiredRole === USER_ROLES.STAFF) {
            hasAccess = isStaff();
          } else if (options.requiredRole === USER_ROLES.ADMIN) {
            hasAccess = isAdmin();
          } else if (options.requiredRole === USER_ROLES.SUPER_ADMIN) {
            hasAccess = isSuperAdmin();
          } else {
            hasAccess = user?.role === options.requiredRole;
          }

          if (!hasAccess) {
            router.push(options.unauthorizedRedirect || '/');
          }
        }
      }
    }, [loading, isAuthenticated, user, isStaff, isAdmin, isSuperAdmin, router, pathname, options.requiredRole, options.unauthorizedRedirect]);

    if (loading) {
      return options.loadingComponent || (
        <div className="flex items-center justify-center min-h-screen bg-[#050203]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white/70">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return options.unauthenticatedComponent || null;
    }

    if (options.requiredRole) {
      let hasAccess = false;
      if (options.requiredRole === USER_ROLES.STAFF) {
        hasAccess = isStaff();
      } else if (options.requiredRole === USER_ROLES.ADMIN) {
        hasAccess = isAdmin();
      } else if (options.requiredRole === USER_ROLES.SUPER_ADMIN) {
        hasAccess = isSuperAdmin();
      } else {
        hasAccess = user?.role === options.requiredRole;
      }
      
      if (!hasAccess) {
        return options.unauthorizedComponent || null;
      }
    }

    if (authError && options.showError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#050203]">
          <div className="text-center text-red-400">
            <p>Authentication Error: {authError}</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

export default AuthContext;

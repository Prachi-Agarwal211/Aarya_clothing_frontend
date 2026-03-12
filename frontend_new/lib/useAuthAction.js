'use client';

/**
 * Auth-Guarded Action Hook
 * 
 * Wraps any action that requires authentication. If user is not
 * logged in, redirects to /auth/login?redirect=<current_path>
 * instead of executing the action.
 * 
 * Usage:
 *   const guardedAddToCart = useAuthAction((product) => addToCart(product));
 *   <button onClick={() => guardedAddToCart(product)}>Add to Cart</button>
 */

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './authContext';

export function useAuthAction(action) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    return useCallback(
        (...args) => {
            if (loading) return; // Still checking auth — do nothing

            if (!isAuthenticated) {
                // Redirect to login with current path as redirect target
                const currentPath = typeof window !== 'undefined'
                    ? window.location.pathname + window.location.search + window.location.hash
                    : pathname;
                router.push(`/auth/login?redirect_url=${encodeURIComponent(currentPath)}`);
                return;
            }

            // User is authenticated — execute the action
            return action(...args);
        },
        [isAuthenticated, loading, action, router, pathname]
    );
}

/**
 * Hook that returns a redirect-to-login function.
 * Useful when you just want to guard a navigation link.
 */
export function useRequireAuth() {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const requireAuth = useCallback(
        (targetPath) => {
            if (loading) return false;

            if (!isAuthenticated) {
                const currentTarget = targetPath || (typeof window !== 'undefined' ? window.location.pathname + window.location.search + window.location.hash : pathname);
                router.push(`/auth/login?redirect_url=${encodeURIComponent(currentTarget)}`);
                return false;
            }

            return true; // Authenticated — proceed
        },
        [isAuthenticated, loading, router, pathname]
    );

    return { requireAuth, isAuthenticated, loading };
}

export default useAuthAction;

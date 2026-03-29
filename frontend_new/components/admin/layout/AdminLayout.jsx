'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { useAuth } from '../../../lib/authContext';
import logger from '../../../lib/logger';
import '@/styles/admin-globals.css';

const SIDEBAR_COLLAPSED_KEY = 'aarya_admin_sidebar_collapsed';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sidebarRef = useRef(null);
  const logoutTimeoutRef = useRef(null);
  const mainContentRef = useRef(null);

  // Use auth context for authentication
  const { user, loading, isAuthenticated, isAdmin, isStaff } = useAuth();

  // Load sidebar collapse state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) {
      setSidebarCollapsed(JSON.parse(saved));
    }
  }, []);

  // Handle click outside to close mobile menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!mobileMenuOpen || !sidebarRef.current) return;

      const headerMenuButton = document.querySelector('[data-mobile-menu-button]');
      if (headerMenuButton?.contains(event.target)) {
        return;
      }

      if (!sidebarRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        const menuButton = document.querySelector('[data-mobile-menu-button]');
        menuButton?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  // Listen for logout events from child components
  useEffect(() => {
    const handleLogoutStart = () => setIsLoggingOut(true);
    const handleLogoutEnd = () => setIsLoggingOut(false);

    window.addEventListener('admin-logout-start', handleLogoutStart);
    window.addEventListener('admin-logout-end', handleLogoutEnd);

    return () => {
      window.removeEventListener('admin-logout-start', handleLogoutStart);
      window.removeEventListener('admin-logout-end', handleLogoutEnd);
    };
  }, []);

  // Handle authentication and authorization
  useEffect(() => {
    if (!loading) {
      if (isLoggingOut) {
        logoutTimeoutRef.current = setTimeout(() => {
          if (isLoggingOut) {
            logger.warn('Logout navigation took too long, forcing redirect');
            router.push('/auth/login');
          }
        }, 5000);
        return;
      }

      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }

      if (!isAuthenticated) {
        router.push(`/auth/login?redirect_url=${encodeURIComponent(pathname)}`);
        return;
      }

      if (pathname === '/admin' || pathname === '/admin/') {
        if (user?.role === 'super_admin') {
          router.push('/admin/super');
          return;
        }
        if (user?.role === 'staff') {
          router.push('/admin/staff');
          return;
        }
      }

      if (user?.role !== 'super_admin' && pathname.startsWith('/admin/super')) {
        const target = user?.role === 'staff' ? '/admin/staff' : '/admin';
        router.push(target);
        return;
      }

      if (!isStaff()) {
        router.push('/');
        return;
      }
    }
  }, [loading, isAuthenticated, isStaff, isAdmin, user, router, pathname, isLoggingOut]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050203] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const isAuthorized = isAuthenticated && isStaff();
  if ((!isAuthenticated || !isAuthorized) && !isLoggingOut) {
    return (
      <div className="min-h-screen bg-[#050203] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const handleSidebarToggle = useCallback((newState) => {
    setSidebarCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(newState));
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0608] relative">
      {/* Background Pattern */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(122, 47, 87, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 80%, rgba(183, 110, 121, 0.1) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 50%, rgba(242, 194, 154, 0.05) 0%, transparent 70%)
          `
        }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-0 backdrop-blur-[100px] pointer-events-none opacity-50" aria-hidden="true" />

      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
          isMobile={false}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          id="mobile-sidebar-overlay"
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={handleMobileMenuClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Mobile */}
      <div
        ref={sidebarRef}
        id="mobile-sidebar"
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50',
          'transform transition-transform duration-300 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <AdminSidebar
          collapsed={false}
          onToggle={() => {}}
          isMobile={true}
          onClose={handleMobileMenuClose}
        />
      </div>

      {/* Main Content */}
      <div
        className={cn(
          'transition-all duration-300 min-h-screen flex flex-col',
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        {/* Header */}
        <AdminHeader
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
        />

        {/* Page Content */}
        <main
          ref={mainContentRef}
          className="flex-1 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 relative z-10 overflow-x-hidden"
          role="main"
          aria-label="Main content"
        >
          <div className="min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

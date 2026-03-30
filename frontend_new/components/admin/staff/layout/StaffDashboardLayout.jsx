'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
// We can reuse AdminHeader and AdminSidebar for now, 
// but ideally Staff should have their own sidebar with limited items.
// For now, let's reuse AdminSidebar but note that it hides AI config links.
import AdminSidebar from '../../layout/AdminSidebar';
import AdminHeader from '../../layout/AdminHeader';

export default function StaffDashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarRef = useRef(null);

  // Note: Permission check is done in the page-level layout (app/admin/staff/layout.js)
  // This component assumes the user is authorized.

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle click/touch outside to close mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleClickOutside = (event) => {
      if (!sidebarRef.current) return;
      const headerMenuButton = document.querySelector('[data-mobile-menu-button]');
      if (headerMenuButton?.contains(event.target)) return;
      if (!sidebarRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050203] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Loading staff dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050203]">
      {/* Background Pattern */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(122, 47, 87, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(183, 110, 121, 0.08) 0%, transparent 50%)
          `
        }}
      />

      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <div
        ref={sidebarRef}
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 w-72
          transform transition-transform duration-300
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <AdminSidebar
          collapsed={false}
          onToggle={() => setMobileMenuOpen(false)}
          isMobile={true}
          onClose={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div
        className={`
          transition-all duration-300
          ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
        `}
      >
        {/* Header */}
        <AdminHeader
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          mobileMenuOpen={mobileMenuOpen}
        />

        {/* Page Content */}
        <main className="p-4 md:p-6 lg:p-8 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}

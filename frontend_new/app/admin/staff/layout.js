'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import StaffDashboardLayout from '@/components/admin/staff/layout/StaffDashboardLayout';

export default function StaffLayout({ children }) {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push('/auth/login?redirect_url=/admin/staff');
      return;
    }

    // staff, admin, and super_admin can all access /admin/staff
    // - staff users see their own dashboard (page.js handles role-based rendering)
    // - admin users see the staff management page
    // - super_admin gets redirected to their own section
    if (user?.role === 'staff' || user?.role === 'admin') {
      setAuthorized(true);
    } else if (user?.role === 'super_admin') {
      router.push('/admin/super');
    } else {
      router.push('/');
    }
  }, [loading, isAuthenticated, user, router]);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0608]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <StaffDashboardLayout>
      {children}
    </StaffDashboardLayout>
  );
}

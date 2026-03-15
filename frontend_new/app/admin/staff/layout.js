'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import StaffDashboardLayout from '@/components/admin/staff/layout/StaffDashboardLayout';
import logger from '@/lib/logger';

export default function StaffLayout({ children }) {
  const router = useRouter();
  const { user, isAuthenticated, loading, isStaff } = useAuth();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    // Check if authenticated
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/admin/staff');
      return;
    }

    // Check user role and redirect accordingly
    if (user?.role === 'staff') {
      setAuthorized(true);
    } else if (user?.role === 'admin') {
      router.push('/admin');
    } else if (user?.role === 'super_admin') {
      router.push('/admin/super');
    } else {
      router.push('/');
    }
  }, [loading, isAuthenticated, user, isStaff, router]);

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

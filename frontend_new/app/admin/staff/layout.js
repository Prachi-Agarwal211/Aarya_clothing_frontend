'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import AdminLayout from '@/components/admin/layout/AdminLayout';
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

    // Check if user is staff (but NOT admin - admins go to full admin)
    if (isStaff() && user?.role === 'staff') {
      setAuthorized(true);
    } else if (user?.role === 'admin') {
      // Admins should use full admin panel
      router.push('/admin');
    } else {
      // Customers or unauthorized
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
    <AdminLayout>
      {children}
    </AdminLayout>
  );
}

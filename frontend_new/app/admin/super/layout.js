'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import SuperAdminLayout from '@/components/admin/super/layout/SuperAdminLayout';

export default function SuperAdminRootLayout({ children }) {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push('/auth/login?redirect_url=/admin/super');
      return;
    }

    // Check if user is super_admin
    if (user?.role === 'super_admin') {
      setAuthorized(true);
    } else if (user?.role === 'admin') {
      // Admins go to admin dashboard
      router.push('/admin');
    } else if (user?.role === 'staff') {
      // Staff go to staff dashboard
      router.push('/admin/staff');
    } else {
      // Customers or unauthorized
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

  return <SuperAdminLayout>{children}</SuperAdminLayout>;
}

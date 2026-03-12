'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, Package, MapPin, Heart, Settings, LogOut, RotateCcw } from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import { useAuth } from '@/lib/authContext';

const SIDEBAR_ITEMS = [
  { id: 'profile', name: 'My Profile', icon: User, path: '/profile' },
  { id: 'orders', name: 'My Orders', icon: Package, path: '/profile/orders' },
  { id: 'returns', name: 'My Returns', icon: RotateCcw, path: '/profile/returns' },
  { id: 'addresses', name: 'Addresses', icon: MapPin, path: '/profile/addresses' },
  { id: 'wishlist', name: 'Wishlist', icon: Heart, path: '/profile/wishlist' },
  { id: 'settings', name: 'Settings', icon: Settings, path: '/profile/settings' },
];

export default function ProfileLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAuthenticated, logout, isStaff } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const loginUrl = new URL('/auth/login', window.location.origin);
      loginUrl.searchParams.set('redirect_url', pathname);
      router.push(loginUrl.toString());
    }
  }, [loading, isAuthenticated, router, pathname]);

  // Handle logout with loading state
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent double-click

    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
      // Still redirect to home even if logout API fails
      router.push('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <main className="min-h-screen bg-[#050203] text-[#EAE0D5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Loading...</p>
        </div>
      </main>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#050203] text-[#EAE0D5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Redirecting to login...</p>
        </div>
      </main>
    );
  }

  // Get display name for user
  const displayName = user?.full_name || user?.username || user?.email?.split('@')[0] || 'User';

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]">
      {/* Background is now handled by root layout */}

      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />

        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 header-spacing">
            {/* Page Header */}
            <div className="mb-8">
              <h1
                className="text-3xl md:text-4xl font-bold text-[#F2C29A]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                My Account
              </h1>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              {/* Sidebar */}
              <div className="md:col-span-1">
                <div className="sticky top-28 p-4 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl">
                  {/* User Info */}
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#B76E79]/10">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#7A2F57] to-[#B76E79] flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-[#F2C29A]">Welcome back!</p>
                      <p className="text-sm text-[#EAE0D5]/50 truncate max-w-[150px]">
                        {displayName}
                      </p>
                    </div>
                  </div>

                  {/* Navigation */}
                  <nav className="space-y-1">
                    {SIDEBAR_ITEMS.map((item) => {
                      const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                      return (
                        <Link
                          key={item.id}
                          href={item.path}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive
                              ? 'bg-[#7A2F57]/30 text-[#F2C29A]'
                              : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]'
                            }`}
                        >
                          <item.icon className="w-5 h-5" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </nav>

                  {/* Admin Link (if staff) */}
                  {isStaff() && (
                    <div className="mt-4 pt-4 border-t border-[#B76E79]/10">
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-3 py-2.5 w-full text-[#F2C29A] hover:bg-[#B76E79]/10 transition-colors rounded-xl"
                      >
                        <Settings className="w-5 h-5" />
                        Admin Dashboard
                      </Link>
                    </div>
                  )}

                  {/* Logout */}
                  <div className="mt-6 pt-4 border-t border-[#B76E79]/10">
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className={`flex items-center gap-3 px-3 py-2.5 w-full text-[#B76E79] hover:text-[#F2C29A] transition-colors rounded-xl hover:bg-[#B76E79]/10 ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                      <LogOut className={`w-5 h-5 ${isLoggingOut ? 'animate-pulse' : ''}`} />
                      {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="md:col-span-3">
                {children}
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}

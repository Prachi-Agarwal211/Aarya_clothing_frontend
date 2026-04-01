'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  SlidersHorizontal,
  Activity,
  Shield,
  Users,
  CreditCard,
  Package,
  ShoppingBag,
  Warehouse,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';

const navigation = [
  { name: 'Dashboard', href: '/admin/super', icon: LayoutDashboard },
  { name: 'AI Configuration', href: '/admin/super/ai-settings', icon: SlidersHorizontal },
  { name: 'AI Monitoring', href: '/admin/super/ai-monitoring', icon: Activity },
  { name: 'User Management', href: '/admin/super/users', icon: Users },
  { name: 'System Settings', href: '/admin/super/settings', icon: Settings },
];

const adminNavigation = [
  { name: 'Products', href: '/admin/products', icon: ShoppingBag },
  { name: 'Orders', href: '/admin/orders', icon: Package },
  { name: 'Inventory', href: '/admin/inventory', icon: Warehouse },
  { name: 'Collections', href: '/admin/collections', icon: Layers },
  { name: 'Customers', href: '/admin/customers', icon: Users },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function SuperAdminSidebar({ collapsed, onToggle, onClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Handle logout with loading state and error handling
  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return; // Prevent double-click

    setIsLoggingOut(true);
    // Dispatch custom event to notify parent layout
    window.dispatchEvent(new CustomEvent('admin-logout-start'));
    
    try {
      await logout();
      router.push('/auth/login');
    } catch (error) {
      console.error('SuperAdmin logout failed:', error);
      // Still redirect to login even if logout API fails
      router.push('/auth/login');
    } finally {
      setIsLoggingOut(false);
      // Dispatch custom event to notify parent layout
      window.dispatchEvent(new CustomEvent('admin-logout-end'));
    }
  }, [isLoggingOut, logout, router]);

  const isActive = (href) => {
    if (href === '/admin/super') {
      return pathname === '/admin/super';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen z-40
        bg-[#0B0608]/95 backdrop-blur-xl
        border-r border-[#B76E79]/15
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#B76E79]/15">
        {!collapsed && (
          <Link href="/admin/super" className="flex items-center gap-2">
            <span
              className="text-xl font-bold text-[#F2C29A]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Aarya
            </span>
            <span className="text-sm text-[#EAE0D5]/60">Super Admin</span>
          </Link>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 text-[#EAE0D5]/70" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-[#EAE0D5]/70" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-[#7A2F57]/30 text-[#F2C29A] border border-[#B76E79]/30' : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]'}`}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-[#F2C29A]' : ''}`} />
                  {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Admin section divider */}
        {!collapsed && (
          <p className="px-4 pt-4 pb-1 text-xs text-[#EAE0D5]/30 uppercase tracking-widest">Admin</p>
        )}
        <ul className="space-y-1 px-2">
          {adminNavigation.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-[#7A2F57]/30 text-[#F2C29A] border border-[#B76E79]/30' : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]'}`}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-[#F2C29A]' : ''}`} />
                  {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-[#B76E79]/15 p-4">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            text-[#EAE0D5]/70 hover:bg-red-500/10 hover:text-red-400
            transition-all duration-200
            ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className={`w-5 h-5 ${isLoggingOut ? 'animate-pulse' : ''}`} />
          {!collapsed && <span className="font-medium text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
        </button>
      </div>
    </aside>
  );
}

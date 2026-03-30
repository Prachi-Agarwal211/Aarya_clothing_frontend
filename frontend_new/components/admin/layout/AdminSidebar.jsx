'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  MessageCircle,
  Settings,
  Image,
  ChevronLeft,
  ChevronRight,
  LogOut,
  RotateCcw,
  Layers,
  Warehouse,
  Sparkles,
  Activity,
  Key,
  Cpu,
  MonitorCheck,
  X,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import logger from '../../../lib/logger';

const SIDEBAR_COLLAPSED_KEY = 'aarya_admin_sidebar_collapsed';

export default function AdminSidebar({ collapsed, onToggle, isMobile = false, onClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleToggle = useCallback(() => {
    if (!isMobile) {
      const newState = !collapsed;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(newState));
      onToggle?.(newState);
    }
  }, [collapsed, onToggle, isMobile]);

  // Define navigation based on role
  let navigation = [];

  if (user?.role === 'super_admin') {
    navigation = [
      { name: 'AI Overview', href: '/admin/super', icon: Activity },
      { name: 'AI Key Management', href: '/admin/super/ai-settings', icon: Key },
      { name: 'AI Monitoring', href: '/admin/super/ai-monitoring', icon: MonitorCheck },
    ];
  } else if (user?.role === 'staff') {
    navigation = [
      { name: 'Dashboard', href: '/admin/staff', icon: LayoutDashboard },
      { name: 'Orders', href: '/admin/staff/orders', icon: Package },
      { name: 'Returns', href: '/admin/returns', icon: RotateCcw },
      { name: 'Products & Stock', href: '/admin/products', icon: ShoppingBag },
      { name: 'Inventory', href: '/admin/staff/inventory', icon: Warehouse },
      { name: 'Collections', href: '/admin/collections', icon: Layers },
      { name: 'Chat Support', href: '/admin/chat', icon: MessageCircle },
    ];
  } else {
    // Regular Admin
    navigation = [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { name: 'Orders', href: '/admin/orders', icon: Package },
      { name: 'Returns', href: '/admin/returns', icon: RotateCcw },
      { name: 'Products & Stock', href: '/admin/products', icon: ShoppingBag },
      { name: 'Inventory', href: '/admin/inventory', icon: Warehouse },
      { name: 'Collections', href: '/admin/collections', icon: Layers },
      { name: 'Customers', href: '/admin/customers', icon: Users },
      { name: 'Staff Accounts', href: '/admin/staff', icon: Key },
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Aria AI Assistant', href: '/admin/ai-assistant', icon: Sparkles, highlight: true },
      { name: 'Chat Support', href: '/admin/chat', icon: MessageCircle },
      { name: 'Landing Page', href: '/admin/landing', icon: Image },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];
  }

  // Handle logout with loading state and error handling
  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    window.dispatchEvent(new CustomEvent('admin-logout-start'));

    try {
      await logout();
      router.push('/auth/login');
    } catch (error) {
      logger.error('Admin logout failed:', error);
      router.push('/auth/login');
    } finally {
      setIsLoggingOut(false);
      window.dispatchEvent(new CustomEvent('admin-logout-end'));
    }
  }, [isLoggingOut, logout, router]);

  const isActive = (href) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  // Handle navigation link click - close mobile menu
  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={cn(
        // Mobile: parent wrapper handles fixed positioning + slide animation
        // Desktop: this element is itself fixed to the left edge
        isMobile
          ? 'h-full w-full'
          : 'fixed top-0 left-0 z-40 h-screen',
        'transition-all duration-300 ease-in-out',
        'bg-[#0B0608]/60 backdrop-blur-xl border-r border-[#B76E79]/20',
        'flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.4)]',
        !isMobile && (collapsed ? 'w-20' : 'w-64')
      )}
      role="navigation"
      aria-label="Admin navigation"
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#B76E79]/15">
        {!collapsed && (
          <Link
            href="/admin"
            className="flex items-center gap-2"
            aria-label="Go to admin dashboard"
          >
            <span
              className="text-xl font-bold text-[#F2C29A]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Aarya
            </span>
            <span className="text-sm text-[#EAE0D5]/60">Admin</span>
          </Link>
        )}

        {/* Toggle/Close Button */}
        {isMobile ? (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors min-w-[44px] min-h-[44px] touch-target"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5 text-[#EAE0D5]/70" />
          </button>
        ) : (
          <button
            onClick={handleToggle}
            className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors min-w-[44px] min-h-[44px] touch-target"
            aria-label={collapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-[#EAE0D5]/70" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-[#EAE0D5]/70" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden" role="menubar">
        <ul className="space-y-1 px-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isHighlight = item.highlight && !active;

            return (
              <li key={item.name} role="none">
                <Link
                  href={item.href}
                  onClick={handleLinkClick}
                  role="menuitem"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                    'transition-all duration-200',
                    'min-h-[44px] touch-target',
                    active
                      ? 'bg-[#7A2F57]/30 text-[#F2C29A] border border-[#B76E79]/30'
                      : isHighlight
                        ? 'bg-gradient-to-r from-[#7A2F57]/20 to-[#B76E79]/15 border border-[#B76E79]/25 text-[#F2C29A] hover:from-[#7A2F57]/30 hover:to-[#B76E79]/25'
                        : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]'
                  )}
                  title={collapsed && !isMobile ? item.name : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0', active || isHighlight ? 'text-[#F2C29A]' : '')} />
                  {!collapsed && (
                    <>
                      <span className="font-medium text-sm truncate">{item.name}</span>
                      {isHighlight && (
                        <span className="ml-auto text-xs bg-[#B76E79]/30 text-[#F2C29A] px-1.5 py-0.5 rounded-full flex-shrink-0">
                          AI
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-[#B76E79]/15 p-4">
        {/* Logout */}
        <button
          onClick={() => {
            if (isMobile && onClose) {
              onClose();
            }
            handleLogout();
          }}
          disabled={isLoggingOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
            'text-[#EAE0D5]/70 hover:bg-red-500/10 hover:text-red-400',
            'transition-all duration-200',
            'min-h-[44px] touch-target',
            isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''
          )}
          title={collapsed && !isMobile ? 'Logout' : undefined}
          aria-label="Logout"
        >
          <LogOut className={cn('w-5 h-5 flex-shrink-0', isLoggingOut ? 'animate-pulse' : '')} />
          {!collapsed && (
            <span className="font-medium text-sm">
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

// Utility function for class names (inline since utils.js might not be available)
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

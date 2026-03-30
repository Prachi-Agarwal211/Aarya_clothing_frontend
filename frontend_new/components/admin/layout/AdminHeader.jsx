'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Bell, User, ChevronDown, Menu, LogOut, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../lib/authContext';
import logger from '../../../lib/logger';

export default function AdminHeader({ onMenuClick, user, mobileMenuOpen = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();
  const userMenuRef = useRef(null);
  const userButtonRef = useRef(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showUserMenu]);

  // Close user menu on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showUserMenu) {
        setShowUserMenu(false);
        userButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showUserMenu]);

  // Handle logout with loading state and error handling
  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    setShowUserMenu(false);
    setIsLoggingOut(true);
    window.dispatchEvent(new CustomEvent('admin-logout-start'));

    try {
      await logout();
      router.push('/auth/login');
    } catch (error) {
      logger.error('Admin header logout failed:', error);
      router.push('/auth/login');
    } finally {
      setIsLoggingOut(false);
      window.dispatchEvent(new CustomEvent('admin-logout-end'));
    }
  }, [isLoggingOut, logout, router]);

  // Handle keyboard navigation in user menu
  const handleUserMenuKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const firstItem = userMenuRef.current?.querySelector('button, a');
      firstItem?.focus();
    }
  };

  return (
    <header
      className="h-16 bg-[#0B0608]/80 backdrop-blur-xl border-b border-[#B76E79]/15 sticky top-0 z-30"
      role="banner"
    >
      <div className="h-full px-2 sm:px-4 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section - Mobile Menu & Search */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            data-mobile-menu-button
            className="lg:hidden p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors min-w-[44px] min-h-[44px] touch-target"
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-sidebar"
          >
            <Menu className="w-5 h-5 text-[#EAE0D5]/70" />
          </button>

          {/* Search Bar */}
          <div className="relative w-full max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2',
                'bg-[#0B0608]/60 border border-[#B76E79]/20',
                'rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40',
                'focus:outline-none focus:border-[#B76E79]/40 focus:ring-2 focus:ring-[#B76E79]/20',
                'transition-colors text-sm',
                'min-h-[44px] touch-target'
              )}
              aria-label="Search"
            />
          </div>
        </div>

        {/* Right Section - Notifications & User */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            className="relative p-2 rounded-xl hover:bg-[#B76E79]/10 transition-colors min-w-[44px] min-h-[44px] touch-target"
            aria-label="Notifications"
            aria-describedby="notification-count"
          >
            <Bell className="w-5 h-5 text-[#EAE0D5]/70" />
            <span
              id="notification-count"
              className="absolute top-1 right-1 w-2 h-2 bg-[#B76E79] rounded-full"
              aria-label="You have unread notifications"
            />
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              ref={userButtonRef}
              onClick={() => setShowUserMenu(!showUserMenu)}
              onKeyDown={handleUserMenuKeyDown}
              className={cn(
                'flex items-center gap-2 p-2 rounded-xl hover:bg-[#B76E79]/10 transition-colors',
                'min-h-[44px] touch-target'
              )}
              aria-label={`User menu for ${user?.full_name || user?.username || 'Admin'}`}
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
            >
              <div
                className="w-8 h-8 rounded-full bg-[#7A2F57]/30 border border-[#B76E79]/30 flex items-center justify-center"
                aria-hidden="true"
              >
                <User className="w-4 h-4 text-[#F2C29A]" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-[#EAE0D5]">
                  {user?.full_name || user?.username || 'Admin'}
                </p>
                <p className="text-xs text-[#EAE0D5]/50 capitalize">
                  {user?.role || 'admin'}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-[#EAE0D5]/50 hidden md:block transition-transform',
                  showUserMenu ? 'rotate-180' : ''
                )}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                className={cn(
                  'absolute right-0 mt-2 w-48 py-2',
                  'bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20',
                  'rounded-xl shadow-xl z-50',
                  'animate-in fade-in zoom-in-95 duration-200'
                )}
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="user-menu-button"
              >
                <Link
                  href="/admin/settings"
                  onClick={() => setShowUserMenu(false)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm text-[#EAE0D5]/70',
                    'hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]',
                    'transition-colors',
                    'min-h-[44px] touch-target'
                  )}
                  role="menuitem"
                >
                  <Settings className="w-4 h-4" aria-hidden="true" />
                  Settings
                </Link>
                <hr className="my-2 border-[#B76E79]/15" role="separator" />
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={cn(
                    'w-full flex items-center gap-2 text-left px-4 py-2 text-sm transition-colors',
                    'min-h-[44px] touch-target',
                    isLoggingOut
                      ? 'text-red-400/50 cursor-not-allowed'
                      : 'text-red-400 hover:bg-red-500/10'
                  )}
                  role="menuitem"
                >
                  <LogOut className={cn('w-4 h-4', isLoggingOut ? 'animate-pulse' : '')} aria-hidden="true" />
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

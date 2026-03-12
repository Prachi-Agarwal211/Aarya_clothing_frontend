'use client';

import React, { useState } from 'react';
import { Search, Bell, User, ChevronDown, Menu, LogOut, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../lib/authContext';

export default function AdminHeader({ onMenuClick, user }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    router.push('/auth/login');
  };

  return (
    <header className="h-16 bg-[#0B0608]/80 backdrop-blur-xl border-b border-[#B76E79]/15 sticky top-0 z-30">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left Section - Mobile Menu & Search */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors"
          >
            <Menu className="w-5 h-5 text-[#EAE0D5]/70" />
          </button>

          {/* Search Bar */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
            <input
              type="text"
              placeholder="Search orders, products, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-64 lg:w-96 pl-10 pr-4 py-2
                bg-[#0B0608]/60 border border-[#B76E79]/20
                rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40
                focus:outline-none focus:border-[#B76E79]/40
                transition-colors text-sm
              "
            />
          </div>
        </div>

        {/* Right Section - Notifications & User */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button className="relative p-2 rounded-xl hover:bg-[#B76E79]/10 transition-colors">
            <Bell className="w-5 h-5 text-[#EAE0D5]/70" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#B76E79] rounded-full" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 rounded-xl hover:bg-[#B76E79]/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#7A2F57]/30 border border-[#B76E79]/30 flex items-center justify-center">
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
              <ChevronDown className="w-4 h-4 text-[#EAE0D5]/50 hidden md:block" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 py-2 bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-xl shadow-xl">
                <Link
                  href="/admin/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <hr className="my-2 border-[#B76E79]/15" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

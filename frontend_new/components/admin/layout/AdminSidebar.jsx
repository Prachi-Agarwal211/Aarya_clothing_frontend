'use client';

import React from 'react';
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
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Orders', href: '/admin/orders', icon: Package },
  { name: 'Returns', href: '/admin/returns', icon: RotateCcw },
  { name: 'Products & Stock', href: '/admin/products', icon: ShoppingBag },
  { name: 'Inventory', href: '/admin/inventory', icon: Warehouse },
  { name: 'Collections', href: '/admin/collections', icon: Layers },
  { name: 'Customers', href: '/admin/customers', icon: Users },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Aria AI Assistant', href: '/admin/ai-assistant', icon: Sparkles, highlight: true },
  { name: 'AI Monitoring', href: '/admin/ai-monitoring', icon: Activity },
  { name: 'AI Configuration', href: '/admin/ai-settings', icon: SlidersHorizontal },
  { name: 'Chat Support', href: '/admin/chat', icon: MessageCircle },
  { name: 'Landing Page', href: '/admin/landing', icon: Image },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminSidebar({ collapsed, onToggle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  const isActive = (href) => {
    if (href === '/admin') {
      return pathname === '/admin';
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
          <Link href="/admin" className="flex items-center gap-2">
            <span 
              className="text-xl font-bold text-[#F2C29A]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Aarya
            </span>
            <span className="text-sm text-[#EAE0D5]/60">Admin</span>
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
            
            const isHighlight = item.highlight && !active;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl
                    transition-all duration-200
                    ${active
                      ? 'bg-[#7A2F57]/30 text-[#F2C29A] border border-[#B76E79]/30'
                      : isHighlight
                        ? 'bg-gradient-to-r from-[#7A2F57]/20 to-[#B76E79]/15 border border-[#B76E79]/25 text-[#F2C29A] hover:from-[#7A2F57]/30 hover:to-[#B76E79]/25'
                        : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]'
                    }
                  `}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active || isHighlight ? 'text-[#F2C29A]' : ''}`} />
                  {!collapsed && (
                    <span className="font-medium text-sm">{item.name}</span>
                  )}
                  {!collapsed && isHighlight && (
                    <span className="ml-auto text-xs bg-[#B76E79]/30 text-[#F2C29A] px-1.5 py-0.5 rounded-full">AI</span>
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
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            text-[#EAE0D5]/70 hover:bg-red-500/10 hover:text-red-400
            transition-all duration-200
          `}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IndianRupee, ShoppingBag, Users, Package, AlertTriangle,
  TrendingUp, ArrowRight, Clock, CheckCircle, XCircle,
  Truck, RefreshCw, RotateCcw,
} from 'lucide-react';
import StatCard from '@/components/admin/shared/StatCard';
import { OrderStatusBadge } from '@/components/admin/shared/StatusBadge';
import Breadcrumb from '@/components/admin/shared/Breadcrumb';
import { ErrorBoundary, ErrorDisplay } from '@/components/admin/shared/ErrorBoundary';
import { dashboardApi, ordersApi, inventoryApi } from '@/lib/adminApi';
import { useAuth } from '@/lib/authContext';
import { isAdmin } from '@/lib/roles';
import logger from '@/lib/logger';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function DashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user && !isAdmin(user.role)) {
      router.push(`/admin/${user.role === 'staff' ? 'staff' : 'super'}`);
    }
  }, [user, router]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashboard, lowStock] = await Promise.all([
        dashboardApi.getOverview(),
        inventoryApi.getLowStock(),
      ]);
      setDashboardData(dashboard);
      setLowStockItems(lowStock.items || []);
    } catch (err) {
      logger.error('Failed to load dashboard:', err);
      const msg = err.message || '';
      if (msg.includes('401') || msg.includes('Not authenticated') || msg.includes('Unauthorized')) {
        setError('Please log in to access the admin dashboard');
        setTimeout(() => router.push('/auth/login'), 2000);
        return;
      }
      setDashboardData({ total_revenue: 0, total_orders: 0, total_customers: 0, total_products: 0, pending_orders: 0, today_revenue: 0, today_orders: 0, inventory_alerts: { low_stock: 0, out_of_stock: 0 }, recent_orders: [] });
      setLowStockItems([]);
      setError('Some live data unavailable. Showing cached data.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user === undefined) return;
    if (user && !isAdmin(user.role)) return;
    fetchDashboardData();
  }, [user, fetchDashboardData]);

  if (loading && !dashboardData) {
    return (
      <div className="space-y-6 animate-pulse" role="status" aria-label="Loading dashboard">
        {/* Skeleton Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1a0c12] border border-[#B76E79]/15 rounded-2xl p-5 h-28">
              <div className="h-4 bg-[#B76E79]/10 rounded w-24 mb-3" />
              <div className="h-8 bg-[#B76E79]/10 rounded w-32" />
            </div>
          ))}
        </div>

        {/* Skeleton Alert Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#1a0c12] border border-[#B76E79]/15 rounded-2xl p-5 h-20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#B76E79]/10 rounded-xl" />
                <div className="flex-1">
                  <div className="h-3 bg-[#B76E79]/10 rounded w-20 mb-2" />
                  <div className="h-6 bg-[#B76E79]/10 rounded w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Recent Orders */}
        <div className="bg-[#1a0c12] border border-[#B76E79]/15 rounded-2xl p-5">
          <div className="h-5 bg-[#B76E79]/10 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-[#B76E79]/10 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <ErrorDisplay
        error={new Error(error)}
        onRetry={fetchDashboardData}
        title="Dashboard Unavailable"
        message={error}
      />
    );
  }

  const d = dashboardData || {};

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      {/* Error banner */}
      {error && dashboardData && (
        <div
          className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-center gap-3"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-amber-400/80 text-sm flex-1">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-3 py-1 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 text-xs transition-colors flex items-center gap-1 min-h-[44px] touch-target"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            Dashboard
          </h1>
          <p className="text-[#EAE0D5]/50 mt-1 text-sm">
            Welcome back! Here&apos;s your store at a glance.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/60 hover:bg-[#B76E79]/10 text-sm transition-colors disabled:opacity-50 min-h-[44px] touch-target"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Revenue"
          value={d.total_revenue || 0}
          format="currency"
          prefix="₹"
          icon={IndianRupee}
          accentColor="#F2C29A"
        />
        <StatCard
          title="Total Orders"
          value={d.total_orders || 0}
          icon={ShoppingBag}
          accentColor="#B76E79"
        />
        <StatCard
          title="Customers"
          value={d.total_customers || 0}
          icon={Users}
          accentColor="#9966CC"
        />
        <StatCard
          title="Products"
          value={d.total_products || 0}
          icon={Package}
          accentColor="#22c55e"
        />
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          title="Today&apos;s Revenue"
          value={d.today_revenue || 0}
          format="currency"
          prefix="₹"
          icon={TrendingUp}
          accentColor="#F2C29A"
        />
        <StatCard
          title="Today&apos;s Orders"
          value={d.today_orders || 0}
          icon={ShoppingBag}
          accentColor="#B76E79"
        />
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            href: '/admin/orders?status=confirmed',
            bg: 'from-blue-500/15 to-[#0B0608]',
            border: 'border-blue-500/25',
            hover: 'hover:border-blue-500/40',
            icon: Clock,
            iconBg: 'bg-blue-500/20',
            iconColor: 'text-blue-400',
            label: 'Pending Orders',
            labelColor: 'text-blue-400',
            value: d.pending_orders || 0,
            arrowColor: 'text-blue-400',
          },
          {
            href: '/admin/inventory?tab=low-stock',
            bg: 'from-amber-500/15 to-[#0B0608]',
            border: 'border-amber-500/25',
            hover: 'hover:border-amber-500/40',
            icon: AlertTriangle,
            iconBg: 'bg-amber-500/20',
            iconColor: 'text-amber-400',
            label: 'Low Stock Items',
            labelColor: 'text-amber-400',
            value: d.inventory_alerts?.low_stock || 0,
            arrowColor: 'text-amber-400',
          },
          {
            href: '/admin/inventory?tab=out-of-stock',
            bg: 'from-red-500/15 to-[#0B0608]',
            border: 'border-red-500/25',
            hover: 'hover:border-red-500/40',
            icon: XCircle,
            iconBg: 'bg-red-500/20',
            iconColor: 'text-red-400',
            label: 'Out of Stock',
            labelColor: 'text-red-400',
            value: d.inventory_alerts?.out_of_stock || 0,
            arrowColor: 'text-red-400',
          },
        ].map(({ href, bg, border, hover, icon: Icon, iconBg, iconColor, label, labelColor, value, arrowColor }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'bg-gradient-to-br', bg, 'border', border, hover,
              'rounded-2xl p-4 sm:p-5 flex items-center justify-between group transition-all duration-200',
              'min-h-[44px] touch-target'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl', iconBg, 'flex-shrink-0')}>
                <Icon className={cn('w-5 h-5', iconColor)} aria-hidden="true" />
              </div>
              <div>
                <p className={cn('text-sm font-medium', labelColor)}>{label}</p>
                <p className="text-2xl font-bold text-[#EAE0D5] mt-0.5">{value}</p>
              </div>
            </div>
            <ArrowRight
              className={cn('w-5 h-5', arrowColor, 'opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all')}
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Recent Orders */}
        <div className="xl:col-span-3 bg-gradient-to-br from-[#1a0c12] to-[#0B0608] border border-[#B76E79]/15 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#B76E79]/10">
            <h2 className="font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Recent Orders</h2>
            <Link
              href="/admin/orders"
              className="text-xs text-[#B76E79] hover:text-[#F2C29A] transition-colors flex items-center gap-1 min-h-[44px] touch-target"
            >
              View All <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12" role="status" aria-label="Loading orders">
              <RefreshCw className="w-6 h-6 text-[#B76E79]/40 animate-spin" aria-hidden="true" />
            </div>
          ) : (!d.recent_orders || d.recent_orders.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#EAE0D5]/30">
              <ShoppingBag className="w-10 h-10 mb-2" aria-hidden="true" />
              <p className="text-sm">No recent orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" role="table">
                <thead>
                  <tr className="border-b border-[#B76E79]/10">
                    <th scope="col" className="px-5 py-3 text-left text-xs text-[#EAE0D5]/40 font-semibold uppercase tracking-wider">Order</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs text-[#EAE0D5]/40 font-semibold uppercase tracking-wider hidden sm:table-cell">Amount</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs text-[#EAE0D5]/40 font-semibold uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs text-[#EAE0D5]/40 font-semibold uppercase tracking-wider hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.recent_orders || []).slice(0, 8).map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      className="border-b border-[#B76E79]/5 hover:bg-[#B76E79]/5 cursor-pointer transition-colors"
                      tabIndex={0}
                      role="row"
                    >
                      <td className="px-5 py-3.5" role="cell">
                        <span className="font-medium text-[#F2C29A] text-sm">#{order.id}</span>
                        <span className="block text-xs text-[#EAE0D5]/40 sm:hidden">{fmt(order.total_amount)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#EAE0D5]/70 hidden sm:table-cell" role="cell">{fmt(order.total_amount)}</td>
                      <td className="px-5 py-3.5" role="cell">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#EAE0D5]/50 hidden md:table-cell" role="cell">{fmtDate(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="xl:col-span-2 bg-gradient-to-br from-[#1a0c12] to-[#0B0608] border border-[#B76E79]/15 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#B76E79]/10">
            <h2 className="font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Low Stock</h2>
            <Link
              href="/admin/products?filter=low_stock"
              className="text-xs text-[#B76E79] hover:text-[#F2C29A] transition-colors flex items-center gap-1 min-h-[44px] touch-target"
            >
              View All <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12" role="status" aria-label="Loading inventory">
              <RefreshCw className="w-6 h-6 text-[#B76E79]/40 animate-spin" aria-hidden="true" />
            </div>
          ) : lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#EAE0D5]/30">
              <CheckCircle className="w-10 h-10 mb-2 text-green-500/30" aria-hidden="true" />
              <p className="text-sm">All items well stocked!</p>
            </div>
          ) : (
            <div className="divide-y divide-[#B76E79]/5" role="list">
              {lowStockItems.slice(0, 8).map((item) => (
                <div
                  key={item.sku || item.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[#B76E79]/5 transition-colors"
                  role="listitem"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[#EAE0D5] truncate">{item.product_name}</p>
                    <p className="text-xs text-[#EAE0D5]/40 font-mono">{item.sku}</p>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    {item.quantity === 0 ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                        Out
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        {item.quantity} left
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-[#1a0c12] to-[#0B0608] border border-[#B76E79]/15 rounded-2xl p-5">
        <h2 className="font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/admin/orders?status=confirmed', icon: CheckCircle, label: 'Process Orders', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { href: '/admin/products/create', icon: Package, label: 'Add Product', color: 'text-[#F2C29A]', bg: 'bg-[#7A2F57]/20', border: 'border-[#B76E79]/20' },
            { href: '/admin/inventory', icon: Truck, label: 'Manage Stock', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
            { href: '/admin/returns', icon: RotateCcw, label: 'Returns', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
          ].map(({ href, icon: Icon, label, color, bg, border }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl', bg, border,
                'hover:scale-105 hover:shadow-lg transition-all duration-200 group',
                'min-h-[44px] touch-target'
              )}
            >
              <Icon className={cn('w-6 h-6', color, 'group-hover:scale-110 transition-transform')} aria-hidden="true" />
              <span className={cn('text-xs font-medium', color, 'text-center')}>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Wrap dashboard in ErrorBoundary
export default function AdminDashboard() {
  return (
    <ErrorBoundary
      title="Dashboard Error"
      message="We couldn't load the dashboard. Please try again."
    >
      <DashboardContent />
    </ErrorBoundary>
  );
}

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

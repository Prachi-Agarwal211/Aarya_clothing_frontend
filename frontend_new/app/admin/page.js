'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IndianRupee,
  ShoppingBag,
  Users,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
} from 'lucide-react';
import StatCard from '@/components/admin/shared/StatCard';
import DataTable from '@/components/admin/shared/DataTable';
import { OrderStatusBadge, InventoryStatusBadge } from '@/components/admin/shared/StatusBadge';
import { dashboardApi, ordersApi, inventoryApi } from '@/lib/adminApi';
import { useAuth } from '@/lib/authContext';
import { isAdmin } from '@/lib/roles';
import logger from '@/lib/logger';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [error, setError] = useState(null);

  // Role guard - redirect non-admin users away
  useEffect(() => {
    if (user && !isAdmin(user.role)) {
      // Redirect to appropriate dashboard based on role
      router.push(`/admin/${user.role === 'staff' ? 'staff' : 'super'}`);
    }
  }, [user, router]);

  const fetchDashboardData = useCallback(async () => {
    // Fallback data for when API is unavailable - moved inside callback to prevent infinite loops
    const fallbackData = {
      total_revenue: 0,
      total_orders: 0,
      total_customers: 0,
      total_products: 0,
      pending_orders: 0,
      today_revenue: 0,
      today_orders: 0,
      inventory_alerts: { low_stock: 0, out_of_stock: 0 },
      recent_orders: []
    };

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

      // Check for authentication errors - redirect to login
      const errorMessage = err.message || '';
      if (errorMessage.includes('401') || errorMessage.includes('Not authenticated') || errorMessage.includes('Unauthorized')) {
        setError('Please log in to access the admin dashboard');
        // Optionally redirect to login after a delay
        setTimeout(() => router.push('/auth/login'), 2000);
        return;
      }

      // For other errors, provide fallback data so dashboard is usable
      setDashboardData(fallbackData);
      setLowStockItems([]);
      setError('Showing cached/empty data. Some real-time data may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Fetch data when user is available
  useEffect(() => {
    // Wait for auth to initialize before fetching
    if (user === undefined) return;
    
    // If user is not admin, they will be redirected by the role guard
    if (user && !isAdmin(user.role)) {
      return; // Will be redirected
    }
    
    fetchDashboardData();
  }, [user, fetchDashboardData]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Recent orders columns
  const orderColumns = [
    {
      key: 'id',
      label: 'Order ID',
      render: (value) => <span className="font-medium text-[#F2C29A]">#{value}</span>,
    },
    {
      key: 'user_id',
      label: 'Customer',
      render: (value) => <span className="text-[#EAE0D5]/70">User #{value}</span>,
    },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (value) => <span className="font-medium">{formatCurrency(value)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <OrderStatusBadge status={value} />,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (value) => (
        <span className="text-[#EAE0D5]/60 text-sm">{formatDate(value)}</span>
      ),
    },
  ];

  // Low stock columns
  const lowStockColumns = [
    {
      key: 'product_name',
      label: 'Product',
      render: (value) => <span className="font-medium text-[#EAE0D5]">{value}</span>,
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (value) => <span className="text-[#EAE0D5]/60 font-mono text-sm">{value}</span>,
    },
    {
      key: 'quantity',
      label: 'Stock',
      render: (value, row) => <InventoryStatusBadge quantity={value} threshold={row.low_stock_threshold} />,
    },
  ];

  // Show loading skeleton while fetching
  if (loading && !dashboardData) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6 animate-pulse">
              <div className="h-4 bg-[#B76E79]/20 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-[#B76E79]/20 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <p className="text-red-400">Error loading dashboard: {error}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning banner when using fallback data */}
      {error && dashboardData && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-400 text-sm">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="ml-auto px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#F2C29A] font-cinzel"
          >
            Dashboard
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Welcome back! Here&apos;s what&apos;s happening with your store.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#EAE0D5]/50">
          <Clock className="w-4 h-4" />
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={dashboardData?.total_revenue || 0}
          format="currency"
          prefix="₹"
          icon={IndianRupee}
        />
        <StatCard
          title="Total Orders"
          value={dashboardData?.total_orders || 0}
          icon={ShoppingBag}
        />
        <StatCard
          title="Total Customers"
          value={dashboardData?.total_customers || 0}
          icon={Users}
        />
        <StatCard
          title="Total Products"
          value={dashboardData?.total_products || 0}
          icon={Package}
        />
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="Today's Revenue"
          value={dashboardData?.today_revenue || 0}
          format="currency"
          prefix="₹"
          icon={TrendingUp}
        />
        <StatCard
          title="Today's Orders"
          value={dashboardData?.today_orders || 0}
          icon={ShoppingBag}
        />
      </div>

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pending Orders Alert */}
        <Link
          href="/admin/orders?status=pending"
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 hover:bg-yellow-500/15 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-yellow-500/20">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-yellow-400 font-medium">Pending Orders</p>
                <p className="text-2xl font-bold text-[#EAE0D5] mt-1">
                  {dashboardData?.pending_orders || 0}
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-yellow-400/50 group-hover:text-yellow-400 transition-colors" />
          </div>
        </Link>

        {/* Low Stock Alert */}
        <Link
          href="/admin/inventory?tab=low-stock"
          className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 hover:bg-orange-500/15 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/20">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-orange-400 font-medium">Low Stock Items</p>
                <p className="text-2xl font-bold text-[#EAE0D5] mt-1">
                  {dashboardData?.inventory_alerts?.low_stock || 0}
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-orange-400/50 group-hover:text-orange-400 transition-colors" />
          </div>
        </Link>

        {/* Out of Stock Alert */}
        <Link
          href="/admin/inventory?tab=out-of-stock"
          className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 hover:bg-red-500/15 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/20">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-red-400 font-medium">Out of Stock</p>
                <p className="text-2xl font-bold text-[#EAE0D5] mt-1">
                  {dashboardData?.inventory_alerts?.out_of_stock || 0}
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-red-400/50 group-hover:text-red-400 transition-colors" />
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              className="text-xl font-semibold text-[#F2C29A] font-cinzel"
            >
              Recent Orders
            </h2>
            <Link
              href="/admin/orders"
              className="text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <DataTable
            columns={orderColumns}
            data={dashboardData?.recent_orders || []}
            loading={loading}
            pagination={false}
            onRowClick={(row) => router.push(`/admin/orders/${row.id}`)}
          />
        </div>

        {/* Low Stock Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              className="text-xl font-semibold text-[#F2C29A] font-cinzel"
            >
              Low Stock Alert
            </h2>
            <Link
              href="/admin/products?filter=low_stock"
              className="text-sm text-[#B76E79] hover:text-[#F2C29A] transition-colors flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <DataTable
            columns={lowStockColumns}
            data={lowStockItems}
            loading={loading}
            pagination={false}
            emptyMessage="All items are well stocked!"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
        <h2
          className="text-xl font-semibold text-[#F2C29A] mb-4 font-cinzel"
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/orders?status=pending"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 transition-colors"
          >
            <CheckCircle className="w-6 h-6 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]">Process Orders</span>
          </Link>
          <Link
            href="/admin/products/create"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 transition-colors"
          >
            <Package className="w-6 h-6 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]">Add Product</span>
          </Link>
          <Link
            href="/admin/inventory"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 transition-colors"
          >
            <Truck className="w-6 h-6 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]">Manage Stock</span>
          </Link>
          <Link
            href="/admin/chat"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 transition-colors"
          >
            <Users className="w-6 h-6 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]">Customer Chat</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Package, 
  ShoppingBag, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
} from 'lucide-react';
import StatCard from '@/components/admin/shared/StatCard';
import DataTable from '@/components/admin/shared/DataTable';
import { OrderStatusBadge } from '@/components/admin/shared/StatusBadge';
import { ordersApi, inventoryApi, staffApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

export default function StaffDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingOrders: 0,
    processingOrders: 0,
    lowStockItems: 0,
    todayOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardData, ordersData, processingOrdersData, lowStockData] = await Promise.all([
        staffApi.getDashboard(),
        ordersApi.list({ status: 'pending', limit: 10 }),
        staffApi.getProcessingOrders(),
        inventoryApi.getLowStock(),
      ]);

      setStats({
        pendingOrders: dashboardData.pending_orders || 0,
        processingOrders: processingOrdersData.orders?.length || 0,
        lowStockItems: dashboardData.inventory_alerts?.low_stock || lowStockData.items?.length || 0,
        todayOrders: dashboardData.today_tasks?.order_processing || 0,
      });

      setRecentOrders(ordersData.orders || []);
      setLowStock(lowStockData.items || []);
    } catch (err) {
      logger.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Quick actions for staff
  const quickActions = [
    { label: 'View Orders', href: '/admin/orders', icon: ShoppingBag, color: 'bg-[#7A2F57]' },
    { label: 'Manage Inventory', href: '/admin/inventory', icon: Package, color: 'bg-[#B76E79]' },
  ];

  const columns = [
    {
      key: 'id',
      label: 'Order ID',
      render: (item) => `#${item.id}`,
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (item) => item.customer_name || `User #${item.user_id}`,
    },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (item) => formatCurrency(item.total_amount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <OrderStatusBadge status={item.status} />,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (item) => new Date(item.created_at).toLocaleDateString('en-IN'),
    },
    {
      key: 'actions',
      label: 'Action',
      render: (item) => (
        <Link
          href={`/admin/orders/${item.id}`}
          className="text-[#F2C29A] hover:text-white transition-colors"
        >
          View
        </Link>
      ),
    },
  ];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#EAE0D5]" style={{ fontFamily: 'Cinzel, serif' }}>
            Staff Dashboard
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Manage orders and inventory
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`${action.color} p-4 rounded-lg flex items-center justify-between hover:opacity-90 transition-opacity`}
          >
            <div className="flex items-center gap-3">
              <action.icon className="w-5 h-5 text-white" />
              <span className="text-white font-medium">{action.label}</span>
            </div>
            <ArrowRight className="w-5 h-5 text-white/70" />
          </Link>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Orders"
          value={stats.pendingOrders}
          icon={Clock}
          color="bg-amber-500"
        />
        <StatCard
          title="Processing"
          value={stats.processingOrders}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStockItems}
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <StatCard
          title="Today's Orders"
          value={stats.todayOrders}
          icon={ShoppingBag}
          color="bg-green-500"
        />
      </div>

      {/* Recent Orders */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#EAE0D5]" style={{ fontFamily: 'Cinzel, serif' }}>
            Recent Orders
          </h2>
          <Link
            href="/admin/orders"
            className="text-[#F2C29A] hover:text-white transition-colors text-sm"
          >
            View All
          </Link>
        </div>
        
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#1a1a1a] rounded" />
            ))}
          </div>
        ) : recentOrders.length > 0 ? (
          <DataTable columns={columns} data={recentOrders} />
        ) : (
          <p className="text-[#EAE0D5]/60 text-center py-8">
            No pending orders
          </p>
        )}
      </div>

      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#EAE0D5]" style={{ fontFamily: 'Cinzel, serif' }}>
            Low Stock Alert
          </h2>
          <Link
            href="/admin/inventory"
            className="text-[#F2C29A] hover:text-white transition-colors text-sm"
          >
            Manage Inventory
          </Link>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#1a1a1a] rounded" />
            ))}
          </div>
        ) : lowStock.length > 0 ? (
          <div className="space-y-3">
            {lowStock.slice(0, 5).map((item) => (
              <div
                key={item.id || item.sku || item.product_name}
                className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-[#EAE0D5]">{item.product_name || item.sku || 'Inventory item'}</span>
                </div>
                <span className="text-red-400 text-sm">{item.quantity} left</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[#EAE0D5]/60 text-center py-8">
            No low stock alerts
          </p>
        )}
      </div>
    </div>
  );
}

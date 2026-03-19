'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, TrendingUp, Users, ShoppingBag, 
  Calendar, RefreshCw, Loader2, ArrowUpRight,
  ArrowDownRight, IndianRupee, PieChart, Info,
  Activity, Zap, Clock, Target
} from 'lucide-react';
import { dashboardApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

// Mini bar chart component for visual representation
function MiniBarChart({ data, maxValue, color = "#B76E79" }) {
  if (!data || data.length === 0) return null;
  const barWidth = 100 / data.length;
  
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((item, idx) => (
        <div 
          key={idx}
          className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-80"
          style={{ 
            height: `${Math.max(10, (item.value / maxValue) * 100)}%`,
            backgroundColor: color,
            opacity: 0.4 + (0.6 * (idx / data.length))
          }}
          title={`${item.label}: ${item.value}`}
        />
      ))}
    </div>
  );
}

// Stat card with trend indicator
function StatCard({ title, value, subtitle, icon: Icon, iconBg, trend, trendValue, loading }) {
  return (
    <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-5 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#B76E79]/5 to-transparent rounded-bl-full" />
      
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#EAE0D5]/60 text-xs uppercase tracking-wider font-semibold">{title}</p>
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className="w-4 h-4 text-[#F2C29A]" />
        </div>
      </div>
      
      {loading ? (
        <div className="h-8 bg-[#B76E79]/10 rounded-lg animate-pulse" />
      ) : (
        <>
          <p className="text-2xl font-bold text-[#EAE0D5]">{value}</p>
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1.5">
              {trend === 'up' ? (
                <ArrowUpRight className="w-3 h-3 text-green-400" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-red-400" />
              )}
              <span className={`text-xs font-medium ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                {trendValue}
              </span>
              {subtitle && <span className="text-[#EAE0D5]/20 text-xs">{subtitle}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Real-time indicator component
function LiveIndicator({ lastUpdated, isRefreshing }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/40">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
        <span className="font-medium">{isRefreshing ? 'Updating...' : 'Live'}</span>
      </div>
      {lastUpdated && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Updated {lastUpdated}</span>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('30d');
  const [revenue, setRevenue] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [orders, setOrders] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [performance, setProductPerformance] = useState([]);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [revenueChartData, setRevenueChartData] = useState([]);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      
      setError(null);
      
      const [revData, custData, ordersData, topData, perfData] = await Promise.all([
        dashboardApi.getRevenueAnalytics(period),
        dashboardApi.getCustomerAnalytics(),
        dashboardApi.getOverview(),
        dashboardApi.getTopProducts(period),
        dashboardApi.getProductPerformance(period)
      ]);

      setRevenue(revData);
      setCustomers(custData);
      setOrders(ordersData);
      setTopProducts(topData.top_products || []);
      setProductPerformance(perfData.products || []);
      
      // Process revenue data for chart
      if (revData?.period_data) {
        const chartData = revData.period_data.slice(-7).map(item => ({
          label: new Date(item.date).toLocaleDateString('en-IN', { weekday: 'short' }),
          value: item.revenue || 0
        }));
        setRevenueChartData(chartData);
      }
      
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
    } catch (err) {
      logger.error('Analytics fetch error:', err);
      
      const errorMessage = err.message || '';
      if (errorMessage.includes('401') || errorMessage.includes('Not authenticated') || errorMessage.includes('Unauthorized')) {
        setError('Please log in to view analytics');
      } else {
        setRevenue({ total_revenue: 0, period_data: [] });
        setCustomers({ total_customers: 0, new_customers_today: 0, new_customers_this_week: 0, new_customers_this_month: 0, returning_customers: 0 });
        setOrders({ today_orders: 0, pending_orders: 0, shipped_today: 0 });
        setTopProducts([]);
        setProductPerformance([]);
        setError('Showing empty data. Some analytics may be unavailable.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  // Initial fetch and auto-refresh setup
  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh && !loading) {
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, 30000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, loading, fetchData]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setRevenueChartData([]);
  };

  // Calculate average order value
  const avgOrderValue = revenue?.total_revenue && orders?.today_orders 
    ? Math.round(revenue.total_revenue / (orders.today_orders || 1))
    : 0;

  // Get max revenue for chart scaling
  const maxRevenue = revenueChartData.length > 0 
    ? Math.max(...revenueChartData.map(d => d.value), 1)
    : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#B76E79] animate-spin" />
        <span className="ml-3 text-[#EAE0D5]/60 font-cinzel">Generating Reports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            Store Analytics
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1 text-sm">Deep insights into your store's performance</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <LiveIndicator lastUpdated={lastUpdated} isRefreshing={refreshing} />
          
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              autoRefresh 
                ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                : 'border-[#B76E79]/20 text-[#EAE0D5]/40'
            }`}
            title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
          >
            <Zap className={`w-4 h-4 ${autoRefresh ? 'fill-current' : ''}`} />
          </button>
          
          <select 
            value={period} 
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <button 
            onClick={() => fetchData(true)} 
            disabled={refreshing}
            className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
          <Info className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Revenue" 
          value={fmt(revenue?.total_revenue || 0)}
          subtitle="vs last period"
          icon={IndianRupee}
          iconBg="bg-green-500/10"
          trend="up"
          trendValue="+12.5%"
          loading={refreshing}
        />
        <StatCard 
          title="Total Customers" 
          value={customers?.total_customers || 0}
          subtitle={`${customers?.returning_customers || 0} returning`}
          icon={Users}
          iconBg="bg-[#7A2F57]/20"
          loading={refreshing}
        />
        <StatCard 
          title="Orders Today" 
          value={orders?.today_orders || 0}
          subtitle={`${orders?.pending_orders || 0} pending`}
          icon={ShoppingBag}
          iconBg="bg-blue-500/10"
          trend={orders?.shipped_today > 0 ? 'up' : undefined}
          trendValue={orders?.shipped_today ? `${orders.shipped_today} shipped` : undefined}
          loading={refreshing}
        />
        <StatCard 
          title="Avg Order Value" 
          value={fmt(avgOrderValue)}
          subtitle="per order"
          icon={Target}
          iconBg="bg-purple-500/10"
          loading={refreshing}
        />
      </div>

      {/* Revenue Chart Section */}
      {revenueChartData.length > 0 && (
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
              Revenue Trend (Last 7 Days)
            </h2>
            <div className="flex items-center gap-4 text-xs text-[#EAE0D5]/40">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#B76E79]" />
                Daily Revenue
              </div>
            </div>
          </div>
          <MiniBarChart data={revenueChartData} maxValue={maxRevenue} color="#B76E79" />
          <div className="flex justify-between mt-2 text-xs text-[#EAE0D5]/30">
            {revenueChartData.map((d, i) => (
              <span key={i}>{d.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Charts / Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#B76E79]/10">
            <h2 className="text-base font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Top Selling Products</h2>
          </div>
          <div className="flex-1 p-4 space-y-3">
            {topProducts.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-[#EAE0D5]/30 text-sm italic">No data for this period</div>
            ) : topProducts.map((p, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-[#0B0608]/40 rounded-xl border border-[#B76E79]/5 hover:border-[#B76E79]/20 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : idx === 1 ? 'bg-gray-400/20 text-gray-400' : idx === 2 ? 'bg-amber-600/20 text-amber-600' : 'bg-[#B76E79]/10 text-[#EAE0D5]/40'}`}>
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#EAE0D5] truncate">{p.product_name}</p>
                  <p className="text-xs text-[#EAE0D5]/40">{p.total_sold} units sold</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#F2C29A]">{fmt(p.total_revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Performance */}
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#B76E79]/10">
            <h2 className="text-base font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Product Performance</h2>
          </div>
          <div className="flex-1 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#B76E79]/5 text-[#EAE0D5]/40 text-[10px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3 text-center">Orders</th>
                    <th className="px-6 py-3 text-center">Rating</th>
                    <th className="px-6 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#B76E79]/5">
                  {performance.slice(0, 6).map((p, idx) => (
                    <tr key={idx} className="hover:bg-[#B76E79]/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-medium text-[#EAE0D5] truncate max-w-[150px]">{p.name}</p>
                        <p className="text-[10px] text-[#EAE0D5]/30 font-mono">{p.sku}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-[#EAE0D5]/70">{p.order_count}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#F2C29A]">
                          <span className="text-xs font-bold">{p.avg_rating || '-'}</span>
                          {p.avg_rating && <span className="text-[10px] text-[#EAE0D5]/20">★</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-semibold text-[#F2C29A]">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Insights */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>Customer Insights</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[#0B0608]/40 rounded-xl border border-[#B76E79]/10">
            <p className="text-xs text-[#EAE0D5]/40 uppercase tracking-wider mb-1">New Today</p>
            <p className="text-xl font-bold text-[#EAE0D5]">{customers?.new_customers_today || 0}</p>
          </div>
          <div className="p-4 bg-[#0B0608]/40 rounded-xl border border-[#B76E79]/10">
            <p className="text-xs text-[#EAE0D5]/40 uppercase tracking-wider mb-1">This Week</p>
            <p className="text-xl font-bold text-[#EAE0D5]">{customers?.new_customers_this_week || 0}</p>
          </div>
          <div className="p-4 bg-[#0B0608]/40 rounded-xl border border-[#B76E79]/10">
            <p className="text-xs text-[#EAE0D5]/40 uppercase tracking-wider mb-1">This Month</p>
            <p className="text-xl font-bold text-[#EAE0D5]">{customers?.new_customers_this_month || 0}</p>
          </div>
          <div className="p-4 bg-[#0B0608]/40 rounded-xl border border-[#B76E79]/10">
            <p className="text-xs text-[#EAE0D5]/40 uppercase tracking-wider mb-1">Returning</p>
            <p className="text-xl font-bold text-green-400">{customers?.returning_customers || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

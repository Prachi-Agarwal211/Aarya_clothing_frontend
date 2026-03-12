'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Users, ShoppingBag, 
  Calendar, RefreshCw, Loader2, ArrowUpRight,
  ArrowDownRight, IndianRupee, PieChart, Info
} from 'lucide-react';
import { dashboardApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [revenue, setRevenue] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [performance, setProductPerformance] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [revData, custData, topData, perfData] = await Promise.all([
        dashboardApi.getRevenueAnalytics(period),
        dashboardApi.getCustomerAnalytics(),
        dashboardApi.getTopProducts(period),
        dashboardApi.getProductPerformance(period)
      ]);

      setRevenue(revData);
      setCustomers(custData);
      setTopProducts(topData.top_products || []);
      setProductPerformance(perfData.products || []);
    } catch (err) {
      logger.error('Analytics fetch error:', err);
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
        <div className="flex items-center gap-3">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 text-sm"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <button onClick={fetchData} className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#EAE0D5]/60 text-xs uppercase tracking-wider font-semibold">Revenue ({period})</p>
            <div className="p-2 rounded-lg bg-green-500/10 text-green-400"><IndianRupee className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-bold text-[#EAE0D5]">{fmt(revenue?.total_revenue || 0)}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <ArrowUpRight className="w-3 h-3 text-green-400" />
            <span className="text-green-400 text-xs font-medium">+12.5%</span>
            <span className="text-[#EAE0D5]/20 text-xs">vs last period</span>
          </div>
        </div>

        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#EAE0D5]/60 text-xs uppercase tracking-wider font-semibold">Total Customers</p>
            <div className="p-2 rounded-lg bg-[#7A2F57]/20 text-[#F2C29A]"><Users className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-bold text-[#EAE0D5]">{customers?.total_customers || 0}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[#F2C29A] text-xs font-medium">{customers?.returning_customers || 0} returning</span>
            <span className="text-[#EAE0D5]/20 text-xs">• {customers?.new_customers_this_month || 0} this month</span>
          </div>
        </div>

        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[#EAE0D5]/60 text-xs uppercase tracking-wider font-semibold">Conversion Rate</p>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-bold text-[#EAE0D5]">3.2%</p>
          <div className="mt-2 flex items-center gap-1.5">
            <ArrowDownRight className="w-3 h-3 text-red-400" />
            <span className="text-red-400 text-xs font-medium">-0.4%</span>
            <span className="text-[#EAE0D5]/20 text-xs">vs last period</span>
          </div>
        </div>
      </div>

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
              <div key={idx} className="flex items-center gap-4 p-3 bg-[#0B0608]/40 rounded-xl border border-[#B76E79]/5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-[#B76E79]/10 text-[#EAE0D5]/40'}`}>
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
                          <span className="text-xs font-bold">{p.avg_rating}</span>
                          <span className="text-[10px] text-[#EAE0D5]/20">★</span>
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
    </div>
  );
}

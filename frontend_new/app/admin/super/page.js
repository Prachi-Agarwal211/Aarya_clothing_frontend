'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  Key,
  Users,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  Clock,
  Cpu,
} from 'lucide-react';
import StatCard from '@/components/admin/shared/StatCard';
import { aiSettingsApi, adminClient } from '@/lib/adminApi';
import logger from '@/lib/logger';

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch AI Monitoring Summary (Super Admin only)
      const [monitoringData, settingsData] = await Promise.all([
        adminClient.get('/api/v1/super/ai-monitoring?days=7'),
        aiSettingsApi.getAll(),
      ]);

      setDashboardData({
        aiMonitoring: monitoringData,
        aiSettingsCount: settingsData.settings?.length || 0,
      });
    } catch (err) {
      logger.error('Failed to load super admin dashboard:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (error) {
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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A] font-cinzel">
            System Overview
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Manage AI configuration, billing, and system settings.
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
          title="AI Cost (7 Days)"
          value={dashboardData?.aiMonitoring?.total_cost_usd || 0}
          format="currency"
          prefix="$"
          icon={CreditCard}
        />
        <StatCard
          title="Active API Keys"
          value={dashboardData?.aiSettingsCount || 0}
          icon={Key}
        />
        <StatCard
          title="AI Sessions"
          value={dashboardData?.aiMonitoring?.totals?.sessions || 0}
          icon={Activity}
        />
        <StatCard
          title="Users"
          value={dashboardData?.aiMonitoring?.top_users?.length || 0}
          icon={Users}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-[#F2C29A] mb-4 font-cinzel">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/super/ai-settings"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 transition-colors"
          >
            <Key className="w-6 h-6 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]">API Keys</span>
          </Link>
          <Link
            href="/admin/super/ai-monitoring"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 transition-colors"
          >
            <Activity className="w-6 h-6 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]">Monitoring</span>
          </Link>
          <Link
            href="/admin/super/users"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 transition-colors"
          >
            <Users className="w-6 h-6 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]">Users</span>
          </Link>
          <Link
            href="/admin/super/settings"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/10 hover:border-[#B76E79]/30 transition-colors"
          >
            <Cpu className="w-6 h-6 text-[#B76E79]" />
            <span className="text-sm text-[#EAE0D5]">System</span>
          </Link>
        </div>
      </div>

      {/* AI Cost Breakdown */}
      {dashboardData?.aiMonitoring?.by_model && (
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#F2C29A] font-cinzel">
              AI Cost by Model
            </h2>
          </div>
          <div className="space-y-3">
            {dashboardData.aiMonitoring.by_model.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg">
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-[#B76E79]" />
                  <span className="text-[#EAE0D5]">{item.model}</span>
                </div>
                <span className="text-[#F2C29A] font-mono">
                  ${item.cost_usd.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

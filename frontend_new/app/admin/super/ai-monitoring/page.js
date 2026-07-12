'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  TrendingUp,
  DollarSign,
  Clock,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { aiMonitoringApi } from '@/lib/adminApi';

export default function SuperAdminAiMonitoring() {
  const [loading, setLoading] = useState(true);
  const [monitoringData, setMonitoringData] = useState(null);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);

  const fetchMonitoringData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aiMonitoringApi.get(days);
      setMonitoringData(data);
    } catch (err) {
      console.error('Failed to load AI monitoring:', err);
      setError(err.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#A8B4C8]/30 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#F5F0E8]/70">Loading AI Monitoring...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#D4AF37] font-cinzel">
            AI Monitoring
          </h1>
          <p className="text-[#F5F0E8]/60 mt-1">
            Track AI usage, costs, and performance metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="bg-[#111111] border border-[#A8B4C8]/20 rounded-lg px-3 py-2 text-[#F5F0E8] focus:outline-none focus:border-[#A8B4C8]"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={fetchMonitoringData}
            className="p-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#A8B4C8] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111]/40 backdrop-blur-md border border-[#A8B4C8]/15 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#1E3A5F]/20">
              <DollarSign className="w-5 h-5 text-[#A8B4C8]" />
            </div>
            <span className="text-[#F5F0E8]/60 text-sm">Total Cost</span>
          </div>
          <p className="text-2xl font-bold text-[#D4AF37]">
            ${monitoringData?.total_cost_usd?.toFixed(4) || '0.00'}
          </p>
        </div>

        <div className="bg-[#111111]/40 backdrop-blur-md border border-[#A8B4C8]/15 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#1E3A5F]/20">
              <Activity className="w-5 h-5 text-[#A8B4C8]" />
            </div>
            <span className="text-[#F5F0E8]/60 text-sm">Sessions</span>
          </div>
          <p className="text-2xl font-bold text-[#D4AF37]">
            {monitoringData?.totals?.sessions || 0}
          </p>
        </div>

        <div className="bg-[#111111]/40 backdrop-blur-md border border-[#A8B4C8]/15 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#1E3A5F]/20">
              <TrendingUp className="w-5 h-5 text-[#A8B4C8]" />
            </div>
            <span className="text-[#F5F0E8]/60 text-sm">Messages</span>
          </div>
          <p className="text-2xl font-bold text-[#D4AF37]">
            {monitoringData?.totals?.messages || 0}
          </p>
        </div>

        <div className="bg-[#111111]/40 backdrop-blur-md border border-[#A8B4C8]/15 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-[#1E3A5F]/20">
              <Clock className="w-5 h-5 text-[#A8B4C8]" />
            </div>
            <span className="text-[#F5F0E8]/60 text-sm">Tokens In/Out</span>
          </div>
          <p className="text-lg font-bold text-[#D4AF37]">
            {(monitoringData?.totals?.tokens_in || 0).toLocaleString()} / {(monitoringData?.totals?.tokens_out || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Cost by Model */}
      <div className="bg-[#111111]/40 backdrop-blur-md border border-[#A8B4C8]/15 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-[#D4AF37] mb-4 font-cinzel">
          Cost by Model
        </h2>
        <div className="space-y-3">
          {monitoringData?.by_model?.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-[#F5F0E8]">{item.model}</span>
                <span className="text-xs text-[#F5F0E8]/50">({item.sessions} sessions)</span>
              </div>
              <span className="text-[#D4AF37] font-mono">
                ${item.cost_usd.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-[#111111]/40 backdrop-blur-md border border-[#A8B4C8]/15 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-[#D4AF37] mb-4 font-cinzel">
          Top Users by AI Cost
        </h2>
        <div className="space-y-3">
          {monitoringData?.top_users?.map((user, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1E3A5F]/20 flex items-center justify-center">
                  <span className="text-[#D4AF37] text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-[#F5F0E8] text-sm">{user.email}</p>
                  <p className="text-[#F5F0E8]/50 text-xs">{user.role}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[#D4AF37] font-mono">${user.cost_usd.toFixed(4)}</p>
                <p className="text-[#F5F0E8]/50 text-xs">{user.sessions} sessions</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

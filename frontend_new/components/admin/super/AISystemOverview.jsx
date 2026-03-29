'use client';

import React from 'react';
import { Sparkles, Activity, DollarSign, Database, Zap, TrendingUp } from 'lucide-react';

/**
 * AI System Overview - Executive Summary Dashboard
 * Displays key AI metrics at a glance (Grafana-style)
 */
export default function AISystemOverview({ stats }) {
  return (
    <div className="bg-gradient-to-r from-[#7A2F57]/10 via-[#B76E79]/10 to-[#7A2F57]/10 border border-[#B76E79]/30 rounded-2xl overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#B76E79]/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7A2F57]/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#F2C29A]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#F2C29A]">AI System Overview</h2>
            <p className="text-xs text-[#EAE0D5]/60">Real-time AI platform metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-400">System Online</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-6">
        {/* Active Provider */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/60">
            <Zap className="w-3 h-3" />
            <span>Active Provider</span>
          </div>
          <p className="text-lg font-bold text-[#EAE0D5]">
            {stats?.active_provider || 'Gemini'}
          </p>
          <p className="text-[10px] text-[#EAE0D5]/40">
            {stats?.active_model || '2.0 Flash Lite'}
          </p>
        </div>

        {/* Today's Tokens */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/60">
            <Database className="w-3 h-3" />
            <span>Today's Tokens</span>
          </div>
          <p className="text-lg font-bold text-[#F2C29A]">
            {formatNumber(stats?.tokens_today || 24582)}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-green-400">
            <TrendingUp className="w-3 h-3" />
            <span>+12.5%</span>
          </div>
        </div>

        {/* Cost Today */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/60">
            <DollarSign className="w-3 h-3" />
            <span>Cost Today</span>
          </div>
          <p className="text-lg font-bold text-green-400">
            ${stats?.cost_today?.toFixed(2) || '0.42'}
          </p>
          <p className="text-[10px] text-[#EAE0D5]/40">
            Avg: ${(stats?.cost_today / 24).toFixed(3)}/hr
          </p>
        </div>

        {/* Daily Budget */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/60">
            <Activity className="w-3 h-3" />
            <span>Daily Budget</span>
          </div>
          <p className="text-lg font-bold text-[#EAE0D5]">
            ${stats?.cost_today?.toFixed(2) || '0.42'}
          </p>
          <div className="w-full h-1.5 bg-[#0B0608] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7A2F57] to-[#B76E79] transition-all duration-500"
              style={{ width: `${Math.min((stats?.cost_today / stats?.daily_limit * 100) || 42, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-[#EAE0D5]/40">
            ${stats?.daily_limit || '1.00'} limit
          </p>
        </div>

        {/* Requests Today */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/60">
            <Activity className="w-3 h-3" />
            <span>Requests</span>
          </div>
          <p className="text-lg font-bold text-[#F2C29A]">
            {formatNumber(stats?.requests_today || 1247)}
          </p>
          <p className="text-[10px] text-[#EAE0D5]/40">
            {stats?.avg_response_time || '1.2'}s avg
          </p>
        </div>

        {/* Success Rate */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/60">
            <TrendingUp className="w-3 h-3" />
            <span>Success Rate</span>
          </div>
          <p className="text-lg font-bold text-green-400">
            {stats?.success_rate || '99.8'}%
          </p>
          <div className="w-full h-1.5 bg-[#0B0608] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500"
              style={{ width: `${stats?.success_rate || 99.8}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * StatCard - Premium metric card with gradient accent and trend indicator
 */
export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  format = 'number',
  prefix = '',
  suffix = '',
  accentColor = '#B76E79',
  className = '',
}) {
  const isPositive = change >= 0;
  const changeColor = change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-[#EAE0D5]/50';

  const formatValue = () => {
    if (typeof value === 'string') return value;
    switch (format) {
      case 'currency':
        return `${prefix}${(value || 0).toLocaleString('en-IN')}`;
      case 'percentage':
        return `${value}${suffix}`;
      default:
        return (value || 0).toLocaleString('en-IN');
    }
  };

  return (
    <div className={`
      relative overflow-hidden
      bg-gradient-to-br from-[#1a0c12] to-[#0B0608]
      border border-[#B76E79]/20
      rounded-2xl p-5
      hover:border-[#B76E79]/40 hover:shadow-[0_8px_32px_rgba(183,110,121,0.15)]
      transition-all duration-300 group
      ${className}
    `}>
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20 transition-opacity group-hover:opacity-30"
        style={{ background: `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)` }} />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[#EAE0D5]/60 text-xs font-semibold uppercase tracking-widest mb-1">
            {title}
          </p>
          <p className="text-2xl md:text-3xl font-bold text-[#F2C29A] mt-2 truncate"
            style={{ fontFamily: 'Cinzel, serif' }}>
            {formatValue()}
          </p>
          {change !== undefined && change !== null && (
            <div className={`flex items-center gap-1 mt-2 ${changeColor}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span className="text-xs font-semibold">{isPositive ? '+' : ''}{change}%</span>
              <span className="text-[#EAE0D5]/40 text-xs">vs last</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-xl flex-shrink-0 ml-3"
            style={{ background: `${accentColor}22`, border: `1px solid ${accentColor}33` }}>
            <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: accentColor }} />
          </div>
        )}
      </div>
    </div>
  );
}

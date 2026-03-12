'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * StatCard - Displays a metric with optional trend indicator
 * 
 * @param {string} title - Card title
 * @param {number|string} value - Main metric value
 * @param {number} change - Percentage change (positive = green, negative = red)
 * @param {React.Component} icon - Lucide icon component
 * @param {string} format - Value format: 'number', 'currency', 'percentage'
 * @param {string} prefix - Prefix for value (e.g., '₹')
 * @param {string} suffix - Suffix for value (e.g., '%')
 */
export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  format = 'number',
  prefix = '',
  suffix = '',
  className = '',
}) {
  const isPositive = change >= 0;
  const changeColor = change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-[#EAE0D5]/50';

  const formatValue = () => {
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'currency':
        return `${prefix}${value.toLocaleString('en-IN')}`;
      case 'percentage':
        return `${value}${suffix}`;
      default:
        return value.toLocaleString('en-IN');
    }
  };

  return (
    <div
      className={`
        bg-[#0B0608]/40 backdrop-blur-md 
        border border-[#B76E79]/15 
        rounded-2xl p-5 md:p-6
        hover:border-[#B76E79]/30 hover:shadow-[0_0_30px_rgba(183,110,121,0.1)]
        transition-all duration-300
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[#EAE0D5]/70 text-sm font-medium tracking-wide">
            {title}
          </p>
          <p 
            className="text-2xl md:text-3xl font-bold text-[#F2C29A] mt-2"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            {formatValue()}
          </p>
          {change !== undefined && change !== null && (
            <div className={`flex items-center gap-1 mt-2 ${changeColor}`}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {isPositive ? '+' : ''}{change}%
              </span>
              <span className="text-[#EAE0D5]/50 text-sm ml-1">vs last period</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl bg-[#7A2F57]/20 border border-[#B76E79]/10">
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-[#B76E79]" />
          </div>
        )}
      </div>
    </div>
  );
}

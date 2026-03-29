'use client';

import React from 'react';

/**
 * Grafana-style Gauge Component
 * Displays a value as a semi-circular gauge with gradient coloring
 */
export default function Gauge({
  value = 0,
  max = 100,
  label = '',
  unit = '',
  color = '#B76E79',
  size = 'medium' // small, medium, large
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const rotation = (percentage / 100) * 180 - 90;

  const sizeClasses = {
    small: 'w-24 h-12',
    medium: 'w-32 h-16',
    large: 'w-40 h-20'
  };

  const needleSize = {
    small: 'w-1 h-12',
    medium: 'w-1.5 h-16',
    large: 'w-2 h-20'
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className={`relative ${sizeClasses[size]} overflow-hidden`}>
        {/* Background Arc */}
        <div
          className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${sizeClasses[size]} rounded-t-full border-4`}
          style={{
            borderColor: 'rgba(183, 110, 121, 0.2)',
            transform: 'translateX(-50%)'
          }}
        />

        {/* Value Arc (Progress) */}
        <div
          className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${sizeClasses[size]} rounded-t-full border-4 transition-all duration-500`}
          style={{
            borderLeftColor: 'transparent',
            borderTopColor: color,
            borderTopWidth: '4px',
            borderRightColor: 'transparent',
            transform: `translateX(-50%) rotate(${rotation - 90}deg)`,
            opacity: percentage / 100
          }}
        />

        {/* Needle */}
        <div
          className={`absolute bottom-0 left-1/2 origin-bottom ${needleSize[size]} rounded-full transition-transform duration-500`}
          style={{
            background: `linear-gradient(to top, ${color}, ${color}80)`,
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            boxShadow: `0 0 8px ${color}60`
          }}
        />

        {/* Center Dot */}
        <div
          className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 10px ${color}`
          }}
        />
      </div>

      {/* Value Display */}
      <div className="mt-2 text-center">
        <p className="text-2xl font-bold text-[#F2C29A]">
          {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          {unit && <span className="text-sm ml-1">{unit}</span>}
        </p>
        {label && (
          <p className="text-xs text-[#EAE0D5]/60 mt-1 max-w-[120px] truncate">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Linear Gauge (Progress Bar Style)
 */
export function LinearGauge({
  value = 0,
  max = 100,
  label = '',
  unit = '',
  color = '#B76E79',
  showPercentage = true
}) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        {label && <p className="text-sm text-[#EAE0D5]/80">{label}</p>}
        {showPercentage && (
          <p className="text-xs text-[#EAE0D5]/60">
            {percentage.toFixed(1)}%
          </p>
        )}
      </div>
      <div className="relative h-3 bg-[#0B0608] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color}, ${color}80)`,
            boxShadow: `0 0 10px ${color}60`
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-[#EAE0D5]/40">
        <span>0{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

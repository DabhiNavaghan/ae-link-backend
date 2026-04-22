'use client';

import React from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  gradient?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  changeLabel = 'vs last period',
  icon,
  isLoading = false,
  gradient = false,
  trend,
}) => {
  const changeColor =
    typeof change === 'number'
      ? change >= 0
        ? 'text-emerald-600'
        : 'text-rose-600'
      : 'text-slate-600';

  const trendIcon =
    trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendClass =
    trend === 'up'
      ? 'text-emerald-600'
      : trend === 'down'
        ? 'text-rose-600'
        : 'text-slate-400';

  return (
    <div
      className={`card p-6 transition-all duration-200 hover:shadow-md ${
        gradient ? 'bg-gradient-to-br from-primary-50 to-primary-100' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
          {isLoading ? (
            <div className="h-10 bg-slate-200 rounded animate-pulse w-32" />
          ) : (
            <p className="text-3xl font-bold text-slate-900">
              {typeof value === 'number'
                ? value.toLocaleString()
                : value}
            </p>
          )}
          {(change !== undefined || trend) && !isLoading && (
            <div className="flex items-center gap-1 mt-3">
              {trend && (
                <span className={`text-lg font-semibold ${trendClass}`}>
                  {trendIcon}
                </span>
              )}
              {change !== undefined && (
                <p className={`text-sm font-medium ${changeColor}`}>
                  {change >= 0 ? '+' : ''}
                  {change}%
                </p>
              )}
              <p className="text-xs text-slate-500 ml-1">{changeLabel}</p>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-lg bg-white bg-opacity-50 text-primary-600 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;

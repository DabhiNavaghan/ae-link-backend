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
      className="card p-6 transition-all duration-200 hover:shadow-md"
      style={gradient ? { background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.05))' } : {}}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
          {isLoading ? (
            <div className="h-10 rounded animate-pulse w-32" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
          ) : (
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
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
              <p className="text-xs ml-1" style={{ color: 'var(--color-text-tertiary)' }}>{changeLabel}</p>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 flex-shrink-0" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;

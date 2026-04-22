'use client';

import React, { useEffect, useState } from 'react';

interface StatsCardProps {
  icon?: React.ReactNode;
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  gradient?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  isLoading?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  label,
  value,
  change,
  changeLabel = 'from last month',
  gradient = false,
  color = 'primary',
  isLoading = false,
}) => {
  const [displayValue, setDisplayValue] = useState<number | string>(
    typeof value === 'number' ? 0 : value
  );

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    const increment = value / 30;
    let current = 0;

    const interval = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(interval);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, 30);

    return () => clearInterval(interval);
  }, [value]);

  const gradientClasses: Record<string, string> = {
    primary: 'gradient-primary',
    secondary: 'gradient-secondary',
    success: 'bg-gradient-to-br from-success-50 to-success-100',
    warning: 'bg-gradient-to-br from-warning-50 to-warning-100',
    danger: 'bg-gradient-to-br from-danger-50 to-danger-100',
  };

  const iconColorClasses: Record<string, string> = {
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-danger-600',
  };

  const changeColorClass =
    typeof change === 'number' && change >= 0
      ? 'text-success-600'
      : 'text-danger-600';

  return (
    <div
      className={`card p-6 transition-all duration-200 hover:shadow-md ${
        gradient ? gradientClasses[color] : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
          {isLoading ? (
            <div className="h-8 bg-slate-200 rounded animate-pulse w-24" />
          ) : (
            <p className="text-3xl font-bold text-slate-900">
              {typeof displayValue === 'number'
                ? displayValue.toLocaleString()
                : displayValue}
            </p>
          )}
          {change !== undefined && !isLoading && (
            <p className={`text-sm font-medium mt-2 ${changeColorClass}`}>
              {change >= 0 ? '+' : ''}
              {change}% {changeLabel}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={`p-3 rounded-lg bg-white bg-opacity-50 ${iconColorClasses[color]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;

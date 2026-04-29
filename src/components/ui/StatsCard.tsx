'use client';

import React, { useEffect, useState, CSSProperties } from 'react';

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

  const getGradientStyle = (): CSSProperties => {
    const gradientStyles: Record<string, CSSProperties> = {
      primary: { backgroundColor: 'var(--color-primary-light)' },
      secondary: { backgroundColor: 'var(--color-secondary)' },
      success: { backgroundColor: 'var(--color-success)' },
      warning: { backgroundColor: 'var(--color-warning)' },
      danger: { backgroundColor: 'var(--color-danger)' },
    };
    return gradient ? gradientStyles[color] : {};
  };

  const getIconColorStyle = (): CSSProperties => {
    const iconColorStyles: Record<string, CSSProperties> = {
      primary: { color: 'var(--color-primary)' },
      secondary: { color: 'var(--color-secondary)' },
      success: { color: 'var(--color-success)' },
      warning: { color: 'var(--color-warning)' },
      danger: { color: 'var(--color-danger)' },
    };
    return iconColorStyles[color];
  };

  const changeColor =
    typeof change === 'number' && change >= 0
      ? 'var(--color-success)'
      : 'var(--color-danger)';

  return (
    <div
      className="card p-6 transition-all duration-200 hover:shadow-md"
      style={getGradientStyle()}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            className="text-sm font-medium mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </p>
          {isLoading ? (
            <div
              className="h-8 rounded animate-pulse w-24"
              style={{ backgroundColor: 'var(--color-bg-hover)' }}
            />
          ) : (
            <p
              className="text-3xl font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              {typeof displayValue === 'number'
                ? displayValue.toLocaleString()
                : displayValue}
            </p>
          )}
          {change !== undefined && !isLoading && (
            <p
              className="text-sm font-medium mt-2"
              style={{ color: changeColor }}
            >
              {change >= 0 ? '+' : ''}
              {change}% {changeLabel}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="p-3 rounded-lg"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              ...getIconColorStyle(),
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;

'use client';

import React, { CSSProperties } from 'react';

interface StatusDotProps {
  status: 'active' | 'paused' | 'archived' | 'error' | 'pending' | 'idle';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = 'md',
  animated = false,
}) => {
  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      active: 'var(--color-success)',
      paused: 'var(--color-warning)',
      archived: 'var(--color-text-tertiary)',
      error: 'var(--color-danger)',
      pending: 'var(--color-primary)',
      idle: 'var(--color-text-tertiary)',
    };
    return statusColors[status];
  };

  const getSizeStyle = (size: string): CSSProperties => {
    const sizeStyles: Record<string, CSSProperties> = {
      sm: { width: '0.5rem', height: '0.5rem' },
      md: { width: '0.75rem', height: '0.75rem' },
      lg: { width: '1rem', height: '1rem' },
    };
    return sizeStyles[size];
  };

  const animationClass = animated && status === 'active' ? 'animate-pulse' : '';

  return (
    <span
      className={`inline-block rounded-full ${animationClass}`}
      style={{
        ...getSizeStyle(size),
        backgroundColor: getStatusColor(status),
      }}
    />
  );
};

export default StatusDot;

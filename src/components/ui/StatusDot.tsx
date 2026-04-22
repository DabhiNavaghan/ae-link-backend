'use client';

import React from 'react';

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
  const statusColors: Record<string, string> = {
    active: 'bg-success-600',
    paused: 'bg-warning-600',
    archived: 'bg-slate-400',
    error: 'bg-danger-600',
    pending: 'bg-primary-600',
    idle: 'bg-slate-400',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const animationClass = animated && status === 'active' ? 'animate-pulse' : '';

  return (
    <span
      className={`inline-block rounded-full ${sizeClasses[size]} ${statusColors[status]} ${animationClass}`}
    />
  );
};

export default StatusDot;

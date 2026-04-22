'use client';

import React from 'react';

interface BadgeProps {
  status: 'active' | 'paused' | 'archived' | 'error' | 'pending' | 'completed';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

const Badge: React.FC<BadgeProps> = ({ status, children, size = 'md' }) => {
  const statusClasses: Record<string, string> = {
    active: 'bg-success-100 text-success-800',
    paused: 'bg-warning-100 text-warning-800',
    archived: 'bg-slate-100 text-slate-800',
    error: 'bg-danger-100 text-danger-800',
    pending: 'bg-primary-100 text-primary-800',
    completed: 'bg-success-100 text-success-800',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  };

  return (
    <span
      className={`badge-base ${statusClasses[status]} ${sizeClasses[size]} font-semibold`}
    >
      <span className={`w-2 h-2 rounded-full mr-2 inline-block`}>
        <span
          className={`w-full h-full block rounded-full ${
            {
              active: 'bg-success-600',
              paused: 'bg-warning-600',
              archived: 'bg-slate-400',
              error: 'bg-danger-600',
              pending: 'bg-primary-600',
              completed: 'bg-success-600',
            }[status]
          }`}
        />
      </span>
      {children}
    </span>
  );
};

export default Badge;

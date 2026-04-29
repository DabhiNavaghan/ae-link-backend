'use client';

import React, { CSSProperties } from 'react';

interface BadgeProps {
  status: 'active' | 'paused' | 'archived' | 'error' | 'pending' | 'completed';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

const Badge: React.FC<BadgeProps> = ({ status, children, size = 'md' }) => {
  const getStatusStyle = (status: string): CSSProperties => {
    const statusStyles: Record<string, CSSProperties> = {
      active: {
        backgroundColor: 'var(--color-success)',
        color: 'var(--color-bg)',
      },
      paused: {
        backgroundColor: 'var(--color-warning)',
        color: 'var(--color-bg)',
      },
      archived: {
        backgroundColor: 'var(--color-bg-hover)',
        color: 'var(--color-text-tertiary)',
      },
      error: {
        backgroundColor: 'var(--color-danger)',
        color: 'var(--color-bg)',
      },
      pending: {
        backgroundColor: 'var(--color-primary-light)',
        color: 'var(--color-primary)',
      },
      completed: {
        backgroundColor: 'var(--color-success)',
        color: 'var(--color-bg)',
      },
    };
    return statusStyles[status];
  };

  const getDotStyle = (status: string): CSSProperties => {
    const dotStyles: Record<string, CSSProperties> = {
      active: { backgroundColor: 'var(--color-success)' },
      paused: { backgroundColor: 'var(--color-warning)' },
      archived: { backgroundColor: 'var(--color-text-tertiary)' },
      error: { backgroundColor: 'var(--color-danger)' },
      pending: { backgroundColor: 'var(--color-primary)' },
      completed: { backgroundColor: 'var(--color-success)' },
    };
    return dotStyles[status];
  };

  const sizeStyles: Record<string, CSSProperties> = {
    sm: { fontSize: '0.75rem', padding: '0.25rem 0.5rem' },
    md: { fontSize: '0.875rem', padding: '0.375rem 0.75rem' },
  };

  return (
    <span
      className="badge-base"
      style={{
        ...getStatusStyle(status),
        ...sizeStyles[size],
        fontWeight: 600,
        display: 'inline-block',
        borderRadius: '0.375rem',
      }}
    >
      <span style={{
        width: '0.5rem',
        height: '0.5rem',
        borderRadius: '50%',
        marginRight: '0.5rem',
        display: 'inline-block',
      }}>
        <span
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            borderRadius: '50%',
            ...getDotStyle(status),
          }}
        />
      </span>
      {children}
    </span>
  );
};

export default Badge;

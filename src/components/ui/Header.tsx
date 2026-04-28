'use client';

import React, { useState } from 'react';
import Breadcrumb from './Breadcrumb';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
  onProfileClick?: () => void;
  onToggleSidebar?: () => void;
  tenantName?: string;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showSearch = false,
  showNotifications = false,
  onProfileClick,
  onToggleSidebar,
  tenantName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <div className="flex-1">
            <Breadcrumb />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="hidden sm:block relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--color-text-tertiary)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base pl-9 w-56 text-sm"
              />
            </div>
          )}

          {showNotifications && (
            <button
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-danger)' }}
              />
            </button>
          )}

          <button
            onClick={onProfileClick}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
            aria-label="Profile menu"
          >
            <div className="flex flex-col items-end">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>
                {tenantName || 'Tenant'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
                Admin
              </p>
            </div>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
            >
              {tenantName?.charAt(0).toUpperCase() || 'A'}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

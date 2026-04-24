'use client';

import React, { useState, useEffect } from 'react';
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
  showSearch = true,
  showNotifications = true,
  onProfileClick,
  onToggleSidebar,
  tenantName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);

  // Load theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('smartlink-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved === 'dark' || (!saved && prefersDark);
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('smartlink-theme', newDark ? 'dark' : 'light');
  };

  return (
    <header style={{ backgroundColor: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }} className="sticky top-0 z-40">
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

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {showNotifications && (
            <button
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full" />
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
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Admin</p>
            </div>
            <div className="w-8 h-8 logo-gradient rounded-lg flex items-center justify-center text-white font-semibold text-sm">
              {tenantName?.charAt(0).toUpperCase() || 'A'}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

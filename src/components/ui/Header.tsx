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
  showSearch = true,
  showNotifications = true,
  onProfileClick,
  onToggleSidebar,
  tenantName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden text-slate-600 hover:text-slate-900 transition-colors duration-200"
              aria-label="Toggle sidebar"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}

          <div className="flex-1">
            <Breadcrumb />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {showSearch && (
            <div className="hidden sm:block relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base pl-10 w-64"
              />
            </div>
          )}

          {showNotifications && (
            <button
              className="relative text-slate-600 hover:text-slate-900 transition-colors duration-200 p-2 hover:bg-slate-100 rounded-lg"
              aria-label="Notifications"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-danger-600 rounded-full" />
            </button>
          )}

          <button
            onClick={onProfileClick}
            className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors duration-200"
            aria-label="Profile menu"
          >
            <div className="flex flex-col items-end">
              <p className="text-sm font-medium text-slate-900">
                {tenantName || 'Tenant'}
              </p>
              <p className="text-xs text-slate-500">Admin</p>
            </div>
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
              {tenantName?.charAt(0).toUpperCase() || 'A'}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

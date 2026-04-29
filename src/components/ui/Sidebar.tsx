'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboard } from '@/lib/context/DashboardContext';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const pathname = usePathname();
  const { apps, selectedAppId, setSelectedAppId } = useDashboard();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sidebar-collapsed', String(isCollapsed));
    }
  }, [isCollapsed]);

  const navItems: SidebarItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 4l4 2m-9-2l4-2" />
        </svg>
      ),
    },
    {
      label: 'Apps',
      href: '/dashboard/apps',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 18h.01M4 18h.01M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        </svg>
      ),
    },
    {
      label: 'Campaigns',
      href: '/dashboard/campaigns',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
    {
      label: 'Links',
      href: '/dashboard/links',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      label: 'Analytics',
      href: '/dashboard/analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: 'rgba(10, 11, 14, 0.7)' }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 transition-all duration-300 flex flex-col
          lg:static lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderRight: '1px solid var(--color-border)',
          width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? (isCollapsed ? '5rem' : '16rem') : '16rem',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between h-14 px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div
                className="w-8 h-8 flex items-center justify-center"
                style={{ background: 'var(--color-primary)', position: 'relative' }}
              >
                <div style={{ position: 'absolute', inset: 3, background: 'var(--color-bg)' }} />
                <div style={{ position: 'absolute', inset: 6, background: 'var(--color-primary)' }} />
              </div>
              <span className="font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                SmartLink<span style={{ color: 'var(--color-primary)' }}>/</span>
              </span>
            </Link>
          )}
          {isCollapsed && (
            <div
              className="w-8 h-8 mx-auto flex items-center justify-center"
              style={{ background: 'var(--color-primary)', position: 'relative' }}
            >
              <div style={{ position: 'absolute', inset: 3, background: 'var(--color-bg)' }} />
              <div style={{ position: 'absolute', inset: 6, background: 'var(--color-primary)' }} />
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 transition-all duration-200"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* App Switcher */}
        {apps.length > 0 && !isCollapsed && (
          <div
            className="flex-shrink-0 px-4 pt-4 pb-2"
          >
            <button
              className="w-full flex items-center gap-2.5 transition-all duration-200"
              style={{
                padding: '10px 12px',
                border: '1px solid var(--color-border-hover)',
                background: 'var(--color-bg)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={(e) => {
                // Toggle a native select below
                const select = e.currentTarget.nextElementSibling as HTMLSelectElement | null;
                if (select) select.click();
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  background: selectedAppId ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                  flexShrink: 0,
                }}
              />
              <span className="flex-1 text-left truncate" style={{ color: 'var(--color-text)' }}>
                {selectedAppId
                  ? apps.find((a) => a.id === selectedAppId)?.name || 'Select app'
                  : 'All apps'}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)' }}>▾</span>
            </button>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              style={{
                position: 'absolute',
                opacity: 0,
                width: 0,
                height: 0,
                pointerEvents: 'none',
              }}
            >
              <option value="">All apps</option>
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
            {/* Visible native select overlay — cleaner UX */}
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full mt-0"
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                marginTop: -42,
                height: 42,
                opacity: 0,
                cursor: 'pointer',
                width: 'calc(100% - 32px)',
              }}
            >
              <option value="">All apps</option>
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {apps.length > 0 && isCollapsed && (
          <div className="flex-shrink-0 px-2 pt-3 pb-1">
            <div
              className="mx-auto w-8 h-8 flex items-center justify-center cursor-pointer"
              style={{
                background: selectedAppId ? 'var(--color-primary)' : 'var(--color-bg-hover)',
                border: '1px solid var(--color-border-hover)',
                position: 'relative',
              }}
              title={selectedAppId ? apps.find((a) => a.id === selectedAppId)?.name : 'All apps'}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: selectedAppId ? 'var(--color-bg)' : 'var(--color-text-tertiary)' }}>
                {selectedAppId
                  ? (apps.find((a) => a.id === selectedAppId)?.name || 'A').charAt(0).toUpperCase()
                  : '⊡'}
              </span>
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                }}
              >
                <option value="">All apps</option>
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onClose?.()}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
              style={
                isActive(item.href)
                  ? {
                      backgroundColor: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                      fontWeight: 600,
                    }
                  : {
                      color: 'var(--color-text-secondary)',
                    }
              }
              title={isCollapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-sm">{item.label}</span>
                  {item.badge && (
                    <span
                      className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-danger)', color: 'var(--color-bg)' }}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="flex-shrink-0 p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="p-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                // docs
              </h4>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                SDK guides, API reference, and integration tutorials.
              </p>
              <Link
                href="/dashboard/docs"
                className="text-xs font-semibold transition-colors duration-200"
                style={{ color: 'var(--color-primary)' }}
              >
                View docs &rarr;
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;

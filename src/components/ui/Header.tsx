'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import Breadcrumb from './Breadcrumb';
import { useDashboard, type UserRole } from '@/lib/context/DashboardContext';

const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  admin: 'Admin',
  editor: 'Editor',
  analyst: 'Analyst',
};

const ROLE_STYLES: Record<UserRole, { color: string; bg: string; border: string }> = {
  administrator: {
    color: 'var(--color-accent)',
    bg: 'var(--color-danger-light)',
    border: 'rgba(255, 61, 138, 0.24)',
  },
  admin: {
    color: 'var(--color-primary)',
    bg: 'var(--color-primary-light)',
    border: 'rgba(201, 255, 61, 0.24)',
  },
  editor: {
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-light)',
    border: 'rgba(255, 184, 77, 0.24)',
  },
  analyst: {
    color: 'var(--color-secondary)',
    bg: 'rgba(90, 229, 255, 0.12)',
    border: 'rgba(90, 229, 255, 0.24)',
  },
};

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
  const [menuOpen, setMenuOpen] = useState(false);
  const { role, can } = useDashboard();
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [menuOpen]);

  const handleLogout = async () => {
    // Clear all local storage
    localStorage.removeItem('smartlink-api-key');
    localStorage.removeItem('smartlink-tenant');
    localStorage.removeItem('smartlink-role');
    localStorage.removeItem('smartlink-allowed-apps');
    localStorage.removeItem('smartlink-selected-app');
    await signOut();
    router.push('/');
  };

  const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';

  type MenuItem = {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    permission?: string;
    dividerAfter?: boolean;
    danger?: boolean;
    badge?: string;
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Inbox',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
        </svg>
      ),
      onClick: () => { setMenuOpen(false); router.push('/dashboard/inbox'); },
    },
    {
      label: 'Support',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      onClick: () => { setMenuOpen(false); router.push('/dashboard/support'); },
      dividerAfter: true,
    },
    {
      label: 'API Keys',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
      onClick: () => { setMenuOpen(false); router.push('/dashboard/settings?tab=integration'); },
      permission: 'view:api-keys',
    },
    {
      label: 'App Settings',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      onClick: () => { setMenuOpen(false); router.push('/dashboard/settings'); },
      permission: 'manage:settings',
    },
    {
      label: 'Team & Permissions',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      onClick: () => { setMenuOpen(false); router.push('/dashboard/settings?tab=team'); },
      permission: 'manage:team',
      dividerAfter: true,
    },
    {
      label: 'Documentation',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      onClick: () => { setMenuOpen(false); router.push('/dashboard/docs'); },
      dividerAfter: true,
    },
    {
      label: 'Sign out',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      onClick: handleLogout,
      danger: true,
    },
  ];

  // Filter by permission
  const visibleItems = menuItems.filter(
    (item) => !item.permission || can(item.permission)
  );

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
              className="lg:hidden p-2 transition-colors"
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
              className="relative p-2 transition-colors"
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

          {/* Profile button + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 transition-colors"
              aria-label="Profile menu"
              aria-expanded={menuOpen}
            >
              <div className="flex flex-col items-end">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>
                  {tenantName || 'Tenant'}
                </p>
                <p className="text-xs" style={{ color: ROLE_STYLES[role]?.color || 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
                  {ROLE_LABELS[role] || 'Member'}
                </p>
              </div>
              <div
                className="w-8 h-8 flex items-center justify-center font-semibold text-sm"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
              >
                {tenantName?.charAt(0).toUpperCase() || 'A'}
              </div>
              <svg
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: 'var(--color-text-tertiary)',
                  transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: 280,
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--color-border)',
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                {/* User info header */}
                <div
                  style={{
                    padding: '16px 16px 14px',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {tenantName?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        color: 'var(--color-text)',
                        fontFamily: 'var(--font-heading)',
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {tenantName || 'User'}
                      </p>
                      <p style={{
                        color: 'var(--color-text-tertiary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {userEmail}
                      </p>
                    </div>
                  </div>
                  {/* Role badge */}
                  <div style={{ marginTop: 10 }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: ROLE_STYLES[role]?.color || 'var(--color-text-tertiary)',
                      backgroundColor: ROLE_STYLES[role]?.bg || 'var(--color-bg-secondary)',
                      border: `1px solid ${ROLE_STYLES[role]?.border || 'var(--color-border)'}`,
                    }}>
                      {ROLE_LABELS[role] || 'Member'}
                    </span>
                  </div>
                </div>

                {/* Menu items */}
                <div style={{ padding: '6px 0' }}>
                  {visibleItems.map((item, idx) => (
                    <React.Fragment key={item.label}>
                      <button
                        onClick={item.onClick}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          width: '100%',
                          padding: '10px 16px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: item.danger ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                          letterSpacing: '0.02em',
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = item.danger
                            ? 'var(--color-danger-light)'
                            : 'var(--color-bg-hover)';
                          e.currentTarget.style.color = item.danger ? 'var(--color-danger)' : 'var(--color-text)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = item.danger ? 'var(--color-danger)' : 'var(--color-text-secondary)';
                        }}
                      >
                        <span style={{ flexShrink: 0, opacity: 0.7 }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.badge && (
                          <span style={{
                            padding: '2px 7px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'var(--color-text-tertiary)',
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                          }}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                      {item.dividerAfter && idx < visibleItems.length - 1 && (
                        <div style={{
                          height: 1,
                          backgroundColor: 'var(--color-border)',
                          margin: '4px 16px',
                        }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Footer */}
                <div style={{
                  padding: '10px 16px',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    SmartLink v1.0
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    letterSpacing: '0.06em',
                  }}>
                    ⌘K for search
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

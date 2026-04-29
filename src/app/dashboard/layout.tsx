'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/ui/Sidebar';
import Header from '@/components/ui/Header';
import { ToastProvider } from '@/components/ui/Toast';
import { DashboardProvider } from '@/lib/context/DashboardContext';
import { smartLinkApi } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const isSetupPage = pathname === '/dashboard/setup';
  const isDocsPage = pathname === '/dashboard/docs';
  const isFullScreenPage = isSetupPage || isDocsPage;

  useEffect(() => {
    if (!isLoaded) return;

    const apiKey = localStorage.getItem('smartlink-api-key');
    if (apiKey || isFullScreenPage) {
      setReady(true);
      return;
    }

    // No API key in localStorage — try to recover from Clerk session
    // This handles the case where user signs in on a new device
    let recovered = false;
    const timeout = setTimeout(() => {
      if (!recovered) {
        // Recovery took too long — send to setup
        router.replace('/dashboard/setup');
      }
    }, 8000);

    smartLinkApi.getTenantBySession().then((tenant) => {
      recovered = true;
      clearTimeout(timeout);
      if (tenant?.apiKey) {
        // Recovered! Store API key and tenant info locally
        smartLinkApi.setApiKey(tenant.apiKey);
        localStorage.setItem(
          'smartlink-tenant',
          JSON.stringify({ id: tenant.tenantId, name: tenant.name, apiKey: tenant.apiKey })
        );
        // Store role for RBAC
        if (tenant.role) {
          localStorage.setItem('smartlink-role', tenant.role);
        }
        // Store allowed apps for scoping
        if (tenant.allowedApps?.length) {
          localStorage.setItem('smartlink-allowed-apps', JSON.stringify(tenant.allowedApps));
        } else {
          localStorage.removeItem('smartlink-allowed-apps');
        }
        setReady(true);
        // Force a page reload so DashboardContext picks up the new API key
        window.location.reload();
      } else {
        // No tenant found — new user, send to setup
        router.replace('/dashboard/setup');
      }
    }).catch(() => {
      recovered = true;
      clearTimeout(timeout);
      // Recovery failed — send to setup
      router.replace('/dashboard/setup');
    });
  }, [isLoaded, pathname, router, isFullScreenPage]);

  if (!isLoaded || !ready) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 mx-auto mb-4"
            style={{ border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)' }}
          ></div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Setup and docs pages get their own full-screen layout
  if (isFullScreenPage) {
    return (
      <DashboardProvider>
        <ToastProvider>{children}</ToastProvider>
      </DashboardProvider>
    );
  }

  const displayName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'User';

  return (
    <DashboardProvider>
      <ToastProvider>
        <div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <Header
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              tenantName={displayName}
            />

            <main className="flex-1 overflow-y-auto">
              <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </DashboardProvider>
  );
}

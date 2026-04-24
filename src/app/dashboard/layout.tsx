'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/ui/Sidebar';
import Header from '@/components/ui/Header';
import { ToastProvider } from '@/components/ui/Toast';
import { DashboardProvider } from '@/lib/context/DashboardContext';

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

    // Clerk handles auth — if user is here, they're signed in
    // Check if they have an API key configured
    const apiKey = localStorage.getItem('smartlink-api-key');
    if (!apiKey && !isFullScreenPage) {
      router.replace('/dashboard/setup');
    } else {
      setReady(true);
    }
  }, [isLoaded, pathname, router, isFullScreenPage]);

  if (!isLoaded || !ready) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-4"></div>
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

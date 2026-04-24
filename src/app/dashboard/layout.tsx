'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const isSetupPage = pathname === '/dashboard/setup';
  const isDocsPage = pathname === '/dashboard/docs';
  const isFullScreenPage = isSetupPage || isDocsPage;

  // Redirect to setup if no API key (except if already on setup or docs page)
  useEffect(() => {
    const apiKey = localStorage.getItem('smartlink-api-key');
    if (!apiKey && !isFullScreenPage) {
      router.replace('/dashboard/setup');
    } else {
      setReady(true);
    }
  }, [pathname, router, isFullScreenPage]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Setup and docs pages get their own full-screen layout (no sidebar/header)
  if (isFullScreenPage) {
    return (
      <DashboardProvider>
        <ToastProvider>{children}</ToastProvider>
      </DashboardProvider>
    );
  }

  return (
    <DashboardProvider>
      <ToastProvider>
        <div className="flex h-screen bg-slate-50">
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <Header
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              tenantName="AllEvents"
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

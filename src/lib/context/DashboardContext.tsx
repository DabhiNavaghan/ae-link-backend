'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { smartLinkApi } from '@/lib/api';
import { IApp } from '@/types';

interface Tenant {
  id: string;
  name: string;
  email: string;
  apiKey: string;
}

interface AppOption {
  id: string;
  name: string;
}

interface DashboardContextType {
  tenant: Tenant | null;
  setTenant: (tenant: Tenant | null) => void;
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  // App selection
  apps: AppOption[];
  selectedAppId: string;
  setSelectedAppId: (id: string) => void;
  // True once localStorage has been read and apps have been loaded
  isContextReady: boolean;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [isContextReady, setIsContextReady] = useState(false);

  // Initialize from localStorage + fetch apps in one pass
  useEffect(() => {
    const storedApiKey = localStorage.getItem('smartlink-api-key');
    const storedTenant = localStorage.getItem('smartlink-tenant');
    const storedAppId = localStorage.getItem('smartlink-selected-app');

    if (storedApiKey) {
      setApiKey(storedApiKey);
    }

    if (storedTenant) {
      try {
        setTenant(JSON.parse(storedTenant));
      } catch (err) {
        console.error('Failed to parse stored tenant:', err);
      }
    }

    if (storedAppId) {
      setSelectedAppId(storedAppId);
    }

    // Fetch apps immediately if we have an API key, then mark ready
    if (storedApiKey) {
      smartLinkApi
        .listApps({ limit: 100 })
        .then((res) => {
          const appList = (res.apps || []).map((a: any) => ({
            id: a._id?.toString() || a.id,
            name: a.name,
          }));
          setApps(appList);

          // Auto-select first app if none selected yet
          if (!storedAppId && appList.length > 0) {
            setSelectedAppId(appList[0].id);
            localStorage.setItem('smartlink-selected-app', appList[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setIsContextReady(true));
    } else {
      setIsContextReady(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTenant = useCallback((t: Tenant | null) => {
    setTenant(t);
    if (t) {
      localStorage.setItem('smartlink-tenant', JSON.stringify(t));
    } else {
      localStorage.removeItem('smartlink-tenant');
    }
  }, []);

  const updateApiKey = useCallback((key: string | null) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('smartlink-api-key', key);
    } else {
      localStorage.removeItem('smartlink-api-key');
    }
  }, []);

  const updateSelectedAppId = useCallback((id: string) => {
    setSelectedAppId(id);
    if (id) {
      localStorage.setItem('smartlink-selected-app', id);
    } else {
      localStorage.removeItem('smartlink-selected-app');
    }
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        tenant,
        setTenant: updateTenant,
        apiKey,
        setApiKey: updateApiKey,
        isLoading,
        setIsLoading,
        apps,
        selectedAppId,
        setSelectedAppId: updateSelectedAppId,
        isContextReady,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
};

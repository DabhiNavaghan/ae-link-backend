'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { smartLinkApi } from '@/lib/api';
import { IApp } from '@/types';

export type UserRole = 'administrator' | 'admin' | 'editor' | 'analyst';

/** Permission map — what each role can do */
const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  administrator: new Set([
    'view:dashboard', 'view:analytics',
    'manage:apps', 'manage:campaigns', 'manage:links',
    'manage:settings', 'manage:team', 'manage:billing', 'view:api-keys',
  ]),
  admin: new Set([
    'view:dashboard', 'view:analytics',
    'manage:apps', 'manage:campaigns', 'manage:links',
    'manage:settings', 'view:api-keys',
  ]),
  editor: new Set([
    'view:dashboard', 'view:analytics',
    'manage:campaigns', 'manage:links',
  ]),
  analyst: new Set([
    'view:dashboard', 'view:analytics',
  ]),
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  apiKey: string;
}

interface AppOption {
  id: string;
  name: string;
  slug?: string;
  androidStoreUrl?: string;
  iosStoreUrl?: string;
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
  // Role-based access
  role: UserRole;
  can: (permission: string) => boolean;
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
  const [role, setRole] = useState<UserRole>('administrator');

  const can = useCallback((permission: string) => hasPermission(role, permission), [role]);

  // Initialize from localStorage + fetch apps in one pass
  useEffect(() => {
    const storedApiKey = localStorage.getItem('smartlink-api-key');
    const storedTenant = localStorage.getItem('smartlink-tenant');
    const storedAppId = localStorage.getItem('smartlink-selected-app');
    const storedRole = localStorage.getItem('smartlink-role') as UserRole | null;
    if (storedRole && ROLE_PERMISSIONS[storedRole]) {
      setRole(storedRole);
    }

    if (storedApiKey) {
      setApiKey(storedApiKey);
      // Ensure the singleton API client also has the key
      smartLinkApi.setApiKey(storedApiKey);
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

    // Parse allowed apps for scoping (empty = all apps)
    let storedAllowedApps: string[] = [];
    try {
      const raw = localStorage.getItem('smartlink-allowed-apps');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) storedAllowedApps = parsed;
      }
    } catch {}

    // Fetch apps immediately if we have an API key, then mark ready
    if (storedApiKey) {
      // Safety: ensure context is ready even if listApps hangs
      const safetyTimer = setTimeout(() => setIsContextReady(true), 10000);

      const applyAppList = (res: any) => {
        let appList = (res.apps || []).map((a: any) => ({
          id: a._id?.toString() || a.id,
          name: a.name,
          slug: a.slug || null,
          androidStoreUrl: a.android?.storeUrl || '',
          iosStoreUrl: a.ios?.storeUrl || '',
        }));

        if (storedAllowedApps.length > 0) {
          const allowedSet = new Set(storedAllowedApps);
          appList = appList.filter((a: any) => allowedSet.has(a.id));
        }

        setApps(appList);

        const storedStillValid = storedAppId && appList.some((a: any) => a.id === storedAppId);
        if (!storedStillValid && appList.length > 0) {
          setSelectedAppId(appList[0].id);
          localStorage.setItem('smartlink-selected-app', appList[0].id);
        }
      };

      smartLinkApi
        .listApps({ limit: 100 })
        .then(applyAppList)
        .catch(async (err: any) => {
          // Stale/invalid key — recover the real key from Clerk session then retry
          if (err?.status === 401) {
            try {
              const recovered = await smartLinkApi.getTenantBySession();
              if (recovered?.apiKey) {
                localStorage.setItem('smartlink-api-key', recovered.apiKey);
                smartLinkApi.setApiKey(recovered.apiKey);
                setApiKey(recovered.apiKey);
                if (recovered.tenantId) {
                  const tenantData = { id: recovered.tenantId, name: recovered.name, email: '', apiKey: recovered.apiKey };
                  setTenant(tenantData);
                  localStorage.setItem('smartlink-tenant', JSON.stringify(tenantData));
                }
                const res = await smartLinkApi.listApps({ limit: 100 });
                applyAppList(res);
              }
            } catch {
              // Recovery failed — let the app handle the unauthenticated state
            }
          }
        })
        .finally(() => {
          clearTimeout(safetyTimer);
          setIsContextReady(true);
        });
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
      smartLinkApi.setApiKey(key);
    } else {
      localStorage.removeItem('smartlink-api-key');
      smartLinkApi.clearApiKey();
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
        role,
        can,
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

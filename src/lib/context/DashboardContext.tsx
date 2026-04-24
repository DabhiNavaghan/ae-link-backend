'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface Tenant {
  id: string;
  name: string;
  email: string;
  apiKey: string;
}

interface DashboardContextType {
  tenant: Tenant | null;
  setTenant: (tenant: Tenant | null) => void;
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize from localStorage
  React.useEffect(() => {
    const storedApiKey = localStorage.getItem('smartlink-api-key');
    const storedTenant = localStorage.getItem('smartlink-tenant');

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
  }, []);

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

  return (
    <DashboardContext.Provider
      value={{
        tenant,
        setTenant: updateTenant,
        apiKey,
        setApiKey: updateApiKey,
        isLoading,
        setIsLoading,
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

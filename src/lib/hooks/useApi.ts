import { useState, useCallback, useRef, useEffect } from 'react';
import { useDashboard } from '@/lib/context/DashboardContext';

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export const useApi = () => {
  const { apiKey } = useDashboard();

  const apiCall = useCallback(
    async (
      endpoint: string,
      options: RequestInit = {},
      customApiKey?: string
    ) => {
      const key = customApiKey || apiKey;
      if (!key) {
        throw new Error('API key not configured');
      }

      const response = await fetch(`/api/v1${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': key,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return response.json();
    },
    [apiKey]
  );

  return { apiCall };
};

export const useTenant = () => {
  const { apiCall } = useApi();
  const [tenant, setTenant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTenant = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiCall('/tenants');
      setTenant(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch tenant');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  const updateTenant = useCallback(
    async (updates: Record<string, any>) => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall('/tenants', {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        setTenant(data);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update tenant');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall]
  );

  return { tenant, isLoading, error, fetchTenant, updateTenant };
};

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export const useCampaigns = () => {
  const { apiCall } = useApi();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<{ campaigns: Campaign[]; timestamp: number } | null>(null);

  const fetchCampaigns = useCallback(async (useCache = true) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check cache (5 minute TTL)
      if (useCache && cacheRef.current && Date.now() - cacheRef.current.timestamp < 5 * 60 * 1000) {
        setCampaigns(cacheRef.current.campaigns);
        return cacheRef.current.campaigns;
      }

      const data = await apiCall('/campaigns');
      const campaignsList = Array.isArray(data) ? data : data.campaigns || [];

      cacheRef.current = {
        campaigns: campaignsList,
        timestamp: Date.now(),
      };

      setCampaigns(campaignsList);
      return campaignsList;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch campaigns');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  const createCampaign = useCallback(
    async (campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall('/campaigns', {
          method: 'POST',
          body: JSON.stringify(campaign),
        });

        setCampaigns((prev) => [...prev, data]);
        cacheRef.current = null; // Invalidate cache

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create campaign');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall]
  );

  const updateCampaign = useCallback(
    async (id: string, updates: Partial<Campaign>) => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall(`/campaigns/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });

        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? data : c))
        );
        cacheRef.current = null; // Invalidate cache

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update campaign');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall]
  );

  const deleteCampaign = useCallback(
    async (id: string) => {
      try {
        setIsLoading(true);
        setError(null);
        await apiCall(`/campaigns/${id}`, {
          method: 'DELETE',
        });

        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        cacheRef.current = null; // Invalidate cache
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete campaign');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall]
  );

  return {
    campaigns,
    isLoading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    refetch: () => fetchCampaigns(false),
  };
};

interface Link {
  id: string;
  shortCode: string;
  destinationUrl: string;
  campaignId?: string;
  status: 'active' | 'paused' | 'archived';
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

export const useLinks = () => {
  const { apiCall } = useApi();
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<{ links: Link[]; timestamp: number } | null>(null);

  const fetchLinks = useCallback(async (useCache = true) => {
    try {
      setIsLoading(true);
      setError(null);

      if (useCache && cacheRef.current && Date.now() - cacheRef.current.timestamp < 5 * 60 * 1000) {
        setLinks(cacheRef.current.links);
        return cacheRef.current.links;
      }

      const data = await apiCall('/links');
      const linksList = Array.isArray(data) ? data : data.links || [];

      cacheRef.current = {
        links: linksList,
        timestamp: Date.now(),
      };

      setLinks(linksList);
      return linksList;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch links');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  const createLink = useCallback(
    async (link: Omit<Link, 'id' | 'clicks' | 'createdAt' | 'updatedAt'>) => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall('/links', {
          method: 'POST',
          body: JSON.stringify(link),
        });

        setLinks((prev) => [...prev, data]);
        cacheRef.current = null;

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create link');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall]
  );

  const updateLink = useCallback(
    async (id: string, updates: Partial<Link>) => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall(`/links/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });

        setLinks((prev) =>
          prev.map((l) => (l.id === id ? data : l))
        );
        cacheRef.current = null;

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update link');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall]
  );

  const deleteLink = useCallback(
    async (id: string) => {
      try {
        setIsLoading(true);
        setError(null);
        await apiCall(`/links/${id}`, {
          method: 'DELETE',
        });

        setLinks((prev) => prev.filter((l) => l.id !== id));
        cacheRef.current = null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete link');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall]
  );

  return {
    links,
    isLoading,
    error,
    fetchLinks,
    createLink,
    updateLink,
    deleteLink,
    refetch: () => fetchLinks(false),
  };
};

interface Analytics {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  topLinks: Link[];
  topCampaigns: Campaign[];
}

export const useAnalytics = () => {
  const { apiCall } = useApi();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<{ analytics: Analytics; timestamp: number } | null>(null);

  const fetchAnalytics = useCallback(async (useCache = true) => {
    try {
      setIsLoading(true);
      setError(null);

      if (useCache && cacheRef.current && Date.now() - cacheRef.current.timestamp < 1 * 60 * 1000) {
        setAnalytics(cacheRef.current.analytics);
        return cacheRef.current.analytics;
      }

      const data = await apiCall('/analytics/overview');

      cacheRef.current = {
        analytics: data,
        timestamp: Date.now(),
      };

      setAnalytics(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch analytics');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  return {
    analytics,
    isLoading,
    error,
    fetchAnalytics,
    refetch: () => fetchAnalytics(false),
  };
};

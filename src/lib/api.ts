'use client';

import {
  ITenant,
  IApp,
  ICampaign,
  ILink,
  DashboardOverview,
  LinkAnalytics,
  CampaignAnalytics,
  RegisterTenantDto,
  CreateAppDto,
  UpdateAppDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  CreateLinkDto,
  UpdateLinkDto,
  ApiResponse,
} from '@/types';

export class AeLinkApi {
  private baseUrl: string;
  private apiKey: string | null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
    // Get API key from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem('smartlink-api-key');
    } else {
      this.apiKey = null;
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartlink-api-key', apiKey);
    }
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smartlink-api-key');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Merge existing headers if they are a plain object
    if (options.headers && typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
      Object.assign(headers, options.headers as Record<string, string>);
    }

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        errorData?.error?.message || `API Error: ${response.status}`
      );
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response.json();
  }

  // ============================================================================
  // Tenant Methods
  // ============================================================================

  async registerTenant(data: RegisterTenantDto): Promise<ITenant> {
    const response = await this.request<ApiResponse<ITenant>>(
      '/tenants',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    if (response.data?.apiKey) {
      this.setApiKey(response.data.apiKey);
    }
    return response.data as ITenant;
  }

  async getTenant(): Promise<ITenant> {
    const response = await this.request<ApiResponse<ITenant>>(
      '/tenants',
      {
        method: 'GET',
      }
    );
    return response.data as ITenant;
  }

  async updateTenant(
    _tenantId: string,
    data: Partial<ITenant>
  ): Promise<ITenant> {
    const response = await this.request<ApiResponse<ITenant>>(
      '/tenants',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data as ITenant;
  }

  async regenerateApiKey(): Promise<{ apiKey: string }> {
    const response = await this.request<ApiResponse<{ apiKey: string }>>(
      '/tenants/regenerate-key',
      { method: 'POST' }
    );
    const newKey = response.data?.apiKey;
    if (newKey) {
      this.setApiKey(newKey);
    }
    return response.data as { apiKey: string };
  }

  // ============================================================================
  // App Methods
  // ============================================================================

  async createApp(data: CreateAppDto): Promise<IApp> {
    const response = await this.request<ApiResponse<IApp>>('/apps', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data as IApp;
  }

  async listApps(
    params?: Record<string, any>
  ): Promise<{ apps: IApp[]; total: number }> {
    const queryString = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });
    }
    const endpoint = `/apps${queryString.toString() ? '?' + queryString.toString() : ''}`;
    const response = await this.request<
      ApiResponse<{ apps: IApp[]; total: number }>
    >(endpoint, { method: 'GET' });
    return response.data as { apps: IApp[]; total: number };
  }

  async getApp(id: string): Promise<IApp> {
    const response = await this.request<ApiResponse<IApp>>(
      `/apps/${id}`,
      { method: 'GET' }
    );
    return response.data as IApp;
  }

  async updateApp(id: string, data: UpdateAppDto): Promise<IApp> {
    const response = await this.request<ApiResponse<IApp>>(
      `/apps/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data as IApp;
  }

  async deleteApp(id: string): Promise<void> {
    await this.request(`/apps/${id}`, { method: 'DELETE' });
  }

  // ============================================================================
  // Campaign Methods
  // ============================================================================

  async createCampaign(data: CreateCampaignDto): Promise<ICampaign> {
    const response = await this.request<ApiResponse<ICampaign>>(
      '/campaigns',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data as ICampaign;
  }

  async listCampaigns(
    params?: Record<string, any>
  ): Promise<{ campaigns: ICampaign[]; total: number }> {
    const queryString = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });
    }

    const endpoint = `/campaigns${queryString.toString() ? '?' + queryString.toString() : ''}`;
    const response = await this.request<
      ApiResponse<{ campaigns: ICampaign[]; total: number }>
    >(endpoint, { method: 'GET' });
    return response.data as { campaigns: ICampaign[]; total: number };
  }

  async getCampaign(id: string): Promise<ICampaign> {
    const response = await this.request<ApiResponse<ICampaign>>(
      `/campaigns/${id}`,
      { method: 'GET' }
    );
    return response.data as ICampaign;
  }

  async updateCampaign(
    id: string,
    data: UpdateCampaignDto
  ): Promise<ICampaign> {
    const response = await this.request<ApiResponse<ICampaign>>(
      `/campaigns/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data as ICampaign;
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.request(`/campaigns/${id}`, { method: 'DELETE' });
  }

  // ============================================================================
  // Link Methods
  // ============================================================================

  async createLink(data: CreateLinkDto): Promise<ILink> {
    const response = await this.request<ApiResponse<ILink>>(
      '/links',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data as ILink;
  }

  async listLinks(
    params?: Record<string, any>
  ): Promise<{ links: ILink[]; total: number }> {
    const queryString = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });
    }

    const endpoint = `/links${queryString.toString() ? '?' + queryString.toString() : ''}`;
    const response = await this.request<
      ApiResponse<{ links: ILink[]; total: number }>
    >(endpoint, { method: 'GET' });
    return response.data as { links: ILink[]; total: number };
  }

  async getLink(id: string): Promise<ILink> {
    const response = await this.request<ApiResponse<ILink>>(
      `/links/${id}`,
      { method: 'GET' }
    );
    return response.data as ILink;
  }

  async updateLink(id: string, data: UpdateLinkDto): Promise<ILink> {
    const response = await this.request<ApiResponse<ILink>>(
      `/links/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data as ILink;
  }

  async deleteLink(id: string): Promise<void> {
    await this.request(`/links/${id}`, { method: 'DELETE' });
  }

  // ============================================================================
  // Analytics Methods
  // ============================================================================

  async getOverview(): Promise<DashboardOverview> {
    const response = await this.request<ApiResponse<DashboardOverview>>(
      '/analytics/overview',
      { method: 'GET' }
    );
    return response.data as DashboardOverview;
  }

  async getLinkAnalytics(id: string): Promise<LinkAnalytics> {
    const response = await this.request<ApiResponse<LinkAnalytics>>(
      `/analytics/links/${id}`,
      { method: 'GET' }
    );
    return response.data as LinkAnalytics;
  }

  async getCampaignAnalytics(id: string): Promise<CampaignAnalytics> {
    const response = await this.request<ApiResponse<CampaignAnalytics>>(
      `/analytics/campaigns/${id}`,
      { method: 'GET' }
    );
    return response.data as CampaignAnalytics;
  }
}

// Export singleton instance
export const aeLinkApi = new AeLinkApi();

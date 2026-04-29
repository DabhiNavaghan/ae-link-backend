'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { smartLinkApi } from '@/lib/api';

interface TenantSettings {
  name: string;
  domain: string;
  defaultFallbackUrl?: string;
  apiKey?: string;
  tenantId?: string;
  android?: {
    package: string;
    sha256: string;
    storeUrl: string;
  };
  ios?: {
    bundleId: string;
    teamId: string;
    appId: string;
    storeUrl: string;
  };
  fingerprintTtlHours: number;
  matchThreshold: number;
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<TenantSettings>({
    name: '',
    domain: '',
    fingerprintTtlHours: 6,
    matchThreshold: 60,
    android: {
      package: '',
      sha256: '',
      storeUrl: '',
    },
    ios: {
      bundleId: '',
      teamId: '',
      appId: '',
      storeUrl: '',
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'team' | 'app' | 'deep-link' | 'integration' | 'danger'>('general');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const { user } = useUser();

  // Team state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('editor');
  const [inviting, setInviting] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  const fetchTeamMembers = useCallback(async () => {
    try {
      setTeamLoading(true);
      const data = await smartLinkApi.listTeamMembers();
      setTeamMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load team members', err);
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'team') {
      fetchTeamMembers();
    }
  }, [activeTab, fetchTeamMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    const currentEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    if (currentEmail && inviteEmail.trim().toLowerCase() === currentEmail) {
      setMessage({ type: 'error', text: 'You cannot invite yourself' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    try {
      setInviting(true);
      await smartLinkApi.inviteTeamMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        inviterName: user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Team admin',
      });
      setInviteEmail('');
      setMessage({ type: 'success', text: `Invite sent to ${inviteEmail.trim()}` });
      setTimeout(() => setMessage(null), 3000);
      fetchTeamMembers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.data?.error?.message || err.message || 'Failed to send invite' });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      await smartLinkApi.updateTeamMember(memberId, { role: newRole });
      setEditingRole(null);
      setMessage({ type: 'success', text: 'Role updated' });
      setTimeout(() => setMessage(null), 2000);
      fetchTeamMembers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update role' });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await smartLinkApi.removeTeamMember(memberId);
      setRemoveConfirm(null);
      setMessage({ type: 'success', text: 'Team member removed' });
      setTimeout(() => setMessage(null), 2000);
      fetchTeamMembers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove member' });
    }
  };

  const handleResendInvite = async (member: any) => {
    try {
      setResendingInvite(member._id);
      await smartLinkApi.inviteTeamMember({
        email: member.email,
        role: member.role,
        inviterName: user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Team admin',
      });
      setMessage({ type: 'success', text: `Invite resent to ${member.email}` });
      setTimeout(() => setMessage(null), 3000);
      fetchTeamMembers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.data?.error?.message || err.message || 'Failed to resend invite' });
    } finally {
      setResendingInvite(null);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const tenant = await smartLinkApi.getTenant();
      setSettings({
        name: tenant.name || '',
        domain: tenant.domain || '',
        defaultFallbackUrl: (tenant as any).settings?.defaultFallbackUrl || '',
        apiKey: smartLinkApi.getApiKey() || '',
        tenantId: (tenant as any)._id || (tenant as any).tenantId || '',
        android: (tenant as any).app?.android || {
          package: '',
          sha256: '',
          storeUrl: '',
        },
        ios: (tenant as any).app?.ios || {
          bundleId: '',
          teamId: '',
          appId: '',
          storeUrl: '',
        },
        fingerprintTtlHours: (tenant as any).settings?.fingerprintTtlHours || 6,
        matchThreshold: (tenant as any).settings?.matchThreshold || 60,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tenantId = settings.tenantId;
      if (!tenantId) throw new Error('Tenant ID not found');

      await smartLinkApi.updateTenant(tenantId, {
        name: settings.name,
        settings: {
          defaultFallbackUrl: settings.defaultFallbackUrl || '',
          fingerprintTtlHours: settings.fingerprintTtlHours,
          matchThreshold: settings.matchThreshold,
        },
        app: {
          android: settings.android,
          ios: settings.ios,
        },
      } as any);

      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    try {
      const result = await smartLinkApi.regenerateApiKey();
      setSettings({ ...settings, apiKey: result.apiKey });
      setMessage({ type: 'success', text: 'API key regenerated. The old key no longer works.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to regenerate key',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard' });
    setTimeout(() => setMessage(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3"></div>
          <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: 'var(--color-text)' }} className="text-3xl font-bold mb-2">Settings</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Configure your SmartLink app and deep linking preferences.</p>
      </div>

      {/* Messages */}
      {message && (
        <div
          style={{
            backgroundColor: message.type === 'success' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 61, 138, 0.12)',
            borderColor: message.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 61, 138, 0.3)',
            color: message.type === 'success' ? '#4ADE80' : '#FF3D8A'
          }}
          className="card p-4 mb-6"
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="card border-b mb-6 flex overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
        {[
          { key: 'general', label: 'General' },
          { key: 'team', label: 'Team' },
          { key: 'app', label: 'App Config' },
          { key: 'deep-link', label: 'Deep Link' },
          { key: 'integration', label: 'Integration' },
          { key: 'danger', label: 'Danger zone' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary-500'
                : 'border-transparent'
            }`}
            style={{
              color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                App Name
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={e => setSettings({ ...settings, name: e.target.value })}
                className="input-base"
                placeholder="AllEvents"
              />
            </div>

            <div>
              <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                Domain
              </label>
              <input
                type="text"
                value={settings.domain}
                disabled
                style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', cursor: 'not-allowed' }}
                className="input-base"
              />
              <p style={{ color: 'var(--color-text-tertiary)' }} className="text-xs mt-1">Domain cannot be changed after registration.</p>
            </div>

            <div>
              <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                Default Fallback URL
              </label>
              <input
                type="url"
                value={settings.defaultFallbackUrl || ''}
                onChange={e =>
                  setSettings({ ...settings, defaultFallbackUrl: e.target.value })
                }
                className="input-base"
                placeholder="https://allevents.in"
              />
              <p style={{ color: 'var(--color-text-tertiary)' }} className="text-xs mt-1">
                Where to redirect users when the app is not installed and no store URL is configured.
              </p>
            </div>

            <div>
              <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                API Key
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.apiKey || ''}
                  disabled
                  style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', cursor: 'not-allowed' }}
                  className="input-base flex-1 font-mono text-sm"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
                  className="px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:opacity-80"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => copyToClipboard(settings.apiKey || '')}
                  style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
                  className="px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:opacity-90"
                >
                  Copy
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleRegenerateKey}
                  style={{ color: 'var(--color-danger)' }}
                  className="text-sm hover:opacity-80 font-medium"
                >
                  Regenerate API Key
                </button>
                <span style={{ color: 'var(--color-text-tertiary)' }} className="text-xs">
                  Warning: this will invalidate the current key immediately.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Team Management */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            {/* Invite Form */}
            <div>
              <h3 style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 16 }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>01</span>
                // invite member
              </h3>
              <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', padding: 20 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 240px' }}>
                    <label style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                      email
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="input-base"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    />
                  </div>
                  <div style={{ flex: '0 0 180px' }}>
                    <label style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                      role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="input-base"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer' }}
                    >
                      <option value="administrator">Administrator</option>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="analyst">Data Analyst</option>
                    </select>
                  </div>
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    style={{
                      background: 'var(--color-primary)',
                      color: '#000',
                      border: 'none',
                      padding: '11px 24px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                      opacity: inviting || !inviteEmail.trim() ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inviting ? 'Sending...' : '→ Send Invite'}
                  </button>
                </div>
                <p style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 12 }}>
                  Invite expires in 7 days. The invited user will receive an email with a link to accept.
                </p>
              </div>
            </div>

            {/* Role descriptions */}
            <div>
              <h3 style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 16 }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>02</span>
                // roles
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {[
                  { role: 'Administrator', color: '#FF3D8A', desc: 'Full access to everything including billing and team management' },
                  { role: 'Admin', color: '#C9FF3D', desc: 'Manage apps, campaigns, links, and settings' },
                  { role: 'Editor', color: '#FFB84D', desc: 'Create and edit campaigns & links, view analytics' },
                  { role: 'Data Analyst', color: '#7DD3FC', desc: 'View-only access to dashboard and analytics' },
                ].map(r => (
                  <div key={r.role} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 6, height: 6, background: r.color, display: 'inline-block' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: r.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {r.role}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      {r.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Team members table */}
            <div>
              <h3 style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 16 }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>03</span>
                // team members
              </h3>
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                {teamLoading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    Loading team members...
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    No team members yet. Send your first invite above.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['email', 'role', 'status', 'invited', ''].map(h => (
                          <th key={h} style={{
                            textAlign: 'left',
                            padding: '12px 16px',
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.16em',
                            color: 'var(--color-text-tertiary)',
                            fontWeight: 500,
                            borderBottom: '1px solid var(--color-border)',
                            background: 'var(--color-bg-secondary)',
                            whiteSpace: 'nowrap',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member: any) => {
                        const roleColors: Record<string, string> = {
                          administrator: '#FF3D8A',
                          admin: '#C9FF3D',
                          editor: '#FFB84D',
                          analyst: '#7DD3FC',
                        };
                        const statusColors: Record<string, { bg: string; text: string }> = {
                          pending: { bg: 'rgba(255, 184, 77, 0.15)', text: '#FFB84D' },
                          accepted: { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ADE80' },
                          expired: { bg: 'rgba(122, 130, 144, 0.15)', text: '#7A8290' },
                          revoked: { bg: 'rgba(255, 61, 138, 0.15)', text: '#FF3D8A' },
                        };
                        const sc = statusColors[member.status] || statusColors.pending;
                        const isEditing = editingRole === member._id;

                        return (
                          <tr key={member._id} style={{ transition: 'background 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                              <div>
                                {member.name && <span style={{ display: 'block', fontWeight: 500 }}>{member.name}</span>}
                                <span style={{ color: member.name ? 'var(--color-text-secondary)' : 'var(--color-text)', fontSize: member.name ? 11 : 12 }}>{member.email}</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                              {isEditing ? (
                                <select
                                  defaultValue={member.role}
                                  onChange={e => handleUpdateRole(member._id, e.target.value)}
                                  onBlur={() => setEditingRole(null)}
                                  autoFocus
                                  style={{
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--color-primary)',
                                    color: 'var(--color-text)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 11,
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <option value="administrator">Administrator</option>
                                  <option value="admin">Admin</option>
                                  <option value="editor">Editor</option>
                                  <option value="analyst">Data Analyst</option>
                                </select>
                              ) : (
                                <span
                                  onClick={() => setEditingRole(member._id)}
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: roleColors[member.role] || 'var(--color-text)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    cursor: 'pointer',
                                    padding: '3px 8px',
                                    border: `1px solid ${roleColors[member.role] || 'var(--color-border)'}`,
                                    display: 'inline-block',
                                  }}
                                  title="Click to change role"
                                >
                                  {member.role === 'analyst' ? 'data analyst' : member.role}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                padding: '3px 8px',
                                background: sc.bg,
                                color: sc.text,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}>
                                <span style={{ width: 5, height: 5, background: sc.text, display: 'inline-block' }} />
                                {member.status}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: 11 }}>
                              {new Date(member.invitedAt || member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                              {removeConfirm === member._id ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    onClick={() => handleRemoveMember(member._id)}
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', background: '#FF3D8A', color: '#fff', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                                  >
                                    confirm
                                  </button>
                                  <button
                                    onClick={() => setRemoveConfirm(null)}
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                                  >
                                    cancel
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  {(member.status === 'pending' || member.status === 'expired') && (
                                    <button
                                      onClick={() => handleResendInvite(member)}
                                      disabled={resendingInvite === member._id}
                                      style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 10,
                                        padding: '4px 10px',
                                        background: 'transparent',
                                        color: 'var(--color-primary)',
                                        border: '1px solid var(--color-primary)',
                                        cursor: resendingInvite === member._id ? 'not-allowed' : 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        opacity: resendingInvite === member._id ? 0.5 : 1,
                                        whiteSpace: 'nowrap',
                                      }}
                                      title="Resend invite email"
                                    >
                                      {resendingInvite === member._id ? '...' : '↻ resend'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setRemoveConfirm(member._id)}
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 8px', color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                    title="Remove member"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* App Configuration */}
        {activeTab === 'app' && (
          <div className="space-y-8">
            {/* Android */}
            <div className="border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
              <h3 style={{ color: 'var(--color-text)' }} className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#4ADE80">
                  <path d="M17.523 15.341c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.901.402.901.902-.401.902-.901.902zm-11.046 0c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.902.402.902.902-.402.902-.902.902zm11.4-6.052l1.997-3.46a.416.416 0 00-.152-.567.416.416 0 00-.568.152L17.12 8.93c-1.46-.67-3.1-1.044-5.12-1.044s-3.66.374-5.12 1.044L4.846 5.414a.416.416 0 00-.568-.152.416.416 0 00-.152.567l1.997 3.46C2.688 11.186.343 14.654 0 18.76h24c-.343-4.106-2.688-7.574-6.123-9.471z" />
                </svg>
                Android
              </h3>
              <div className="space-y-4">
                <div>
                  <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                    Package Name
                  </label>
                  <input
                    type="text"
                    value={settings.android?.package || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        android: { ...settings.android!, package: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="com.amitech.allevents"
                  />
                  <p style={{ color: 'var(--color-text-tertiary)' }} className="text-xs mt-1">Found in app/build.gradle under applicationId</p>
                </div>

                <div>
                  <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                    SHA256 Certificate Fingerprint
                  </label>
                  <textarea
                    value={settings.android?.sha256 || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        android: { ...settings.android!, sha256: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="23:C6:3D:23:1E:87:..."
                    rows={3}
                  />
                  <p style={{ color: 'var(--color-text-tertiary)' }} className="text-xs mt-1">Run ./gradlew signingReport in Android Studio terminal, or find in Google Play Console &gt; App Signing</p>
                </div>

                <div>
                  <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                    Play Store URL
                  </label>
                  <input
                    type="url"
                    value={settings.android?.storeUrl || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        android: { ...settings.android!, storeUrl: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="https://play.google.com/store/apps/details?id=com.amitech.allevents"
                  />
                </div>
              </div>
            </div>

            {/* iOS */}
            <div>
              <h3 style={{ color: 'var(--color-text)' }} className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--color-text)' }}>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                iOS
              </h3>
              <div className="space-y-4">
                <div>
                  <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                    Bundle ID
                  </label>
                  <input
                    type="text"
                    value={settings.ios?.bundleId || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        ios: { ...settings.ios!, bundleId: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="com.amitech.allevents"
                  />
                  <p style={{ color: 'var(--color-text-tertiary)' }} className="text-xs mt-1">Xcode &gt; Target &gt; General &gt; Bundle Identifier</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                      Team ID
                    </label>
                    <input
                      type="text"
                      value={settings.ios?.teamId || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          ios: { ...settings.ios!, teamId: e.target.value },
                        })
                      }
                      className="input-base"
                      placeholder="53V82MSR2T"
                    />
                    <p style={{ color: 'var(--color-text-tertiary)' }} className="text-xs mt-1">developer.apple.com &gt; Membership</p>
                  </div>

                  <div>
                    <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                      App Store ID
                    </label>
                    <input
                      type="text"
                      value={settings.ios?.appId || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          ios: { ...settings.ios!, appId: e.target.value },
                        })
                      }
                      className="input-base"
                      placeholder="488116646"
                    />
                    <p style={{ color: 'var(--color-text-tertiary)' }} className="text-xs mt-1">App Store Connect &gt; General &gt; Apple ID</p>
                  </div>
                </div>

                <div>
                  <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                    App Store URL
                  </label>
                  <input
                    type="url"
                    value={settings.ios?.storeUrl || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        ios: { ...settings.ios!, storeUrl: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="https://apps.apple.com/app/id488116646"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deep Link Settings */}
        {activeTab === 'deep-link' && (
          <div className="space-y-6">
            <div>
              <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                Fingerprint TTL (hours)
              </label>
              <input
                type="number"
                value={settings.fingerprintTtlHours}
                onChange={e =>
                  setSettings({
                    ...settings,
                    fingerprintTtlHours: Math.min(
                      168,
                      Math.max(1, parseInt(e.target.value) || 1)
                    ),
                  })
                }
                min="1"
                max="168"
                className="input-base"
              />
              <p style={{ color: 'var(--color-text-tertiary)' }} className="text-xs mt-2">
                How long to keep device fingerprints for deferred link matching (1-168 hours). Default: 72 hours.
              </p>
              <div style={{ backgroundColor: 'var(--color-primary-light)', borderColor: 'var(--color-border)' }} className="mt-4 p-3 rounded-lg border">
                <p style={{ color: 'var(--color-text)' }} className="text-sm">
                  <strong>About fingerprints:</strong> Device fingerprints help match
                  deferred deep links by capturing device characteristics (IP, user agent,
                  screen properties). Longer TTLs allow more matches but use more storage.
                </p>
              </div>
            </div>

            <div>
              <label style={{ color: 'var(--color-text)' }} className="block text-sm font-medium mb-2">
                Match Threshold (points)
              </label>
              <input
                type="range"
                value={settings.matchThreshold}
                onChange={e =>
                  setSettings({
                    ...settings,
                    matchThreshold: parseInt(e.target.value),
                  })
                }
                min="50"
                max="100"
                step="5"
                className="w-full"
              />
              <div className="mt-2 flex justify-between items-center">
                <span style={{ color: 'var(--color-text)' }} className="text-sm font-semibold">
                  {settings.matchThreshold} points
                </span>
                <span style={{ color: 'var(--color-text-tertiary)' }} className="text-xs">Recommended: 70</span>
              </div>
              <div style={{ backgroundColor: 'var(--color-primary-light)', borderColor: 'var(--color-border)' }} className="mt-4 p-3 rounded-lg border">
                <p style={{ color: 'var(--color-text)' }} className="text-sm">
                  <strong>Match threshold:</strong> Minimum confidence score required to
                  confirm a deferred link match. Lower values = more matches but less
                  accurate. Higher values = fewer matches but very reliable.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Integration Guide */}
        {activeTab === 'integration' && (
          <div className="space-y-6">
            <div>
              <h3 style={{ color: 'var(--color-text)' }} className="text-lg font-semibold mb-4">Flutter SDK</h3>
              <div style={{ backgroundColor: 'var(--color-bg-secondary)' }} className="p-4 rounded-lg overflow-x-auto">
                <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm mb-2">Create <code style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text)' }} className="px-1 py-0.5 rounded text-xs">lib/services/smartlink_service.dart</code> and initialize in main.dart:</p>
                <pre style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }} className="text-xs whitespace-pre-wrap">
{`import 'package:smartlink/smartlink.dart';

// Create service with your API key
final smartLink = SmartLinkService(
  apiKey: '${settings.apiKey || 'YOUR_API_KEY'}',
  onDeepLink: (data) {
    // Route based on event ID, action, params
    if (data.eventId != null) {
      navigateTo('/event/\${data.eventId}');
    }
  },
);

// In main():
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final deferred = await aeLink.initialize();
  runApp(MyApp(initialLink: deferred));
}`}
                </pre>
              </div>
            </div>

            <div>
              <h3 style={{ color: 'var(--color-text)' }} className="text-lg font-semibold mb-4">API Usage</h3>
              <div style={{ backgroundColor: 'var(--color-bg-secondary)' }} className="p-4 rounded-lg overflow-x-auto">
                <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm mb-2">Create a deep link:</p>
                <pre style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }} className="text-xs whitespace-pre-wrap">
{`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://smartlink.vercel.app'}/api/v1/links \\
  -H "X-API-Key: ${settings.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Summer Music Festival",
    "destinationUrl": "https://allevents.in/event/summer-fest",
    "deepLinkPath": "/event/summer-fest",
    "params": { "source": "email" }
  }'`}
                </pre>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--color-primary-light)', borderColor: 'var(--color-border)' }} className="p-4 border rounded-lg">
              <p style={{ color: 'var(--color-text)' }} className="text-sm">
                <strong>Full documentation:</strong>{' '}
                <a href="/dashboard/docs" style={{ color: 'var(--color-primary)' }} className="hover:underline font-medium">
                  View the complete integration guide
                </a>{' '}
                for detailed setup instructions, SDK reference, and troubleshooting.
              </p>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {activeTab === 'danger' && (
          <div className="space-y-4">
            <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm mb-6">
              These actions are irreversible. Please proceed with caution.
            </p>

            <div style={{ borderColor: 'rgba(255, 61, 138, 0.3)', backgroundColor: 'rgba(255, 61, 138, 0.12)' }} className="border p-4 rounded-lg">
              <h4 style={{ color: 'var(--color-danger)' }} className="font-semibold mb-2">Reset Analytics Data</h4>
              <p style={{ color: 'var(--color-danger)' }} className="text-sm mb-4 opacity-80">
                Delete all clicks, conversions, and analytics data.
              </p>
              <button
                onClick={() => setShowDeleteConfirm('analytics')}
                style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              >
                Reset Analytics
              </button>
            </div>

            <div style={{ borderColor: 'rgba(255, 61, 138, 0.3)', backgroundColor: 'rgba(255, 61, 138, 0.12)' }} className="border p-4 rounded-lg">
              <h4 style={{ color: 'var(--color-danger)' }} className="font-semibold mb-2">Delete All Links</h4>
              <p style={{ color: 'var(--color-danger)' }} className="text-sm mb-4 opacity-80">
                Permanently delete all deep links and associated data.
              </p>
              <button
                onClick={() => setShowDeleteConfirm('links')}
                style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              >
                Delete Links
              </button>
            </div>

            <div style={{ borderColor: 'rgba(255, 61, 138, 0.3)', backgroundColor: 'rgba(255, 61, 138, 0.12)' }} className="border p-4 rounded-lg">
              <h4 style={{ color: 'var(--color-danger)' }} className="font-semibold mb-2">Delete Tenant Account</h4>
              <p style={{ color: 'var(--color-danger)' }} className="text-sm mb-4 opacity-80">
                Permanently delete this account and all associated data.
              </p>
              <button
                onClick={() => setShowDeleteConfirm('account')}
                style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      {activeTab !== 'danger' && activeTab !== 'integration' && activeTab !== 'team' && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
              color: saving ? 'var(--color-text-tertiary)' : '#000'
            }}
            className="px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => { setLoading(true); fetchSettings(); }}
            style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
            className="px-6 py-3 rounded-lg font-medium transition-colors hover:opacity-80"
          >
            Reset
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }} className="fixed inset-0 flex items-center justify-center z-50">
          <div style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }} className="card p-6 max-w-sm border">
            <h3 style={{ color: 'var(--color-text)' }} className="text-lg font-bold mb-2">Confirm Delete</h3>
            <p style={{ color: 'var(--color-text-secondary)' }} className="mb-6">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
                className="flex-1 px-4 py-2 rounded-lg font-medium hover:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setMessage({
                    type: 'success',
                    text: `${showDeleteConfirm} deletion would be processed`,
                  });
                }}
                style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}
                className="flex-1 px-4 py-2 rounded-lg font-medium hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

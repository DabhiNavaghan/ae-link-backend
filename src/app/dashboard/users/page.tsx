'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { smartLinkApi, TrackedUserRow, EventCampaignStat } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
      {'// '}
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 24, ...style }}>
      {children}
    </div>
  );
}

const th: React.CSSProperties = {
  ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--color-text-tertiary)', padding: '8px 12px', fontWeight: 600, textAlign: 'left',
};

const td: React.CSSProperties = { ...mono, fontSize: 12, padding: '10px 12px', color: 'var(--color-text)' };

const SORTS = [
  { label: 'recent', value: 'recent' as const },
  { label: 'value', value: 'value' as const },
  { label: 'events', value: 'events' as const },
];

/** How this person was acquired, in words rather than in enum. */
const ACQUISITION_LABEL: Record<string, string> = {
  explicit_click: 'deep link',
  install_match: 'install match',
  last_touch: 'last touch',
  direct: 'direct',
  none: 'organic',
};

function UsersContent() {
  const searchParams = useSearchParams();
  const campaignFilter = searchParams.get('campaignId') || '';
  const linkFilter = searchParams.get('linkId') || '';

  const [users, setUsers] = useState<TrackedUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'recent' | 'value' | 'events'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<EventCampaignStat[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState(campaignFilter);

  const limit = 25;

  // Campaign list for the filter — pulled from the event data rather than the
  // campaign collection, so it only offers campaigns that actually have users.
  useEffect(() => {
    smartLinkApi
      .getEventAnalytics<{ campaigns: EventCampaignStat[] }>('campaigns', {})
      .then((r) => setCampaigns((r.campaigns || []).filter((c) => c.campaignId)))
      .catch(() => { /* filter is a convenience — never block the list on it */ });
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await smartLinkApi.listTrackedUsers({
        campaignId: selectedCampaign || undefined,
        linkId: linkFilter || undefined,
        sort,
        page,
        limit,
      });
      setUsers(result.users || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, linkFilter, sort, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Changing a filter must reset paging, or page 4 of a filtered set shows nothing.
  const changeCampaign = (id: string) => {
    setSelectedCampaign(id);
    setPage(1);
  };

  const changeSort = (s: 'recent' | 'value' | 'events') => {
    setSort(s);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const totalValue = users.reduce((sum, u) => sum + u.totalValue, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Link href="/dashboard/events" style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>
              ← events
            </Link>
            <h1 style={{ ...mono, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', margin: '8px 0 4px' }}>users</h1>
            <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              who each campaign acquired, and what they have been worth since
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={selectedCampaign}
              onChange={(e) => changeCampaign(e.target.value)}
              style={{
                ...mono, fontSize: 11, padding: '8px 12px', background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer',
              }}
            >
              <option value="">all campaigns</option>
              {campaigns.map((c) => (
                <option key={c.campaignId!} value={c.campaignId!}>{c.campaignName}</option>
              ))}
            </select>

            <div style={{ display: 'flex', border: '1px solid var(--color-border)' }}>
              {SORTS.map((s, i) => (
                <button
                  key={s.value}
                  onClick={() => changeSort(s.value)}
                  style={{
                    ...mono, fontSize: 11, padding: '8px 14px', border: 'none', cursor: 'pointer',
                    background: sort === s.value ? 'var(--color-primary)' : 'var(--color-bg-card)',
                    color: sort === s.value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                    borderRight: i < SORTS.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 24, ...mono, fontSize: 12, color: 'var(--color-warning)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <Card>
            <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
              {selectedCampaign ? 'users from this campaign' : 'identified users'}
            </div>
            <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{total.toLocaleString()}</div>
          </Card>
          <Card>
            <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>value on this page</div>
            <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' }}>
              {totalValue ? totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
            </div>
          </Card>
          <Card>
            <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>page</div>
            <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{page} / {totalPages}</div>
          </Card>
        </div>

        <Card>
          <SectionLabel>identified users</SectionLabel>

          {loading ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', padding: '32px 0', textAlign: 'center' }}>loading…</div>
          ) : users.length === 0 ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', padding: '32px 0', textAlign: 'center', lineHeight: 1.8 }}>
              {selectedCampaign ? (
                <>no users acquired by this campaign yet.</>
              ) : (
                <>
                  no identified users yet.<br />
                  call <span style={{ color: 'var(--color-primary)' }}>smartLink.identify(userId)</span> when someone signs in.
                </>
              )}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={th}>user</th>
                      <th style={th}>acquired via</th>
                      <th style={{ ...th, textAlign: 'right' }}>events</th>
                      <th style={{ ...th, textAlign: 'right' }}>value</th>
                      <th style={{ ...th, textAlign: 'right' }}>devices</th>
                      <th style={{ ...th, textAlign: 'right' }}>last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.userId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={td}>
                          <Link
                            href={`/dashboard/users/${encodeURIComponent(u.userId)}`}
                            style={{ ...mono, fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none' }}
                          >
                            {u.userId}
                          </Link>
                          <div style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                            since {new Date(u.firstSeenAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={td}>
                          {u.acquisition ? (
                            <>
                              <div style={{ color: 'var(--color-text)' }}>
                                {u.acquisition.campaign || u.acquisition.shortCode || u.acquisition.source || '—'}
                              </div>
                              <div style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                                {ACQUISITION_LABEL[u.acquisition.model] || u.acquisition.model}
                              </div>
                            </>
                          ) : (
                            <span style={{ color: 'var(--color-text-tertiary)' }}>organic</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{u.eventCount.toLocaleString()}</td>
                        <td style={{ ...td, textAlign: 'right', color: u.totalValue ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}>
                          {u.totalValue ? u.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{u.deviceCount}</td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                          {new Date(u.lastSeenAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    style={{
                      ...mono, fontSize: 11, padding: '8px 16px', cursor: page <= 1 ? 'default' : 'pointer',
                      background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)', opacity: page <= 1 ? 0.4 : 1,
                    }}
                  >
                    ← prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    style={{
                      ...mono, fontSize: 11, padding: '8px 16px', cursor: page >= totalPages ? 'default' : 'pointer',
                      background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)', opacity: page >= totalPages ? 0.4 : 1,
                    }}
                  >
                    next →
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function UsersPage() {
  // useSearchParams needs a Suspense boundary in the app router, or the whole
  // route opts out of static rendering with a build-time warning.
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32, ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          loading…
        </div>
      }
    >
      <UsersContent />
    </Suspense>
  );
}

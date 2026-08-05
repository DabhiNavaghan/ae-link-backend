'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { smartLinkApi, TrackedUserDetail } from '@/lib/api';

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

function Field({ label, value, mutedValue }: { label: string; value: React.ReactNode; mutedValue?: boolean }) {
  return (
    <div>
      <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ ...mono, fontSize: 13, color: mutedValue ? 'var(--color-text-tertiary)' : 'var(--color-text)', wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  );
}

const ACQUISITION_LABEL: Record<string, string> = {
  explicit_click: 'deep link — the SDK carried the exact click',
  install_match: 'install match — device matched back to a click',
  last_touch: 'last touch — most recent click in the window',
  direct: 'direct — app launched from a link',
  none: 'organic — no link involved',
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = decodeURIComponent(String(params?.userId || ''));

  const [user, setUser] = useState<TrackedUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setUser(await smartLinkApi.getTrackedUser(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const handleErase = async () => {
    setErasing(true);
    setError(null);
    try {
      await smartLinkApi.eraseTrackedUser(userId);
      router.push('/dashboard/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erasure failed');
      setErasing(false);
      setConfirmErase(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32, ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
        loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Link href="/dashboard/users" style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>← users</Link>
          <Card style={{ marginTop: 24 }}>
            <div style={{ ...mono, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {error || 'User not found.'}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const traitEntries = Object.entries(user.traits || {});

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Link href="/dashboard/users" style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>← users</Link>
            <h1 style={{ ...mono, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', margin: '8px 0 4px' }}>{user.userId}</h1>
            <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              first seen {new Date(user.firstSeenAt).toLocaleDateString()} · identified {new Date(user.identifiedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 24, ...mono, fontSize: 12, color: 'var(--color-warning)' }}>
            {error}
          </div>
        )}

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <Card>
            <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>events</div>
            <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>{user.eventCount.toLocaleString()}</div>
          </Card>
          <Card>
            <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>lifetime value</div>
            <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>
              {user.totalValue ? user.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
            </div>
          </Card>
          <Card>
            <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>devices</div>
            <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>{user.devices?.length || 0}</div>
          </Card>
          <Card>
            <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>last active</div>
            <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', paddingTop: 6 }}>
              {new Date(user.lastSeenAt).toLocaleDateString()}
            </div>
          </Card>
        </div>

        {/* Acquisition — the answer to "which campaign brought this person in" */}
        <Card style={{ marginBottom: 24 }}>
          <SectionLabel>acquisition</SectionLabel>
          {user.acquisition ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 16 }}>
                <Field
                  label="campaign"
                  value={
                    user.acquisition.campaign?.name ? (
                      <Link href={`/dashboard/campaigns/${user.acquisition.campaign.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                        {user.acquisition.campaign.name}
                      </Link>
                    ) : (
                      user.acquisition.campaign || '—'
                    )
                  }
                  mutedValue={!user.acquisition.campaign}
                />
                <Field
                  label="link"
                  value={
                    user.acquisition.link ? (
                      <Link href={`/dashboard/links/${user.acquisition.link.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                        /{user.acquisition.link.shortCode || user.acquisition.link.title}
                      </Link>
                    ) : (
                      user.acquisition.shortCode || '—'
                    )
                  }
                  mutedValue={!user.acquisition.link && !user.acquisition.shortCode}
                />
                <Field label="source" value={user.acquisition.source || '—'} mutedValue={!user.acquisition.source} />
                <Field label="medium" value={user.acquisition.medium || '—'} mutedValue={!user.acquisition.medium} />
              </div>
              <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.7, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                {ACQUISITION_LABEL[user.acquisition.model] || user.acquisition.model}
                {' · '}
                Set on first sign-in and never overwritten — first touch wins permanently, across every device
                this person later signs in on.
              </div>
            </>
          ) : (
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
              Organic — no link was attributable when this person first signed in.
            </div>
          )}
        </Card>

        {/* Devices */}
        <Card style={{ marginBottom: 24 }}>
          <SectionLabel>devices</SectionLabel>
          {(user.devices?.length || 0) === 0 ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>no devices attached</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['device', 'platform', 'epoch', 'first seen', 'last seen'].map((h, i) => (
                      <th key={h} style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', padding: '8px 12px', fontWeight: 600, textAlign: i > 1 ? 'right' : 'left' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {user.devices.map((d) => (
                    <tr key={`${d.deviceId}-${d.epoch}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ ...mono, fontSize: 11, padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{d.deviceId}</td>
                      <td style={{ ...mono, fontSize: 12, padding: '10px 12px', color: 'var(--color-text)' }}>{d.platform || '—'}</td>
                      <td style={{ ...mono, fontSize: 12, padding: '10px 12px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{d.epoch}</td>
                      <td style={{ ...mono, fontSize: 11, padding: '10px 12px', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>{new Date(d.firstSeenAt).toLocaleDateString()}</td>
                      <td style={{ ...mono, fontSize: 11, padding: '10px 12px', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>{new Date(d.lastSeenAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 14, lineHeight: 1.6 }}>
            Devices are merged, histories are not — each event keeps the device that produced it.
            The epoch increments whenever a device changes hands, which is what stops a shared device
            from handing one person another person&rsquo;s activity.
          </p>
        </Card>

        {/* Traits */}
        <Card style={{ marginBottom: 24 }}>
          <SectionLabel>traits</SectionLabel>
          {traitEntries.length === 0 && !user.emailHash ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>none recorded</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              {traitEntries.map(([k, v]) => (
                <Field key={k} label={k} value={String(v)} />
              ))}
              {user.emailHash && (
                <Field
                  label="email (hashed)"
                  value={<span title={user.emailHash}>{user.emailHash.slice(0, 16)}…</span>}
                  mutedValue
                />
              )}
            </div>
          )}
          <p style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 14, lineHeight: 1.6 }}>
            Only trait keys on your tenant&rsquo;s allowlist are stored. Email is kept as a hash — still matchable,
            never readable.
          </p>
        </Card>

        {/* Timeline */}
        <Card style={{ marginBottom: 24 }}>
          <SectionLabel>
            event timeline{user.timelineTruncated ? ' — most recent 100' : ''}
          </SectionLabel>
          {user.timeline.length === 0 ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>no events</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {user.timeline.map((e, i) => (
                <div
                  key={e._id}
                  style={{
                    display: 'grid', gridTemplateColumns: '150px 1fr 120px 100px',
                    gap: 12, padding: '10px 0', alignItems: 'center',
                    borderBottom: i < user.timeline.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    {new Date(e.occurredAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ ...mono, fontSize: 12, color: 'var(--color-text)', fontWeight: 600 }}>
                    {e.name}
                    {e.properties && Object.keys(e.properties).length > 0 && (
                      <span style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 400, marginLeft: 8 }}>
                        {Object.entries(e.properties).slice(0, 3).map(([k, v]) => `${k}=${String(v)}`).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {e.attribution?.campaign || e.attribution?.shortCode || e.attribution?.model || '—'}
                  </span>
                  <span style={{ ...mono, fontSize: 12, color: e.value ? 'var(--color-primary)' : 'var(--color-text-tertiary)', textAlign: 'right' }}>
                    {e.value ? `${e.value.toLocaleString()} ${e.currency || ''}`.trim() : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Erasure */}
        <Card style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <SectionLabel>data subject request</SectionLabel>
          <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7, maxWidth: '70ch', marginBottom: 16 }}>
            Erasing deletes this identity and anonymises their events in place — the rows stay, stripped of
            <code style={{ color: 'var(--color-primary)', margin: '0 4px' }}>userId</code> and
            <code style={{ color: 'var(--color-primary)', margin: '0 4px' }}>deviceId</code>. Aggregate counts and
            historical reports do not change. This cannot be undone.
          </p>

          {!confirmErase ? (
            <button
              onClick={() => setConfirmErase(true)}
              style={{
                ...mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '10px 20px', cursor: 'pointer', background: 'transparent',
                border: '1px solid rgba(239,68,68,0.5)', color: 'var(--color-warning)',
              }}
            >
              erase this user
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ ...mono, fontSize: 12, color: 'var(--color-warning)' }}>
                Erase <strong>{user.userId}</strong> permanently?
              </span>
              <button
                onClick={handleErase}
                disabled={erasing}
                style={{
                  ...mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '10px 20px', cursor: erasing ? 'wait' : 'pointer', border: 'none',
                  background: 'var(--color-warning)', color: 'var(--color-bg)',
                }}
              >
                {erasing ? 'erasing…' : 'yes, erase'}
              </button>
              <button
                onClick={() => setConfirmErase(false)}
                disabled={erasing}
                style={{
                  ...mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '10px 20px', cursor: 'pointer', background: 'transparent',
                  border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)',
                }}
              >
                cancel
              </button>
            </div>
          )}

          <p style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 14 }}>
            Requires a tenant API key. App keys ship inside your mobile binary and the API rejects them here.
          </p>
        </Card>
      </div>
    </div>
  );
}

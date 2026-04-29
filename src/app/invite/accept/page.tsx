'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser, useAuth, SignInButton } from '@clerk/nextjs';
import { smartLinkApi } from '@/lib/api';

/* ─── Role metadata ─── */
const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  administrator: {
    label: 'Administrator',
    color: '#C9FF3D',
    description: 'Full access to all apps, settings, team management, and billing.',
  },
  admin: {
    label: 'Admin',
    color: '#3B82F6',
    description: 'Manage apps, campaigns, links, and view all analytics.',
  },
  editor: {
    label: 'Editor',
    color: '#A855F7',
    description: 'Create and edit campaigns, links, and view analytics.',
  },
  analyst: {
    label: 'Analyst',
    color: '#F59E0B',
    description: 'View-only access to analytics dashboards and reports.',
  },
};

type PageState = 'loading' | 'valid' | 'accepted' | 'expired' | 'revoked' | 'not_found' | 'error' | 'already_accepted';

export default function InviteAcceptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const token = searchParams.get('token');

  const [state, setState] = useState<PageState>('loading');
  const [inviteData, setInviteData] = useState<{
    email: string;
    role: string;
    tenantName: string;
    invitedBy: string;
    expiresAt: string;
  } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  /* ─── Validate token on mount ─── */
  useEffect(() => {
    if (!token) {
      setState('not_found');
      return;
    }

    fetch(`/api/v1/team/accept?token=${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setState('not_found');
          return;
        }
        const d = json.data;
        setInviteData({
          email: d.email,
          role: d.role,
          tenantName: d.tenantName,
          invitedBy: d.invitedBy,
          expiresAt: d.expiresAt,
        });
        if (!d.valid) {
          setState(d.status === 'expired' ? 'expired' : d.status === 'revoked' ? 'revoked' : 'already_accepted');
        } else {
          setState('valid');
        }
      })
      .catch(() => setState('error'));
  }, [token]);

  /* ─── Accept invite ─── */
  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError('');

    try {
      const res = await fetch('/api/v1/team/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: user?.fullName || user?.firstName || undefined,
          clerkUserId: user?.id || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setState('already_accepted');
          return;
        }
        setError(json?.error?.message || 'Failed to accept invite');
        return;
      }

      // Store API key & tenant info so user lands in dashboard
      const tenant = json.data?.tenant;
      if (tenant?.apiKey) {
        smartLinkApi.setApiKey(tenant.apiKey);
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'smartlink-tenant',
            JSON.stringify({
              id: tenant.id,
              name: tenant.name,
              domain: tenant.domain,
            })
          );
          // Store role for RBAC — team member gets their assigned role
          const memberRole = json.data?.member?.role;
          if (memberRole) {
            localStorage.setItem('smartlink-role', memberRole);
          }
          // Store allowed apps for scoping
          const memberAllowedApps = json.data?.member?.allowedApps;
          if (memberAllowedApps?.length) {
            localStorage.setItem('smartlink-allowed-apps', JSON.stringify(
              memberAllowedApps.map((id: any) => id.toString())
            ));
          } else {
            localStorage.removeItem('smartlink-allowed-apps');
          }
        }
      }

      setState('accepted');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const goToDashboard = () => router.push('/dashboard');

  const roleMeta = inviteData ? ROLE_META[inviteData.role] || ROLE_META.editor : ROLE_META.editor;

  /* ─── Render ─── */
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9FF3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <span style={styles.logoText}>SmartLink</span>
        </div>

        {/* ─── Loading ─── */}
        {state === 'loading' && (
          <div style={styles.center}>
            <div style={styles.spinner} />
            <p style={styles.subtext}>Validating invite...</p>
          </div>
        )}

        {/* ─── Not Found ─── */}
        {state === 'not_found' && (
          <div style={styles.center}>
            <div style={styles.iconCircle('#EF4444')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={styles.heading}>Invite Not Found</h2>
            <p style={styles.subtext}>
              This invite link is invalid or has already been used. Please ask the team administrator to send a new invite.
            </p>
          </div>
        )}

        {/* ─── Expired ─── */}
        {state === 'expired' && (
          <div style={styles.center}>
            <div style={styles.iconCircle('#F59E0B')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 style={styles.heading}>Invite Expired</h2>
            <p style={styles.subtext}>
              This invite for <strong style={{ color: '#fff' }}>{inviteData?.email}</strong> to join{' '}
              <strong style={{ color: '#fff' }}>{inviteData?.tenantName}</strong> has expired. Please ask the team administrator to resend the invite.
            </p>
          </div>
        )}

        {/* ─── Revoked ─── */}
        {state === 'revoked' && (
          <div style={styles.center}>
            <div style={styles.iconCircle('#EF4444')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 5.64a9 9 0 11-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            </div>
            <h2 style={styles.heading}>Invite Revoked</h2>
            <p style={styles.subtext}>
              This invite has been revoked by the team administrator.
            </p>
          </div>
        )}

        {/* ─── Already Accepted ─── */}
        {state === 'already_accepted' && (
          <div style={styles.center}>
            <div style={styles.iconCircle('#3B82F6')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={styles.heading}>Already Accepted</h2>
            <p style={styles.subtext}>
              This invite has already been accepted. You can go to the dashboard to get started.
            </p>
            <button style={styles.primaryBtn} onClick={goToDashboard}>
              Go to Dashboard
            </button>
          </div>
        )}

        {/* ─── Valid — show invite details ─── */}
        {state === 'valid' && inviteData && (
          <div style={styles.center}>
            <div style={styles.iconCircle(roleMeta.color)}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={roleMeta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <h2 style={styles.heading}>You&apos;re Invited!</h2>
            <p style={styles.subtext}>
              <strong style={{ color: '#fff' }}>{inviteData.invitedBy}</strong> has invited you to join
            </p>

            {/* Tenant name */}
            <div style={styles.tenantName}>{inviteData.tenantName}</div>

            {/* Role badge */}
            <div style={styles.roleBadge(roleMeta.color)}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                {roleMeta.label}
              </span>
            </div>
            <p style={{ ...styles.subtext, fontSize: '0.8rem', marginTop: '4px' }}>{roleMeta.description}</p>

            {/* Invite email */}
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Invited email</span>
              <span style={styles.detailValue}>{inviteData.email}</span>
            </div>

            {/* Expiry */}
            <div style={{ ...styles.detailRow, borderBottom: 'none' }}>
              <span style={styles.detailLabel}>Expires</span>
              <span style={styles.detailValue}>
                {new Date(inviteData.expiresAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            {/* Error */}
            {error && (
              <div style={styles.errorBox}>
                {error}
              </div>
            )}

            {/* Action */}
            {isUserLoaded && !isSignedIn ? (
              <div style={{ width: '100%', marginTop: '16px' }}>
                <p style={{ ...styles.subtext, marginBottom: '12px' }}>
                  Sign in to accept this invite
                </p>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl={`/invite/accept?token=${token}`}
                  signUpForceRedirectUrl={`/invite/accept?token=${token}`}
                >
                  <button style={styles.primaryBtn}>
                    Sign In to Accept
                  </button>
                </SignInButton>
              </div>
            ) : (
              <button
                style={{
                  ...styles.primaryBtn,
                  marginTop: '16px',
                  opacity: accepting ? 0.7 : 1,
                }}
                onClick={handleAccept}
                disabled={accepting}
              >
                {accepting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <span style={{ ...styles.spinner, width: '16px', height: '16px', borderWidth: '2px' }} />
                    Accepting...
                  </span>
                ) : (
                  'Accept Invite'
                )}
              </button>
            )}
          </div>
        )}

        {/* ─── Accepted — success ─── */}
        {state === 'accepted' && (
          <div style={styles.center}>
            <div style={styles.iconCircle('#C9FF3D')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9FF3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={styles.heading}>Welcome to the Team!</h2>
            <p style={styles.subtext}>
              You&apos;ve joined <strong style={{ color: '#fff' }}>{inviteData?.tenantName}</strong> as{' '}
              <strong style={{ color: roleMeta.color }}>{roleMeta.label}</strong>.
            </p>
            <button style={styles.primaryBtn} onClick={goToDashboard}>
              Go to Dashboard
            </button>
          </div>
        )}

        {/* ─── Error ─── */}
        {state === 'error' && (
          <div style={styles.center}>
            <div style={styles.iconCircle('#EF4444')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 style={styles.heading}>Something Went Wrong</h2>
            <p style={styles.subtext}>
              We couldn&apos;t validate this invite. Please try again or contact the team administrator.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={styles.footer}>
        SmartLink by AllEvents
      </p>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ─── Styles ─── */
const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0B0D11',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    background: '#141820',
    border: '1px solid #232831',
    borderRadius: 0,
    padding: '32px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '28px',
    justifyContent: 'center',
  },
  logoIcon: {
    width: '36px',
    height: '36px',
    borderRadius: 0,
    background: 'rgba(201,255,61,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#fff',
    fontFamily: 'var(--font-bricolage), sans-serif',
    letterSpacing: '-0.02em',
  },
  center: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(201,255,61,0.15)',
    borderTopColor: '#C9FF3D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  heading: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
    margin: '16px 0 8px',
    fontFamily: 'var(--font-bricolage), sans-serif',
  },
  subtext: {
    fontSize: '0.875rem',
    color: '#8B919E',
    lineHeight: 1.5,
    margin: 0,
  },
  tenantName: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#fff',
    margin: '16px 0 12px',
    fontFamily: 'var(--font-bricolage), sans-serif',
    letterSpacing: '-0.02em',
  },
  roleBadge: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: 0,
    background: `${color}18`,
    color,
    border: `1px solid ${color}30`,
    marginBottom: '4px',
  }),
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    padding: '12px 0',
    borderBottom: '1px solid #232831',
    marginTop: '4px',
  },
  detailLabel: {
    fontSize: '0.8rem',
    color: '#8B919E',
    fontWeight: 500,
  },
  detailValue: {
    fontSize: '0.8rem',
    color: '#fff',
    fontFamily: 'var(--font-jetbrains), monospace',
  },
  primaryBtn: {
    width: '100%',
    padding: '12px 24px',
    background: '#C9FF3D',
    color: '#0B0D11',
    border: 'none',
    borderRadius: 0,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  errorBox: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 0,
    color: '#EF4444',
    fontSize: '0.8rem',
    marginTop: '12px',
  },
  iconCircle: (color: string) => ({
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: `${color}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
  }),
  footer: {
    marginTop: '24px',
    fontSize: '0.75rem',
    color: '#555B66',
  },
};

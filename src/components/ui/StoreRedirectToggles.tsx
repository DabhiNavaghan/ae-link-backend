'use client';

/**
 * The two app-store navigation switches on a link form — phones and desktop,
 * controlled independently. Shared by the create and edit pages so the copy
 * explaining each state cannot drift between them.
 */

interface StoreRedirectTogglesProps {
  mobile: boolean;
  web: boolean;
  onChange: (next: { mobile: boolean; web: boolean }) => void;
  /** Drives the "nothing to open" hint — true when the link has a destination. */
  hasWebDestination?: boolean;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '14px 16px',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--color-text)',
};

const helpStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  lineHeight: 1.6,
  color: 'var(--color-text-tertiary)',
};

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        position: 'relative', flexShrink: 0,
        background: on ? 'var(--color-primary)' : 'var(--color-border-hover)',
        transition: 'background 0.2s',
      }}
    >
      <span
        style={{
          position: 'absolute', top: 3, left: on ? 23 : 3,
          width: 18, height: 18, borderRadius: 9,
          background: on ? 'var(--color-bg)' : 'var(--color-text-tertiary)',
          transition: 'left 0.2s, background 0.2s',
        }}
      />
    </button>
  );
}

export default function StoreRedirectToggles({
  mobile,
  web,
  onChange,
  hasWebDestination = false,
}: StoreRedirectTogglesProps) {
  // With no destination to fall back to, "off" means the app info page rather
  // than a web redirect — say so, since that is a visibly different outcome.
  const noDestinationNote = hasWebDestination
    ? 'opens the destination on the web instead — each click\'s deepLink wins over the web override.'
    : 'this link has no web destination, so they land on the app info page with a qr + store links.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={rowStyle}>
        <div>
          <div style={titleStyle}>app store navigation · android &amp; ios</div>
          <p style={helpStyle}>
            {mobile
              ? 'phones without the app go to the play store / app store.'
              : `phones without the app never reach the store — ${noDestinationNote}`}
          </p>
        </div>
        <Switch on={mobile} onToggle={() => onChange({ mobile: !mobile, web })} label="App store navigation for Android and iOS" />
      </div>

      <div style={rowStyle}>
        <div>
          <div style={titleStyle}>app store navigation · web</div>
          <p style={helpStyle}>
            {web
              ? 'desktop visitors with no web destination are sent to the store listing.'
              : `desktop visitors never reach the store — ${noDestinationNote}`}
          </p>
        </div>
        <Switch on={web} onToggle={() => onChange({ mobile, web: !web })} label="App store navigation for web" />
      </div>
    </div>
  );
}

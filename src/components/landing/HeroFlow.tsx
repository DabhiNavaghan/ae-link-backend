'use client';

/**
 * Hero diagram: the deferred deep link story, told in four beats.
 *
 * Deliberately user-facing rather than architectural — a visitor should read
 * "the link remembers where it was going, even through an install" without
 * knowing what a fingerprint match is. The step index drives every visual
 * state; CSS handles the easing so the loop stays cheap.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

const LINK_HOST = 'yourapp.aelinks.io';
const LINK_PATH = '/e/summer-fest';

const STEPS = [
  { k: 'tap', title: 'Tap a link', note: 'Instagram, email, SMS, QR' },
  { k: 'store', title: 'App not installed', note: 'sent to the store' },
  { k: 'install', title: 'Install + open', note: 'the link is remembered' },
  { k: 'land', title: 'Lands on the page', note: 'not a blank home screen' },
] as const;

const STEP_MS = 2300;

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToMotionPref(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export default function HeroFlow() {
  const reduced = useSyncExternalStore(
    subscribeToMotionPref,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false // server render: assume motion, the client corrects on hydrate
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setTick((t) => (t + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(id);
  }, [reduced]);

  // Reduced motion gets the resolved end state instead of a loop.
  const step = reduced ? STEPS.length - 1 : tick;
  const at = (i: number) => (step === i ? ' is-on' : step > i ? ' is-done' : '');

  return (
    <div className={`tl-flow${reduced ? ' no-motion' : ''}`} data-step={step} aria-hidden="true">
      <div className="tl-flow-bar">
        <span className="tl-flow-bar-label">
          <span className="live-dot" /> Deferred deep link
        </span>
        <span className="tl-flow-bar-label dim">one link · any device</span>
      </div>

      {/* The link itself — always visible, because it is the thing that persists */}
      <div className="tl-flow-link">
        <span className="tl-flow-link-icon" />
        <span className="tl-flow-link-host">{LINK_HOST}</span>
        <span className="tl-flow-link-path">{LINK_PATH}</span>
        <span className="tl-flow-link-tap">tap</span>
      </div>

      <div className="tl-flow-body">
        {/* Left rail: the four beats */}
        <ol className="tl-flow-rail">
          {STEPS.map((s, i) => (
            <li key={s.k} className={`tl-flow-beat${at(i)}`}>
              <span className="tl-flow-dot" />
              <span className="tl-flow-beat-title">{s.title}</span>
              <span className="tl-flow-beat-note">{s.note}</span>
            </li>
          ))}
        </ol>

        {/* Right: the phone, one screen per beat */}
        <div className="tl-flow-phone">
          <span className="tl-flow-notch" />
          <div className="tl-flow-screens">
            {/* 0 — the tap */}
            <div className={`tl-flow-screen${step === 0 ? ' is-on' : ''}`}>
              <div className="tl-fs-head">feed</div>
              <div className="tl-fs-row">
                <span className="tl-fs-avatar" />
                <span className="tl-fs-lines">
                  <i style={{ width: '70%' }} />
                  <i style={{ width: '45%' }} />
                </span>
              </div>
              <div className="tl-fs-media" />
              <div className="tl-fs-chip">
                {LINK_HOST}
                {LINK_PATH}
              </div>
              <span className="tl-fs-ripple" />
            </div>

            {/* 1 — the store */}
            <div className={`tl-flow-screen${step === 1 ? ' is-on' : ''}`}>
              <div className="tl-fs-head">app store</div>
              <div className="tl-fs-row tl-fs-store">
                <span className="tl-fs-appicon" />
                <span className="tl-fs-lines">
                  <i style={{ width: '60%' }} />
                  <i style={{ width: '38%' }} />
                </span>
                <span className="tl-fs-get">GET</span>
              </div>
              <div className="tl-fs-shots">
                <span />
                <span />
                <span />
              </div>
            </div>

            {/* 2 — install, context held */}
            <div className={`tl-flow-screen tl-fs-center${step === 2 ? ' is-on' : ''}`}>
              <span className="tl-fs-appicon big" />
              <div className="tl-fs-progress">
                <i />
              </div>
              <div className="tl-fs-note">installing</div>
              <div className="tl-fs-held">{LINK_PATH}</div>
            </div>

            {/* 3 — lands on the exact page */}
            <div className={`tl-flow-screen${step === 3 ? ' is-on' : ''}`}>
              <div className="tl-fs-head lime">your app</div>
              <div className="tl-fs-hero" />
              <div className="tl-fs-lines tall">
                <i style={{ width: '80%' }} />
                <i style={{ width: '55%' }} />
              </div>
              <div className="tl-fs-target">
                <span className="tl-fs-target-path">{LINK_PATH}</span>
                <span className="tl-fs-target-tick">✓</span>
              </div>
              <div className="tl-fs-meta">
                <span>opened in 118ms</span>
                <span className="lime">attributed</span>
              </div>
              <div className="tl-fs-rows">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The point of the whole thing, in two lanes */}
      <div className="tl-flow-compare">
        <div className="tl-flow-lane muted">
          <span className="tl-flow-lane-tag">Without</span>
          <span className="tl-flow-lane-track broken">
            <i />
          </span>
          <span className="tl-flow-lane-end">home screen</span>
        </div>
        <div className="tl-flow-lane">
          <span className="tl-flow-lane-tag">SmartLink</span>
          <span className="tl-flow-lane-track">
            <i />
          </span>
          <span className="tl-flow-lane-end lime">{LINK_PATH}</span>
        </div>
      </div>
    </div>
  );
}

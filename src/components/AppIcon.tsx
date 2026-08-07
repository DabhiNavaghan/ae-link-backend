'use client';

import { useState } from 'react';

interface AppIconProps {
  /**
   * The app whose icon to show. The image is served from our own origin at
   * /app-asset/:appId/icon rather than from the CDN the URL points at — see
   * that route for why. Omit it to go straight to the letter tile.
   */
  appId?: string;
  /** Whether the app actually has an icon configured. */
  hasIcon?: boolean;
  /** Supplies the letter shown when there is no usable icon. */
  name: string;
  size?: number;
  className?: string;
}

/**
 * The app's icon, with a letter tile standing in whenever the real one cannot
 * be shown.
 *
 * A remote icon can fail for reasons we do not control — the CDN rate-limits,
 * a content blocker eats the request, the network drops — and a bare <img>
 * turns every one of those into a blank hole on an otherwise finished page.
 * Falling back on `error` means the page always looks deliberate.
 */
export default function AppIcon({
  appId,
  hasIcon = true,
  name,
  size = 64,
  className = 'ae-icon',
}: AppIconProps) {
  const [failed, setFailed] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase() || '?';

  if (!appId || !hasIcon || failed) {
    return (
      <div
        className={`${className} ae-icon-fallback`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
        aria-hidden="true"
      >
        {letter}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/app-asset/${appId}/icon`}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
      // Above the fold on a page the visitor is looking at right now, so it
      // should not wait for lazy-loading heuristics.
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

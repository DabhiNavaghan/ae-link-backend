'use client';

import { useEffect } from 'react';
import { sendFingerprint, type FingerprintPayload } from '@/lib/utils/fingerprint-beacon';

/**
 * Fires the deferred-deep-link fingerprint once on mount, then renders nothing.
 *
 * Lets an otherwise server-rendered page (the app-info interstitial) still take
 * part in post-install attribution: the visitor may tap a store badge minutes
 * later, and the SDK needs this fingerprint to match that install back to the
 * click. Mount it only for visitors who could plausibly install — phones.
 */
export default function FingerprintBeacon(payload: FingerprintPayload) {
  const { linkId, tenantId, clickId, mergedDestinationUrl, mergedParams } = payload;

  useEffect(() => {
    sendFingerprint({ linkId, tenantId, clickId, mergedDestinationUrl, mergedParams });
    // Once per page load — the click it belongs to does not change under us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

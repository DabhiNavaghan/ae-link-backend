import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LiveEvent } from './live-events';

/**
 * Emit a live tracking event via filesystem IPC.
 *
 * Next.js dev server deadlocks when a Server Component tries to
 * HTTP-POST to its own API routes (single-threaded event loop).
 *
 * This writes events to a temp file instead. The live-events module
 * watches the file and fans out to SSE subscribers. Works across
 * all module contexts because the filesystem is truly shared.
 */

const EVENT_FILE = path.join(os.tmpdir(), 'smartlink-live-events.jsonl');

export function emitLiveEvent(
  event: Omit<LiveEvent, 'id' | 'timestamp'>
): void {
  try {
    const full: LiveEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    } as LiveEvent;

    fs.appendFileSync(EVENT_FILE, JSON.stringify(full) + '\n');
  } catch {
    // Never let live tracking failures affect the redirect flow
  }
}

/** Path to the shared event file — used by live-events.ts watcher */
export { EVENT_FILE };

/**
 * Server-side event emitter for real-time tracking.
 *
 * Two input paths:
 *   1. liveEvents.emit()  — called directly from API routes (same module context)
 *   2. File watcher        — picks up events written by Server Components via
 *                            emitLiveEvent() in emit-live-event.ts
 *
 * SSE clients subscribe via liveEvents.subscribe() and receive events
 * from both paths.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface LiveEvent {
  id: string;
  type:
    | 'click'
    | 'fingerprint'
    | 'deferred_match'
    | 'app_opened'
    | 'store_redirect'
    | 'web_fallback';
  timestamp: string;
  linkId?: string;
  linkTitle?: string;
  shortCode?: string;
  tenantId?: string;
  device?: {
    os?: string;
    browser?: string;
    type?: string;
  };
  geo?: {
    country?: string;
    city?: string;
  };
  metadata?: Record<string, any>;
}

type Listener = (event: LiveEvent) => void;

const EVENT_FILE = path.join(os.tmpdir(), 'smartlink-live-events.jsonl');

class LiveEventEmitter {
  private listeners = new Set<Listener>();
  private buffer: LiveEvent[] = [];
  private maxBuffer = 100;
  private counter = 0;
  private fileOffset = 0;
  private watchInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startFileWatcher();
  }

  /** Push a new event to all connected SSE clients */
  emit(event: Omit<LiveEvent, 'id' | 'timestamp'>) {
    const full: LiveEvent = {
      ...event,
      id: `evt_${Date.now()}_${++this.counter}`,
      timestamp: new Date().toISOString(),
    };
    this._fanOut(full);
  }

  /** Internal: add to buffer and notify listeners */
  private _fanOut(full: LiveEvent) {
    // Ring buffer
    this.buffer.push(full);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }

    // Fan out to SSE subscribers
    for (const fn of this.listeners) {
      try {
        fn(full);
      } catch {
        // listener threw — ignore
      }
    }
  }

  /** Subscribe — returns an unsubscribe function */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Return the recent-event ring buffer (newest last) */
  getRecent(): LiveEvent[] {
    return [...this.buffer];
  }

  /** Clear the ring buffer */
  clearBuffer() {
    this.buffer = [];
  }

  /** How many SSE clients are connected right now */
  get clientCount(): number {
    return this.listeners.size;
  }

  /**
   * Watch the shared temp file for new events written by Server Components.
   * Polls every 300ms — checks if file has grown since last read.
   */
  private startFileWatcher() {
    // Truncate or create the file on startup
    try {
      fs.writeFileSync(EVENT_FILE, '');
    } catch {
      // ignore
    }
    this.fileOffset = 0;

    this.watchInterval = setInterval(() => {
      try {
        const stat = fs.statSync(EVENT_FILE);

        // File was truncated/recreated (e.g. server restart) — reset offset
        if (stat.size < this.fileOffset) {
          this.fileOffset = 0;
        }

        if (stat.size <= this.fileOffset) return;

        // Read only new bytes
        const fd = fs.openSync(EVENT_FILE, 'r');
        const newBytes = Buffer.alloc(stat.size - this.fileOffset);
        fs.readSync(fd, newBytes, 0, newBytes.length, this.fileOffset);
        fs.closeSync(fd);
        this.fileOffset = stat.size;

        // Parse each line
        const lines = newBytes.toString('utf-8').split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const evt: LiveEvent = JSON.parse(line);
            // Avoid duplicates — file events have their own IDs
            this._fanOut(evt);
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        // File doesn't exist yet or read error — ignore
      }
    }, 300);
  }
}

// ── Singleton via globalThis (for API route context) ──────
const globalKey = '__smartlink_live_events_v2__';

function getEmitter(): LiveEventEmitter {
  if (!(globalThis as any)[globalKey]) {
    (globalThis as any)[globalKey] = new LiveEventEmitter();
  }
  return (globalThis as any)[globalKey];
}

export const liveEvents = getEmitter();

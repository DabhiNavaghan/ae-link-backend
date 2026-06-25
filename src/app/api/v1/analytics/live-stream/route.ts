import { NextRequest } from 'next/server';
import { liveEvents, LiveEvent } from '@/lib/services/live-events';

/**
 * GET /api/v1/analytics/live-stream
 *
 * Server-Sent Events endpoint for real-time tracking.
 * Streams every click, fingerprint, deferred match, app open, etc.
 * as it happens.
 *
 * Query params:
 *   tenantId  — optional filter (only events for this tenant)
 *   linkId    — optional filter (only events for this link)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filterTenantId = searchParams.get('tenantId');
  const filterLinkId = searchParams.get('linkId');
  // If noReplay=1, skip the ring buffer burst (used after client-side clear)
  const noReplay = searchParams.get('noReplay') === '1';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send recent events as a burst so the UI isn't empty on connect
      if (!noReplay) {
        const recent = liveEvents.getRecent();
        for (const evt of recent) {
          if (filterTenantId && evt.tenantId !== filterTenantId) continue;
          if (filterLinkId && evt.linkId !== filterLinkId) continue;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(evt)}\n\n`)
          );
        }
      }

      // Subscribe to new events
      const unsub = liveEvents.subscribe((evt: LiveEvent) => {
        if (filterTenantId && evt.tenantId !== filterTenantId) return;
        if (filterLinkId && evt.linkId !== filterLinkId) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(evt)}\n\n`)
          );
        } catch {
          // Stream closed by client
          unsub();
        }
      });

      // Keep-alive ping every 30s to prevent proxy/browser timeouts
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
          unsub();
        }
      }, 30_000);

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

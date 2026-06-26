import { NextRequest, NextResponse } from 'next/server';
import { liveEvents } from '@/lib/services/live-events';

/**
 * DELETE /api/v1/analytics/live-stream/clear
 *
 * Clears the server-side event ring buffer so that
 * new SSE connections don't replay old events.
 */
export async function DELETE(request: NextRequest) {
  liveEvents.clearBuffer();

  const res = NextResponse.json({ success: true, message: 'Buffer cleared' });
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

/** Handle CORS preflight */
export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

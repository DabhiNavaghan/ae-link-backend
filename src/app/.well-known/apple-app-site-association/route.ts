import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import AppModel from '@/lib/models/App';
import { getAppByHost } from '@/lib/utils/domain-map.server';
import { PLATFORM_HOSTS, normalizeHost } from '@/lib/utils/domain-map';
import { cacheHeaderForHost } from '@/lib/utils/asset-links';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'aasa' });

export const dynamic = 'force-dynamic';

/**
 * GET /.well-known/apple-app-site-association
 *
 * Serves Apple App Site Association for Universal Links.
 * Per-host: returns only the app mapped to the requesting subdomain.
 * The platform host returns all apps (legacy — scheduled for scoping).
 */
export async function GET() {
  try {
    await connectDB();
    // The Host header can carry a port or uppercase characters; either would
    // miss the host maps and silently serve an empty association file.
    const host = normalizeHost(headers().get('host') || '');

    if (PLATFORM_HOSTS.has(host)) {
      const apps = await AppModel.find({
        isActive: true,
        'ios.bundleId': { $exists: true, $ne: '' },
        'ios.teamId': { $exists: true, $ne: '' },
      }).lean();

      const details = apps.map((app) => ({
        appIDs: [`${app.ios!.teamId}.${app.ios!.bundleId}`],
        components: [
          { '/': '/.well-known/*', exclude: true },
          { '/': '/api/*', exclude: true },
          { '/': '/*', comment: 'All SmartLink paths' },
        ],
      }));

      return new NextResponse(JSON.stringify({ applinks: { details } }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': cacheHeaderForHost(host),
        },
      });
    }

    // App-specific host: return only that one app
    const app = await getAppByHost(host);

    if (!app || !app.ios?.bundleId || !app.ios?.teamId) {
      logger.warn({ host }, 'No iOS config for host, returning empty AASA');
      return new NextResponse(
        JSON.stringify({ applinks: { details: [] } }),
        {
          status: 200,
          headers: {
          'Content-Type': 'application/json',
          // Never let a transient failure get cached as "this app claims nothing".
          'Cache-Control': 'no-store',
        },
        }
      );
    }

    const aasa = {
      applinks: {
        details: [{
          appIDs: [`${app.ios.teamId}.${app.ios.bundleId}`],
          components: [
            { '/': '/.well-known/*', exclude: true },
            { '/': '/api/*', exclude: true },
            { '/': '/*', comment: 'All short codes on this host' },
          ],
        }],
      },
    };

    return new NextResponse(JSON.stringify(aasa), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': cacheHeaderForHost(host),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Internal error — returning empty AASA');
    return new NextResponse(
      JSON.stringify({ applinks: { details: [] } }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Never let a transient failure get cached as "this app claims nothing".
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

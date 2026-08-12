import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import AppModel from '@/lib/models/App';
import { getAppByHost } from '@/lib/utils/domain-map.server';
import { PLATFORM_HOSTS } from '@/lib/utils/domain-map';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'assetlinks.json' });

export const dynamic = 'force-dynamic';

/**
 * GET /.well-known/assetlinks.json
 *
 * Serves Android Digital Asset Links for App Links verification.
 * Per-host: returns only the app mapped to the requesting subdomain.
 * The platform host returns all apps (legacy — scheduled for scoping).
 */
export async function GET() {
  try {
    await connectDB();
    const host = headers().get('host') || '';

    if (PLATFORM_HOSTS.has(host)) {
      const apps = await AppModel.find({
        isActive: true,
        'android.package': { $exists: true, $ne: '' },
        'android.sha256': { $exists: true, $ne: '' },
      }).lean();

      const assetLinks = apps.map((app) => ({
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: app.android!.package,
          sha256_cert_fingerprints: [app.android!.sha256],
        },
      }));

      return new NextResponse(JSON.stringify(assetLinks), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    }

    // App-specific host: return only that one app
    const app = await getAppByHost(host);

    if (!app || !app.android?.package || !app.android?.sha256) {
      logger.warn({ host }, 'No Android config for host, returning empty array');
      return new NextResponse(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const assetLinks = [{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: app.android.package,
        sha256_cert_fingerprints: [app.android.sha256],
      },
    }];

    return new NextResponse(JSON.stringify(assetLinks), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Internal error — returning empty assetlinks');
    return new NextResponse(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

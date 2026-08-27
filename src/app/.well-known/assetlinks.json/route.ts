import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import AppModel from '@/lib/models/App';
import { getAppByHost } from '@/lib/utils/domain-map.server';
import { PLATFORM_HOSTS, isDebugLinkHost, normalizeHost } from '@/lib/utils/domain-map';
import {
  cacheHeaderForHost,
  fingerprintsForHost,
  relationsFor,
} from '@/lib/utils/asset-links';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'assetlinks.json' });

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    // The Host header can carry a port or uppercase characters; either would
    // miss the host maps and silently serve an empty association file.
    const host = normalizeHost(headers().get('host') || '');

    if (PLATFORM_HOSTS.has(host)) {
      const apps = await AppModel.find({
        isActive: true,
        'android.package': { $exists: true, $ne: '' },
        'android.sha256': { $exists: true, $ne: '' },
      }).lean();

      const assetLinks = apps
        .map((app) => ({
          relation: relationsFor(app.android),
          target: {
            namespace: 'android_app',
            package_name: app.android!.package,
            sha256_cert_fingerprints: fingerprintsForHost(host, app.android),
          },
        }))
        .filter((entry) => entry.target.sha256_cert_fingerprints.length > 0);

      return new NextResponse(JSON.stringify(assetLinks), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': cacheHeaderForHost(host),
        },
      });
    }

    // App-specific host: return only that one app
    const app = await getAppByHost(host);
    const fingerprints = fingerprintsForHost(host, app?.android);

    if (!app || !app.android?.package || fingerprints.length === 0) {
      logger.warn(
        { host, isDebugHost: isDebugLinkHost(host) },
        'No Android config for host, returning empty array'
      );
      return new NextResponse(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Never let a transient failure get cached as "this app claims nothing".
          'Cache-Control': 'no-store',
        },
      });
    }

    const assetLinks = [{
      relation: relationsFor(app.android),
      target: {
        namespace: 'android_app',
        package_name: app.android.package,
        sha256_cert_fingerprints: fingerprints,
      },
    }];

    return new NextResponse(JSON.stringify(assetLinks), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': cacheHeaderForHost(host),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Internal error — returning empty assetlinks');
    return new NextResponse(JSON.stringify([]), {
      status: 200,
      headers: {
          'Content-Type': 'application/json',
          // Never let a transient failure get cached as "this app claims nothing".
          'Cache-Control': 'no-store',
        },
    });
  }
}

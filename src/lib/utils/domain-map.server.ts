import AppModel from '@/lib/models/App';
import { APP_HOST_MAP } from '@/lib/utils/domain-map';

export interface HostApp {
  _id: string;
  name: string;
  android?: { package?: string; sha256?: string; storeUrl?: string };
  ios?: { bundleId?: string; teamId?: string; appId?: string; storeUrl?: string };
}

/**
 * Resolve an inbound Host header to the app it represents (or null).
 * Used by well-known routes to scope association files to one app.
 * Server-only — relies on Mongoose, cannot run in Edge middleware.
 */
export async function getAppByHost(host: string): Promise<HostApp | null> {
  const appId = APP_HOST_MAP[host];
  if (!appId) return null;
  try {
    const doc = await AppModel.findById(appId).lean();
    if (!doc) return null;
    return {
      _id: doc._id.toString(),
      name: doc.name,
      android: doc.android ? {
        package: doc.android.package,
        sha256: doc.android.sha256,
        storeUrl: doc.android.storeUrl,
      } : undefined,
      ios: doc.ios ? {
        bundleId: doc.ios.bundleId,
        teamId: doc.ios.teamId,
        appId: doc.ios.appId,
        storeUrl: doc.ios.storeUrl,
      } : undefined,
    };
  } catch {
    return null;
  }
}

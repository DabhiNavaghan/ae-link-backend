import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AppModel from '@/lib/models/App';

/**
 * GET /.well-known/assetlinks.json
 *
 * Serves Android Digital Asset Links for App Links verification.
 * Dynamically generates from all registered apps with Android config.
 * This tells Android that our domain is authorized to open these apps.
 */
export async function GET() {
  try {
    await connectDB();

    // Get all active apps with Android package + SHA256 configured
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
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    // Return empty array on error — don't break App Links verification
    return new NextResponse(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

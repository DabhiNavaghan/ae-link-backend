import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AppModel from '@/lib/models/App';

/**
 * GET /.well-known/apple-app-site-association
 *
 * Serves Apple App Site Association for Universal Links.
 * Dynamically generates from all registered apps with iOS config.
 * Uses the modern "components" format (Apple 2022+).
 */
export async function GET() {
  try {
    await connectDB();

    // Get all active apps with iOS bundleId + teamId configured
    const apps = await AppModel.find({
      isActive: true,
      'ios.bundleId': { $exists: true, $ne: '' },
      'ios.teamId': { $exists: true, $ne: '' },
    }).lean();

    const details = apps.map((app) => ({
      appIDs: [`${app.ios!.teamId}.${app.ios!.bundleId}`],
      components: [
        {
          '/': '/*',
          comment: 'Match all SmartLink paths',
        },
      ],
    }));

    const aasa = {
      applinks: {
        details,
      },
    };

    return new NextResponse(JSON.stringify(aasa), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    // Return valid but empty AASA on error
    return new NextResponse(
      JSON.stringify({ applinks: { details: [] } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

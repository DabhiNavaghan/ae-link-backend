import { NextRequest, NextResponse } from 'next/server';
import { connectDB, getDBConnectionStatus } from '@/lib/mongodb';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'health' });

export async function GET(request: NextRequest) {
  try {
    // Ensure DB connection
    await connectDB();

    const status = getDBConnectionStatus();

    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error: String(error) }, 'Health check failed');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNHEALTHY',
          message: 'Service health check failed',
        },
      },
      { status: 503 }
    );
  }
}

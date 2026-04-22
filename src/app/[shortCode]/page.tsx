import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import LinkService from '@/lib/services/link.service';
import ClickModel from '@/lib/models/Click';
import TenantModel from '@/lib/models/Tenant';
import { DeviceDetector } from '@/lib/services/device-detector';
import { Logger } from '@/lib/logger';
import RedirectPage from '@/components/RedirectPage';

const logger = Logger.child({ page: 'redirect' });

interface Params {
  shortCode: string;
}

/**
 * Resolve short link and perform server-side click recording
 */
export default async function ResolvePage({ params }: { params: Params }) {
  try {
    await connectDB();

    const { shortCode } = params;

    // Resolve link by short code
    const link = await LinkService.getLinkByShortCode(shortCode);

    if (!link) {
      logger.warn({ shortCode }, 'Link not found');
      notFound();
    }

    // Get real request headers
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || '';
    const referer = headersList.get('referer') || '';
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';

    // Detect device
    const detector = new DeviceDetector(userAgent);
    const deviceInfo = detector.detect();
    const isMobile = detector.isMobile();

    // Get tenant for store URLs
    const tenant = await TenantModel.findById(link.tenantId).lean();
    const storeUrls = {
      android: tenant?.app?.android?.storeUrl || 'https://play.google.com/store/apps/details?id=com.amitech.allevents',
      ios: tenant?.app?.ios?.storeUrl || 'https://apps.apple.com/app/id488116646',
    };

    // Record click
    let clickId: string | undefined = undefined;
    try {
      const click = new ClickModel({
        linkId: link._id,
        tenantId: link.tenantId,
        ipAddress: ip,
        userAgent: userAgent,
        referer: referer,
        device: deviceInfo,
        geo: {},
        isAppInstalled: false,
        actionTaken: isMobile ? 'app_opened' : 'web_fallback',
      });

      await click.save();
      clickId = click._id.toString();

      // Increment link click count
      await LinkService.incrementClickCount(link._id.toString());

      logger.info(
        {
          linkId: link._id,
          shortCode,
          clickId,
          deviceOS: deviceInfo.os,
        },
        'Click recorded'
      );
    } catch (err) {
      logger.error({ error: err }, 'Click recording failed');
    }

    // Serialize link for client component
    const linkData = link.toObject ? link.toObject() : (link as any);

    return (
      <RedirectPage
        shortCode={shortCode}
        linkId={link._id.toString()}
        link={{
          destinationUrl: linkData.destinationUrl,
          params: linkData.params,
          platformOverrides: linkData.platformOverrides,
        }}
        deviceOS={deviceInfo.os}
        tenantId={link.tenantId.toString()}
        clickId={clickId}
        storeUrls={storeUrls}
      />
    );
  } catch (error) {
    logger.error({ error, shortCode: params.shortCode }, 'Resolve page error');
    notFound();
  }
}

/**
 * Generate metadata for the link (OG tags for sharing)
 */
export async function generateMetadata({ params }: { params: Params }) {
  try {
    await connectDB();

    const link = await LinkService.getLinkByShortCode(params.shortCode);

    if (!link) {
      return {
        title: 'AllEvents',
        description: 'Opening link...',
      };
    }

    const title = `AllEvents - ${link.params?.eventId || 'Link'}`;
    const description = link.params?.action || 'Opening link';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        url: `https://ae-link.allevents.app/${params.shortCode}`,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Generate metadata error');

    return {
      title: 'AllEvents',
      description: 'Opening link...',
    };
  }
}

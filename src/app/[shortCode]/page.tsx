import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import LinkService from '@/lib/services/link.service';
import ClickModel from '@/lib/models/Click';
import TenantModel from '@/lib/models/Tenant';
import AppModel from '@/lib/models/App';
import { DeviceDetector } from '@/lib/services/device-detector';
import { Logger } from '@/lib/logger';
import RedirectPage from '@/components/RedirectPage';
import { ClickChannel } from '@/types';

/**
 * Auto-detect channel from referer URL and UTM params
 */
function detectChannel(referer: string, utmSource?: string, utmMedium?: string): ClickChannel {
  const ref = (referer || '').toLowerCase();
  const src = (utmSource || '').toLowerCase();
  const med = (utmMedium || '').toLowerCase();

  // UTM source takes priority
  if (src.includes('whatsapp') || med === 'whatsapp') return 'whatsapp';
  if (src.includes('email') || med === 'email') return 'email';
  if (src === 'qr' || med === 'qr') return 'qr';
  if (src.includes('instagram') || src === 'ig') return 'instagram';
  if (src.includes('sms') || med === 'sms') return 'sms';
  if (src.includes('push') || med === 'push') return 'push';
  if (src.includes('facebook') || src === 'fb') return 'facebook';
  if (src.includes('twitter') || src === 'x.com') return 'twitter';
  if (src.includes('tiktok')) return 'tiktok';
  if (src.includes('youtube') || src === 'yt') return 'youtube';

  // Fallback to referer detection
  if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'whatsapp';
  if (ref.includes('mail.google') || ref.includes('outlook') || ref.includes('yahoo.com/mail')) return 'email';
  if (ref.includes('instagram.com') || ref.includes('l.instagram')) return 'instagram';
  if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('l.facebook')) return 'facebook';
  if (ref.includes('twitter.com') || ref.includes('t.co') || ref.includes('x.com')) return 'twitter';
  if (ref.includes('tiktok.com')) return 'tiktok';
  if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'youtube';

  // If there's a referer but we couldn't match it, it's web
  if (ref && ref.length > 0) return 'web';

  return 'direct';
}

const logger = Logger.child({ page: 'redirect' });

interface Params {
  shortCode: string;
}

// Paths that must never be treated as short codes.
// Browsers request these automatically on every page load.
const SYSTEM_PATHS = new Set([
  'favicon.ico',
  'favicon.png',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'sw.js',
  'service-worker.js',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
]);

const STATIC_EXTENSIONS = /\.(ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|woff|woff2|ttf|eot|map|txt|xml|json)$/i;

/**
 * Resolve short link and perform server-side click recording
 */
export default async function ResolvePage({ params }: { params: Params }) {
  try {
    const { shortCode } = params;

    // Immediately reject known system/static asset paths — do not query DB.
    if (SYSTEM_PATHS.has(shortCode) || STATIC_EXTENSIONS.test(shortCode)) {
      notFound();
    }

    await connectDB();

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

    // Get store URLs — prefer App model if link has appId, fallback to tenant config
    const tenant = await TenantModel.findById(link.tenantId).lean();
    let storeUrls = {
      android: 'https://play.google.com/store/apps/details?id=com.amitech.allevents',
      ios: 'https://apps.apple.com/app/id488116646',
    };

    // If link references a specific App, use its store URLs
    const linkObj = link.toObject ? link.toObject() : (link as any);
    if (linkObj.appId) {
      const app = await AppModel.findById(linkObj.appId).lean();
      if (app) {
        storeUrls = {
          android: app.android?.storeUrl || storeUrls.android,
          ios: app.ios?.storeUrl || storeUrls.ios,
        };
      }
    } else if (tenant?.app) {
      // Legacy: fallback to tenant-level app config
      storeUrls = {
        android: tenant.app.android?.storeUrl || storeUrls.android,
        ios: tenant.app.ios?.storeUrl || storeUrls.ios,
      };
    }

    // Record click
    let clickId: string | undefined = undefined;
    try {
      // Detect channel from referer and link UTM params
      const linkParams = (link as any).params || {};
      const channel = detectChannel(
        referer,
        linkParams.utmSource,
        linkParams.utmMedium
      );

      const click = new ClickModel({
        linkId: link._id,
        tenantId: link.tenantId,
        ipAddress: ip,
        userAgent: userAgent,
        referer: referer,
        channel,
        device: deviceInfo,
        geo: {},
        isAppInstalled: false,
        actionTaken: isMobile ? 'store_redirect' : 'web_fallback',
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
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://smartlink.vercel.app'}/${params.shortCode}`,
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
